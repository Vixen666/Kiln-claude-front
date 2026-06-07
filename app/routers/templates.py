from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Template, TemplateCurveSegment, Burn
from app.schemas import TemplateCreate, TemplateUpdate, TemplateOut, TemplateRevisionOut
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/api/templates", tags=["templates"])


def _sync_segments(db, template, segments_data):
    for seg in template.segments:
        db.delete(seg)
    db.flush()
    for s in segments_data:
        seg = TemplateCurveSegment(template_id=template.id, **s.model_dump())
        db.add(seg)


def _is_in_use(db, template_id: int) -> bool:
    return db.query(Burn).filter(Burn.template_id == template_id).first() is not None


# ── List — latest revision per base ──────────────────────────

@router.get("/", response_model=List[TemplateOut])
def list_templates(db: Session = Depends(get_db)):
    """Return the latest revision of each template base."""
    # Get max revision per base_id
    latest = db.query(
        func.max(Template.revision).label("max_rev"),
        Template.base_id
    ).group_by(Template.base_id).subquery()

    templates = db.query(Template).join(
        latest,
        (Template.base_id == latest.c.base_id) &
        (Template.revision == latest.c.max_rev)
    ).order_by(Template.name).all()

    return templates


# ── Revisions for a base ──────────────────────────────────────

@router.get("/{template_id}/revisions", response_model=List[TemplateRevisionOut])
def list_revisions(template_id: int, db: Session = Depends(get_db)):
    """Return all revisions of the base that template_id belongs to."""
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


# ── Create (first revision) ───────────────────────────────────

@router.post("/", response_model=TemplateOut, status_code=201)
def create_template(data: TemplateCreate, db: Session = Depends(get_db)):
    segments = data.segments
    payload  = data.model_dump(exclude={"segments"})
    t = Template(**payload, revision=1)
    db.add(t); db.flush()
    t.base_id = t.id   # self-referencing for first revision
    for s in segments:
        seg = TemplateCurveSegment(template_id=t.id, **s.model_dump())
        db.add(seg)
    db.commit(); db.refresh(t)
    return t


# ── Get a specific revision ───────────────────────────────────

@router.get("/{template_id}", response_model=TemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db)):
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "Template not found")
    return t


# ── Save as new revision ──────────────────────────────────────

@router.put("/{template_id}", response_model=TemplateOut)
def update_template(template_id: int, data: TemplateUpdate, db: Session = Depends(get_db)):
    """Creates a new revision rather than editing in place."""
    existing = db.get(Template, template_id)
    if not existing:
        raise HTTPException(404, "Template not found")

    base_id = existing.base_id or existing.id

    # Find highest revision for this base
    max_rev = db.query(func.max(Template.revision))\
                .filter(Template.base_id == base_id).scalar() or 1

    update_data = data.model_dump(exclude_unset=True)
    segments_data = update_data.pop("segments", None)

    # Copy existing fields, apply updates
    new_t = Template(
        base_id     = base_id,
        revision    = max_rev + 1,
        name        = update_data.get("name",            existing.name),
        description = update_data.get("description",     existing.description),
        target_material = update_data.get("target_material", existing.target_material),
        cone        = update_data.get("cone",            existing.cone),
        notes       = update_data.get("notes",           existing.notes),
    )
    db.add(new_t); db.flush()

    # Copy or update segments
    source_segs = segments_data if segments_data is not None else [
        TemplateCreate.model_validate(s).__dict__ for s in existing.segments
    ]
    if segments_data is not None:
        for s in data.segments:
            seg = TemplateCurveSegment(template_id=new_t.id, **s.model_dump())
            db.add(seg)
    else:
        for s in existing.segments:
            seg = TemplateCurveSegment(
                template_id        = new_t.id,
                position           = s.position,
                label              = s.label,
                segment_type       = s.segment_type,
                start_temp         = s.start_temp,
                end_temp           = s.end_temp,
                duration_minutes   = s.duration_minutes,
                hold_minutes       = s.hold_minutes,
                notify_on_complete = s.notify_on_complete,
            )
            db.add(seg)

    db.commit(); db.refresh(new_t)
    return new_t


# ── Delete a specific revision ────────────────────────────────

@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "Template not found")
    if _is_in_use(db, template_id):
        raise HTTPException(400, "Cannot delete — burns are using this revision")
    db.delete(t); db.commit()
