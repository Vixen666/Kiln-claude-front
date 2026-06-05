from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Kiln
from app.schemas import KilnCreate, KilnUpdate, KilnOut
from typing import List
from datetime import datetime

router = APIRouter(prefix="/api/kilns", tags=["kilns"])


@router.get("/", response_model=List[KilnOut])
def list_kilns(db: Session = Depends(get_db)):
    return db.query(Kiln).order_by(Kiln.name).all()


@router.post("/", response_model=KilnOut, status_code=201)
def create_kiln(data: KilnCreate, db: Session = Depends(get_db)):
    if db.query(Kiln).filter(Kiln.name == data.name).first():
        raise HTTPException(400, "Kiln name already exists")
    kiln = Kiln(**data.model_dump())
    db.add(kiln)
    db.commit()
    db.refresh(kiln)
    return kiln


@router.get("/{kiln_id}", response_model=KilnOut)
def get_kiln(kiln_id: int, db: Session = Depends(get_db)):
    kiln = db.get(Kiln, kiln_id)
    if not kiln:
        raise HTTPException(404, "Kiln not found")
    return kiln


@router.put("/{kiln_id}", response_model=KilnOut)
def update_kiln(kiln_id: int, data: KilnUpdate, db: Session = Depends(get_db)):
    kiln = db.get(Kiln, kiln_id)
    if not kiln:
        raise HTTPException(404, "Kiln not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(kiln, k, v)
    kiln.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(kiln)
    return kiln


@router.delete("/{kiln_id}", status_code=204)
def delete_kiln(kiln_id: int, db: Session = Depends(get_db)):
    kiln = db.get(Kiln, kiln_id)
    if not kiln:
        raise HTTPException(404, "Kiln not found")
    db.delete(kiln)
    db.commit()
