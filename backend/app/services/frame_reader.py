from typing import Any


import cv2
from app.schemas.frame_meta import FrameMeta
import uuid
from datetime import datetime, timezone
from collections import deque

def frame_reader(source):
    camera = cv2.VideoCapture(source)
    frame_meta_buffer = deque(maxlen=500)

    if not camera.isOpened():
        raise RuntimeError("Camera could not be opened")

    try:
        while camera.isOpened():
            ok, frame = camera.read()
            if not ok:
                break
            cv2.imshow("Camera", frame)

            height,width = frame.shape[:2]
            meta = FrameMeta(height = height,
            width = width, 
            frame_id = str(uuid.uuid4()),
            timestamp = datetime.now(timezone.utc),
            source = source,
            num_bytes=frame.nbytes,
            content_type="image/bgr")
            print(meta.model_dump)

            frame_meta_buffer.append(meta.model_dump())
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    finally:
        camera.release()
        cv2.destroyAllWindows()

frame_reader(0)