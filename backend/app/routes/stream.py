"""
Streaming endpoints:
  GET /api/stream/alerts          — SSE for real-time alert notifications
  GET /api/video/feed/{camera_id} — MJPEG stream for a specific camera

How SSE works:
  The frontend opens a persistent connection to /api/stream/alerts.
  When an incident is created or updated, publish() adds it to the queue.
  The streamer() loop sends each event as a JSON payload to all connected clients.
  The frontend's EventSource API automatically reconnects if the connection drops.

How MJPEG works:
  The frontend points an <img> tag at /api/video/feed/{camera_id}.
  The endpoint continuously sends JPEG frames as a multipart HTTP response.
  The browser renders each frame, creating a live video feed.
  Bounding boxes from YOLO are already drawn on the frames by frame_reader.
"""

from fastapi import APIRouter
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
import asyncio
import json

from app.services.video_stream import get_frame_with_seq, wait_for_new_frame

router = APIRouter()

# Notification queue — incidents get added here and streamed to the frontend via SSE
queue = []


def publish(event):
    """Add an event to the SSE queue. Called by incident routes and frame_reader."""
    queue.append(event)


async def streamer():
    """
    SSE generator. Runs in a while loop, sending events as they appear in the queue.
    Uses asyncio.sleep so it doesn't block the server while waiting for new events.
    """
    while True:
        if queue:
            event = queue.pop(0)
            event_fix = jsonable_encoder(event)
            yield "data: " + json.dumps(event_fix) + "\n\n"
        else:
            await asyncio.sleep(0.5)


@router.get("/stream/alerts")
def stream_alerts():
    """
    SSE endpoint. The frontend connects here with EventSource to receive
    real-time incident alerts as they are created or updated.
    """
    return StreamingResponse(streamer(), media_type="text/event-stream")


async def mjpeg_generator(camera_id: str):
    """
    MJPEG generator for a specific camera. Waits on the frame buffer's
    condition variable so clients receive each new frame as soon as the
    capture thread publishes it, without the 33ms polling delay the old
    sleep-loop introduced.
    """
    loop = asyncio.get_event_loop()
    frame, last_seq = get_frame_with_seq(camera_id)
    if frame is not None:
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + frame
            + b"\r\n"
        )

    while True:
        # Offload the blocking wait to a thread so the event loop stays free.
        frame, last_seq = await loop.run_in_executor(
            None, wait_for_new_frame, camera_id, last_seq, 1.0
        )
        if frame is None:
            continue
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + frame
            + b"\r\n"
        )


@router.get("/video/feed/{camera_id}")
def video_feed(camera_id: str):
    """
    MJPEG video stream for a specific camera. Returns a continuous stream of
    JPEG frames with YOLO bounding boxes drawn on them.

    Usage in frontend: <img src="/api/video/feed/front-door" />
    """
    return StreamingResponse(
        mjpeg_generator(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )
