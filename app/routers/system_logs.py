from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import SystemLog
from app.schemas import SystemLogOut
from typing import List, Optional

router = APIRouter(prefix="/api/logs", tags=["system-logs"])


@router.get("/", response_model=List[SystemLogOut])
def get_logs(
    burn_id:  Optional[int] = None,
    level:    Optional[str] = None,   # ERROR WARNING INFO DEBUG
    after_id: int = 0,
    limit:    int = Query(default=200, le=500),
    db: Session = Depends(get_db),
):
    """
    Fetch system log entries.
    - burn_id  : filter to a specific burn
    - level    : minimum level (ERROR < WARNING < INFO < DEBUG)
    - after_id : only entries with id > after_id (for live polling)
    - limit    : max rows returned
    """
    q = db.query(SystemLog)

    if burn_id is not None:
        q = q.filter(SystemLog.burn_id == burn_id)

    if level:
        import logging
        min_level = getattr(logging, level.upper(), logging.INFO)
        included  = [name for name, val in
                     logging._nameToLevel.items()
                     if val >= min_level and name not in ('NOTSET', 'WARN')]
        q = q.filter(SystemLog.level.in_(included))

    if after_id:
        q = q.filter(SystemLog.id > after_id)

    return q.order_by(SystemLog.created_at.desc()).limit(limit).all()


@router.delete("/")
def clear_logs(burn_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Clear system logs, optionally for a specific burn only."""
    q = db.query(SystemLog)
    if burn_id is not None:
        q = q.filter(SystemLog.burn_id == burn_id)
    count = q.count()
    q.delete()
    db.commit()
    return {"deleted": count}
