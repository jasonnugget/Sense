from pydantic import BaseModel
from datetime import datetime, timezone


class FrameMeta(BaseModel):
    frame_id : int
    content_type : str
    timestamp: datetime
    num_bytes: int   