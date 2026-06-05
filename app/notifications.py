"""
Notification service.
Called by the burns router when a log entry has event="segment_change"
and the completed segment has notify_on_complete=True.
"""

import httpx
import logging

log = logging.getLogger(__name__)


async def send_notifications(settings, burn_name: str, segment_label: str,
                              actual_temp: float, elapsed_minutes: float):
    """Fire all enabled notification channels. Non-blocking — errors are logged, not raised."""

    title   = f"🔥 Kiln: {burn_name}"
    message = (
        f"Segment complete: {segment_label or 'unnamed'}\n"
        f"Temp: {actual_temp:.1f}°C  |  Elapsed: {elapsed_minutes:.0f} min"
    )

    tasks = []

    if settings.discord_enabled and settings.discord_webhook_url:
        tasks.append(_discord(settings.discord_webhook_url, title, message))

    if settings.resend_enabled and settings.resend_api_key and settings.resend_to_email:
        tasks.append(_resend(settings.resend_api_key, settings.resend_from_email,
                             settings.resend_to_email, title, message))

    if settings.ntfy_enabled and settings.ntfy_topic:
        tasks.append(_ntfy(settings.ntfy_server, settings.ntfy_topic, title, message))

    import asyncio
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for r in results:
        if isinstance(r, Exception):
            log.error("Notification error: %s", r)


async def _discord(webhook_url: str, title: str, message: str):
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(webhook_url, json={
            "embeds": [{
                "title":       title,
                "description": message,
                "color":       0xe8610a,   # orange
            }]
        })


async def _resend(api_key: str, from_email: str, to_email: str,
                  title: str, message: str):
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from":    from_email,
                "to":      [to_email],
                "subject": title,
                "text":    message,
            }
        )


async def _ntfy(server: str, topic: str, title: str, message: str):
    url = f"{server.rstrip('/')}/{topic}"
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(url, content=message.encode(),
                          headers={"Title": title, "Priority": "high"})
