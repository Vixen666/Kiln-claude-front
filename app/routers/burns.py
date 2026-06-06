from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Burn, BurnLog, BurnRecipe, BurnTempAlert, BurnStatus, Kiln, Template, Settings, TemplateCurveSegment
from app.schemas import BurnCreate, BurnUpdate, BurnOut, BurnSummaryOut, BurnLogCreate, BurnLogOut, BurnRecipeCreate, BurnRecipeOut, BurnTempAlertCreate, BurnTempAlertUpdate, BurnTempAlertOut
from app.notifications import send_notifications
from typing import List
from datetime import datetime
import asyncio

router = APIRouter(prefix="/api/burns", tags=["burns"])


@router.get("/", response_model=List[BurnSummaryOut])
def list_burns(db: Session = Depends(get_db)):
    return db.query(Burn).order_by(Burn.created_at.desc()).all()


@router.post("/", response_model=BurnSummaryOut, status_code=201)
def create_burn(data: BurnCreate, db: Session = Depends(get_db)):
    kiln = db.get(Kiln, data.kiln_id)
    if not kiln:
        raise HTTPException(404, "Kiln not found")
    if not db.get(Template, data.template_id):
        raise HTTPException(404, "Template not found")
    burn = Burn(**data.model_dump())
    db.add(burn)
    db.commit()
    db.refresh(burn)
    return burn


@router.get("/{burn_id}", response_model=BurnOut)
def get_burn(burn_id: int, db: Session = Depends(get_db)):
    b = db.get(Burn, burn_id)
    if not b:
        raise HTTPException(404, "Burn not found")
    return b


@router.put("/{burn_id}", response_model=BurnSummaryOut)
def update_burn(burn_id: int, data: BurnUpdate, db: Session = Depends(get_db)):
    b = db.get(Burn, burn_id)
    if not b:
        raise HTTPException(404, "Burn not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(b, k, v)
    db.commit()
    db.refresh(b)
    return b


@router.post("/{burn_id}/start", response_model=BurnSummaryOut)
def start_burn(burn_id: int, test_data: bool = False,
               db: Session = Depends(get_db)):
    b = db.get(Burn, burn_id)
    if not b:
        raise HTTPException(404, "Burn not found")
    if b.status != BurnStatus.PENDING:
        raise HTTPException(400, f"Cannot start a burn with status '{b.status}'")
    kiln = db.get(Kiln, b.kiln_id)
    b.status = BurnStatus.RUNNING
    b.started_at = datetime.utcnow()
    b.pid_kp_used = kiln.pid_kp
    b.pid_ki_used = kiln.pid_ki
    b.pid_kd_used = kiln.pid_kd
    db.commit()

    if test_data:
        _generate_test_logs(db, b)
        b.status = BurnStatus.COMPLETED
        b.completed_at = datetime.utcnow()
        db.commit()

    db.refresh(b)
    return b


def _generate_test_logs(db, burn):
    """
    Generate realistic simulated log entries (1 per second) based on the
    burn's template segments. Adds ±1°C noise and junk PID values.
    """
    import random, math

    segs = db.query(TemplateCurveSegment)             .filter(TemplateCurveSegment.template_id == burn.template_id)             .order_by(TemplateCurveSegment.position).all()

    if not segs:
        # Fallback: simple 2h ramp to 1000°C then cool
        segs_data = [
            (20, 1000, 60),   # ramp
            (1000, 1000, 30), # hold
            (1000, 50,  30),  # cool
        ]
    else:
        segs_data = []
        for s in segs:
            segs_data.append((s.start_temp, s.end_temp, s.duration_minutes))
            if s.hold_minutes > 0:
                segs_data.append((s.end_temp, s.end_temp, s.hold_minutes))

    # Build second-by-second target curve
    entries = []
    elapsed_s = 0

    for seg_idx, (t_start, t_end, dur_min) in enumerate(segs_data):
        total_s = int(dur_min * 60)
        for s in range(total_s):
            frac   = s / max(total_s - 1, 1)
            target = t_start + (t_end - t_start) * frac
            noise  = random.gauss(0, 0.8)
            actual = target + noise

            elapsed_min = elapsed_s / 60.0
            p = random.uniform(0.1, 1.2)
            i = random.uniform(0.0, 0.3)
            d = random.uniform(-0.1, 0.1)
            duty = max(0, min(100, 50 + p * 10 + i * 5 + random.gauss(0, 3)))

            event = None
            if s == total_s - 1:
                event = f"segment_change:{seg_idx}"

            entries.append(BurnLog(
                burn_id         = burn.id,
                elapsed_minutes = elapsed_min,
                actual_temp     = round(actual, 2),
                target_temp     = round(target, 2),
                duty_cycle      = round(duty, 2),
                pid_p           = round(p, 4),
                pid_i           = round(i, 4),
                pid_d           = round(d, 4),
                event           = event,
            ))
            elapsed_s += 1

        elapsed_s += 1  # 1s gap between segments

    # Bulk insert in chunks to avoid huge transactions
    CHUNK = 500
    for i in range(0, len(entries), CHUNK):
        db.bulk_save_objects(entries[i:i+CHUNK])
        db.flush()
    db.commit()


@router.post("/{burn_id}/complete", response_model=BurnSummaryOut)
def complete_burn(burn_id: int, db: Session = Depends(get_db)):
    b = db.get(Burn, burn_id)
    if not b:
        raise HTTPException(404, "Burn not found")
    if b.status != BurnStatus.RUNNING:
        raise HTTPException(400, "Burn is not running")
    b.status = BurnStatus.COMPLETED
    b.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(b)
    return b


@router.post("/{burn_id}/abort", response_model=BurnSummaryOut)
def abort_burn(burn_id: int, db: Session = Depends(get_db)):
    b = db.get(Burn, burn_id)
    if not b:
        raise HTTPException(404, "Burn not found")
    if b.status not in (BurnStatus.PENDING, BurnStatus.RUNNING):
        raise HTTPException(400, "Cannot abort this burn")
    b.status = BurnStatus.ABORTED
    b.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(b)
    return b


# ─── Log entries (written by PID controller) ──────────────────────────────────

@router.post("/{burn_id}/logs", response_model=BurnLogOut, status_code=201)
def add_log(burn_id: int, data: BurnLogCreate, db: Session = Depends(get_db)):
    b = db.get(Burn, burn_id)
    if not b:
        raise HTTPException(404, "Burn not found")

    # Get previous log entry to detect direction of travel
    prev = db.query(BurnLog).filter(BurnLog.burn_id == burn_id)             .order_by(BurnLog.timestamp.desc()).first()

    entry = BurnLog(burn_id=burn_id, **data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Segment-complete notifications
    if data.event and data.event.startswith("segment_change"):
        _maybe_notify_segment(db, b, data)

    # Temperature threshold alerts
    if prev is not None:
        _maybe_notify_temp(db, b, data, prev_temp=prev.actual_temp)

    return entry


def _maybe_notify_segment(db, burn, data: BurnLogCreate):
    """Check if the just-completed segment has notify_on_complete, fire if so."""
    try:
        # Find the segment that just finished — match by position via elapsed time
        # The PID controller should set event="segment_change" and include
        # the segment position in the event string as "segment_change:2" (optional).
        # Fallback: look up the segment whose end matches target_temp.
        segs = db.query(TemplateCurveSegment)\
                 .filter(TemplateCurveSegment.template_id == burn.template_id)\
                 .order_by(TemplateCurveSegment.position).all()

        # Try to parse segment index from event string "segment_change:N"
        seg = None
        if data.event and ":" in data.event:
            try:
                idx = int(data.event.split(":")[1])
                if 0 <= idx < len(segs):
                    seg = segs[idx]
            except (ValueError, IndexError):
                pass

        # Fallback: find segment whose end_temp matches target_temp
        if seg is None:
            for s in segs:
                if abs(s.end_temp - data.target_temp) < 2:
                    seg = s
                    break

        if seg and seg.notify_on_complete:
            settings = db.get(Settings, 1)
            if settings:
                asyncio.create_task(send_notifications(
                    settings,
                    burn_name=burn.name,
                    segment_label=seg.label or f"Segment {seg.position + 1}",
                    actual_temp=data.actual_temp,
                    elapsed_minutes=data.elapsed_minutes,
                ))
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Notification trigger error: %s", e)


@router.get("/{burn_id}/logs", response_model=List[BurnLogOut])
def get_logs(
    burn_id:  int,
    page:     int   = 1,
    limit:    int   = 100,
    after_id: int   = None,
    from_min: float = None,
    to_min:   float = None,
    order:    str   = "desc",
    db: Session = Depends(get_db),
):
    """
    Paginated log endpoint.
    - page / limit        : paginate full log table (newest first by default)
    - after_id            : return only rows with id > after_id (for live polling)
    - from_min / to_min   : filter by elapsed_minutes range
    - order               : "asc" | "desc"
    """
    if not db.get(Burn, burn_id):
        raise HTTPException(404, "Burn not found")

    q = db.query(BurnLog).filter(BurnLog.burn_id == burn_id)

    if after_id is not None:
        q = q.filter(BurnLog.id > after_id)
    if from_min is not None:
        q = q.filter(BurnLog.elapsed_minutes >= from_min)
    if to_min is not None:
        q = q.filter(BurnLog.elapsed_minutes <= to_min)

    sort_col = BurnLog.elapsed_minutes.asc() if order == "asc" else BurnLog.elapsed_minutes.desc()
    q = q.order_by(sort_col)

    total = q.count()
    rows  = q.offset((page - 1) * limit).limit(limit).all()

    # Always return ascending for the caller even if we paginated desc
    if order == "desc":
        rows = list(reversed(rows))

    return rows


@router.get("/{burn_id}/logs/chart")
def get_chart_data(
    burn_id:    int,
    from_min:   float = None,
    to_min:     float = None,
    max_points: int   = 500,
    db: Session = Depends(get_db),
):
    """
    Downsampled log data for chart rendering.
    Returns at most max_points rows evenly sampled across the time window.
    Also returns the total count and time range for zoom context.
    """
    if not db.get(Burn, burn_id):
        raise HTTPException(404, "Burn not found")

    q = db.query(BurnLog).filter(BurnLog.burn_id == burn_id)
    if from_min is not None:
        q = q.filter(BurnLog.elapsed_minutes >= from_min)
    if to_min is not None:
        q = q.filter(BurnLog.elapsed_minutes <= to_min)

    total = q.count()

    if total == 0:
        return {"total": 0, "from_min": from_min, "to_min": to_min, "points": []}

    # Pick every Nth row to get ~max_points
    step = max(1, total // max_points)

    # Use row_number trick: fetch all IDs, then pick every Nth
    ids = [row.id for row in q.order_by(BurnLog.elapsed_minutes.asc())
                               .with_entities(BurnLog.id).all()]
    sampled_ids = ids[::step]

    rows = db.query(BurnLog).filter(BurnLog.id.in_(sampled_ids))             .order_by(BurnLog.elapsed_minutes.asc()).all()

    # Always include first and last point for accurate range
    first = q.order_by(BurnLog.elapsed_minutes.asc()).first()
    last  = q.order_by(BurnLog.elapsed_minutes.desc()).first()
    id_set = {r.id for r in rows}
    if first and first.id not in id_set:
        rows = [first] + rows
    if last and last.id not in id_set:
        rows = rows + [last]

    return {
        "total":    total,
        "sampled":  len(rows),
        "step":     step,
        "from_min": rows[0].elapsed_minutes  if rows else None,
        "to_min":   rows[-1].elapsed_minutes if rows else None,
        "points": [
            {
                "id":               r.id,
                "elapsed_minutes":  r.elapsed_minutes,
                "actual_temp":      r.actual_temp,
                "target_temp":      r.target_temp,
                "duty_cycle":       r.duty_cycle,
                "event":            r.event,
            }
            for r in rows
        ],
    }


@router.get("/{burn_id}/logs/latest")
def get_latest_logs(
    burn_id:  int,
    after_id: int = 0,
    db: Session = Depends(get_db),
):
    """Return all log rows with id > after_id. Used for live polling."""
    if not db.get(Burn, burn_id):
        raise HTTPException(404, "Burn not found")
    rows = db.query(BurnLog)             .filter(BurnLog.burn_id == burn_id, BurnLog.id > after_id)             .order_by(BurnLog.elapsed_minutes.asc()).all()
    return {"rows": rows, "count": len(rows)}


@router.delete("/{burn_id}", status_code=204)
def delete_burn(burn_id: int, db: Session = Depends(get_db)):
    b = db.get(Burn, burn_id)
    if not b:
        raise HTTPException(404, "Burn not found")
    db.delete(b)
    db.commit()

# ─── Recipes attached to a burn ───────────────────────────────────────────────

@router.get("/{burn_id}/recipes", response_model=List[BurnRecipeOut])
def get_burn_recipes(burn_id: int, db: Session = Depends(get_db)):
    if not db.get(Burn, burn_id):
        raise HTTPException(404, "Burn not found")
    return db.query(BurnRecipe).filter(BurnRecipe.burn_id == burn_id).all()


@router.post("/{burn_id}/recipes", response_model=BurnRecipeOut, status_code=201)
def add_burn_recipe(burn_id: int, data: BurnRecipeCreate, db: Session = Depends(get_db)):
    if not db.get(Burn, burn_id):
        raise HTTPException(404, "Burn not found")
    br = BurnRecipe(burn_id=burn_id, **data.model_dump())
    db.add(br); db.commit(); db.refresh(br)
    return br


@router.delete("/{burn_id}/recipes/{burn_recipe_id}", status_code=204)
def remove_burn_recipe(burn_id: int, burn_recipe_id: int, db: Session = Depends(get_db)):
    br = db.query(BurnRecipe).filter(
        BurnRecipe.id == burn_recipe_id,
        BurnRecipe.burn_id == burn_id
    ).first()
    if not br:
        raise HTTPException(404, "Not found")
    db.delete(br); db.commit()


# ─── Temperature alerts ────────────────────────────────────────────────────────

@router.get("/{burn_id}/alerts", response_model=List[BurnTempAlertOut])
def get_alerts(burn_id: int, db: Session = Depends(get_db)):
    if not db.get(Burn, burn_id):
        raise HTTPException(404, "Burn not found")
    return db.query(BurnTempAlert).filter(BurnTempAlert.burn_id == burn_id)\
             .order_by(BurnTempAlert.temperature).all()


@router.post("/{burn_id}/alerts", response_model=BurnTempAlertOut, status_code=201)
def create_alert(burn_id: int, data: BurnTempAlertCreate, db: Session = Depends(get_db)):
    if not db.get(Burn, burn_id):
        raise HTTPException(404, "Burn not found")
    alert = BurnTempAlert(burn_id=burn_id, **data.model_dump())
    db.add(alert); db.commit(); db.refresh(alert)
    return alert


@router.put("/{burn_id}/alerts/{alert_id}", response_model=BurnTempAlertOut)
def update_alert(burn_id: int, alert_id: int, data: BurnTempAlertUpdate,
                 db: Session = Depends(get_db)):
    alert = db.query(BurnTempAlert).filter(
        BurnTempAlert.id == alert_id, BurnTempAlert.burn_id == burn_id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(alert, k, v)
    db.commit(); db.refresh(alert)
    return alert


@router.delete("/{burn_id}/alerts/{alert_id}", status_code=204)
def delete_alert(burn_id: int, alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(BurnTempAlert).filter(
        BurnTempAlert.id == alert_id, BurnTempAlert.burn_id == burn_id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")
    db.delete(alert); db.commit()


def _maybe_notify_temp(db, burn, data: BurnLogCreate, prev_temp: float):
    """
    Check all unfired temp alerts for this burn.
    An alert fires when actual_temp crosses the threshold in the specified direction,
    optionally only within a given segment.
    """
    try:
        alerts = db.query(BurnTempAlert).filter(
            BurnTempAlert.burn_id == burn.id,
            BurnTempAlert.fired == False,
        ).all()

        if not alerts:
            return

        curr = data.actual_temp

        # Determine current segment index from event or log count
        current_seg_idx = None
        if data.event and data.event.startswith("segment_change:"):
            try:
                current_seg_idx = int(data.event.split(":")[1])
            except (ValueError, IndexError):
                pass

        settings = db.get(Settings, 1)
        to_fire = []

        for alert in alerts:
            threshold = alert.temperature

            # Check direction crossing
            if alert.direction == "rising":
                crossed = prev_temp < threshold <= curr
            else:  # falling
                crossed = prev_temp > threshold >= curr

            if not crossed:
                continue

            # Check segment constraint if set
            if alert.segment_index is not None and current_seg_idx is not None:
                if alert.segment_index != current_seg_idx:
                    continue

            # Mark as fired
            alert.fired = True
            alert.fired_at = datetime.utcnow()
            to_fire.append(alert)

        if to_fire:
            db.commit()
            if settings:
                for alert in to_fire:
                    direction_word = "↑ rising" if alert.direction == "rising" else "↓ falling"
                    label = alert.label or f"{alert.temperature}°C {direction_word}"
                    asyncio.create_task(send_notifications(
                        settings,
                        burn_name=burn.name,
                        segment_label=f"Temp alert: {label}",
                        actual_temp=curr,
                        elapsed_minutes=data.elapsed_minutes,
                    ))
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Temp alert error: %s", e)
