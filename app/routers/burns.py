from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Burn, BurnLog, BurnRecipe, BurnStatus, Kiln, Template
from app.schemas import BurnCreate, BurnUpdate, BurnOut, BurnSummaryOut, BurnLogCreate, BurnLogOut, BurnRecipeCreate, BurnRecipeOut
from typing import List
from datetime import datetime

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
def start_burn(burn_id: int, db: Session = Depends(get_db)):
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
    db.refresh(b)
    return b


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
    entry = BurnLog(burn_id=burn_id, **data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{burn_id}/logs", response_model=List[BurnLogOut])
def get_logs(burn_id: int, db: Session = Depends(get_db)):
    if not db.get(Burn, burn_id):
        raise HTTPException(404, "Burn not found")
    return db.query(BurnLog).filter(BurnLog.burn_id == burn_id)\
             .order_by(BurnLog.timestamp).all()


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
