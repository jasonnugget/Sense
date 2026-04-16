from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas.incident import Create_Incident, Incident_Report, IncidentStatusUpdate
from app.services.incident_manager import create_a_inc, get_list_inc, get_a_inc, update_incident
from app.routes.stream import publish
from app.db.database import get_db

router = APIRouter()


@router.get("/incidents", response_model=list[Incident_Report])
def get_end_list(db: Session = Depends(get_db)):
    return get_list_inc(db)


@router.get("/incidents/{id}", response_model=Incident_Report)
def get_single_inc(id: int, db: Session = Depends(get_db)):
    return get_a_inc(db, id)


@router.post("/incidents", response_model=Incident_Report)
def create(skeleton: Create_Incident, db: Session = Depends(get_db)):
    new_inc = create_a_inc(skeleton, db)
    publish(new_inc)
    return new_inc


@router.patch("/incidents/{id}", response_model=Incident_Report)
def update(id: int, new_status: IncidentStatusUpdate, db: Session = Depends(get_db)):
    updated = update_incident(db, id, new_status)
    publish(updated)
    return updated
