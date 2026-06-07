from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.models import Template, TemplateCurveSegment, Burn
from app.schemas import TemplateCreate, TemplateUpdate, TemplateOut, TemplateRevisionOut
from typing import List

router = APIRouter(prefix="/api/templates", tags=["templates"])


def _load_template(db, template_id):
    return db.query(Template)\
             .options(joinedload(Template.segments))\
             .filter(Template.id == template_id).first()


def _is_in_use(db, template_id: int) -> bool:
    return db.query(Burn)\
             .filter(Burn.template_id == template_id).first() is not None


@router.get("/", response_model=List[TemplateOut])
def list_templates(db: Session = Depends(get_db)):
    latest = db.query(
        func.max(Template.revision).label("max_rev"),
        Template.base_id
    ).group_by(Template.base_id).subquery()

    ids = db.query(Template.id).join(
        latest,
        (Template.base_id == latest.c.base_id) &
        (Template.revision == latest.c.max_rev)
    ).all()
    id_list = [r.id for r in ids]

    return db.query(Template)\
             .options(joinedload(Template.segments))\
             .filter(Template.id.in_(id_list))\
             .order_by(Template.name).all()


@router.get("/{template_id}/revisions", response_model=List[TemplateRevisionOut])
def list_revisions(template_id: int, db: Session = Depends(get_db)):
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "Template not found")
    base_id = t.base_id or t.id
    revisions = db.query(Template)\
                  .filter(Template.base_id == base_id)\
                  .order_by(Template.revision.desc()).all()
    result = []
    for r in revisions:
        out = TemplateRevisionOut.model_validate(r)
        out.in_use = _is_in_use(db, r.id)
        result.append(out)
    return result


@router.get("/{template_id}/diff/{other_id}")
def diff_templates(template_id: int, other_id: int, db: Session = Depends(get_db)):
    """Structured diff between two template revisions."""
    a = _load_template(db, template_id)
    b = _load_template(db, other_id)
    if not a or not b:
        raise HTTPException(404, "Template not found")

    changes = []

    # Field changes
    for field, label in [("name","Namn"),("target_material","Material"),
                          ("cone","Kon"),("notes","Anteckningar")]:
        va, vb = getattr(a, field) or "", getattr(b, field) or ""
        if va != vb:
            changes.append({"type":"field","field":label,"from":va,"to":vb})

    # Segment changes — compare by position
    a_segs = {s.position: s for s in a.segments}
    b_segs = {s.position: s for s in b.segments}
    all_pos = sorted(set(a_segs) | set(b_segs))

    for pos in all_pos:
        sa, sb = a_segs.get(pos), b_segs.get(pos)
        label = (sa or sb).label or f"Segment {pos+1}"
        if sa and not sb:
            changes.append({"type":"segment","pos":pos,"label":label,
                            "change":"removed",
                            "detail":f"{sa.start_temp}→{sa.end_temp}°C, {sa.duration_minutes}min ramp, {sa.hold_minutes}min håll"})
        elif sb and not sa:
            changes.append({"type":"segment","pos":pos,"label":label,
                            "change":"added",
                            "detail":f"{sb.start_temp}→{sb.end_temp}°C, {sb.duration_minutes}min ramp, {sb.hold_minutes}min håll"})
        else:
            diffs = []
            if sa.start_temp != sb.start_temp:
                diffs.append(f"start {sa.start_temp}→{sb.start_temp}°C")
            if sa.end_temp != sb.end_temp:
                diffs.append(f"slut {sa.end_temp}→{sb.end_temp}°C")
            if sa.duration_minutes != sb.duration_minutes:
                diffs.append(f"ramp {sa.duration_minutes}→{sb.duration_minutes}min")
            if sa.hold_minutes != sb.hold_minutes:
                diffs.append(f"håll {sa.hold_minutes}→{sb.hold_minutes}min")
            if diffs:
                changes.append({"type":"segment","pos":pos,"label":label,
                                "change":"changed","detail":", ".join(diffs)})

    return {
        "from": {"id":a.id,"revision":a.revision,"name":a.name},
        "to":   {"id":b.id,"revision":b.revision,"name":b.name},
        "changes": changes,
    }


@router.post("/", response_model=TemplateOut, status_code=201)
def create_template(data: TemplateCreate, db: Session = Depends(get_db)):
    segments = data.segments
    payload  = data.model_dump(exclude={"segments"})
    t = Template(**payload, revision=1)
    db.add(t); db.flush()
    t.base_id = t.id
    for s in segments:
        db.add(TemplateCurveSegment(template_id=t.id, **s.model_dump()))
    db.commit()
    return _load_template(db, t.id)


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db)):
    t = _load_template(db, template_id)
    if not t:
        raise HTTPException(404, "Template not found")
    return t


@router.put("/{template_id}", response_model=TemplateOut)
def update_template(template_id: int, data: TemplateUpdate, db: Session = Depends(get_db)):
    existing = db.get(Template, template_id)
    if not existing:
        raise HTTPException(404, "Template not found")

    base_id = existing.base_id or existing.id
    # If base_id was never set (pre-migration row), fix it now
    if not existing.base_id:
        existing.base_id = existing.id
        db.flush()
    max_rev = db.query(func.max(Template.revision))                .filter(Template.base_id == base_id).scalar() or 1

    update_data   = data.model_dump(exclude_unset=True)
    segments_data = update_data.pop("segments", None)

    new_t = Template(
        base_id         = base_id,
        revision        = max_rev + 1,
        name            = update_data.get("name",            existing.name),
        description     = update_data.get("description",     existing.description),
        target_material = update_data.get("target_material", existing.target_material),
        cone            = update_data.get("cone",            existing.cone),
        notes           = update_data.get("notes",           existing.notes),
    )
    db.add(new_t); db.flush()

    # Use provided segments or copy from existing
    use_segs = segments_data if segments_data is not None else None
    if use_segs is not None:
        for s in use_segs:
            seg_obj = s if isinstance(s, dict) else s.model_dump()
            # Strip any id/template_id that came from existing data
            seg_obj.pop('id', None)
            seg_obj.pop('template_id', None)
            db.add(TemplateCurveSegment(template_id=new_t.id, **seg_obj))
    else:
        for s in (existing.segments or []):
            db.add(TemplateCurveSegment(
                template_id=new_t.id, position=s.position, label=s.label,
                segment_type=s.segment_type, start_temp=s.start_temp,
                end_temp=s.end_temp, duration_minutes=s.duration_minutes,
                hold_minutes=s.hold_minutes, notify_on_complete=s.notify_on_complete,
            ))

    db.commit()
    return _load_template(db, new_t.id)


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "Template not found")
    if _is_in_use(db, template_id):
        raise HTTPException(400, "Cannot delete — burns are using this revision")
    db.delete(t); db.commit()
