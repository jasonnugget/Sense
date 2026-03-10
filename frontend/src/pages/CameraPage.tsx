import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import './CameraPage.css'

export default function CameraPage() {
  const { cameraId } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isClipView = searchParams.get('clip') === '1'
  const clipAt = searchParams.get('at')
  const clipThreat = searchParams.get('threat')
  const clipThreatClass =
    clipThreat === 'high' || clipThreat === 'medium' || clipThreat === 'low'
      ? clipThreat
      : 'low'
  const fromAlert = Boolean((location.state as { fromAlert?: boolean } | null)?.fromAlert)
  const zoomTransition = (location.state as { cameraTransition?: string } | null)?.cameraTransition === 'zoom-card'

  return (
    <div className={`cameraPage${zoomTransition ? ' cameraPageZoomIn' : ''}`}>
      <div className="cameraHeader">
        <Link to="/" className="backLink">← Back</Link>
        <h2 className="cameraTitle">{cameraId}</h2>
        {fromAlert && <span className="cameraPageBadge">From Alert</span>}
        {isClipView && (
          <span className="cameraPageBadge clip">
            Open clip{clipAt ? ` · ${clipAt}` : ''}
          </span>
        )}
      </div>

      <div className={`cameraFrame${isClipView ? ' clipFocus' : ''}`}>
        {/* Placeholder for video/image */}
        <div className="cameraPlaceholder">
          {isClipView ? `Clip Playback${clipAt ? ` (${clipAt})` : ''}` : 'Live / Recorded Feed'}
        </div>
      </div>

      <div className="cameraBottom">
        <div className="timeline">
          <div className="event left">Activity detected @7:00AM</div>
          <div className={`timelineLine${isClipView ? ' hasClipMarker' : ''}`}>
            {isClipView && (
              <div className={`clipMarker ${clipThreatClass}`} aria-label={`Clip marker (${clipThreatClass})`} />
            )}
          </div>
          <div className="event right">Activity Detected @5:00pm</div>
        </div>

        <button className="liveBtn">
          <span className="dot" /> Live Feed
        </button>
      </div>
    </div>
  )
}
