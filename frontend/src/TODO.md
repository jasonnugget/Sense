# Sense Frontend TODO (UI Progress Roadmap)

Goal: Build a demo-ready UI that showcases progress before backend datasets and live inference are integrated. We will later update ths with data given from both the ML and Backend teams.

Branch: `frontend`
Frontend path: `frontend/` (React + Vite)

---

## UI Concepts / Requirements

### Activity Alerts (core concept)

- Alerts represent events detected from:
  - **YOLOe CV detection** output (objects + confidence + threat mapping)
  - **LLM scan** output (image + reasoning + threat mapping)
- **Only show a "confirmed" danger alert when YOLOe AND LLM agree** on danger.
- Each alert has a **threat level** that controls color + priority.
- Alerts are stored and viewable for **24 hours** (backend will handle storage later; for now mock it).

### Threat Level Color System (frontend contract)

(Exact colors can be adjusted later; map must exist now.)

- `SAFE` (no threat) -> green/neutral
- `LOW` -> yellow
- `MEDIUM` -> orange
- `HIGH` -> red
- `CRITICAL` -> purple or deep red
- `UNCONFIRMED` (YOLOe XOR LLM) -> gray (optional; may be hidden entirely)

Frontend should assume alerts look like:

```json
{
  "id": "evt_123",
  "cameraId": "parking_lot",
  "cameraName": "Parking Lot",
  "timestamp": "2026-02-24T15:30:00Z",
  "yolo": {
    "danger": true,
    "level": "HIGH",
    "confidence": 0.86,
    "objects": ["knife"]
  },
  "llm": {
    "danger": true,
    "level": "HIGH",
    "confidence": 0.78,
    "summary": "Weapon-like object detected"
  },
  "agreed": true,
  "finalLevel": "HIGH",
  "message": "Weapon detected (HIGH)",
  "expiresAt": "2026-02-25T15:30:00Z"
}
```
