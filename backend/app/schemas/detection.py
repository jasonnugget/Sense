from pydantic import BaseModel
from datetime import datetime, timezone

class BBox(BaseModel):
    x : int
    y : int
    w : int
    h : int

class ObjectDetection(BaseModel):
    class_name : str
    camera_id : str
    confidence : float
    bbox : BBox
    frame_id : int
    timestamp = datetime.utcnow()
