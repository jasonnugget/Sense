"""
Camera management endpoints:
  POST /api/camera/start     — Start a specific camera by ID and source
  POST /api/camera/stop      — Stop a specific camera by ID
  POST /api/camera/stop-all  — Stop all running cameras
  GET  /api/camera/status    — Get status of all cameras (or one by ?camera_id=)

Each camera runs its own background thread with its own stop event.
The _cameras registry tracks every running camera's thread, source, and timing.
"""

from fastapi import UploadFile, HTTPException, APIRouter, Query
from datetime import datetime, timezone
from app.schemas.frame_meta import FrameMeta, CameraStartRequest, CameraStopRequest
from app.services.frame_reader import frame_reader
from app.services.video_stream import clear_frame, clear_all_frames
import cv2
import threading

# ── Camera registry ──────────────────────────────────────────────────────────
# camera_id -> { "thread", "stop_event", "source", "started_at" }
_cameras: dict[str, dict] = {}
_lock = threading.Lock()

# ── Legacy frame upload store (kept for backward compat) ─────────────────────
frame_store: dict[str, FrameMeta] = {}

router = APIRouter()


# ── Frame upload endpoints (unchanged) ───────────────────────────────────────

@router.post("/receive-frames", response_model=FrameMeta)
async def receive_frames(frame_file: UploadFile, frame_id: str):
    if frame_file.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=415, detail="JPEG and PNG only file type supported")
    imgbytes = await frame_file.read()
    meta_data = FrameMeta(
        frame_id=frame_id,
        content_type=frame_file.content_type,
        num_bytes=len(imgbytes),
        timestamp=datetime.now(timezone.utc),
        source="upload"
    )
    frame_store[frame_id] = meta_data
    return meta_data


@router.get("/frames/{frame_id}", response_model=FrameMeta)
def search_frames(frame_id: str):
    if frame_id not in frame_store:
        raise HTTPException(status_code=404, detail="Frame Not Found")
    return frame_store[frame_id]


# ── Multi-camera management ──────────────────────────────────────────────────

@router.post("/camera/start")
def camera_start(payload: CameraStartRequest):
    """Start detection on a camera. Each camera_id can only run once at a time.

    We probe the source synchronously (cv2.VideoCapture + isOpened) before
    spawning the capture thread. That way, if the webcam index is wrong or
    the RTSP URL is unreachable, the POST itself returns 400 with a clear
    reason — instead of silently "starting" a thread that dies immediately.
    """
    with _lock:
        if payload.camera_id in _cameras:
            raise HTTPException(
                status_code=409,
                detail=f"Camera '{payload.camera_id}' is already running."
            )

        # Synchronous open check. This gives the frontend an immediate, actionable
        # error if the user typed the wrong RTSP URL or picked a webcam index
        # that doesn't exist on this machine.
        probe = cv2.VideoCapture(payload.source)
        opened = probe.isOpened()
        probe.release()
        if not opened:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Could not open source '{payload.source}'. "
                    "Check the webcam index / URL and OS camera permissions."
                ),
            )

        stop_event = threading.Event()
        thread = threading.Thread(
            target=frame_reader,
            args=(payload.camera_id, payload.source, stop_event),
            daemon=True,
        )
        thread.start()

        _cameras[payload.camera_id] = {
            "thread": thread,
            "stop_event": stop_event,
            "source": payload.source,
            "started_at": datetime.now(timezone.utc),
        }

    return {
        "status": "started",
        "camera_id": payload.camera_id,
        "source": payload.source,
    }


@router.post("/camera/stop")
def camera_stop(payload: CameraStopRequest):
    """Stop a specific camera by ID."""
    with _lock:
        cam = _cameras.pop(payload.camera_id, None)

    if cam is None:
        raise HTTPException(
            status_code=409,
            detail=f"Camera '{payload.camera_id}' is not running."
        )

    cam["stop_event"].set()
    cam["thread"].join(timeout=5)
    clear_frame(payload.camera_id)

    return {"status": "stopped", "camera_id": payload.camera_id}


@router.post("/camera/stop-all")
def camera_stop_all():
    """Stop every running camera. Handy for cleanup / shutdown."""
    with _lock:
        snapshot = dict(_cameras)
        _cameras.clear()

    for cid, cam in snapshot.items():
        cam["stop_event"].set()

    for cid, cam in snapshot.items():
        cam["thread"].join(timeout=5)

    clear_all_frames()

    return {"status": "stopped", "cameras_stopped": list(snapshot.keys())}


@router.get("/camera/status")
def camera_status(camera_id: str | None = Query(default=None)):
    """
    Returns status of all cameras, or a single camera if ?camera_id= is provided.
    """
    with _lock:
        if camera_id is not None:
            cam = _cameras.get(camera_id)
            if cam is None:
                return {"camera_id": camera_id, "is_running": False}
            return {
                "camera_id": camera_id,
                "is_running": cam["thread"].is_alive(),
                "source": cam["source"],
                "started_at": cam["started_at"],
            }

        return {
            "cameras": [
                {
                    "camera_id": cid,
                    "is_running": cam["thread"].is_alive(),
                    "source": cam["source"],
                    "started_at": cam["started_at"],
                }
                for cid, cam in _cameras.items()
            ]
        }
