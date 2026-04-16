import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { absTime, relTime } from '../data/alerts';
const LEVEL_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };
function IconCamera() {
    return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>);
}
function IconPlay() {
    return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
    </svg>);
}
export default function AlertDetailPanel({ alert, reviewDecision, onReviewAlert, onViewCamera, onOpenClip }) {
    const navigate = useNavigate();
    const [draftDecision, setDraftDecision] = useState(reviewDecision ?? null);
    const [justReviewed, setJustReviewed] = useState(false);
    useEffect(() => {
        setDraftDecision(reviewDecision ?? null);
        setJustReviewed(false);
    }, [alert.id, reviewDecision]);
    const handleDecision = (decision) => {
        const isChanging = draftDecision === decision;
        if (isChanging)
            return;
        setDraftDecision(decision);
        setJustReviewed(true);
        onReviewAlert(alert.id, decision);
    };
    const isReviewed = alert.status === 'Reviewed' || justReviewed;
    return (<div className="alertDetailPanel">
      
      <div className="alertDetailHeader">
        <div className="alertDetailHeaderMeta">
          <span className={`alertDetailLevel ${alert.level}`}>
            {LEVEL_LABEL[alert.level]}
          </span>
          <span className={`alertDetailStatusPill${isReviewed ? ' reviewed' : ''}`}>
            {isReviewed ? 'Reviewed' : alert.status}
          </span>
        </div>

        <h2 className="alertDetailTitle">{alert.label}</h2>

        <div className="alertDetailTimeline">
          <span>{alert.camera}</span>
          <span className="alertDetailTimelineSep">·</span>
          <span>{absTime(alert.time)}</span>
          <span className="alertDetailTimelineSep">·</span>
          <span className="alertDetailRelTime">{relTime(alert.time)}</span>
        </div>
      </div>

      
      <div className="alertDetailBody">

        
        <div className="alertDetailSection">
          <div className="alertDetailSectionLabel">What happened</div>
          <p className="alertDetailText">{alert.summary}</p>
        </div>

        
        <div className="alertDetailActionBox">
          <div className="alertDetailSectionLabel">Recommended action</div>
          <p className="alertDetailText">{alert.action}</p>
        </div>

        
        <div className="alertDetailSection">
          <div className="alertDetailSectionLabel">
            Your assessment
            {isReviewed && draftDecision && (<span className="alertDetailReviewedTag">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                Marked reviewed
              </span>)}
          </div>
          <div className="alertReviewGrid">
            <button type="button" className={`alertReviewCard false-alert${draftDecision === 'false-alert' ? ' selected' : ''}`} onClick={() => handleDecision('false-alert')} aria-pressed={draftDecision === 'false-alert'}>
              <span className="alertReviewCardIcon" aria-hidden="true">✕</span>
              <span className="alertReviewCardLabel">False alert</span>
              <span className="alertReviewCardDesc">No real threat detected</span>
            </button>
            <button type="button" className={`alertReviewCard valid-alert${draftDecision === 'valid-alert' ? ' selected' : ''}`} onClick={() => handleDecision('valid-alert')} aria-pressed={draftDecision === 'valid-alert'}>
              <span className="alertReviewCardIcon" aria-hidden="true">✓</span>
              <span className="alertReviewCardLabel">Valid alert</span>
              <span className="alertReviewCardDesc">Threat confirmed</span>
            </button>
          </div>
        </div>
      </div>

      
      <div className="alertDetailFooter">
        <button type="button" className="alertDetailFooterBtn" onClick={() => onOpenClip(alert)}>
          <IconPlay />
          View clip
        </button>
        <button type="button" className="alertDetailFooterBtn" onClick={() => onViewCamera(alert)}>
          <IconCamera />
          Go to camera
        </button>
      </div>
    </div>);
}
