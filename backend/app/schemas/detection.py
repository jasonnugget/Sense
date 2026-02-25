from pydantic import BaseModel
<<<<<<< HEAD
from datetime import datetime
=======
from datetime import datetime, timezone
>>>>>>> backend-structure

class BBox(BaseModel):
    x : int
    y : int
    w : int
    h : int

class ObjectDetection(BaseModel):
    class_name : str
<<<<<<< HEAD
    confidence : float
    bbox : BBox
    frame_id : int
    # will implement time stamp in the future, but for now datetime has no value assigned
    timestamp : datetime
=======
    camera_id : str
    confidence : float
    bbox : BBox
    frame_id : int
    timestamp = datetime.utcnow()
>>>>>>> backend-structure
