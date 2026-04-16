"""
Incident CRUD — backed by PostgreSQL via SQLAlchemy.

All functions accept a `db` Session. When called from FastAPI routes the session
comes from Depends(get_db). When called from the frame_reader thread (which has
no request context) a fresh session is created inline.
"""

from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timezone

from app.schemas.incident import (
    Incident_Report, Incident_Status, Create_Incident, IncidentStatusUpdate
)
from app.schemas.detection import ObjectDetection
from app.db.database import SessionLocal
from app.db.models import IncidentRow, DetectionRow


# ── Helpers to convert between DB rows and Pydantic schemas ──────────────────

def _row_to_schema(row: IncidentRow) -> Incident_Report:
    """Convert an IncidentRow (+ its DetectionRows) into the Pydantic response model."""
    objects = [
        ObjectDetection(
            camera_id=d.camera_id,
            class_name=d.class_name,
            confidence=d.confidence,
            bbox={"x": d.bbox_x, "y": d.bbox_y, "w": d.bbox_w, "h": d.bbox_h},
            frame_id=d.frame_id,
            timestamp=d.timestamp,
        )
        for d in row.detections
    ]
    return Incident_Report(
        id=row.id,
        date_posted=row.date_posted,
        status=row.status,
        risk_level=row.risk_level,
        objects=objects if objects else None,
        summary=row.summary,
    )


def _save_detections(db: Session, incident_id: int, detections: list[ObjectDetection] | None):
    """Insert ObjectDetection list as DetectionRows linked to an incident."""
    if not detections:
        return
    for det in detections:
        db.add(DetectionRow(
            incident_id=incident_id,
            camera_id=det.camera_id,
            class_name=det.class_name,
            confidence=det.confidence,
            bbox_x=det.bbox.x,
            bbox_y=det.bbox.y,
            bbox_w=det.bbox.w,
            bbox_h=det.bbox.h,
            frame_id=det.frame_id,
            timestamp=det.timestamp,
        ))


# ── Public CRUD functions ────────────────────────────────────────────────────

def get_list_inc(db: Session) -> list[Incident_Report]:
    rows = db.query(IncidentRow).order_by(IncidentRow.date_posted.desc()).all()
    return [_row_to_schema(r) for r in rows]


def get_a_inc(db: Session, id: int) -> Incident_Report:
    row = db.query(IncidentRow).filter(IncidentRow.id == id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Incident Not found")
    return _row_to_schema(row)


def create_a_inc(information: Create_Incident, db: Session | None = None) -> Incident_Report:
    """
    Create a new incident. If no db session is passed (e.g. called from the
    frame_reader background thread), a fresh session is created and committed.
    """
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        row = IncidentRow(
            status=Incident_Status.open.value,
            risk_level=information.risk_level.value,
            summary=information.summary,
            date_posted=datetime.now(timezone.utc),
        )
        db.add(row)
        db.flush()  # get the auto-generated id

        _save_detections(db, row.id, information.objects)
        db.commit()
        db.refresh(row)

        return _row_to_schema(row)
    except Exception:
        db.rollback()
        raise
    finally:
        if own_session:
            db.close()


def update_incident(db: Session, id: int, info: IncidentStatusUpdate) -> Incident_Report:
    row = db.query(IncidentRow).filter(IncidentRow.id == id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Incident Not found")
    row.status = info.status.value
    db.commit()
    db.refresh(row)
    return _row_to_schema(row)
