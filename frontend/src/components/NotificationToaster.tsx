/**
 * NotificationToaster — global popup that slides in from the top-right
 * whenever a new alert event arrives (from the backend SSE stream).
 *
 * How it works:
 *   - Receives the current `alerts` array from App (already sorted newest-first).
 *   - Remembers which alert ids it has already shown, so toasts only appear
 *     for genuinely new events.
 *   - On mount it records the ids of all existing alerts so we don't spam
 *     the user with toasts for alerts that were loaded on page refresh.
 *   - Each toast auto-dismisses after ~6 seconds, or when the user clicks it.
 *   - Clicking a toast fires `onOpenAlert(id)` so the parent can open the
 *     alert details modal. The user can also click the × to dismiss.
 *
 * The toaster is mounted once at the app root so it fires on every route.
 */

import { useEffect, useRef, useState } from 'react';
import { relTime } from '../data/alerts';
import './NotificationToaster.css';

const LEVEL_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };
const TOAST_TIMEOUT_MS = 6000;
const MAX_VISIBLE = 4;

export default function NotificationToaster({ alerts, onOpenAlert }) {
  // Ids of alerts we've already handled (either displayed or suppressed).
  const seenIdsRef = useRef(new Set());
  const [toasts, setToasts] = useState([]);
  const didInitRef = useRef(false);

  // Seed the seen-set with alerts that already existed when the app loaded
  // so we don't toast the entire history on first render.
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    for (const a of alerts) seenIdsRef.current.add(a.id);
  }, [alerts]);

  useEffect(() => {
    if (!didInitRef.current) return;
    const incoming = [];
    for (const a of alerts) {
      if (!seenIdsRef.current.has(a.id)) {
        seenIdsRef.current.add(a.id);
        incoming.push(a);
      }
    }
    if (!incoming.length) return;
    // Newest first. Cap visible toasts so the stack doesn't overflow the
    // viewport if a burst of detections arrives at once.
    setToasts((prev) => [...incoming, ...prev].slice(0, MAX_VISIBLE));
  }, [alerts]);

  // Auto-dismiss each toast after the timeout window.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, TOAST_TIMEOUT_MS)
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts]);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));
  const handleClick = (alert) => {
    dismiss(alert.id);
    onOpenAlert?.(alert.id);
  };

  if (toasts.length === 0) return null;

  return (
    <div className="notificationToaster" aria-live="polite" aria-label="New alerts">
      {toasts.map((alert) => (
        <button
          key={alert.id}
          type="button"
          className={`notificationToast threat-${alert.level}`}
          onClick={() => handleClick(alert)}
        >
          <span className={`notificationToastLevel ${alert.level}`}>
            {LEVEL_LABEL[alert.level] ?? alert.level}
          </span>
          <div className="notificationToastBody">
            <div className="notificationToastTitle">{alert.label}</div>
            <div className="notificationToastMeta">
              <span>{alert.camera}</span>
              <span className="notificationToastSep" aria-hidden="true">·</span>
              <span>{relTime(alert.time)}</span>
            </div>
          </div>
          <span
            role="button"
            tabIndex={0}
            className="notificationToastClose"
            aria-label="Dismiss notification"
            onClick={(e) => { e.stopPropagation(); dismiss(alert.id); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                dismiss(alert.id);
              }
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </span>
        </button>
      ))}
    </div>
  );
}
