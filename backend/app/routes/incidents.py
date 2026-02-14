from fastapi import APIRouter
from datetime import datetime, timezone
from app.schemas.incident import Create_Incident, Incident_Report, Incident_Status, IncidentStatusUpdate
from app.services.incident_manager import create_a_inc, get_list_inc, get_a_inc, update_incident
from app.routes.stream import publish
from typing import List

router = APIRouter()


# Returns all incidents
@router.get("/incidents", response_model = list[Incident_Report])
def get_end_list():
    list_of_inc = get_list_inc()
    return list_of_inc



# Returns a specfic incident according to ID
@router.get("/incidents/{id}", response_model = Incident_Report)
def get_single_inc(id : int):
    inc = get_a_inc(id)
    return inc



# Creates a incident
@router.post("/incidents", response_model = Incident_Report)
def create(skeleton : Create_Incident):
    new_inc = create_a_inc(skeleton)
    publish(new_inc) # sends event to the queue
    return new_inc




# Updates a incident
@router.patch("/incidents/{id}", response_model = Incident_Report)
def update(id : int, new_status : IncidentStatusUpdate):
    updated = update_incident(id, new_status)
    publish(updated) # sends event to the queue
    return updated 

