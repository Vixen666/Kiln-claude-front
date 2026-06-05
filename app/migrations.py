"""
Lightweight migration runner.
SQLAlchemy's create_all() creates missing tables but never adds columns to
existing ones. This file handles ALTER TABLE for new columns safely using
"ADD COLUMN IF NOT EXISTS" (supported by both PostgreSQL and SQLite 3.37+).
"""
import logging
from sqlalchemy import text

log = logging.getLogger(__name__)


def run(engine):
    """Run all pending column migrations. Safe to call on every startup."""
    with engine.connect() as conn:
        _add_column_if_missing(conn, engine,
            "template_curve_segments",
            "notify_on_complete", "BOOLEAN DEFAULT FALSE NOT NULL")

        _add_column_if_missing(conn, engine,
            "settings", "discord_enabled",      "BOOLEAN DEFAULT FALSE NOT NULL")
        _add_column_if_missing(conn, engine,
            "settings", "discord_webhook_url",  "VARCHAR DEFAULT ''")
        _add_column_if_missing(conn, engine,
            "settings", "resend_enabled",       "BOOLEAN DEFAULT FALSE NOT NULL")
        _add_column_if_missing(conn, engine,
            "settings", "resend_api_key",       "VARCHAR DEFAULT ''")
        _add_column_if_missing(conn, engine,
            "settings", "resend_from_email",    "VARCHAR DEFAULT ''")
        _add_column_if_missing(conn, engine,
            "settings", "resend_to_email",      "VARCHAR DEFAULT ''")
        _add_column_if_missing(conn, engine,
            "settings", "ntfy_enabled",         "BOOLEAN DEFAULT FALSE NOT NULL")
        _add_column_if_missing(conn, engine,
            "settings", "ntfy_topic",           "VARCHAR DEFAULT ''")
        _add_column_if_missing(conn, engine,
            "settings", "ntfy_server",          "VARCHAR DEFAULT 'https://ntfy.sh'")

        # burn_temp_alerts is a new table — handled by create_all()
        # but add a safety check for the fired_at column in case of partial migration
        _add_column_if_missing(conn, engine,
            "burn_temp_alerts", "fired_at", "TIMESTAMP NULL")

        conn.commit()


def _add_column_if_missing(conn, engine, table: str, column: str, col_def: str):
    dialect = engine.dialect.name  # "postgresql" or "sqlite"

    if dialect == "postgresql":
        sql = f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {col_def}"
        try:
            conn.execute(text(sql))
            log.info("Migration OK: %s.%s", table, column)
        except Exception as e:
            log.warning("Migration skip %s.%s: %s", table, column, e)
            conn.rollback()
    else:
        # SQLite: check information_schema manually
        result = conn.execute(text(f"PRAGMA table_info({table})"))
        cols = [row[1] for row in result]
        if column not in cols:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}"))
            log.info("Migration OK (sqlite): %s.%s", table, column)
