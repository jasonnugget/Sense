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
_lock = threading.Lock()


def set_frame(camera_id: str, jpeg_bytes: bytes):
    """Called by a camera's frame_reader thread to publish its newest annotated frame."""
    with _lock:
        _frames[camera_id] = jpeg_bytes


def get_frame(camera_id: str) -> bytes | None:
    """Called by the MJPEG endpoint to grab the latest frame for a specific camera."""
    with _lock:
        return _frames.get(camera_id)


def clear_frame(camera_id: str):
    """Called when a specific camera stops to remove its buffer."""
    with _lock:
        _frames.pop(camera_id, None)


def clear_all_frames():
    """Called on shutdown to clear all camera buffers."""
    with _lock:
        _frames.clear()


def list_active_cameras() -> list[str]:
    """Returns a list of camera IDs that currently have frames in the buffer."""
    with _lock:
        return list(_frames.keys())
