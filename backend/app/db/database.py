"""
SQLAlchemy database setup for Sense.

Uses PostgreSQL via psycopg2. The connection URL is read from the DATABASE_URL
environment variable (defaults to a local dev database).

Usage in FastAPI routes:
    from app.db.database import get_db
    @router.get("/things")
    def list_things(db: Session = Depends(get_db)):
        ...
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://sense:sense@localhost:5432/sense_db"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def create_tables():
    """Create all tables that don't exist yet. Safe to call on every startup."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency — yields a session and closes it when the request finishes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
