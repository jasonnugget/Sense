"""
Frame reader — captures video from any source, runs YOLO, draws bounding boxes,
and pushes annotated frames to the per-camera MJPEG stream buffer.

Supports multiple camera sources simultaneously:
  - Webcam index (0, 1, 2...)
  - RTSP URL ("rtsp://user:pass@192.168.1.10:554/stream")
  - IP camera URL ("http://192.168.1.10/video")
  - Video file path ("demo.mp4")

Each camera runs in its own thread with its own stop_event.
The YOLO model is loaded once at startup and shared across all threads.
"""

import cv2
import time
from app.schemas.frame_meta import FrameMeta
import uuid
from datetime import datetime, timezone
from collections import deque
from app.services.detector import run_inference
from app.services.risk_engine import process_detection
from app.services.incident_manager import create_a_inc
from app.routes.stream import publish
from app.services.video_stream import set_frame, clear_frame

# Colors for bounding boxes (BGR format for OpenCV)
BOX_COLORS = {
    "default": (0, 255, 0),    # green — safe objects
    "knife":   (0, 0, 255),    # red — dangerous
    "gun":     (0, 0, 255),    # red — dangerous
}

# RTSP/IP camera reconnection settings
RTSP_MAX_RETRIES = 3
RTSP_RETRY_DELAY = 2.0  # seconds between retries


def draw_detections(frame, detections):
    """
    Draws bounding boxes and labels on the frame for each detection.
    Red boxes for dangerous objects (knife, gun), green for everything else.
    """
    for det in detections:
        color = BOX_COLORS.get(det.class_name, BOX_COLORS["default"])
        x, y, w, h = det.bbox.x, det.bbox.y, det.bbox.w, det.bbox.h
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)

        label = f"{det.class_name} {det.confidence:.0%}"
        (text_w, text_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(frame, (x, y - text_h - 10), (x + text_w + 4, y), color, -1)
        cv2.putText(frame, label, (x + 2, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    return frame


def _is_stream_source(source) -> bool:
    """Check if the source is a network stream (RTSP/HTTP) that may need reconnection."""
    return isinstance(source, str) and (
        source.startswith("rtsp://") or source.startswith("http://") or source.startswith("https://")
    )


def _open_camera(source, retries: int = 1):
    """Try to open a camera source with retries for network streams."""
    for attempt in range(retries):
        camera = cv2.VideoCapture(source)
        if camera.isOpened():
            return camera
        camera.release()
        if attempt < retries - 1:
            time.sleep(RTSP_RETRY_DELAY)
    return None


def frame_reader(camera_id: str, source, stop_event):
    """
    Main capture loop for one camera. Runs in a background thread.

    Args:
        camera_id: Unique identifier for this camera (e.g. "front-door")
        source: Camera source — webcam index (0), RTSP URL, IP camera URL, or video file path
        stop_event: threading.Event that signals this camera to stop
    """
    is_stream = _is_stream_source(source)
    max_retries = RTSP_MAX_RETRIES if is_stream else 1

    camera = _open_camera(source, retries=max_retries)
    if camera is None:
        raise RuntimeError(f"Camera '{camera_id}' could not open source: {source}")

    frame_meta_buffer = deque(maxlen=500)

    try:
        while camera.isOpened() and not stop_event.is_set():
            ok, frame = camera.read()

            if not ok:
                # For network streams, try to reconnect
                if is_stream and not stop_event.is_set():
                    camera.release()
                    camera = _open_camera(source, retries=max_retries)
                    if camera is None:
                        break
                    continue
                else:
                    break

            height, width = frame.shape[:2]
            meta = FrameMeta(
                height=height,
                width=width,
                frame_id=str(uuid.uuid4()),
                timestamp=datetime.now(timezone.utc),
                source=source,
                num_bytes=frame.nbytes,
                content_type="image/bgr"
            )

            detections = run_inference(frame, meta)
            annotated = draw_detections(frame.copy(), detections)

            _, jpeg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
            set_frame(camera_id, jpeg.tobytes())

            for detection in detections:
                incident_request = process_detection(detection)
                if incident_request is not None:
                    new_incident = create_a_inc(incident_request)
                    publish(new_incident)

            frame_meta_buffer.append(meta.model_dump())

            # ~30 FPS max — time.sleep instead of cv2.waitKey (no GUI on server)
            time.sleep(0.033)

    finally:
        camera.release()
        clear_frame(camera_id)
