/**
 * useBackendAlerts — React hook that connects to the backend SSE stream
 * and converts incoming incidents into the alert format the UI expects.
 *
 * How it works:
 * 1. On mount, opens an EventSource connection to /api/stream/alerts
 * 2. Each time the backend publishes an incident (from YOLO detections),
 *    it arrives here as a JSON message
 * 3. We transform it into the same alert shape the frontend already uses
 *    (id, level, label, camera, time, status, summary, action, cameraId)
 * 4. New alerts are prepended to the list (most recent first)
 * 5. On unmount, the EventSource connection is closed
 *
 * The hook returns:
 *   - backendAlerts: array of alerts from the backend
 *   - isConnected: whether the SSE connection is active
 *   - clearAlerts: function to reset the alert list
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { connectAlertStream } from '../services/api';

interface BackendIncident {
  id: number;
  date_posted: string;
  status: string;
  risk_level: string;
  objects?: Array<{
    camera_id: string;
    class_name: string;
    confidence: number;
    bbox: { x: number; y: number; w: number; h: number };
    frame_id: string;
    timestamp: string;
  }>;
  summary?: string;
}

export interface AlertEvent {
  id: string;
  cameraId: string;
  level: string;
  label: string;
  camera: string;
  time: Date;
  status: string;
  summary: string;
  action: string;
}

/** Map a risk_level from the backend to the frontend severity level. */
function mapLevel(riskLevel: string): string {
  if (riskLevel === 'high') return 'high';
  if (riskLevel === 'medium') return 'medium';
  return 'low';
}

// Keywords the backend considers "weapon-ish". Kept in sync with
// backend/app/services/risk_engine.DANGEROUS_KEYWORDS — if a detected
// class name contains any of these tokens we prefer the label "Weapon
// detected (<class>)" so the feed reads naturally even when the model
// uses exotic class names like "assault_rifle" or "kitchen knife".
const WEAPON_TOKENS = [
  'gun', 'pistol', 'handgun', 'rifle', 'shotgun', 'firearm', 'revolver',
  'knife', 'blade', 'dagger', 'sword', 'machete',
  'axe', 'hatchet', 'crowbar', 'bat', 'weapon',
];

function isWeaponClass(className: string): boolean {
  const n = className.toLowerCase().replace(/[_-]/g, ' ');
  return WEAPON_TOKENS.some((tok) => n.includes(tok));
}

/** Build a human-readable label from the detected objects. */
function buildLabel(incident: BackendIncident): string {
  if (!incident.objects || incident.objects.length === 0) return 'Detection alert';
  const classes = [...new Set(incident.objects.map((o) => o.class_name))];
  return classes
    .map((c) => {
      const pretty = c.charAt(0).toUpperCase() + c.slice(1);
      return isWeaponClass(c) ? `Weapon detected (${pretty})` : `${pretty} detected`;
    })
    .join(', ');
}

/** Build a recommended action string based on risk level. */
function buildAction(incident: BackendIncident): string {
  if (incident.risk_level === 'high') return 'Escalate to security immediately and review camera feed.';
  if (incident.risk_level === 'medium') return 'Review the detection clip and verify if the alert is valid.';
  return 'No immediate action needed. Monitor for repeat events.';
}

/** Convert a backend incident into the frontend alert shape. */
function toAlertEvent(incident: BackendIncident): AlertEvent {
  const cameraId = incident.objects?.[0]?.camera_id ?? 'unknown';
  // Pretty-print the camera id ("front-door" → "Front Door") so the feed
  // shows a human name instead of the slug. We fall back to the raw id
  // if there's nothing to prettify.
  const cameraLabel = cameraId === 'unknown'
    ? 'Unknown camera'
    : cameraId
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
  return {
    id: `backend-${incident.id}`,
    cameraId,
    level: mapLevel(incident.risk_level),
    label: buildLabel(incident),
    camera: cameraLabel,
    time: new Date(incident.date_posted),
    status: incident.status === 'open' ? 'Open' : incident.status === 'acknowledged' ? 'Acknowledged' : 'Resolved',
    summary: incident.summary ?? 'Object detected by YOLO model.',
    action: buildAction(incident),
  };
}

export default function useBackendAlerts() {
  const [backendAlerts, setBackendAlerts] = useState<AlertEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = connectAlertStream((incident: BackendIncident) => {
      const alert = toAlertEvent(incident);
      setBackendAlerts((prev) => [alert, ...prev]);
    });

    es.onopen = () => setIsConnected(true);

    const origOnError = es.onerror;
    es.onerror = (e) => {
      setIsConnected(false);
      if (origOnError) origOnError.call(es, e);
    };

    esRef.current = es;

    return () => {
      es.close();
      esRef.current = null;
      setIsConnected(false);
    };
  }, []);

  const clearAlerts = useCallback(() => setBackendAlerts([]), []);

  return { backendAlerts, isConnected, clearAlerts };
}
