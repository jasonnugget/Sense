import { useParams, Link } from 'react-router-dom'
import './CameraPage.css'

export default function CameraPage() {
  const { cameraId } = useParams()

  return (
    <div className="cameraPage">
      <div className="cameraHeader">
        <Link to="/" className="backLink">← Back</Link>
        <h2 className="cameraTitle">{cameraId}</h2>
      </div>

      <div className="cameraFrame">
        {/* Placeholder for video/image */}
        <div className="cameraPlaceholder">Live / Recorded Feed</div>
      </div>

      <div className="cameraBottom">
        <div className="timeline">
          <div className="event left">Activity detected @7:00AM</div>
          <div className="timelineLine" />
          <div className="event right">Activity Detected @5:00pm</div>
        </div>

        <button className="liveBtn">
          <span className="dot" /> Live Feed
        </button>
      </div>
    </div>
  )
}