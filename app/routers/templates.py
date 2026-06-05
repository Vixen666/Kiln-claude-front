from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Template, TemplateCurveSegment
from app.schemas import TemplateCreate, TemplateUpdate, TemplateOut
from typing import List
from datetime import datetime

router = APIRouter(prefix="/api/templates", tags=["templates"])


def _sync_segments(db, template, segments_data):
    """Replace all segments on a template."""
    for seg in template.segments:
        db.delete(seg)
    db.flush()
    for s in segments_data:
        seg = TemplateCurveSegment(template_id=template.id, **s.model_dump())
        db.add(seg)


@router.get("/", response_model=List[TemplateOut])
def list_templates(db: Session = Depends(get_db)):
    return db.query(Template).order_by(Template.name).all()


@router.post("/", response_model=TemplateOut, status_code=201)
def create_template(data: TemplateCreate, db: Session = Depends(get_db)):
    if db.query(Template).filter(Template.name == data.name).first():
        raise HTTPException(400, "Template name already exists")
    segments = data.segments
    payload = data.model_dump(exclude={"segments"})
    template = Template(**payload)
    db.add(template)
    db.flush()
    for s in segments:
        seg = TemplateCurveSegment(template_id=template.id, **s.model_dump())
        db.add(seg)
    db.commit()
    db.refresh(template)
    return template


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db)):
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "Template not found")
    return t


@router.put("/{template_id}", response_model=TemplateOut)
def update_template(template_id: int, data: TemplateUpdate, db: Session = Depends(get_db)):
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "Template not found")
    update_data = data.model_dump(exclude_unset=True)
    segments_data = update_data.pop("segments", None)
    for k, v in update_data.items():
        setattr(t, k, v)
    t.updated_at = datetime.utcnow()
    if segments_data is not None:
        _sync_segments(db, t, data.segments)
    db.commit()
    db.refresh(t)
    return t


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "Template not found")
    db.delete(t)
    db.commit()
