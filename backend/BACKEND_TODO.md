# Backend Team To-Do List (12 Weeks)

Full task list in build order. Check off items as you complete them.

## Current Build Mode

For now, focus on:
- endpoint creation
- service/connectors wiring
- core backend logic
- mock or in-memory data flows

Do not block progress on perfect/real data during this stage.
Hard-data validation and realism checks are tracked in the testing section below.

---

## Phase 1: Foundation (Weeks 1-2) -- Work independently

**Goal**: Runnable backend skeleton with mock data that the frontend can connect to.

- [x] Create FastAPI app skeleton (`main.py` with router wiring)
- [x] Build `GET /health` endpoint
- [x] Build `GET /version` endpoint
- [x] Define `BBox` and `Detection` Pydantic schemas (`schemas/detection.py`)
- [x] Define `Incident` and `IncidentStatusUpdate` Pydantic schemas (`schemas/incident.py`)
- [x] Build `GET /api/incidents` endpoint (return hardcoded mock list)
- [x] Build `GET /api/incidents/{id}` endpoint (return single mock incident)
- [x] Build `PATCH /api/incidents/{id}/status` endpoint (accept status update)
- [x] Build `GET /api/stream/alerts` SSE endpoint (connection + publish flow; hard-data alerts in Testing section)
- [x] Build `POST /api/camera/start` and `POST /api/camera/stop` placeholders
- [ ] Build standalone OpenCV script that reads webcam/video and prints frame info
- [ ] Add placeholder `router = APIRouter()` to empty route files so app doesn't crash
- [ ] Remove unused `FastAPI` import from `health.py`
- [ ] Verify everything runs with `uvicorn app.main:app --reload`

**SYNC with Frontend**: Frontend connects to `GET /api/stream/alerts` and confirms mock alerts render in their dashboard.

---

## Testing & Hard Data Validation (Add after endpoint skeleton is stable)

**Goal**: Validate real-looking payloads and behavior after core routes/connectors are in place.

- [ ] Create fixed detection + incident fixture payloads (realistic values, consistent IDs/timestamps)
- [ ] Add API contract checks using hard-data fixtures for incidents endpoints
- [ ] Add SSE test feed using hard-data mock alerts (not random shape)
- [ ] Verify frontend renders hard-data alerts exactly as expected
- [ ] Run manual `curl` checks for all Phase 1 routes with fixture data

---

## Phase 2: First Real Detection Loop (Weeks 3-4) -- First integration

**Goal**: Replace all mocks with real YOLO detections flowing to the dashboard.

- [ ] Integrate OpenCV frame reader into FastAPI as a background task
- [ ] Get trained `.pt` model file and class list from Vision team
- [ ] Load YOLO model and run inference on frames
- [ ] Normalize YOLO output into `Detection` schema
- [ ] Build basic in-memory incident manager (create incidents from detections)
- [ ] Wire real detections into SSE stream (replace mock data)
- [ ] Wire incident endpoints to in-memory store (replace hardcoded mocks)
- [ ] Test end-to-end with a known demo video (detections appear in dashboard within 3 seconds)

**SYNC with Vision**: Get their `.pt` model file and class list. Confirm classes match your schemas. Get a test video clip.

**SYNC with Frontend**: Replace mock SSE with real detections. Frontend confirms real alerts render. All teams freeze schema -- no more renaming fields.

---

## Phase 3: Risk Engine + Database (Weeks 5-6) -- Joint development

**Goal**: Smart alerting rules and persistent storage.

- [ ] Build risk engine: consecutive frame rule (dangerous class in >=3 frames within 2s)
- [ ] Build risk engine: confidence threshold (>= 0.60)
- [ ] Build risk engine: cooldown timer (30s between incidents for same class)
- [ ] Build incident state machine (open -> acknowledged -> resolved)
- [ ] Set up PostgreSQL and create database tables (detections, incidents)
- [ ] Build database layer in Python (SQLAlchemy or asyncpg)
- [ ] Create Alembic migrations for tables
- [ ] Wire incident endpoints to database (replace in-memory store)
- [ ] Wire detection logging to database

**SYNC with Vision**: Get threshold recommendations per class (e.g., gun needs 0.70 confidence, person needs 0.50).

**SYNC with Frontend**: Confirm `PATCH /api/incidents/{id}/status` works with their ack/resolve buttons.

---

## Phase 4: LLM Summary (Weeks 7-8) -- Joint development

**Goal**: Call OpenAI to generate a short summary when an incident is created or escalates.

- [ ] Set up OpenAI Python SDK with API key in `.env`
- [ ] Build async summary service (runs in background, doesn't block alerts)
- [ ] Design the prompt (structured detection data in, short summary out)
- [ ] Add 30-second cooldown so LLM isn't called too frequently
- [ ] Add timeout + fallback (if LLM takes >5s, incident works without summary)
- [ ] Store summaries in database, include in Incident response

**SYNC with Frontend**: They build a summary panel. Confirm `summary` field appears correctly and they handle `null` (LLM timeout).

**SYNC with Vision**: They deliver improved model checkpoint. Swap `.pt` file and verify detection quality.

---

## Phase 5: Hardening (Weeks 9-10) -- Bug fixes only, no new features

**Goal**: Reliable enough for a 30-minute live demo.

- [ ] Add error handling: camera disconnect recovery
- [ ] Add error handling: SSE client disconnect/reconnect
- [ ] Add error handling: database connection retry
- [ ] Write pytest tests for risk engine rules
- [ ] Write pytest tests for incident status transitions
- [ ] Write pytest tests for schema validation
- [ ] Write pytest tests for API endpoints using TestClient
- [ ] Set up GitHub Actions CI to run tests on push
- [ ] Create `Dockerfile` and `docker-compose.yml`
- [ ] Run 30-minute stability test (no crashes, no memory leaks)
- [ ] Prepare 2 fallback prerecorded demo videos

**SYNC with all teams**: Full dress rehearsal. Live camera, real model, real dashboard. Fix anything that breaks.

---

## Phase 6: Expo Prep (Weeks 11-12) -- Code freeze

**Goal**: Polish, document, rehearse.

- [ ] Clean up config (no hardcoded values, everything in `.env`)
- [ ] Clean up logs (useful info, not debug spam)
- [ ] Write one-page backend runbook (how to start, stop, troubleshoot)
- [ ] List top 5 failure cases + recovery steps
- [ ] Run 2 full timed rehearsals with all teams
- [ ] Freeze code after final rehearsal

**SYNC with all teams**: Assign expo speaking roles. Practice transitions. Everyone knows what to say and when.
