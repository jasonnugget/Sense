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
import itertools
import logging
import time
from app.schemas.frame_meta import FrameMeta
from app.schemas.incident import Incident_Report, Incident_Status
import uuid
from datetime import datetime, timezone
from collections import deque
from app.services.detector import run_inference
from app.services.risk_engine import process_detection, is_dangerous_class
from app.services.incident_manager import create_a_inc
from app.routes.stream import publish
from app.services.video_stream import set_frame, clear_frame

log = logging.getLogger("uvicorn.error")

# Monotonic counter for in-memory incidents. Used when the DB is
# unavailable so the frontend still receives a unique id per alert.
# Starts negative so these can never collide with real DB rows (which
# use positive auto-increment ids).
_fallback_incident_ids = itertools.count(start=-1, step=-1)

# Colors for bounding boxes (BGR format for OpenCV). We color everything
# the risk engine considers dangerous in red and everything else in green —
# the `is_dangerous_class` check matches the expanded weapon keyword list,
# so new weapon classes from custom-trained models get red boxes for free.
SAFE_COLOR = (0, 255, 0)
DANGER_COLOR = (0, 0, 255)

# RTSP/IP camera reconnection settings
RTSP_MAX_RETRIES = 3
RTSP_RETRY_DELAY = 2.0  # seconds between retries

# FPS tuning knobs. YOLO inference is by far the slowest step in the loop,
# so we only run it every Nth frame and reuse the last set of detections
# for the boxes drawn on the skipped frames. This keeps the stream feeling
# smooth without multiplying inference cost.
#
# N=2 means: inference on every other frame. On a typical laptop CPU this
# roughly doubles streamed FPS while the risk engine still sees detections
# frequently enough to trigger incidents within its 2-second window.
INFERENCE_EVERY_N_FRAMES = 2

# Lower JPEG quality → smaller frames → faster encode + less bandwidth.
# 70 is visually near-identical to 80 for surveillance footage.
JPEG_QUALITY = 70


def draw_detections(frame, detections):
    """
    Draws bounding boxes and labels on the frame for each detection.
    Red boxes for anything the risk engine considers dangerous (knife,
    gun, pistol, rifle, sword, etc. — see risk_engine.DANGEROUS_KEYWORDS),
    green for everything else.
    """
    for det in detections:
        color = DANGER_COLOR if is_dangerous_class(det.class_name) else SAFE_COLOR
        x, y, w, h = det.bbox.x, det.bbox.y, det.bbox.w, det.bbox.h
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)

        label = f"{det.class_name} {det.confidence:.0%}"
        (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
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
    frame_counter = 0
    # Cache the most recent detections so we can draw boxes on frames
    # where we skipped inference. The boxes drift slightly for one frame
    # but that's invisible to the eye at N=2.
    last_detections: list = []
    new_detections_this_frame: list = []

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
                source=str(source),
                num_bytes=frame.nbytes,
                content_type="image/bgr"
            )

            # YOLO inference — run only every Nth frame for speed. On the
            # skipped frames we reuse `last_detections` so the boxes stay
            # visible. If the model failed to load, stream raw frames
            # instead of crashing the capture thread.
            run_this_frame = (frame_counter % INFERENCE_EVERY_N_FRAMES) == 0
            frame_counter += 1
            if run_this_frame:
                try:
                    last_detections = run_inference(frame, meta)
                    new_detections_this_frame = last_detections
                except Exception as e:
                    log.warning("Camera '%s' inference skipped: %s", camera_id, e)
                    last_detections = []
                    new_detections_this_frame = []
            else:
                # Drawing-only pass. No new detections go to the risk engine,
                # otherwise stale boxes would double-trigger alerts.
                new_detections_this_frame = []

            # Draw directly on the captured frame (no .copy()). OpenCV's
            # read() already gave us a fresh buffer, so in-place drawing is
            # safe and saves a full-frame memcpy every iteration.
            draw_detections(frame, last_detections)

            _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
            set_frame(camera_id, jpeg.tobytes())

            # Risk engine → incident creation → SSE publish.
            # Publishing is split from DB persistence so the Recent Events
            # feed still updates even when Postgres is unreachable. When
            # create_a_inc fails (missing DB, connection refused, etc.) we
            # build a transient Incident_Report in memory, give it a
            # negative id to signal "not persisted", and publish that.
            for detection in new_detections_this_frame:
                try:
                    # Tag the detection with the user-facing camera_id so
                    # the alert shows the right camera name in the UI,
                    # rather than the raw source string ("0", "rtsp://…").
                    detection.camera_id = camera_id
                    incident_request = process_detection(detection)
                except Exception as e:
                    log.warning("Camera '%s' risk engine error: %s", camera_id, e)
                    continue

                if incident_request is None:
                    continue

                # Try to persist. If the DB is down, fall back to a
                # transient record so the SSE feed still fires.
                incident = None
                try:
                    incident = create_a_inc(incident_request)
                except Exception as e:
                    log.warning(
                        "Camera '%s' incident DB save failed (will publish transient): %s",
                        camera_id, e,
                    )
                    incident = Incident_Report(
                        id=next(_fallback_incident_ids),
                        date_posted=datetime.now(timezone.utc),
                        status=Incident_Status.open,
                        risk_level=incident_request.risk_level,
                        objects=incident_request.objects,
                        summary=incident_request.summary,
                    )

                try:
                    publish(incident)
                except Exception as e:
                    log.warning("Camera '%s' SSE publish failed: %s", camera_id, e)

            frame_meta_buffer.append(meta.model_dump())

            # No fixed sleep: the camera's own read() blocks at its native
            # frame rate for webcams, and the MJPEG generator is now
            # event-driven (see video_stream.wait_for_new_frame), so we
            # don't need to throttle artificially. A tiny yield keeps the
            # thread cooperative with other camera threads on the GIL.
            time.sleep(0)

    finally:
        camera.release()
        clear_frame(camera_id)
