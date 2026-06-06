"""
Notification service.
Uses httpx in sync mode so it works reliably from both sync and async contexts.
"""
import httpx
import logging

log = logging.getLogger(__name__)


def send_notifications(settings, burn_name: str, segment_label: str,
                       actual_temp: float, elapsed_minutes: float):
    """Fire all enabled notification channels synchronously."""

    title   = f"Kiln: {burn_name}"
    message = (
        f"Segment complete: {segment_label or 'unnamed'}\n"
        f"Temp: {actual_temp:.1f}°C  |  Elapsed: {elapsed_minutes:.0f} min"
    )

    if settings.discord_enabled and settings.discord_webhook_url:
        _discord(settings.discord_webhook_url, title, message)

    if settings.resend_enabled and settings.resend_api_key and settings.resend_to_email:
        _resend(settings.resend_api_key, settings.resend_from_email,
                settings.resend_to_email, title, message)

    if settings.ntfy_enabled and settings.ntfy_topic:
        _ntfy(settings.ntfy_server, settings.ntfy_topic, title, message)


def _discord(webhook_url: str, title: str, message: str):
    try:
        with httpx.Client(timeout=10) as client:
            r = client.post(webhook_url, json={
                "embeds": [{"title": title, "description": message, "color": 0xe8610a}]
            })
            log.info("Discord: %s", r.status_code)
    except Exception as e:
        log.error("Discord error: %s", e)


def _resend(api_key: str, from_email: str, to_email: str, title: str, message: str):
    try:
        with httpx.Client(timeout=10) as client:
            r = client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"from": from_email, "to": [to_email],
                      "subject": title, "text": message}
            )
            log.info("Resend: %s", r.status_code)
    except Exception as e:
        log.error("Resend error: %s", e)


def _ntfy(server: str, topic: str, title: str, message: str):
    try:
        url = f"{server.rstrip('/')}/{topic}"
        log.info("Ntfy: posting to %s", url)
        # HTTP headers must be ASCII — strip non-ASCII chars from title
        safe_title = title.encode('ascii', 'ignore').decode('ascii').strip()
        if not safe_title:
            safe_title = "Kiln notification"
        with httpx.Client(timeout=10) as client:
            r = client.post(
                url,
                content=message.encode('utf-8'),
                headers={
                    "Title":    safe_title,
                    "Priority": "high",
                    "Tags":     "fire",   # shows 🔥 emoji in ntfy app
                }
            )
            log.info("Ntfy: %s %s", r.status_code, r.text[:100])
    except Exception as e:
        log.error("Ntfy error: %s", e)
