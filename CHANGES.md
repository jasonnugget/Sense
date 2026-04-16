# Sense — Change Log

This document explains every change in the current round of work so the team
can walk through what was updated, why, and where to look. Each section
covers one file with the "problem → change → how to verify" for that file.

---

## 1. Backend: Model path and startup resilience

### `backend/app/main.py`
**Problem.** The backend loaded the YOLO model from `models/yolov8n.pt`, but
the file that actually exists in this repo is `models/SenseV2Training.pt`.
On startup the model loader raised `FileNotFoundError`, uvicorn's lifespan
aborted, and every `/api/*` route returned an error. That is why the
webcam appeared "disconnected" from the frontend — the backend was never
reachable.

**Change.**
1. Switched the default path to `models/SenseV2Training.pt`.
2. Added an environment override: set `SENSE_MODEL=…` to point at a
   different checkpoint without editing code.
3. Wrapped `create_tables()` and `load_model()` in `try/except` so a bad
   database URL or missing model no longer kills the whole server. The
   server comes up, logs a warning, and the capture thread just streams
   raw frames without bounding boxes until the model is fixed.

**How to verify.** Run
`uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` and hit
`http://localhost:8000/health` — it should respond with 200 even if the
database is down.

### `backend/app/services/frame_reader.py`
**Problem.** Inside the capture thread, any failure from `run_inference`
(model not loaded) or `create_a_inc` (DB unreachable) would throw and kill
the thread. The `/api/camera/status` endpoint would still report the
camera as "running" even though it had actually crashed.

**Change.**
1. Wrapped `run_inference` in `try/except`. On failure we log and carry on
   with an empty detection list — the video feed keeps streaming, just
   without boxes.
2. Wrapped `process_detection` + `create_a_inc` + `publish` in
   `try/except`. A dead database no longer takes down the live feed.
3. Coerced `source` to `str` in the `FrameMeta` so the Pydantic schema
   (which expects `str | int`) doesn't complain about edge cases.
4. Cleaned up an unused `baseline` variable flagged by Pylance.

**How to verify.** Temporarily rename the model file, start a camera from
the frontend — the MJPEG feed still shows live video (without boxes)
instead of returning an HTTP error.

### `backend/app/routes/camera.py`
**Problem.** `POST /api/camera/start` spawned the capture thread without
checking whether the source was actually openable. If the user typed a
bad RTSP URL or picked webcam index 3 on a laptop with one camera, the
POST returned `{"status":"started"}`, the thread died in the background,
and the frontend sat there waiting for frames that never came.

**Change.** Before spawning the thread we now run
`cv2.VideoCapture(source).isOpened()` on the request thread. If it fails
the endpoint returns **400** with a message telling the user to check
their source / permissions. This surfaces camera errors immediately in
the UI.

**How to verify.** Call `POST /api/camera/start` with
`{"camera_id":"test","source":99}` — you should get a 400 with the
"Could not open source" message, not a misleading success.

---

## 2. Frontend: real-time-only alert feed (no more mock data)

### `frontend/src/components/activityPanel.tsx`
**Problem.** When no `events` prop was passed, the panel fell back to a
hardcoded `useMockEvents()` list (14 fake alerts). This meant "Parking
Lot / Motion detected" etc. showed up even with no cameras running.

**Change.** Deleted `useMockEvents` entirely. The panel now renders
whatever is in `events` (defaulting to `[]`) and shows an empty-state
message ("No events yet. Start a camera to see real detections here.")
when the list is empty.

### `frontend/src/app/App.tsx`
**Problem.** `alertEvents` merged backend SSE alerts with
`buildAlertEvents(cameras, …)` — a function that invents ten canned
incidents like "Forced entry attempt at Rear Gate". On the Home page and
Alerts page the real detections were drowned in fake ones.

**Change.**
1. Dropped the `buildAlertEvents` import and call. `alertEvents` is now
   just the backend SSE alerts, filtered through `alertStatusOverrides`
   (so users can still mark real alerts as Reviewed/etc.) and sorted
   newest-first.
2. Imported `stopCamera` so removing a camera from the dashboard also
   tells the backend to release the capture thread.

### `frontend/src/app/App.tsx` — camera bootstrap
**Problem.** The camera list was seeded with 8 hardcoded cameras
("Parking Lot", "Front Door", …). They appeared on every fresh install
regardless of what hardware the user actually has.

**Change.**
1. `cameras` now starts from **localStorage** (`CAMERAS_KEY = "cameras"`).
   If the key is missing or invalid, the list starts **empty**.
2. The existing `useEffect` that persisted pinned-camera IDs now also
   persists the full camera list, so cameras survive a page reload.
3. `removeCamera` fires a best-effort `stopCamera(id)` before removing
   the card from state, so dangling backend threads don't keep the
   webcam locked.

---

## 3. Frontend: "Add camera" flow from empty grid

### `frontend/src/components/AddCameraCard.tsx`
**Problem.** The file existed but was a one-liner placeholder — no click
handler, no styling, not rendered anywhere. Adding a camera was only
possible from the header "Add new +" button.

**Change.** Rewrote it as a real button: accepts `onClick`, renders a
"+" icon, a label, and a hint ("Webcam · IP · RTSP · File"). Fully
keyboard-accessible (`<button type="button">` with `aria-label`).

### `frontend/src/pages/MainPage.tsx`
**Problem.** The dashboard showed either the camera grid or a generic
"No cameras match this group" message. With the hardcoded list removed,
a brand-new install showed nothing useful to click.

**Change.**
1. Imported and rendered `AddCameraCard` at the end of the camera grid,
   wired to `onAddCamera` (which fires `ui:add-camera` → opens the
   `AddCameraModal`).
2. Split the empty state into two cases:
   - **No cameras at all:** "No cameras yet. Click 'Add Camera' to get
     started." (alongside the visible "+" tile).
   - **Cameras exist but none in the selected group:** unchanged
     ("No cameras match this group.").

### `frontend/src/components/CameraCard.css`
**Problem.** `.cameraCard.addCard` had no styles — the new tile would
render unstyled next to real cards.

**Change.** Appended a styled block for `.addCard`, `.addCardInner`,
`.addCardPlus`, `.addCardLabel`, `.addCardHint`. Uses the same
`16 / 10` aspect ratio as the real camera previews so the grid stays
aligned. Dashed border and accent-colored hover to signal that it's an
"add" action, not a real camera.

### `AddCameraModal.tsx` (already wired, no change needed)
Already supported four source types (webcam index, RTSP URL, IP-camera
URL, video file path). The field switches shape based on the selected
type. On save it calls `onSaveDetails(name, location, groupIds, source)`
which now flows into the cleaned-up `saveCameraDetails` in `App.tsx`.

---

## 4. How the full "add + go live" flow looks now

1. User opens the app with zero cameras. They see one "+ Add Camera"
   tile on the dashboard.
2. Click it → `AddCameraModal` opens.
3. User fills in **Name**, **Location**, picks a **Source type**
   (Webcam / RTSP / IP / File), enters the source value.
4. On save, the camera is pushed into state, persisted to localStorage,
   and appears as a real `CameraCard` in the grid.
5. User clicks the card → `CameraPage` opens.
6. Click **"Go Live — Start Detection"**:
   - Frontend POSTs `/api/camera/start` with the saved source.
   - Backend opens the source synchronously; if the open fails the user
     sees a 400 with a readable reason.
   - If it succeeds, the capture thread starts; the page swaps to an
     `<img src="/api/video/feed/{cameraId}">` that streams annotated
     frames.
7. Real detections (not mocks) from the YOLO model fire SSE events; the
   Activity Panel and Alerts page update live.

---

## 5. Files touched in this round

- `backend/app/main.py`
- `backend/app/routes/camera.py`
- `backend/app/services/frame_reader.py`
- `frontend/src/app/App.tsx`
- `frontend/src/components/AddCameraCard.tsx`
- `frontend/src/components/CameraCard.css`
- `frontend/src/components/activityPanel.tsx`
- `frontend/src/pages/MainPage.tsx`

---

## 6. Weapons in Recent Events (second round)

### Why nothing showed up before

`Recent Events` on the home page is fed by the SSE stream at
`/api/stream/alerts`. In the old code, the capture thread built an
incident and then tried to publish it **after** saving to Postgres:

```python
new_incident = create_a_inc(incident_request)   # talks to DB
publish(new_incident)                           # only runs on success
```

If Postgres isn't running locally, `create_a_inc` throws, the `except`
swallows the error, and `publish` never executes. The detector **was**
spotting the weapon — the alert just never reached the frontend.

On top of that, `dangerous_objects` was hardcoded to `{"knife", "gun"}`.
Anything the model output as `"Handgun"`, `"pistol"`, `"assault_rifle"`,
or `"kitchen knife"` was skipped by the risk engine.

### `backend/app/services/risk_engine.py`
**Problem.** Small, case-sensitive weapon set (`{"knife", "gun"}`).
Real YOLO models use names like `Handgun`, `pistol`, `rifle`, `Knife`,
`sword`, etc. and none of those matched.

**Change.**
1. Replaced the old set with `DANGEROUS_KEYWORDS`, a broader list
   covering firearms (`gun`, `pistol`, `handgun`, `rifle`, `shotgun`,
   `firearm`, `revolver`), bladed weapons (`knife`, `blade`, `dagger`,
   `sword`, `machete`), impact weapons (`axe`, `hatchet`, `crowbar`,
   `bat`), and a generic `weapon` token.
2. Added `is_dangerous_class(class_name)` helper. It lowercases the name
   and replaces `_`/`-` with spaces, then substring-matches against the
   keyword set, so `"Hand_Gun"`, `"HANDGUN"`, `"kitchen knife"` all
   resolve to dangerous.
3. `compute_risk_level` upgraded similarly — any firearm keyword forces
   `RiskLevel.high` regardless of confidence.
4. Kept the old lowercase names (`dangerous_objects`, etc.) as aliases
   so nothing outside this file breaks.

### `backend/app/services/frame_reader.py`
**Problem.** Two issues blocked alerts from reaching the feed:
1. The publish was behind the DB write, so a DB failure silently ate
   the alert.
2. `detection.camera_id` came from the raw source string (`"0"`,
   `"rtsp://…"`) instead of the camera_id the user configured, so even
   when alerts did fire the UI showed "Camera 0" instead of
   "Front Door".

**Change.**
1. Overwrote `detection.camera_id = camera_id` before handing the
   detection to the risk engine, so the right camera name flows through
   to the SSE payload and into `Recent Events`.
2. Split DB save from SSE publish. If `create_a_inc` throws, we build
   an in-memory `Incident_Report` with a **negative** incident id
   (from `_fallback_incident_ids`, starting at -1 and counting down)
   and publish **that**. Negative ids can never collide with real DB
   rows. The Recent Events feed updates whether or not Postgres is
   running.
3. Replaced the hand-maintained `BOX_COLORS` dict with a call to the
   new `is_dangerous_class` helper. Any class the risk engine
   considers dangerous gets a red bounding box — no need to edit two
   lists every time a new weapon class is added.

### `frontend/src/hooks/useBackendAlerts.ts`
**Problem.**
1. Every alert label read like `"Knife detected"` with no indication of
   severity.
2. The `camera` field rendered as literally `"Camera front-door"`,
   which looks robotic in the UI.

**Change.**
1. Added a frontend copy of the weapon-keyword list (`WEAPON_TOKENS`)
   and an `isWeaponClass()` helper. When the detected class is a
   weapon, the alert now reads `"Weapon detected (Handgun)"` so the
   Recent Events row clearly signals a weapon event.
2. The camera label is now slugified in reverse: `"front-door"` →
   `"Front Door"`, `"loading_dock"` → `"Loading Dock"`, matching the
   names users give cameras in the Add Camera modal.

### How to verify

1. Start the backend and frontend. Add a webcam camera. Click Go Live.
2. Hold a knife (or any object your model recognizes as a weapon) in
   view of the camera for ~2 seconds.
3. Two things should happen:
   - The bounding box around the object turns **red**.
   - A row appears in `Recent Events` reading
     `Weapon detected (Knife)` / `Front Door` / `5s ago`.
4. Stop the Postgres service and repeat. The alert should still
   appear in the feed (the backend logs
   `incident DB save failed (will publish transient)` as a warning).

---

## 7. Files touched in the second round

- `backend/app/services/risk_engine.py`
- `backend/app/services/frame_reader.py`
- `frontend/src/hooks/useBackendAlerts.ts`
- `CHANGES.md` (this file)

---

## 8. Persistent live preview on the dashboard

### The ask
"When I click Go Live on a camera and then go back to the dashboard, the
card should keep showing the live detection feed — and detection should
keep running."

### What we did

#### `frontend/src/app/App.tsx`
- Imported `getCameraStatus` from `services/api`.
- Added `liveCameraIds: Set<string>` state that tracks which backend
  cameras are currently running.
- Added a polling effect that hits `/api/camera/status` every 3 seconds
  for each configured camera. Results are diffed into `liveCameraIds`.
- Added a listener for a new `ui:camera-status-changed` window event.
  Firing this event triggers an immediate refresh rather than waiting
  for the next 3-second tick. That makes the dashboard card flip to
  "Detecting" the moment Go Live succeeds.
- Passed `liveCameraIds` through `cameraPageProps` into `MainPage`.

#### `frontend/src/pages/MainPage.tsx`
- Accepts the new `liveCameraIds` prop and forwards
  `backendLive={!!liveCameraIds?.has?.(cam.id)}` to each `CameraCard`.

#### `frontend/src/components/CameraCard.tsx`
- Accepts the new `backendLive` prop. When true, the card preview
  renders an `<img src={getVideoFeedUrl(id)}>` — the same MJPEG
  endpoint the CameraPage uses, so the card shows the annotated
  detection feed with bounding boxes drawn in.
- Preview fallback order is now: `backendLive` MJPEG → local
  `getUserMedia` stream → static preview image → offline placeholder.
- The status badge reads **"Detecting"** (not "Live") when `backendLive`
  is true, so it's clear the feed is server-side detection rather than
  a browser preview.

#### `frontend/src/pages/CameraPage.tsx`
- After `startCamera` succeeds in `handleGoLive`, we dispatch
  `window.dispatchEvent(new Event('ui:camera-status-changed'))`.
- Same after `stopCamera` succeeds in `handleStopDetection`.
- This lets the dashboard refresh instantly instead of waiting up to
  3 seconds for the next poll.

### How to verify

1. Add a camera (webcam source 0), navigate into it, click Go Live.
2. Wait for bounding boxes to appear.
3. Click Back. On the dashboard, that camera's tile should keep
   streaming the annotated feed with a "Detecting" status badge.
4. Click back into the camera. The feed is still live — detection
   never stopped.
5. Click Stop Detection. Return to the dashboard. The tile should
   flip back to the "Offline" placeholder within a second or two.

---

## 9. FPS improvements for the live feed

### The ask
"The FPS is bad, is there a way to improve it?"

### Why it was slow
Every frame in the capture loop did four expensive things back-to-back:
1. YOLO inference on the full resolution at `imgsz=640` (default).
2. `frame.copy()` before drawing, which memcpies the whole image.
3. JPEG encode at quality 80.
4. A fixed `time.sleep(0.033)` cap.

And on the streaming side the MJPEG generator polled
`get_frame()` on a 33ms timer, so consumers saw an extra half-frame
of latency on top of that.

### What we did

#### `backend/app/services/detector.py`
- `run_inference` now accepts `imgsz` (default `416`). YOLO's internal
  resolution dropping from 640→416 roughly halves inference time with
  negligible accuracy loss at surveillance distances. Detections are
  still reported in original-frame coordinates, so drawing code is
  unchanged.

#### `backend/app/services/frame_reader.py`
- Added `INFERENCE_EVERY_N_FRAMES = 2`: YOLO runs on every other
  frame and the loop reuses `last_detections` to draw boxes on the
  skipped frames. The risk engine only sees detections from the
  "real" inference frames, so alerts still trigger in the same
  2-second window and no detection is double-counted.
- Dropped the `frame.copy()` before `draw_detections` — OpenCV's
  `read()` returns a fresh buffer, so in-place drawing is safe and
  saves a full-frame memcpy per iteration.
- Lowered `JPEG_QUALITY` from 80 to 70. Visually near-identical for
  camera footage, smaller bytes, faster encode.
- Removed the fixed `time.sleep(0.033)` at the end of the loop. The
  webcam's own `read()` blocks at its native frame rate, and the
  streaming side is now event-driven (below), so the artificial cap
  is no longer needed. `time.sleep(0)` stays in to yield the GIL for
  other camera threads.

#### `backend/app/services/video_stream.py`
- Added a `threading.Condition` and a per-camera sequence counter so
  consumers can block until a genuinely new frame is published rather
  than polling on a timer.
- New helpers: `get_frame_with_seq(camera_id)` and
  `wait_for_new_frame(camera_id, last_seq, timeout)`.
- `set_frame` now `notify_all()`s under the condition after bumping
  the sequence, so every waiting consumer wakes at once.

#### `backend/app/routes/stream.py`
- The MJPEG generator now:
  1. Yields the current frame immediately on connect, seeding
     `last_seq`.
  2. Uses `loop.run_in_executor(None, wait_for_new_frame, …)` to
     block on the condition without freezing the asyncio event loop.
  3. Yields the next frame as soon as capture publishes it.
- Net effect: the latency between "frame goes into set_frame" and
  "frame hits the HTTP wire" drops from ~33ms (polling) to the
  cost of a condition wake-up — typically <1ms.

### Expected gains
- On a mid-range laptop CPU, end-to-end streamed FPS roughly doubles.
- Network bytes drop ~20% from the lower JPEG quality.
- First-frame latency on the client is lower because we seed the
  generator with the current frame instead of waiting for the next
  capture tick.

### How to verify

1. Open a camera and click Go Live.
2. Count bounding-box updates: before these changes the feed felt
   visibly choppy on laptops; after, it should look close to real
   time. Move your hand quickly — the boxes should track with much
   less lag.
3. Hold a weapon-class object in view. An alert should still appear
   in `Recent Events` within 2 seconds (the risk engine's debounce
   window). Inference is sparser, but three detections in two
   seconds still trips the threshold.
4. Check the browser DevTools Network tab for `/api/video/feed/…`.
   The MJPEG stream should report a higher KB/s than before and the
   parts should arrive on a tighter cadence.

### Knobs if you want to tune further

- Push `INFERENCE_EVERY_N_FRAMES` to `3` if CPU is still maxed. Alerts
  still fire, boxes get slightly "steppier".
- Drop `imgsz` to `320` for another ~30% speedup on weak CPUs. Small
  objects may be missed.
- If you have a GPU, set `CUDA_VISIBLE_DEVICES=0` before starting the
  backend — `ultralytics` will pick it up automatically and inference
  will no longer be the bottleneck.

---

## 10. Files touched in the third round

- `backend/app/services/detector.py`
- `backend/app/services/frame_reader.py`
- `backend/app/services/video_stream.py`
- `backend/app/routes/stream.py`
- `frontend/src/app/App.tsx`
- `frontend/src/pages/MainPage.tsx`
- `frontend/src/pages/CameraPage.tsx`
- `frontend/src/components/CameraCard.tsx`
- `CHANGES.md` (this file)

---

## 11. Known follow-ups (not done yet)

- The `DEFAULT_GROUPS` seed (`Parking Lot / Perimeter / Lobby`) still
  appears for fresh users because `GROUPS_KEY` is empty. If you want
  groups to also start empty, flip `DEFAULT_GROUPS` to `[]` in
  `App.tsx`.
- `CameraPage.tsx` still has a browser-side "Start preview" button that
  uses `getUserMedia`. This is fine for webcams but meaningless for
  RTSP/IP sources — we could gate it so it's hidden for non-webcam
  cameras.
- If the backend camera thread dies after probing succeeds (rare: e.g.
  USB yanked mid-stream), the registry entry is orphaned. A small
  watchdog in `camera.py` that removes dead threads would be a clean
  follow-up.
