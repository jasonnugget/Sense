"""
Per-camera frame buffer for MJPEG streaming.

Each camera gets its own entry in the _frames dict, keyed by camera_id.
The frame_reader thread for each camera writes annotated JPEG frames here.
The /api/video/feed/{camera_id} endpoint reads from the matching entry.

This is a latest-frame buffer (not a queue) — MJPEG streaming only cares
about the most recent frame, so we overwrite each time.
"""

import threading

# camera_id -> latest JPEG bytes with bounding boxes drawn
_frames: dict[str, bytes] = {}
# camera_id -> monotonically increasing counter that ticks each time a new
# frame is published. The MJPEG generator compares this against the last
# value it yielded so it can sleep just long enough to wake as soon as a
# fresh frame arrives, rather than polling on a fixed timer.
_frame_seq: dict[str, int] = {}
_lock = threading.Lock()
# Single condition variable reused across cameras; notify_all is cheap
# compared to the inference cost, and consumers filter by camera_id.
_frame_cond = threading.Condition(_lock)


def set_frame(camera_id: str, jpeg_bytes: bytes):
    """Called by a camera's frame_reader thread to publish its newest annotated frame."""
    with _frame_cond:
        _frames[camera_id] = jpeg_bytes
        _frame_seq[camera_id] = _frame_seq.get(camera_id, 0) + 1
        _frame_cond.notify_all()


def get_frame(camera_id: str) -> bytes | None:
    """Called by the MJPEG endpoint to grab the latest frame for a specific camera."""
    with _lock:
        return _frames.get(camera_id)


def get_frame_with_seq(camera_id: str) -> tuple[bytes | None, int]:
    """Return (frame, sequence) so the MJPEG generator can detect new frames."""
    with _lock:
        return _frames.get(camera_id), _frame_seq.get(camera_id, 0)


def wait_for_new_frame(camera_id: str, last_seq: int, timeout: float = 1.0) -> tuple[bytes | None, int]:
    """Block until a new frame arrives for camera_id (or timeout)."""
    with _frame_cond:
        _frame_cond.wait_for(
            lambda: _frame_seq.get(camera_id, 0) > last_seq,
            timeout=timeout,
        )
        return _frames.get(camera_id), _frame_seq.get(camera_id, 0)


def clear_frame(camera_id: str):
    """Called when a specific camera stops to remove its buffer."""
    with _frame_cond:
        _frames.pop(camera_id, None)
        _frame_seq.pop(camera_id, None)
        _frame_cond.notify_all()


def clear_all_frames():
    """Called on shutdown to clear all camera buffers."""
    with _lock:
        _frames.clear()


def list_active_cameras() -> list[str]:
    """Returns a list of camera IDs that currently have frames in the buffer."""
    with _lock:
        return list(_frames.keys())
