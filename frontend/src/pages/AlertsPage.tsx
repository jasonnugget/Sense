import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AlertDetailPanel from '../components/AlertDetailPanel';
import { relTime } from '../data/alerts';
import './AlertsPage.css';
const SEVERITY_LABEL = { all: 'All', high: 'High', medium: 'Medium', low: 'Low' };
function statusClass(status) {
    if (status.toLowerCase() === 'needs review')
        return 'needs-review';
    if (status.toLowerCase() === 'escalated')
        return 'escalated';
    return '';
}
function IconShield() {
    return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>);
}
export default function AlertsPage({ cameras: _cameras, alerts: allAlerts, reviewDecisions, searchQuery = '', onReviewAlert }) {
    const navigate = useNavigate();
    const [selectedAlertId, setSelectedAlertId] = useState(null);
    const [severityFilter, setSeverityFilter] = useState('all');
    const [hideReviewed, setHideReviewed] = useState(false);
    const alerts = useMemo(() => {
        return allAlerts
            .filter((alert) => {
            const q = searchQuery.trim().toLowerCase();
            if (!q)
                return true;
            return `${alert.label} ${alert.camera} ${alert.status} ${alert.summary}`.toLowerCase().includes(q);
        })
            .filter((alert) => severityFilter === 'all' || alert.level === severityFilter)
            .filter((alert) => {
            if (!hideReviewed)
                return true;
            const isReviewed = alert.status === 'Reviewed' || !!reviewDecisions[alert.id];
            return !isReviewed;
        });
    }, [allAlerts, searchQuery, severityFilter, hideReviewed, reviewDecisions]);
    useEffect(() => {
        if (!alerts.length) {
            setSelectedAlertId(null);
            return;
        }
        setSelectedAlertId((prev) => (prev && alerts.some((a) => a.id === prev) ? prev : alerts[0].id));
    }, [alerts]);
    const counts = useMemo(() => ({
        all: allAlerts.filter((a) => {
            const q = searchQuery.trim().toLowerCase();
            return !q || `${a.label} ${a.camera} ${a.status} ${a.summary}`.toLowerCase().includes(q);
        }).length,
        high: allAlerts.filter((a) => a.level === 'high').length,
        medium: allAlerts.filter((a) => a.level === 'medium').length,
        low: allAlerts.filter((a) => a.level === 'low').length,
    }), [allAlerts, searchQuery]);
    const reviewedCount = useMemo(() => allAlerts.filter((a) => a.status === 'Reviewed' || !!reviewDecisions[a.id]).length, [allAlerts, reviewDecisions]);
    const selectedAlert = alerts.find((a) => a.id === selectedAlertId) ?? null;
    const viewCamera = (alert) => {
        navigate(`/camera/${alert.cameraId}`, { state: { cameraTransition: 'zoom-card', fromAlert: true } });
    };
    const openClip = (alert) => {
        const params = new URLSearchParams({ clip: '1', alert: alert.id, at: relTime(alert.time), threat: alert.level });
        navigate(`/camera/${alert.cameraId}?${params.toString()}`, {
            state: { cameraTransition: 'zoom-card', fromAlert: true, openClip: true },
        });
    };
    return (<div className="alertsPageRoot">

      
      <div className="alertsFilterBar">
        <div className="alertsSeverityTabs" role="tablist" aria-label="Filter by severity">
          {['all', 'high', 'medium', 'low'].map((level) => (<button key={level} type="button" role="tab" aria-selected={severityFilter === level} className={`alertsSeverityTab${severityFilter === level ? ' active' : ''}${level !== 'all' ? ` ${level}` : ''}`} onClick={() => setSeverityFilter(level)}>
              {SEVERITY_LABEL[level]}
              <span className="alertsTabCount">{counts[level]}</span>
            </button>))}
        </div>

        <div className="alertsFilterRight">
          {reviewedCount > 0 && (<span className="alertsResultCount">{reviewedCount} reviewed</span>)}
          <button type="button" className={`alertsToggleBtn${hideReviewed ? ' active' : ''}`} onClick={() => setHideReviewed((v) => !v)}>
            {hideReviewed ? 'Show reviewed' : 'Hide reviewed'}
          </button>
        </div>
      </div>

      
      <div className="alertsLayout">

        
        <div className="alertsListPanel">
          <div className="alertsListHeader">
            <span className="alertsListTitle">Alert Feed</span>
            <span className="alertsResultCount">{alerts.length} shown</span>
          </div>

          <div className="alertsListScroll" role="list">
            {alerts.map((alert) => {
            const isSelected = alert.id === selectedAlertId;
            const isReviewed = alert.status === 'Reviewed' || !!reviewDecisions[alert.id];
            return (<button key={alert.id} type="button" role="listitem" className={`alertRow${isSelected ? ' selected' : ''}${isReviewed ? ' reviewed' : ''}`} onClick={() => setSelectedAlertId(alert.id)} aria-current={isSelected ? 'true' : undefined}>
                  <span className={`alertRowDot ${alert.level}`} aria-hidden="true"/>
                  <div className="alertRowBody">
                    <div className="alertRowLabel">{alert.label}</div>
                    <div className="alertRowMeta">
                      <span className="alertRowCamera">{alert.camera}</span>
                      <span className="alertRowMetaSep" aria-hidden="true">·</span>
                      <span className={`alertRowStatus ${statusClass(alert.status)}`}>{alert.status}</span>
                    </div>
                  </div>
                  <div className="alertRowRight">
                    <span className="alertRowTime">{relTime(alert.time)}</span>
                    {isReviewed && (<span className="alertRowCheck" aria-label="Reviewed">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                      </span>)}
                  </div>
                </button>);
        })}

            {alerts.length === 0 && (<div className="alertsListEmpty">
                <div className="alertsListEmptyIcon">—</div>
                <div className="alertsListEmptyText">
                  {hideReviewed
                ? 'All alerts reviewed. Toggle "Show reviewed" to see them.'
                : 'No alerts match your filters.'}
                </div>
              </div>)}
          </div>
        </div>

        
        <div className="alertsDetailCol">
          {selectedAlert ? (<AlertDetailPanel alert={selectedAlert} reviewDecision={reviewDecisions[selectedAlert.id]} onReviewAlert={onReviewAlert} onViewCamera={viewCamera} onOpenClip={openClip}/>) : (<div className="alertsDetailEmpty">
              <div className="alertsDetailEmptyIcon">
                <IconShield />
              </div>
              <div className="alertsDetailEmptyTitle">Select an alert</div>
              <div className="alertsDetailEmptyText">
                Click any alert in the list to review what was detected and take action.
              </div>
            </div>)}
        </div>
      </div>
    </div>);
}
