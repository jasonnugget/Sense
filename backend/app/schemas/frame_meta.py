from pydantic import BaseModel
from datetime import datetime, timezone


class FrameMeta(BaseModel):
    frame_id : str
    content_type : str | None = None
    timestamp: datetime
    num_bytes: int | None = None
    width: int | None = None
    height: int | None = None
    source: str | int

class CameraStartRequest(BaseModel):
    camera_id: str
    source: str | int = 0

class CameraStopRequest(BaseModel):
    camera_id: str