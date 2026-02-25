from app.schemas.incident import Incident_Report, Incident_Status, Create_Incident, IncidentStatusUpdate
from fastapi import HTTPException
from datetime import datetime, timezone

# Temp Storage for incidents
incident_storage: dict[int, Incident_Report] = {}
next_id = 1 # ID counter begins at 1 

# Prints out all incidents
def get_list_inc():
    return list(incident_storage.values()) # had to make it into a list so it can translate into mutiple incidents in json
# Prints out a specfic incident
def get_a_inc(id: int):
    if id not in incident_storage:
        raise HTTPException(status_code= 404, detail = "Incident Not found")
    return incident_storage[id]

# Creates a incident
def create_a_inc(information : Create_Incident):
    global next_id

    # creates a new incident report and fills out schema with information given
    new_inc = Incident_Report(
    id = next_id,
    date_posted = datetime.now(timezone.utc),
    status = Incident_Status.open,
    risk_level = information.risk_level,
    #objects = information.objects,
    summary = information.summary
    )
    # adds it to storage 
    incident_storage[next_id] = new_inc
    next_id += 1
    return new_inc

# updates incident (takes in id and new status)
def update_incident(id : int, info : IncidentStatusUpdate):
    if id not in incident_storage: # checks if id isn't in storage
        raise HTTPException(status_code = 404, detail = "Incident Not found")
    incident_storage[id].status = info.status # if it is replace new status with old
    return incident_storage[id] # return incident

