from pydantic import BaseModel
from datetime import datetime

class BBox(BaseModel):
    x : int
    y : int
    w : int
    h : int

class ObjectDetection(BaseModel):
    camera_id : str 
    class_name : str
    confidence : float
    bbox : BBox
    frame_id : int
    # will implement time stamp in the future, but for now datetime has no value assigned
    timestamp : datetime
