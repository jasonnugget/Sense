# Sense — Backend ↔ Frontend Integration Guide

This document explains how the backend and frontend are connected, what was built, and how to run the full system for the expo demo. Share this with your teammates so everyone understands the end-to-end flow.

---

## Architecture Overview

```
[User's Webcam / Video File]
        |
        v
[FastAPI Backend (Python)]
   |-- OpenCV captures frames
   |-- YOLO model detects objects in each frame
   |-- Draws bounding boxes (red=dangerous, green=safe) on frames
   |-- Risk engine checks if detection should create an incident
   |
   |-- /api/video/feed  -----> MJPEG stream (annotated frames with boxes)
   |-- /api/stream/alerts ---> SSE stream (real-time incident notifications)
   |
   v
[React Frontend (Vite + TypeScript)]
   |-- CameraPage shows MJPEG stream (live detection view)
   |-- Alerts page shows real-time incidents from SSE
   |-- Activity panel on home page shows threat counts
```

---

## What Was Built (New Files & Changes)

### Backend (Python / FastAPI)

| File | What it does |
|------|-------------|
| `backend/requirements.txt` | **NEW** — Lists all Python dependencies needed to run the backend |
| `backend/app/main.py` | **MODIFIED** — Added CORS middleware so the React frontend can make API calls to the backend without being blocked by browser security |
| `backend/app/services/video_stream.py` | **NEW** — Shared frame buffer. The frame reader writes JPEG frames here, and the MJPEG endpoint reads from here. Uses a thread lock so both threads can safely access the same data. |
| `backend/app/services/frame_reader.py` | **MODIFIED** — Now draws bounding boxes on frames and pushes them to the video_stream buffer instead of opening a cv2 window. This is what makes detection visible on the frontend. |
| `backend/app/routes/stream.py` | **MODIFIED** — Added the `/api/video/feed` MJPEG endpoint alongside the existing SSE alert stream. |
| `backend/app/routes/camera.py` | **MODIFIED** — Added `/api/camera/status` endpoint and clears the frame buffer when camera stops. |

### Frontend (React + TypeScript)

| File | What it does |
|------|-------------|
| `frontend/vite.config.js` | **MODIFIED** — Added proxy config so `/api` requests get forwarded to the backend at `localhost:8000`. This means the frontend never needs to hardcode the backend URL. |
| `frontend/src/services/api.ts` | **NEW** — All backend API functions in one file. Handles starting/stopping camera, fetching incidents, and connecting to SSE. |
| `frontend/src/hooks/useBackendAlerts.ts` | **NEW** — React hook that connects to the SSE stream and converts backend incidents into the alert format the UI uses. |
| `frontend/src/app/App.tsx` | **MODIFIED** — Now uses `useBackendAlerts` to merge real backend alerts with the mock demo alerts. Real alerts appear alongside mock data, sorted by time. |
| `frontend/src/pages/CameraPage.tsx` | **MODIFIED** — Added "Go Live" detection mode. Users can start YOLO detection with one button. The annotated MJPEG stream shows directly in the browser. |
| `frontend/src/pages/CameraPage.css` | **MODIFIED** — Added styles for Go Live button, detection badge, and MJPEG stream display. |
| `frontend/index.html` | **MODIFIED** — Fixed script entry point reference. |

---

## How Each Feature Works

### 1. CORS (Cross-Origin Resource Sharing)

**Problem:** Browsers block frontend JavaScript from making requests to a different origin (port). The frontend runs on `localhost:5173` and the backend on `localhost:8000`.

**Solution:** We added CORS middleware to FastAPI that explicitly allows requests from the frontend's origin. This tells the browser "yes, this frontend is allowed to talk to me."

```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

We also set up a Vite proxy as a backup — requests to `/api/...` on the frontend are automatically forwarded to the backend.

### 2. MJPEG Video Stream (How Detection Gets to the Browser)

**What is MJPEG?** It stands for Motion JPEG. Instead of a complex video codec, the server sends a continuous stream of JPEG images over HTTP. The browser's `<img>` tag can display this as live video — no JavaScript video player needed.

**Flow:**
1. `frame_reader.py` captures a frame from OpenCV
2. YOLO runs inference → returns list of detected objects
3. `draw_detections()` draws colored bounding boxes on the frame
4. Frame is encoded as JPEG and stored in `video_stream.py`'s shared buffer
5. The `/api/video/feed` endpoint reads the latest frame and sends it as part of an MJPEG multipart response
6. The frontend displays it with: `<img src="/api/video/feed" />`

**Why MJPEG?** It's simple, works in every browser, and doesn't require WebSocket or WebRTC setup. For a demo, reliability matters more than efficiency.

### 3. SSE (Server-Sent Events) for Real-Time Alerts

**What is SSE?** A one-way persistent HTTP connection where the server can push data to the client. The browser's `EventSource` API handles connection, reconnection, and message parsing automatically.

**Flow:**
1. Frontend opens `EventSource('/api/stream/alerts')`
2. When the risk engine creates an incident (dangerous object in 3+ frames), `publish()` adds it to the queue
3. The SSE `streamer()` loop detects the new event and sends it as JSON
4. The `useBackendAlerts` hook receives it, transforms it to the UI alert format
5. The alert appears in the Activity Panel, Alerts page, and Home page

**Risk engine trigger rules:**
- Object must be in the `dangerous_objects` set (knife, gun)
- Confidence must be ≥ 0.60 (60%)
- Must appear in ≥ 3 frames within a 2-second window
- 30-second cooldown between incidents for the same object class

### 4. Go Live Button (CameraPage)

When the user clicks "Go Live — Start Detection":
1. Frontend calls `POST /api/camera/start` with `{"source": 0}` (0 = default webcam)
2. Backend spawns a background thread running `frame_reader()`
3. The frame reader opens the camera with OpenCV and starts the detection loop
4. The CameraPage switches to showing the MJPEG `<img>` stream
5. Detected objects appear as colored bounding boxes in real time
6. Incidents trigger alerts that flow through SSE to the Alerts page

When the user clicks "Stop Detection":
1. Frontend calls `POST /api/camera/stop`
2. Backend sets the `stop_flag`, the frame reader loop exits
3. Camera is released, frame buffer is cleared
4. CameraPage returns to the idle state

### 5. Alert Merging (Mock + Real Data)

The frontend maintains both:
- **Mock alerts** — pre-built demo data so the UI always has something to show
- **Backend alerts** — real incidents from YOLO detections

Both are merged into a single sorted list in `App.tsx`:
```javascript
const alertEvents = [...backendAlerts, ...mockAlerts].sort((a, b) => b.time - a.time);
```

This means during the expo, you'll see the demo alerts as "historical" data and the live YOLO detections as new alerts appearing at the top.

---

## How to Run the Full System

### Prerequisites
- Python 3.10+ with pip
- Node.js 18+ with npm
- A webcam (built-in or USB)
- The YOLO model file at `backend/models/SenseV2Training.pt`

### Step 1: Start the Backend

```bash
cd backend

# Create and activate virtual environment (first time only)
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install dependencies (first time only)
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify it works: open `http://localhost:8000/health` in your browser — you should see `{"status":"Up and running :)"}`.

### Step 2: Start the Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Run the dev server
npm run dev
```

This starts Vite on `http://localhost:5173`. Open it in your browser.

### Step 3: Go Live

1. Navigate to any camera (click a camera card on the Home page)
2. Click the green **"Go Live — Start Detection"** button
3. Grant camera permission if prompted by your OS
4. You should see the live camera feed with bounding boxes around detected objects
5. If a dangerous object is detected, an alert will appear on the Alerts page

### Troubleshooting

| Problem | Solution |
|---------|----------|
| "Camera already running" error | The camera was started but not stopped cleanly. Restart the backend server. |
| No video showing after Go Live | Check that the YOLO model file exists at `backend/models/SenseV2Training.pt`. Check the backend terminal for errors. |
| Alerts not appearing | Make sure the backend is running. Check the browser console for SSE connection errors. |
| CORS errors in browser console | Make sure the backend has CORS middleware and is running on port 8000. |
| Camera permission denied | Check your OS camera privacy settings. On Windows: Settings → Privacy → Camera. |

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Returns backend status |
| `/version` | GET | Returns backend version info |
| `/api/camera/start` | POST | Starts camera capture + YOLO detection. Body: `{"source": 0}` |
| `/api/camera/stop` | POST | Stops camera capture |
| `/api/camera/status` | GET | Returns `{"is_running": true/false, ...}` |
| `/api/video/feed` | GET | MJPEG stream of annotated frames (use in `<img>` tag) |
| `/api/stream/alerts` | GET | SSE stream of incident alerts (use with `EventSource`) |
| `/api/incidents` | GET | Lists all incidents |
| `/api/incidents` | POST | Creates an incident |
| `/api/incidents/{id}` | GET | Gets a single incident |
| `/api/incidents/{id}` | PATCH | Updates incident status. Body: `{"status": "acknowledged"}` |

---

## Key Concepts for the Expo Presentation

1. **Real-time pipeline:** Camera → OpenCV → YOLO → Risk Engine → SSE → Dashboard. Under 3 seconds end-to-end.
2. **MJPEG streaming:** Simple, reliable way to get annotated video into the browser without complex video codecs.
3. **SSE (Server-Sent Events):** Lightweight one-way push from server to browser. Auto-reconnects. No WebSocket complexity.
4. **Risk engine:** Not every detection creates an alert — the engine requires multiple frames and confidence thresholds to reduce false alarms.
5. **CORS + Proxy:** Two layers ensuring the frontend and backend can communicate despite being on different ports.

---

## File Tree (What Changed)

```
Sense/
├── INTEGRATION_GUIDE.md          ← You are here
├── backend/
│   ├── requirements.txt          ← NEW: Python dependencies
│   ├── app/
│   │   ├── main.py               ← MODIFIED: Added CORS
│   │   ├── routes/
│   │   │   ├── stream.py         ← MODIFIED: Added MJPEG endpoint
│   │   │   └── camera.py         ← MODIFIED: Added status endpoint
│   │   └── services/
│   │       ├── video_stream.py   ← NEW: Shared frame buffer
│   │       └── frame_reader.py   ← MODIFIED: Draws boxes, pushes to buffer
│   └── ...
├── frontend/
│   ├── vite.config.js            ← MODIFIED: Added backend proxy
│   ├── index.html                ← MODIFIED: Fixed entry point
│   ├── src/
│   │   ├── services/
│   │   │   └── api.ts            ← NEW: Backend API client
│   │   ├── hooks/
│   │   │   └── useBackendAlerts.ts ← NEW: SSE alert hook
│   │   ├── app/
│   │   │   └── App.tsx           ← MODIFIED: Wired backend alerts
│   │   └── pages/
│   │       ├── CameraPage.tsx    ← MODIFIED: Added Go Live mode
│   │       └── CameraPage.css    ← MODIFIED: Added detection styles
│   └── ...
└── ...
```
