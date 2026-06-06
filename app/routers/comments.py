from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Burn, BurnComment
from app.schemas import BurnCommentCreate, BurnCommentUpdate, BurnCommentOut
from typing import List

router = APIRouter(prefix="/api/burns", tags=["comments"])


@router.get("/{burn_id}/comments", response_model=List[BurnCommentOut])
def get_comments(burn_id: int, db: Session = Depends(get_db)):
    if not db.get(Burn, burn_id):
        raise HTTPException(404, "Burn not found")
    return db.query(BurnComment)\
             .filter(BurnComment.burn_id == burn_id)\
             .order_by(BurnComment.created_at).all()


@router.post("/{burn_id}/comments", response_model=BurnCommentOut, status_code=201)
def add_comment(burn_id: int, data: BurnCommentCreate, db: Session = Depends(get_db)):
    if not db.get(Burn, burn_id):
        raise HTTPException(404, "Burn not found")
    comment = BurnComment(burn_id=burn_id, **data.model_dump())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.put("/{burn_id}/comments/{comment_id}", response_model=BurnCommentOut)
def update_comment(burn_id: int, comment_id: int, data: BurnCommentUpdate,
                   db: Session = Depends(get_db)):
    c = db.query(BurnComment).filter(
        BurnComment.id == comment_id,
        BurnComment.burn_id == burn_id
    ).first()
    if not c:
        raise HTTPException(404, "Comment not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{burn_id}/comments/{comment_id}", status_code=204)
def delete_comment(burn_id: int, comment_id: int, db: Session = Depends(get_db)):
    c = db.query(BurnComment).filter(
        BurnComment.id == comment_id,
        BurnComment.burn_id == burn_id
    ).first()
    if not c:
        raise HTTPException(404, "Comment not found")
    db.delete(c)
    db.commit()
