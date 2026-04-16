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
export default function AlertDetailPanel({ alert, onViewCamera, onOpenClip }) {
    const navigate = useNavigate();
    return (<div className="alertDetailPanel">
      
      <div className="alertDetailHeader">
        <div className="alertDetailHeaderMeta">
          <span className={`alertDetailLevel ${alert.level}`}>
            {LEVEL_LABEL[alert.level]}
          </span>
          <span className="alertDetailStatusPill">{alert.status}</span>
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
