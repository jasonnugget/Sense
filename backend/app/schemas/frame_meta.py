from pydantic import BaseModel
from datetime import datetime, timezone


class FrameMeta(BaseModel):
    frame_id : str
    content_type : str | None
    timestamp: datetime
    num_bytes: int | None
    width: int
    height: int
    source: str | int

class CameraStartRequest(BaseModel):
    source: str | int = 0