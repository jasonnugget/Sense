import { useMemo } from 'react';
function useMockEvents() {
    return useMemo(() => [
        { id: '1', cameraId: 'parking-lot', level: 'low', camera: 'Parking Lot', label: 'Motion detected', time: new Date(Date.now() - 60_000 * 18), status: 'Open', summary: 'Routine motion event in Parking Lot.', action: 'No action required.' },
        { id: '2', cameraId: 'front-door', level: 'medium', camera: 'Front Door', label: 'Unknown person', time: new Date(Date.now() - 60_000 * 54), status: 'Needs review', summary: 'Unidentified person at Front Door.', action: 'Review the clip.' },
        { id: '3', cameraId: 'parking-lot', level: 'low', camera: 'Parking Lot', label: 'Vehicle movement', time: new Date(Date.now() - 60_000 * 130), status: 'Open', summary: 'Vehicle movement detected.', action: 'No action required.' },
        { id: '4', cameraId: 'front-door', level: 'high', camera: 'Front Door', label: 'Forced entry attempt', time: new Date(Date.now() - 60_000 * 210), status: 'Escalated', summary: 'Possible forced entry attempt.', action: 'Escalate to security.' },
        { id: '5', cameraId: 'parking-lot', level: 'low', camera: 'Parking Lot', label: 'Motion detected', time: new Date(Date.now() - 60_000 * 380), status: 'Open', summary: 'Routine motion event in Parking Lot.', action: 'No action required.' },
        { id: '6', cameraId: 'parking-lot', level: 'medium', camera: 'Parking Lot', label: 'Loitering detected', time: new Date(Date.now() - 60_000 * 570), status: 'Open', summary: 'Loitering threshold exceeded in parking lot.', action: 'Review and tune thresholds if needed.' },
        { id: '7', cameraId: 'loading-dock', level: 'low', camera: 'Loading Dock', label: 'Motion detected', time: new Date(Date.now() - 60_000 * 760), status: 'Open', summary: 'Loading dock motion detected.', action: 'No action required.' },
        { id: '8', cameraId: 'hallway-east', level: 'medium', camera: 'Hallway', label: 'Unknown person', time: new Date(Date.now() - 60_000 * 930), status: 'Needs review', summary: 'Unknown person detected in hallway.', action: 'Review badge/access logs.' },
        { id: '9', cameraId: 'rear-gate', level: 'low', camera: 'Rear Gate', label: 'Vehicle movement', time: new Date(Date.now() - 60_000 * 1110), status: 'Open', summary: 'Vehicle movement at rear gate.', action: 'No action required.' },
        { id: '10', cameraId: 'server-room', level: 'high', camera: 'Server Room', label: 'Unauthorized access', time: new Date(Date.now() - 60_000 * 1290), status: 'Open', summary: 'Unauthorized access detected.', action: 'Investigate immediately.' },
        { id: '11', cameraId: 'parking-lot', level: 'low', camera: 'Parking Lot', label: 'Motion detected', time: new Date(Date.now() - 60_000 * 1480), status: 'Open', summary: 'Routine motion event in Parking Lot.', action: 'No action required.' },
        { id: '12', cameraId: 'front-door', level: 'medium', camera: 'Front Door', label: 'Loitering detected', time: new Date(Date.now() - 60_000 * 1680), status: 'Open', summary: 'Loitering detected at front door.', action: 'Review visitor behavior.' },
        { id: '13', cameraId: 'back-alley', level: 'low', camera: 'Back Alley', label: 'Motion detected', time: new Date(Date.now() - 60_000 * 1880), status: 'Open', summary: 'Motion detected in back alley.', action: 'No action required.' },
        { id: '14', cameraId: 'front-door', level: 'high', camera: 'Front Door', label: 'Forced entry attempt', time: new Date(Date.now() - 60_000 * 2100), status: 'Escalated', summary: 'Potential forced entry attempt at front door.', action: 'Escalate to security.' },
    ], []);
}
function relTime(d) {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60)
        return `${s}s ago`;
    if (s < 3600)
        return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
}
export default function ActivityPanel({ events, onEventClick }) {
    const display = events ?? useMockEvents();
    const counts = useMemo(() => ({
        high: display.filter((e) => e.level === 'high').length,
        medium: display.filter((e) => e.level === 'medium').length,
        low: display.filter((e) => e.level === 'low').length,
    }), [display]);
    return (<aside className="activityPanel">
      <div className="panelLabel">
        Threats 24h
        <span className="panelLabelCount">{counts.high + counts.medium + counts.low}</span>
      </div>

      <div className="threatPill high">
        <div className="threatPillLeft">
          <div>
            <div className="threatPillLabel">High</div>
            <div className="threatPillSub">Critical threats</div>
          </div>
        </div>
        <span className="threatPillCount">{counts.high}</span>
      </div>

      <div className="threatPill medium">
        <div className="threatPillLeft">
          <div>
            <div className="threatPillLabel">Medium</div>
            <div className="threatPillSub">Needs review</div>
          </div>
        </div>
        <span className="threatPillCount">{counts.medium}</span>
      </div>

      <div className="threatPill low">
        <div className="threatPillLeft">
          <div>
            <div className="threatPillLabel">Low</div>
            <div className="threatPillSub">Routine activity</div>
          </div>
        </div>
        <span className="threatPillCount">{counts.low}</span>
      </div>

      <div className="panelDivider panelDividerRecent"/>

      <div className="panelLabel">
        Recent Events
        <span className="panelLabelCount">{display.length}</span>
      </div>

      <div className="eventList">
        {display.map((event) => (<button key={event.id} type="button" className={`eventRow${onEventClick ? ' eventRowInteractive' : ''}`} onClick={() => onEventClick?.(event)}>
            <div className="eventInfo">
              <div className="eventLabel">{event.label}</div>
              <div className="eventCamera">{event.camera}</div>
            </div>
            <span className={`eventBadge ${event.level}`}>
              {event.level.charAt(0).toUpperCase() + event.level.slice(1)}
            </span>
            <span className="eventTime">{relTime(event.time)}</span>
          </button>))}
      </div>
    </aside>);
}
