import { useEffect, useState } from 'react';
import { absTime, relTime } from '../data/alerts';
const LEVEL_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };
export default function AlertDetailsModal({ alert, onClose, onViewCamera, onOpenClip, exitVariant, }) {
    const [renderedAlert, setRenderedAlert] = useState(null);
    const [closing, setClosing] = useState(false);
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
