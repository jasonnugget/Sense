# Frontend Integration Guide

This doc covers everything the frontend team needs to connect to the backend and test the full detection pipeline. Right now we're using in-memory storage, so data resets when the server restarts. A PostgreSQL database will be added later to persist incidents across restarts — your code won't need to change when that happens since the API stays the same.

---

## Running the Backend

```bash
cd backend
uvicorn app.main:app --reload
```

Server runs at `http://localhost:8000`

To confirm it's up:
```
GET http://localhost:8000/health
```
Response:
```json
{"status": "Up and running :)"}
```

---

## API Endpoints

### Camera Controls

#### Start the camera
```
POST /api/camera/start
Content-Type: application/json
```
Body:
```json
{"source": 0}
```
- `source: 0` = webcam
- `source: "path/to/video.mp4"` = video file

Response:
```json
{
  "status": "started",
  "source": 0,
  "started_at": "2026-04-09T12:00:00Z"
}
```

#### Stop the camera
```
POST /api/camera/stop
```
Response:
```json
{"status": "stopped"}
```

Note: Starting the camera kicks off the full detection pipeline in the background. YOLO runs on each frame, and if a dangerous object (knife, gun) is detected in 3+ frames within 2 seconds, an incident is automatically created and pushed to the SSE stream.

---

### Live Alert Stream (SSE)

```
GET /api/stream/alerts
```

This is a **Server-Sent Events** endpoint. Connect to it to receive incidents in real-time as they're created.

**JavaScript example:**
```javascript
const eventSource = new EventSource("http://localhost:8000/api/stream/alerts");

eventSource.onmessage = (event) => {
  const incident = JSON.parse(event.data);
  console.log("New incident:", incident);
};

eventSource.onerror = (error) => {
  console.error("SSE connection error:", error);
};
```

Each event arrives as a JSON object with this shape:
```json
{
  "id": 1,
  "date_posted": "2026-04-09T12:00:05Z",
  "status": "open",
  "risk_level": "high",
  "objects": [
    {
      "camera_id": "0",
      "class_name": "knife",
      "confidence": 0.87,
      "bbox": {"x": 120, "y": 200, "w": 80, "h": 150},
      "frame_id": "abc-123",
      "timestamp": "2026-04-09T12:00:05Z"
    }
  ],
  "summary": "knife detected on camera 0"
}
```

---

### Incidents

#### Get all incidents
```
GET /api/incidents
```
Response: array of incident objects
```json
[
  {
    "id": 1,
    "date_posted": "2026-04-09T12:00:05Z",
    "status": "open",
    "risk_level": "high",
    "objects": [...],
    "summary": "knife detected on camera 0"
  }
]
```

#### Get a single incident
```
GET /api/incidents/{id}
```
Response: single incident object (same shape as above)

Returns `404` if the incident ID doesn't exist.

#### Update incident status
```
PATCH /api/incidents/{id}
Content-Type: application/json
```
Body:
```json
{"status": "acknowledged"}
```

Valid status values: `"open"`, `"acknowledged"`, `"resolved"`

Response: the updated incident object

Returns `404` if the incident ID doesn't exist.

---

## Data Schemas

### Incident
| Field | Type | Description |
|---|---|---|
| id | int | Auto-generated incident ID |
| date_posted | datetime | UTC timestamp when the incident was created |
| status | string | `"open"`, `"acknowledged"`, or `"resolved"` |
| risk_level | string | `"low"`, `"medium"`, or `"high"` |
| objects | array or null | List of detected objects that triggered this incident |
| summary | string or null | Description of what was detected |

### Detection Object (inside `objects` array)
| Field | Type | Description |
|---|---|---|
| camera_id | string | Which camera source detected this |
| class_name | string | What was detected (e.g. "knife", "gun") |
| confidence | float | Model confidence score (0.0 to 1.0) |
| bbox | object | Bounding box with `x`, `y`, `w`, `h` (pixels) |
| frame_id | string | UUID of the frame this detection came from |
| timestamp | datetime | UTC timestamp of the frame |

### Risk Levels
| Level | When it's assigned |
|---|---|
| high | Gun detected, or any object with confidence >= 0.85 |
| medium | Confidence >= 0.70 |
| low | Confidence below 0.70 |

---

## Suggested Frontend Testing Flow

1. Start the backend server
2. Connect to `GET /api/stream/alerts` with EventSource
3. Hit `POST /api/camera/start` with `{"source": 0}` to start the webcam
4. Point the camera at something — if a dangerous object is detected in enough frames, an incident will appear on the SSE stream
5. Hit `GET /api/incidents` to confirm incidents are stored
6. Hit `PATCH /api/incidents/1` with `{"status": "acknowledged"}` to test status updates
7. Hit `POST /api/camera/stop` to stop the camera

---

## Important Notes

- **In-memory storage**: All incident data lives in memory right now. Restarting the server clears everything. A PostgreSQL database will be added in the next phase to make incidents persist — the API contracts above will stay the same, so your frontend code won't need to change.
- **CORS**: If you're running the frontend on a different port (e.g. localhost:3000), we may need to add CORS middleware to the backend. Let us know if you get blocked by CORS errors.
- **SSE reconnection**: If the backend restarts, your EventSource connection will drop. The browser's EventSource API auto-reconnects by default, but you may want to handle the `onerror` event to show a "reconnecting" state in the UI.
