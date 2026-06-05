from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Element
from app.schemas import ElementCreate, ElementUpdate, ElementOut
from typing import List
from datetime import datetime

router = APIRouter(prefix="/api/elements", tags=["elements"])


@router.get("/", response_model=List[ElementOut])
def list_elements(db: Session = Depends(get_db)):
    return db.query(Element).order_by(Element.name).all()


@router.post("/", response_model=ElementOut, status_code=201)
def create_element(data: ElementCreate, db: Session = Depends(get_db)):
    if db.query(Element).filter(Element.name == data.name).first():
        raise HTTPException(400, "Element name already exists")
    el = Element(**data.model_dump())
    db.add(el); db.commit(); db.refresh(el)
    return el


@router.get("/{element_id}", response_model=ElementOut)
def get_element(element_id: int, db: Session = Depends(get_db)):
    el = db.get(Element, element_id)
    if not el:
        raise HTTPException(404, "Element not found")
    return el


@router.put("/{element_id}", response_model=ElementOut)
def update_element(element_id: int, data: ElementUpdate, db: Session = Depends(get_db)):
    el = db.get(Element, element_id)
    if not el:
        raise HTTPException(404, "Element not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(el, k, v)
    el.updated_at = datetime.utcnow()
    db.commit(); db.refresh(el)
    return el


@router.delete("/{element_id}", status_code=204)
def delete_element(element_id: int, db: Session = Depends(get_db)):
    el = db.get(Element, element_id)
    if not el:
        raise HTTPException(404, "Element not found")
    db.delete(el); db.commit()
