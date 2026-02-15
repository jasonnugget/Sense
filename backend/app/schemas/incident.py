from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum 




class Incident_Status(str, Enum):
    open = "open"
    acknowledged = "acknowledged"
    resolved = "resolved"

class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"



class Incident_Report(BaseModel):
    id : int
    date_posted : datetime
    status : Incident_Status
    risk_level : RiskLevel
    objects : List[detections] = None # none right now just for tesing
    summary : Optional[str] = None




class Create_Incident(BaseModel):
    risk_level : RiskLevel
    objects : List[detections] = None # none right now just for tesing
    summary : Optional[str] = None


class IncidentStatusUpdate(BaseModel):
    status : Incident_Status
