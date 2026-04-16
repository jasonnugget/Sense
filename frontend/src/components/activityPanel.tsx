import { useMemo } from 'react';
// NOTE: The previous `useMockEvents()` fixture was removed so this panel only
// shows real events pushed from the backend via SSE. If `events` is undefined
// we render an empty list instead of fabricating demo data.
function relTime(d) {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60)
        return `${s}s ago`;
    if (s < 3600)
        return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
}
export default function ActivityPanel({ events, onEventClick }) {
    const display = events ?? [];
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
        {display.length === 0 && (<div className="emptyState" style={{ padding: '18px 4px', fontSize: 12 }}>
            No events yet. Start a camera to see real detections here.
          </div>)}
      </div>
    </aside>);
}
