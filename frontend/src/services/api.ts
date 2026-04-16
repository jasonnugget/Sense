/**
 * Backend API service for communicating with the FastAPI backend.
 *
 * All functions call the backend through the Vite proxy (/api -> localhost:8000).
 * This means we just use relative URLs like '/api/health' and Vite forwards them.
 *
 * Endpoints used:
 *   GET  /api/health                  — check if backend is running
 *   GET  /api/camera/status           — status of all cameras (or one by ?camera_id=)
 *   POST /api/camera/start            — start a camera by id + source
 *   POST /api/camera/stop             — stop a specific camera by id
 *   POST /api/camera/stop-all         — stop all running cameras
 *   GET  /api/stream/alerts           — SSE stream of real-time incident alerts
 *   GET  /api/video/feed/{camera_id}  — MJPEG stream for a specific camera
 *   GET  /api/incidents               — list all incidents
 *   PATCH /api/incidents/:id          — update incident status
 */

const API_BASE = '/api';

/** Check if the backend is reachable. Returns true if /health responds. */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch('/health', { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Get the status of all cameras, or a specific camera by ID. */
export async function getCameraStatus(cameraId?: string): Promise<any> {
  const url = cameraId
    ? `${API_BASE}/camera/status?camera_id=${encodeURIComponent(cameraId)}`
    : `${API_BASE}/camera/status`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Camera status failed: ${res.status}`);
  return res.json();
}

/** Tell the backend to start capturing from a specific camera. */
export async function startCamera(cameraId: string, source: string | number = 0): Promise<any> {
  const res = await fetch(`${API_BASE}/camera/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ camera_id: cameraId, source }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(detail.detail || `Start camera failed: ${res.status}`);
  }
  return res.json();
}

/** Tell the backend to stop a specific camera. */
export async function stopCamera(cameraId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/camera/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ camera_id: cameraId }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(detail.detail || `Stop camera failed: ${res.status}`);
  }
  return res.json();
}

/** Stop all running cameras. */
export async function stopAllCameras(): Promise<any> {
  const res = await fetch(`${API_BASE}/camera/stop-all`, { method: 'POST' });
  if (!res.ok) throw new Error(`Stop all cameras failed: ${res.status}`);
  return res.json();
}

/** Returns the MJPEG video feed URL for a specific camera. */
export function getVideoFeedUrl(cameraId: string): string {
  return `${API_BASE}/video/feed/${encodeURIComponent(cameraId)}`;
}

/**
 * Connect to the SSE alert stream. Returns an EventSource instance.
 *
 * Usage:
 *   const es = connectAlertStream((alert) => { console.log(alert); });
 *   // later: es.close();
 *
 * The callback fires each time the backend publishes a new incident.
 * EventSource auto-reconnects if the connection drops.
 */
export function connectAlertStream(onAlert: (alert: any) => void): EventSource {
  const es = new EventSource(`${API_BASE}/stream/alerts`);

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onAlert(data);
    } catch {
      // ignore malformed events
    }
  };

  es.onerror = () => {
    // EventSource auto-reconnects — no action needed here.
  };

  return es;
}

/** Fetch all incidents from the backend. */
export async function getIncidents(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/incidents`);
  if (!res.ok) throw new Error(`Fetch incidents failed: ${res.status}`);
  return res.json();
}

/** Update an incident's status (open, acknowledged, resolved). */
export async function updateIncidentStatus(id: number, status: string): Promise<any> {
  const res = await fetch(`${API_BASE}/incidents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Update incident failed: ${res.status}`);
  return res.json();
}
