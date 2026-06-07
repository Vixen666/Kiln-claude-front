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

        _add_column_if_missing(conn, engine,
            "kilns", "tc_type",    "VARCHAR DEFAULT 'K'")
        _add_column_if_missing(conn, engine,
            "kilns", "pin_safety", "INTEGER NULL")
        _add_column_if_missing(conn, engine,
            "kilns", "pin_power",  "INTEGER NULL")
        _add_column_if_missing(conn, engine,
            "kilns", "log_level",          "VARCHAR DEFAULT 'INFO'")
        _add_column_if_missing(conn, engine,
            "kilns", "catch_up_enabled",   "BOOLEAN DEFAULT TRUE")
        _add_column_if_missing(conn, engine,
            "kilns", "catch_up_max_error", "FLOAT DEFAULT 25.0")
        _add_column_if_missing(conn, engine,
            "kilns", "sensor_samples",     "INTEGER DEFAULT 10")
        _add_column_if_missing(conn, engine,
            "kilns", "sensor_trim_pct",    "FLOAT DEFAULT 20.0")
        _add_column_if_missing(conn, engine,
            "kilns", "pid_window_below", "FLOAT DEFAULT 0.0")
        _add_column_if_missing(conn, engine,
            "kilns", "pid_window_above", "FLOAT DEFAULT 0.0")

        # Template and Recipe revisions
        _add_column_if_missing(conn, engine,
            "templates", "base_id",  "INTEGER NULL")
        _add_column_if_missing(conn, engine,
            "templates", "revision", "INTEGER DEFAULT 1")
        _add_column_if_missing(conn, engine,
            "recipes",   "base_id",  "INTEGER NULL")
        _add_column_if_missing(conn, engine,
            "recipes",   "revision", "INTEGER DEFAULT 1")

        # Set base_id = id for all existing rows (revision 1 = base)
        try:
            conn.execute(text(
                "UPDATE templates SET base_id = id WHERE base_id IS NULL"
            ))
            conn.execute(text(
                "UPDATE recipes SET base_id = id WHERE base_id IS NULL"
            ))
        except Exception as e:
            log.warning("Could not backfill base_id: %s", e)

        _add_column_if_missing(conn, engine,
            "burns", "resume_on_power_loss",   "BOOLEAN DEFAULT FALSE")
        _add_column_if_missing(conn, engine,
            "burns", "resume_timeout_minutes", "INTEGER DEFAULT 30")

        _add_column_if_missing(conn, engine,
            "burn_logs", "wall_minutes", "FLOAT NULL")

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
