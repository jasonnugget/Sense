/**
 * CameraPage — the individual camera view.
 *
 * Single mode: Go Live / Stop Detection. The backend captures from the
 * configured source (webcam index, RTSP URL, or IP URL), runs YOLO, and
 * streams annotated MJPEG frames back to an <img> tag on this page.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { startCamera, stopCamera, getCameraStatus, getVideoFeedUrl } from '../services/api';
import './CameraPage.css';

function formatCameraName(cameraId: string | undefined) {
    if (!cameraId) return 'Camera';
    return cameraId
        .split('-')
        .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function IconChevronLeft() {
    return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6"/>
    </svg>);
}

function IconCamera() {
    return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>);
}

function IconShield() {
    return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>);
}

export default function CameraPage({ cameras = [], liveCameraIds }: { cameras?: any[]; liveCameraIds?: Set<string> }) {
    const { cameraId } = useParams();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    const frameRef = useRef<HTMLDivElement>(null);

    // Seed detection state from the App-level live-camera registry so the
    // page matches what the dashboard shows. Without this, a camera that
    // was already running when the user navigated in would briefly render
    // as "off" and a Go Live click would 409 against the backend.
    const isLiveFromRegistry = !!(cameraId && liveCameraIds?.has?.(cameraId));
    const [detectionMode, setDetectionMode] = useState<'off' | 'starting' | 'live' | 'stopping' | 'error'>(
        isLiveFromRegistry ? 'live' : 'off'
    );
    const [detectionError, setDetectionError] = useState<string | null>(null);

    // Keep local detection state in sync with the App-level registry so
    // background poll updates (every 3s) reach this page too.
    useEffect(() => {
        if (!cameraId) return;
        const live = !!liveCameraIds?.has?.(cameraId);
        setDetectionMode((prev) => {
            if (prev === 'starting' || prev === 'stopping') return prev;
            if (live && prev !== 'live') return 'live';
            if (!live && prev === 'live') return 'off';
            return prev;
        });
    }, [cameraId, liveCameraIds]);

    const isClipView = searchParams.get('clip') === '1';
    const clipAt = searchParams.get('at');
    const clipThreat = searchParams.get('threat');
    const clipThreatClass = clipThreat === 'high' || clipThreat === 'medium' || clipThreat === 'low'
        ? clipThreat
        : 'low';
    const fromAlert = Boolean(location.state?.fromAlert);
    const zoomTransition = location.state?.cameraTransition === 'zoom-card';

    const camera = useMemo(() => cameras.find((c: any) => c.id === cameraId), [cameras, cameraId]);
    const pageTitle = useMemo(() => camera?.name ?? formatCameraName(cameraId), [camera, cameraId]);

    const handleGoLive = async () => {
        if (!cameraId) return;
        setDetectionMode('starting');
        setDetectionError(null);
        try {
            const source = camera?.source ?? 0;
            await startCamera(cameraId, source);
            setDetectionMode('live');
            window.dispatchEvent(new Event('ui:camera-status-changed'));
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to start detection.';
            // If the backend already has this camera running (409), treat
            // that as success and sync the UI to the live state instead of
            // surfacing an error.
            if (/already running/i.test(msg)) {
                setDetectionMode('live');
                window.dispatchEvent(new Event('ui:camera-status-changed'));
                return;
            }
            setDetectionMode('error');
            setDetectionError(msg);
        }
    };

    const handleStopDetection = async () => {
        if (!cameraId) return;
        setDetectionMode('stopping');
        try {
            await stopCamera(cameraId);
            setDetectionMode('off');
            setDetectionError(null);
            window.dispatchEvent(new Event('ui:camera-status-changed'));
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to stop detection.';
            setDetectionMode('error');
            setDetectionError(msg);
        }
    };

    useEffect(() => {
        if (!cameraId) return;
        getCameraStatus(cameraId)
            .then((status) => {
                if (status.is_running) setDetectionMode('live');
            })
            .catch(() => {
                // Backend not reachable — detection stays off.
            });
    }, [cameraId]);

    const isDetectionActive = detectionMode === 'live';
    const statusLabel = detectionMode === 'live'
        ? 'Detecting'
        : detectionMode === 'starting' ? 'Starting...'
        : detectionMode === 'stopping' ? 'Stopping...'
        : detectionMode === 'error' ? 'Error'
        : 'Idle';

    return (<div className={`cameraPage${zoomTransition ? ' cameraPageZoomIn' : ''}`}>

      {/* Header */}
      <div className="cameraPageHeader">
        <Link to="/" className="cameraBackLink">
          <IconChevronLeft />
          Back
        </Link>
        <div className="cameraPageTitleRow">
          <IconCamera />
          <h2 className="cameraPageTitle">{pageTitle}</h2>
        </div>
        <div className="cameraPageBadges">
          {fromAlert && <span className="cameraPageBadge">From alert</span>}
          {isClipView && (<span className="cameraPageBadge clip">
              Clip{clipAt ? ` · ${clipAt}` : ''}
            </span>)}
          {isDetectionActive && (
            <span className="cameraPageBadge detectionBadge">YOLO Detection Active</span>
          )}
        </div>
      </div>

      {/* Video frame — MJPEG detection stream when active, placeholder otherwise */}
      <div ref={frameRef} className={`cameraFrame${isClipView ? ' clipFocus' : ''}${isDetectionActive ? ' is-live' : ''}`}>
        {isDetectionActive && cameraId ? (
          <img
            src={getVideoFeedUrl(cameraId)}
            alt="Live detection feed with YOLO bounding boxes"
            className="cameraLiveVideo is-visible"
            style={{ objectFit: 'contain', background: '#000' }}
          />
        ) : (
          <div className="cameraPlaceholder">
            <div className="cameraPlaceholderInner">
              <span className="cameraPlaceholderEyebrow">
                {isClipView ? `Clip${clipAt ? ` · ${clipAt}` : ''}` : 'Live preview'}
              </span>
              <strong className="cameraPlaceholderHeading">Camera is off.</strong>
              <span className="cameraPlaceholderBody">
                Click "Go Live" to start YOLO object detection through the backend.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Control panels */}
      <div className="cameraControlGrid">

        <section className="cameraPanel">
          <div className="cameraPanelHeader">
            <div>
              <div className="cameraPanelTitle">Camera Controls</div>
              <div className="cameraPanelSub">
                {camera?.source !== undefined ? `Source: ${camera.source}` : 'No source configured'}
              </div>
            </div>
            <span className={`cameraStatusPill cameraStatus-${isDetectionActive ? 'live' : 'idle'}`}>
              {statusLabel}
            </span>
          </div>

          <div className="cameraPanelActions">
            {!isDetectionActive ? (
              <button
                type="button"
                className="cameraPrimaryBtn goLiveBtn"
                onClick={() => void handleGoLive()}
                disabled={detectionMode === 'starting' || detectionMode === 'stopping'}
              >
                <IconShield />
                {detectionMode === 'starting' ? 'Starting detection...' : 'Go Live — Start Detection'}
              </button>
            ) : (
              <button
                type="button"
                className="cameraPrimaryBtn stopDetectionBtn"
                onClick={() => void handleStopDetection()}
                disabled={detectionMode === 'stopping'}
              >
                {detectionMode === 'stopping' ? 'Stopping...' : 'Stop Detection'}
              </button>
            )}
          </div>

          {detectionError && <div className="cameraError">{detectionError}</div>}
        </section>

        <section className="cameraPanel">
          <div className="cameraPanelTitle">How it works</div>
          <ul className="cameraNotesList">
            <li><strong>Go Live</strong> starts the backend YOLO model. The camera feed is captured server-side, objects are detected in real time, and bounding boxes are drawn on the stream.</li>
            <li>When a dangerous object (knife, gun) is detected in 3+ frames within 2 seconds, an <strong>incident alert</strong> is automatically created and appears in the Alerts page.</li>
            <li>The detection stream shows colored boxes: <strong style={{color: '#ef4444'}}>red</strong> for dangerous objects, <strong style={{color: '#22c55e'}}>green</strong> for safe objects.</li>
            {isClipView && (<li className={`threat-${clipThreatClass}`}>
                Clip marker preserved — threat level: <strong>{clipThreatClass}</strong>
              </li>)}
            {fromAlert && (<li>Navigated here from an alert. Review the clip badge above the feed.</li>)}
          </ul>
        </section>

      </div>
    </div>);
}
