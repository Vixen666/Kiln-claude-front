import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base

# DATABASE_URL is set by Railway/Render as an environment variable.
# Falls back to SQLite for local development.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./kiln.db")

# Railway provides PostgreSQL URLs starting with "postgres://" — SQLAlchemy
# needs "postgresql+psycopg2://" instead.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)

# SQLite needs check_same_thread=False; Postgres does not.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
