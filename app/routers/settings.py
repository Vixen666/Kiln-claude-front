from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Settings
from app.schemas import SettingsUpdate, SettingsOut

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _get_or_create(db: Session) -> Settings:
    s = db.get(Settings, 1)
    if not s:
        s = Settings(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.get("/", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.put("/", response_model=SettingsOut)
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db)):
    s = _get_or_create(db)
    for k, v in data.model_dump().items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.post("/test-notification")
def test_notification(db: Session = Depends(get_db)):
    """Fire a test notification to all enabled channels."""
    from app.notifications import send_notifications
    s = _get_or_create(db)

    enabled = []
    if s.discord_enabled and s.discord_webhook_url: enabled.append("Discord")
    if s.resend_enabled  and s.resend_api_key:      enabled.append("Email")
    if s.ntfy_enabled    and s.ntfy_topic:           enabled.append("Ntfy")

    if not enabled:
        return {"ok": False, "message": "No notification channels are enabled"}

    send_notifications(
        s,
        burn_name="Test Burn",
        segment_label="Test notification from KilnOS",
        actual_temp=850.0,
        elapsed_minutes=42.0,
    )
    return {"ok": True, "message": f"Sent to: {', '.join(enabled)}"}
