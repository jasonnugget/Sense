import { useEffect, useState } from 'react';
import { absTime, relTime } from '../data/alerts';
const LEVEL_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };
export default function AlertDetailsModal({ alert, onClose, onViewCamera, onOpenClip, onReviewAlert, reviewDecision, exitVariant, }) {
    const [renderedAlert, setRenderedAlert] = useState(null);
    const [closing, setClosing] = useState(false);
    const [draftDecision, setDraftDecision] = useState(reviewDecision ?? null);
    useEffect(() => {
        if (alert) {
            setRenderedAlert(alert);
            setClosing(false);
            return;
        }
        if (!renderedAlert)
            return;
        setClosing(true);
        const t = window.setTimeout(() => {
            setRenderedAlert(null);
            setClosing(false);
        }, 220);
        return () => window.clearTimeout(t);
    }, [alert, renderedAlert]);
    useEffect(() => {
        setDraftDecision(reviewDecision ?? null);
    }, [reviewDecision, renderedAlert?.id]);
    useEffect(() => {
        if (!renderedAlert)
            return;
        const onKeyDown = (e) => { if (e.key === 'Escape')
            onClose(); };
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [renderedAlert, onClose]);
    if (!renderedAlert)
        return null;
    const handleDecision = (decision) => {
        setDraftDecision(decision);
        onReviewAlert(renderedAlert.id, decision);
    };
    const isReviewed = renderedAlert.status === 'Reviewed';
    return (<div className={`alertModalOverlay${closing ? ' is-closing' : ' is-open'}${closing && exitVariant === 'to-camera' ? ' is-routing-camera' : ''}`} role="dialog" aria-modal="true" aria-label="Alert details">
      <button className="alertModalBackdrop" onClick={onClose} aria-label="Close alert details"/>

      <div className={`alertModalCard threat-${renderedAlert.level}`} onClick={(e) => e.stopPropagation()}>

        
        <div className="alertModalHeader">
          <div className="alertModalTitleWrap">
            <span className={`alertDetailLevel ${renderedAlert.level}`}>
              {LEVEL_LABEL[renderedAlert.level]}
            </span>
            <div>
              <div className="alertModalTitle">{renderedAlert.label}</div>
              <div className="alertModalSub">
                {renderedAlert.camera} · {absTime(renderedAlert.time)} · <span style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{relTime(renderedAlert.time)}</span>
              </div>
            </div>
          </div>
          <button className="alertModalClose" onClick={onClose} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        
        <div className="alertModalBody">
          <div className="alertModalSection">
            <div className="alertModalLabel">What happened</div>
            <div className="alertModalText">{renderedAlert.summary}</div>
          </div>

          <div className="alertModalCallout">
            <div className="alertModalLabel">Recommended action</div>
            <div className="alertModalText">{renderedAlert.action}</div>
          </div>

          
          <div className="alertModalSection">
            <div className="alertModalLabel">
              Your assessment
              {isReviewed && (<span style={{ fontFamily: 'var(--font)', letterSpacing: 0, textTransform: 'none', color: 'var(--accent)', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                  Reviewed
                </span>)}
            </div>
            <div className="alertReviewGrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button type="button" className={`alertReviewCard false-alert${draftDecision === 'false-alert' ? ' selected' : ''}`} onClick={() => handleDecision('false-alert')} aria-pressed={draftDecision === 'false-alert'}>
                <span className="alertReviewCardIcon" aria-hidden="true">✕</span>
                <span className="alertReviewCardLabel">False alert</span>
                <span className="alertReviewCardDesc">No real threat</span>
              </button>
              <button type="button" className={`alertReviewCard valid-alert${draftDecision === 'valid-alert' ? ' selected' : ''}`} onClick={() => handleDecision('valid-alert')} aria-pressed={draftDecision === 'valid-alert'}>
                <span className="alertReviewCardIcon" aria-hidden="true">✓</span>
                <span className="alertReviewCardLabel">Valid alert</span>
                <span className="alertReviewCardDesc">Threat confirmed</span>
              </button>
            </div>
          </div>
        </div>

        
        <div className="alertModalFooter">
          <div className="alertModalActions alertModalActionsLeft">
            <button className="topBarButton" onClick={() => onOpenClip(renderedAlert)}>View clip</button>
            <button className="topBarButton" onClick={() => onViewCamera(renderedAlert)}>Go to camera</button>
          </div>
          <div className="alertModalActions alertModalActionsRight">
            <button className="topBarButton" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>);
}
