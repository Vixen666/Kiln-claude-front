"""
db_log_handler.py — Python logging handler that writes to the system_logs table.

Usage:
    from app.log_handler import install_handler

    # Call once at startup, passing the active burn_id and kiln log_level
    install_handler(burn_id=5, log_level="INFO")

    # All subsequent log.info/warning/error calls in the controller
    # are automatically written to the DB — no code changes needed.

The handler is burn-scoped: each burn gets its own handler instance
attached to the root logger, and removed when the burn finishes.

Log levels map:
    OFF      → handler disabled entirely
    ERROR    → only ERROR and CRITICAL
    WARNING  → WARNING, ERROR, CRITICAL
    INFO     → INFO, WARNING, ERROR, CRITICAL
    DEBUG    → everything
"""

import logging
from datetime import datetime

# Map string level names to Python logging constants
LEVEL_MAP = {
    "OFF":      None,
    "ERROR":    logging.ERROR,
    "WARNING":  logging.WARNING,
    "INFO":     logging.INFO,
    "DEBUG":    logging.DEBUG,
}

# Keep track of installed handlers so we can remove them
_installed: dict[int, "DBLogHandler"] = {}


class DBLogHandler(logging.Handler):
    """
    Logging handler that persists records to system_logs via SQLAlchemy.
    Uses its own session so it doesn't interfere with the main controller session.
    """

    def __init__(self, burn_id: int, log_level: str = "INFO"):
        level = LEVEL_MAP.get(log_level.upper(), logging.INFO)
        super().__init__(level=level if level is not None else logging.CRITICAL + 1)
        self.burn_id = burn_id
        self._disabled = (log_level.upper() == "OFF")

    def emit(self, record: logging.LogRecord):
        if self._disabled:
            return
        try:
            from app.database import SessionLocal
            from app.models   import SystemLog

            db = SessionLocal()
            try:
                entry = SystemLog(
                    level      = record.levelname,
                    logger     = record.name,
                    message    = self.format(record),
                    burn_id    = self.burn_id,
                    created_at = datetime.utcfromtimestamp(record.created),
                )
                db.add(entry)
                db.commit()
            finally:
                db.close()
        except Exception:
            # Never let logging errors crash the controller
            self.handleError(record)


def install_handler(burn_id: int, log_level: str = "INFO"):
    """
    Attach a DBLogHandler for this burn to the root logger.
    Only captures logs from the kiln-related modules.
    """
    if log_level.upper() == "OFF":
        return

    handler = DBLogHandler(burn_id, log_level)
    handler.setFormatter(logging.Formatter("%(message)s"))

    # Attach to specific loggers so we don't flood the DB with uvicorn access logs
    for name in ("controller", "thermocouple", "heater", "pid.algorithm",
                 "pid.curve", "pid.controller", "app.pid"):
        logger = logging.getLogger(name)
        logger.addHandler(handler)

    _installed[burn_id] = handler


def remove_handler(burn_id: int):
    """Detach and remove the handler for this burn."""
    handler = _installed.pop(burn_id, None)
    if not handler:
        return
    for name in ("controller", "thermocouple", "heater", "pid.algorithm",
                 "pid.curve", "pid.controller", "app.pid"):
        logging.getLogger(name).removeHandler(handler)
