import { useEffect, useState } from 'react'
import type { AlertReviewDecision } from '../app/App'
import type { AlertEvent } from '../data/alerts'
import { relTime } from '../data/alerts'

type Props = {
  alert: AlertEvent | null
  onClose: () => void
  onViewCamera: (alert: AlertEvent) => void
  onOpenClip: (alert: AlertEvent) => void
  onReviewAlert: (alertId: string, decision: AlertReviewDecision) => void
  reviewDecision?: AlertReviewDecision
  exitVariant?: 'default' | 'to-camera'
}

export default function AlertDetailsModal({
  alert,
  onClose,
  onViewCamera,
  onOpenClip,
  onReviewAlert,
  reviewDecision,
  exitVariant,
}: Props) {
  const [renderedAlert, setRenderedAlert] = useState<AlertEvent | null>(null)
  const [closing, setClosing] = useState(false)
  const [draftDecision, setDraftDecision] = useState<AlertReviewDecision | null>(reviewDecision ?? null)

  useEffect(() => {
    if (alert) {
      setRenderedAlert(alert)
      setClosing(false)
      return
    }
    if (!renderedAlert) return
    setClosing(true)
    const t = window.setTimeout(() => {
      setRenderedAlert(null)
      setClosing(false)
    }, 220)
    return () => window.clearTimeout(t)
  }, [alert, renderedAlert])

  useEffect(() => {
    setDraftDecision(reviewDecision ?? null)
  }, [reviewDecision, renderedAlert?.id])

  useEffect(() => {
    if (!renderedAlert) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [renderedAlert, onClose])

  if (!renderedAlert) return null

  return (
    <div
      className={`alertModalOverlay${closing ? ' is-closing' : ' is-open'}${closing && exitVariant === 'to-camera' ? ' is-routing-camera' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Alert details"
    >
      <button className="alertModalBackdrop" onClick={onClose} aria-label="Close alert details" />
      <div className={`alertModalCard threat-${renderedAlert.level}`} onClick={(e) => e.stopPropagation()}>
        <div className="alertModalHeader">
          <div className="alertModalTitleWrap">
            <span className={`eventBadge ${renderedAlert.level}`}>
              {renderedAlert.level.charAt(0).toUpperCase() + renderedAlert.level.slice(1)}
            </span>
            <div>
              <div className="alertModalTitle">{renderedAlert.label}</div>
              <div className="alertModalSub">{renderedAlert.camera} · {relTime(renderedAlert.time)}</div>
            </div>
          </div>
          <button className="alertModalClose" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="alertModalBody">
          <div className="alertModalSection">
            <div className="alertModalLabel">Summary</div>
            <div className="alertModalText">{renderedAlert.summary}</div>
          </div>

          <div className="alertModalCallout">
            <div className="alertModalLabel">Recommended action</div>
            <div className="alertModalText">{renderedAlert.action}</div>
          </div>

          <div className="alertModalSection">
            <div className="alertModalLabel">Review decision</div>
            <div className="alertReviewChoices" role="radiogroup" aria-label="Confirm whether this was a false alert">
              <button
                type="button"
                role="radio"
                aria-checked={draftDecision === 'false-alert'}
                className={`alertReviewChoice${draftDecision === 'false-alert' ? ' active' : ''}`}
                onClick={() => setDraftDecision('false-alert')}
              >
                False alert
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={draftDecision === 'valid-alert'}
                className={`alertReviewChoice${draftDecision === 'valid-alert' ? ' active' : ''}`}
                onClick={() => setDraftDecision('valid-alert')}
              >
                Valid alert
              </button>
            </div>
          </div>
        </div>

        <div className="alertModalFooter">
          <div className="alertModalActions alertModalActionsLeft">
            <button className="topBarButton" onClick={() => onOpenClip(renderedAlert)}>Open clip</button>
            <button
              className="topBarButton"
              onClick={() => {
                if (!draftDecision) return
                onReviewAlert(renderedAlert.id, draftDecision)
                onClose()
              }}
              disabled={!draftDecision}
              style={!draftDecision ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
            >
              {renderedAlert.status === 'Reviewed' ? 'Update review' : 'Mark reviewed'}
            </button>
            <button className="topBarButton" onClick={() => onViewCamera(renderedAlert)}>View camera</button>
          </div>
          <div className="alertModalActions alertModalActionsRight">
            <button className="topBarButton" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}
