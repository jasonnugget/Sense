"""
SQLAlchemy table definitions for Sense.

Tables:
  incidents   — threat incidents created by the risk engine or manually
  detections  — individual YOLO detections linked to an incident
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.db.database import Base


class IncidentRow(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String(20), nullable=False, default="open")
    risk_level = Column(String(10), nullable=False)
    summary = Column(Text, nullable=True)
    date_posted = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # One incident can have many detections
    detections = relationship("DetectionRow", back_populates="incident", cascade="all, delete-orphan")


class DetectionRow(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    camera_id = Column(String(100), nullable=False)
    class_name = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False)
    bbox_x = Column(Integer, nullable=False)
    bbox_y = Column(Integer, nullable=False)
    bbox_w = Column(Integer, nullable=False)
    bbox_h = Column(Integer, nullable=False)
    frame_id = Column(String(100), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)

    incident = relationship("IncidentRow", back_populates="detections")
