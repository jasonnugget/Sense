# Sense — Tech Stack & Architecture

This document explains every technology used in the Sense threat-detection platform, why it was chosen, and how the pieces fit together. Use it to explain the project at the expo and to onboard teammates.

---

## Overview

Sense is a real-time visual threat detection system. Cameras stream video to a Python backend, which runs a YOLO object-detection model on every frame. When a dangerous object (knife, gun) is detected with high enough confidence across multiple frames, the system creates an incident alert and pushes it in real time to a React dashboard.

```
┌──────────────┐    MJPEG     ┌──────────────────────────────────────┐
│  Browser UI  │◄────────────│  FastAPI Backend                      │
│  (React)     │────────────►│  ┌────────┐  ┌──────┐  ┌───────────┐ │
│              │  REST/SSE   │  │ OpenCV  │→ │ YOLO │→ │ Risk      │ │
│              │             │  │ Capture │  │ Model│  │ Engine    │ │
└──────────────┘             │  └────────┘  └──────┘  └───────────┘ │
                             │                              │        │
                             │                        ┌─────▼──────┐ │
                             │                        │ PostgreSQL │ │
                             │                        │ (Incidents)│ │
                             └────────────────────────┴────────────┘
```

---

## Backend

### Python 3.11+
**Why:** Python has the strongest ecosystem for machine learning and computer vision. Libraries like YOLO, OpenCV, NumPy, and PyTorch all have first-class Python support. It also pairs naturally with FastAPI for building web APIs quickly.

### FastAPI
**Why:** FastAPI is a modern, high-performance Python web framework. We chose it because:
- **Automatic API docs** — FastAPI generates Swagger UI at `/docs` and ReDoc at `/redoc` for free. Great for debugging and demos.
- **Pydantic validation** — Request/response schemas are validated automatically using Python type hints. No manual parsing.
- **Async support** — FastAPI is built on Starlette and supports async endpoints, which matters for our SSE streaming.
- **Fast enough** — Despite being Python, FastAPI is one of the fastest Python frameworks (comparable to Go/Node for I/O).

**How we use it:** All REST endpoints (camera control, incidents CRUD) and streaming endpoints (SSE alerts, MJPEG video) are served through FastAPI.

### OpenCV (`opencv-python`)
**Why:** OpenCV is the standard library for computer vision and video I/O. It can:
- Capture from webcams (by index), RTSP streams, IP cameras, and video files — all through the same `cv2.VideoCapture()` API.
- Encode/decode images (JPEG for MJPEG streaming).
- Draw bounding boxes and text overlays on frames.

**How we use it:** Each camera runs in its own thread. OpenCV captures frames, the YOLO model processes them, OpenCV draws bounding boxes, encodes the annotated frame as JPEG, and pushes it to the MJPEG stream buffer.

### YOLOv8 (Ultralytics)
**Why:** YOLO (You Only Look Once) is the go-to model for real-time object detection. It processes an entire image in a single forward pass, making it fast enough for live video (~30 FPS on a GPU, ~5-10 FPS on CPU). Ultralytics provides a clean Python API that handles model loading, inference, and result parsing.

**How we use it:** We load the model once at startup (thread-safe with double-check locking). Every camera thread calls `run_inference(frame, frame_meta)` which runs the YOLO model and returns a list of `ObjectDetection` objects with class names, confidence scores, and bounding boxes.

### Risk Engine
**Why:** Raw YOLO detections are noisy — a single frame might falsely detect a knife in a shadow. The risk engine filters out noise by requiring sustained detection across multiple frames before creating an incident.

**Rules:**
- Only triggers on **dangerous objects** (knife, gun)
- Requires **confidence ≥ 60%**
- Requires detection in **3+ unique frames within a 2-second window**
- Enforces a **30-second cooldown** per camera+object pair to prevent alert spam
- Risk levels: gun → always high; ≥85% confidence → high; ≥70% → medium; else → low

### SQLAlchemy + PostgreSQL
**Why:** Incidents need to survive server restarts. PostgreSQL is a robust, production-ready relational database. SQLAlchemy is Python's standard ORM — it lets us define tables as Python classes and query with Python instead of raw SQL.

**Tables:**
- `incidents` — id, status (open/acknowledged/resolved), risk_level, summary, timestamps
- `detections` — individual YOLO detections linked to an incident (camera_id, class_name, confidence, bounding box, frame_id, timestamp)

**How it works:** When the risk engine promotes a detection to an incident, `create_a_inc()` writes it to the database. The frame_reader thread creates its own database session (no FastAPI request context). API routes use FastAPI's `Depends(get_db)` for session injection.

### Threading Model
**Why:** Each camera needs its own capture loop running at ~30 FPS. Python threads (despite the GIL) work well here because video capture and YOLO inference release the GIL during I/O and C-extension calls (OpenCV, PyTorch).

**How it works:**
- Each camera gets its own `threading.Thread` with its own `threading.Event` stop signal
- The camera registry (`_cameras` dict in `camera.py`) tracks all running cameras
- Shared state (frame buffers, camera registry) is protected with `threading.Lock`
- The YOLO model is loaded once and shared across all threads

### MJPEG Streaming
**Why:** MJPEG (Motion JPEG) is the simplest way to stream live video to a browser. It works in any browser without JavaScript — you just point an `<img>` tag at the endpoint. No WebRTC, no WebSocket, no special codec support needed.

**How it works:** The endpoint returns a `multipart/x-mixed-replace` HTTP response. Each part is a JPEG frame. The browser displays each frame as it arrives, creating a live video effect. The frame_reader writes annotated frames to a per-camera buffer; the MJPEG generator reads from that buffer at ~30 FPS.

### SSE (Server-Sent Events)
**Why:** We need to push incident alerts from the backend to the frontend in real time. SSE is simpler than WebSockets for one-way server-to-client communication. The browser's `EventSource` API handles reconnection automatically.

**How it works:** The frontend opens a persistent connection to `/api/stream/alerts`. When `publish(event)` is called (after an incident is created), the event is added to a queue. The SSE generator loop sends each event as JSON to all connected clients.

---

## Frontend

### React 18
**Why:** React is the most widely used frontend framework. Its component model makes it easy to build complex UIs from reusable pieces. The virtual DOM efficiently updates only what changed.

### TypeScript
**Why:** TypeScript adds type safety to JavaScript. It catches bugs at compile time (wrong prop types, missing fields, typos) rather than at runtime. Essential for a project with multiple developers.

### Vite
**Why:** Vite is a modern build tool that's dramatically faster than Webpack. Hot Module Replacement (HMR) updates the browser in milliseconds when you save a file. It also provides a built-in proxy that forwards `/api` requests to the backend during development, solving CORS issues.

**Proxy config (`vite.config.js`):**
```javascript
server: {
    proxy: {
        '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
},
```

### React Router
**Why:** Handles client-side navigation between pages (Home, Alerts, Cameras, individual Camera view) without full page reloads.

### Key Frontend Patterns

**`useBackendAlerts` hook:** Connects to the SSE endpoint and converts raw backend incidents into the frontend's alert format. Returns `{ backendAlerts, isConnected }`. Alerts from YOLO are merged with mock demo data and sorted by time.

**Camera Go Live flow:**
1. User clicks "Go Live" on a camera page
2. Frontend calls `POST /api/camera/start` with `{ camera_id, source }`
3. Backend spawns a frame_reader thread for that camera
4. Frontend sets `<img src="/api/video/feed/{camera_id}" />` to show the MJPEG stream
5. YOLO bounding boxes are already drawn on the frames
6. Dangerous-object incidents push via SSE to the Alerts page

---

## CORS (Cross-Origin Resource Sharing)

**Why:** The frontend runs on `localhost:5173` (Vite) and the backend on `localhost:8000` (Uvicorn). Browsers block cross-origin requests by default. We add CORS middleware to FastAPI to whitelist the frontend origin.

In production, you would replace the wildcard origins with your actual domain.

---

## How to Run

### Backend
```bash
cd backend
pip install -r requirements.txt
# Make sure PostgreSQL is running with a 'sense_db' database
# Default connection: postgresql://sense:sense@localhost:5432/sense_db
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### Database Setup
```sql
-- In PostgreSQL:
CREATE USER sense WITH PASSWORD 'sense';
CREATE DATABASE sense_db OWNER sense;
```

Tables are created automatically when the backend starts (`create_tables()` in the lifespan handler).

---

## Project Structure

```
Sense/
├── backend/
│   ├── app/
│   │   ├── main.py              — FastAPI app, CORS, startup (model + DB)
│   │   ├── routes/
│   │   │   ├── camera.py        — Camera start/stop/status endpoints
│   │   │   ├── incidents.py     — Incident CRUD endpoints
│   │   │   ├── stream.py        — SSE alerts + MJPEG video feed
│   │   │   └── health.py        — Health check endpoint
│   │   ├── services/
│   │   │   ├── frame_reader.py  — Per-camera capture loop + YOLO + drawing
│   │   │   ├── detector.py      — YOLO model loading + inference
│   │   │   ├── risk_engine.py   — Multi-frame threat confirmation logic
│   │   │   ├── incident_manager.py — Incident CRUD (DB-backed)
│   │   │   └── video_stream.py  — Per-camera frame buffer for MJPEG
│   │   ├── schemas/             — Pydantic request/response models
│   │   └── db/
│   │       ├── database.py      — SQLAlchemy engine + session setup
│   │       └── models.py        — SQLAlchemy table definitions
│   ├── models/                  — YOLO model weights (yolov8n.pt)
│   ├── requirements.txt
│   └── .env                     — DATABASE_URL
├── frontend/
│   ├── src/
│   │   ├── app/App.tsx          — Root component, routing, state management
│   │   ├── pages/
│   │   │   ├── CameraPage.tsx   — Individual camera view (preview + Go Live)
│   │   │   ├── AlertsPage.tsx   — Alert list with review actions
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── AddCameraModal.tsx — Add/edit camera with source config
│   │   │   └── ...
│   │   ├── services/api.ts      — Backend API client functions
│   │   └── hooks/useBackendAlerts.ts — SSE connection hook
│   ├── vite.config.js
│   └── package.json
└── TECH_STACK.md                — This file
```
