"""
Mirrors local writes to a remote instance (e.g. a Railway backup), fire-and-forget.

A single background worker thread drains a bounded queue and does the actual
HTTP call. Callers never block on it, and a slow or unreachable remote can
never affect local kiln control — if the queue fills up (remote is down),
new events are just dropped rather than piling up.
"""
import logging
import queue
import threading

import httpx

log = logging.getLogger(__name__)

_TIMEOUT      = 5.0
_QUEUE_MAXSIZE = 200

_queue = queue.Queue(maxsize=_QUEUE_MAXSIZE)
_worker_started = False
_lock = threading.Lock()

# Prefixes never mirrored: settings holds the sync config itself (and other
# machine-local config), burns have side effects on the remote (starting a
# burn there spawns its own background controller against a mock sensor).
_EXCLUDED_PREFIXES = ("/api/settings", "/api/burns")


def _get_sync_config():
    from app.database import SessionLocal
    from app.models import Settings

    db = SessionLocal()
    try:
        s = db.get(Settings, 1)
        if not s or not s.sync_enabled or not s.sync_api_base_url:
            return None, None
        return s.sync_api_base_url.rstrip("/"), s.sync_api_key
    finally:
        db.close()


def _worker():
    while True:
        method, path, body, content_type = _queue.get()
        try:
            base_url, api_key = _get_sync_config()
            if base_url:
                headers = {"Content-Type": content_type or "application/json"}
                if api_key:
                    headers["X-Sync-Key"] = api_key
                try:
                    with httpx.Client(timeout=_TIMEOUT) as client:
                        resp = client.request(method, base_url + path,
                                              content=body, headers=headers)
                        if resp.status_code >= 400:
                            log.warning("Sync %s %s -> %d", method, path, resp.status_code)
                except Exception as e:
                    log.warning("Sync %s %s failed: %s", method, path, e)
        finally:
            _queue.task_done()


def _ensure_worker():
    global _worker_started
    with _lock:
        if not _worker_started:
            threading.Thread(target=_worker, daemon=True, name="sync-worker").start()
            _worker_started = True


def should_mirror(method: str, path: str) -> bool:
    return (
        method in ("POST", "PUT", "PATCH", "DELETE")
        and path.startswith("/api/")
        and not path.startswith(_EXCLUDED_PREFIXES)
    )


def enqueue(method: str, path: str, body: bytes = b"", content_type: str = None):
    """Queue a write to be mirrored to the remote instance. Never blocks."""
    _ensure_worker()
    try:
        _queue.put_nowait((method, path, body, content_type))
    except queue.Full:
        log.warning("Sync queue full, dropping %s %s", method, path)
