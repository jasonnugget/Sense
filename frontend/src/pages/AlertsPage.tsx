import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AlertReviewDecision, Camera } from '../app/App'
import AlertDetailsModal from '../components/AlertDetailsModal'
import type { AlertEvent } from '../data/alerts'
import { relTime } from '../data/alerts'

type Props = {
  cameras: Camera[]
  alerts: AlertEvent[]
  reviewDecisions: Record<string, AlertReviewDecision>
  searchQuery?: string
  onReviewAlert: (id: string, decision: AlertReviewDecision) => void
}

type ThreatFilter = 'all' | 'high' | 'medium' | 'low'
type StatusFilter = 'all' | 'open' | 'needs review' | 'escalated' | 'reviewed'

export default function AlertsPage({ cameras, alerts: allAlerts, reviewDecisions, searchQuery = '', onReviewAlert }: Props) {
  const navigate = useNavigate()
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null)
  const [modalAlertId, setModalAlertId] = useState<string | null>(null)
  const [modalExitVariant, setModalExitVariant] = useState<'default' | 'to-camera'>('default')
  const [threatFilter, setThreatFilter] = useState<ThreatFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const alerts = useMemo(() => {
    return allAlerts
      .filter((alert) => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return true
        return `${alert.label} ${alert.camera} ${alert.status} ${alert.summary}`.toLowerCase().includes(q)
      })
      .filter((alert) => {
        if (threatFilter !== 'all' && alert.level !== threatFilter) return false
        if (statusFilter !== 'all' && alert.status.toLowerCase() !== statusFilter) return false
        return true
      })
  }, [allAlerts, searchQuery, threatFilter, statusFilter])

  useEffect(() => {
    if (!alerts.length) {
      setSelectedAlertId(null)
      if (modalAlertId) setModalAlertId(null)
      return
    }
    setSelectedAlertId((prev) => (prev && alerts.some((a) => a.id === prev) ? prev : alerts[0].id))
    setModalAlertId((prev) => (prev && alerts.some((a) => a.id === prev) ? prev : prev))
  }, [alerts, modalAlertId])

  const high = alerts.filter((a) => a.level === 'high').length
  const medium = alerts.filter((a) => a.level === 'medium').length
  const low = alerts.filter((a) => a.level === 'low').length
  const modalAlert = alerts.find((a) => a.id === modalAlertId) ?? null

  const viewCamera = (alert: AlertEvent) => {
    setModalExitVariant('to-camera')
    setModalAlertId(null)
    window.setTimeout(() => {
      navigate(`/camera/${alert.cameraId}`, { state: { cameraTransition: 'zoom-card', fromAlert: true } })
      setModalExitVariant('default')
    }, 200)
  }

  const openClip = (alert: AlertEvent) => {
    setModalExitVariant('to-camera')
    setModalAlertId(null)
    const params = new URLSearchParams({
      clip: '1',
      alert: alert.id,
      at: relTime(alert.time),
      threat: alert.level,
    })
    window.setTimeout(() => {
      navigate(`/camera/${alert.cameraId}?${params.toString()}`, {
        state: { cameraTransition: 'zoom-card', fromAlert: true, openClip: true },
      })
      setModalExitVariant('default')
    }, 200)
  }

  return (
    <div className="pageStack">
      <section className="contentPanel">
        <div className="sectionRow">
          <span className="sectionTitle">Alerts</span>
        </div>
        <div className="infoGrid">
          <div className="infoCard">
            <div className="infoCardLabel">Open Alerts</div>
            <div className="infoCardValue">{alerts.length}</div>
            <div className="infoCardSub">Across all cameras</div>
          </div>
          <div className="infoCard">
            <div className="infoCardLabel">High Priority</div>
            <div className="infoCardValue" style={{ color: 'var(--danger)' }}>{high}</div>
            <div className="infoCardSub">{medium} medium · {low} low</div>
          </div>
          <div className="infoCard">
            <div className="infoCardLabel">Offline Cameras</div>
            <div className="infoCardValue">{cameras.filter((c) => c.online === false).length}</div>
            <div className="infoCardSub">Immediate attention recommended</div>
          </div>
        </div>
      </section>

      <section className="contentPanel pagePanelFill">
        <div className="sectionRow">
          <span className="sectionTitle">Alert Feed</span>
          <div className="alertFiltersMeta">{alerts.length} shown</div>
        </div>

        <div className="alertFiltersBar">
          <div className="filterGroup" role="group" aria-label="Severity filter">
            <span className="filterGroupLabel">Severity</span>
            <div className="filterPills">
              {(['all', 'high', 'medium', 'low'] as ThreatFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`filterPill${threatFilter === value ? ' active' : ''}${value !== 'all' ? ` ${value}` : ''}`}
                  onClick={() => setThreatFilter(value)}
                >
                  {value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="filterGroup" role="group" aria-label="Status filter">
            <span className="filterGroupLabel">Status</span>
            <div className="filterPills">
              {(['all', 'open', 'needs review', 'escalated', 'reviewed'] as StatusFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`filterPill status${statusFilter === value ? ' active' : ''}`}
                  onClick={() => setStatusFilter(value)}
                >
                  {value === 'all'
                    ? 'All'
                    : value.split(' ').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="dataList" role="list">
          {alerts.map((alert) => {
            const isSelected = alert.id === selectedAlertId
            return (
              <div key={alert.id} role="listitem" className="alertRowGroup">
                <button
                  type="button"
                  className={`dataRow dataRowInteractive threat-${alert.level}${isSelected ? ' selected' : ''}`}
                  onClick={() => {
                    setSelectedAlertId(alert.id)
                    setModalAlertId(alert.id)
                  }}
                  aria-expanded={isSelected}
                >
                  <div className="dataRowMain">
                    <span className={`eventPip ${alert.level}`} />
                    <div className="dataRowText">
                      <div className="dataRowTitle">{alert.label}</div>
                      <div className="dataRowSub">{alert.camera}</div>
                    </div>
                  </div>
                  <div className="dataRowMeta">{relTime(alert.time)}</div>
                  <div className="dataRowBadges">
                    <span className={`eventBadge ${alert.level}`}>
                      {alert.level.charAt(0).toUpperCase() + alert.level.slice(1)}
                    </span>
                    <span className="dataRowBadge">{alert.status}</span>
                    {reviewDecisions[alert.id] && (
                      <span className="dataRowBadge">
                        {reviewDecisions[alert.id] === 'false-alert' ? 'False alert' : 'Valid alert'}
                      </span>
                    )}
                  </div>
                </button>
              </div>
            )
          })}
          {alerts.length === 0 && <div className="emptyState">No alerts match your search or filters.</div>}
        </div>
      </section>

      <AlertDetailsModal
        alert={modalAlert}
        onClose={() => {
          setModalExitVariant('default')
          setModalAlertId(null)
        }}
        onViewCamera={viewCamera}
        onOpenClip={openClip}
        onReviewAlert={onReviewAlert}
        reviewDecision={modalAlert ? reviewDecisions[modalAlert.id] : undefined}
        exitVariant={modalExitVariant}
      />
    </div>
  )
}
