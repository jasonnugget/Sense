/**
 * CameraPage — the individual camera view.
 *
 * This page has TWO modes:
 *
 * 1. LOCAL PREVIEW (browser webcam via getUserMedia)
 *    - Uses the browser's media API to access the user's webcam
 *    - Good for checking camera works before going live
 *    - No object detection — just a raw preview
 *
 * 2. GO LIVE (backend YOLO detection via MJPEG stream)
 *    - Sends a request to the backend to start capturing from the camera
 *    - Backend runs YOLO on each frame and draws bounding boxes
 *    - The annotated video streams back as MJPEG to an <img> tag
 *    - Incidents are created automatically and pushed via SSE to the alert feed
 *
 * The user can switch between modes using the buttons in the control panel.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { getStream, hasLiveStream, releaseStream, saveStream } from '../data/cameraStreamStore';
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

function IconRefresh() {
    return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>);
}

function IconShield() {
    return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>);
}

export default function CameraPage({ cameras = [] }: { cameras?: any[] }) {
    const { cameraId } = useParams();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    // --- Local preview refs/state (browser webcam) ---
    const videoRef = useRef<HTMLVideoElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mountedRef = useRef(true);

    const [devices, setDevices] = useState<Array<{ deviceId: string; label: string }>>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState(() => getStream(cameraId ?? '')?.deviceId ?? 'default');
    const [streamStatus, setStreamStatus] = useState<'idle' | 'loading' | 'live' | 'error'>(() =>
        (cameraId && hasLiveStream(cameraId) ? 'live' : 'idle')
    );
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // --- Go Live (backend detection) state ---
    const [detectionMode, setDetectionMode] = useState<'off' | 'starting' | 'live' | 'stopping' | 'error'>('off');
    const [detectionError, setDetectionError] = useState<string | null>(null);

    // URL params for clip/alert navigation
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

    const hasMediaDevices = typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices !== 'undefined' &&
        typeof navigator.mediaDevices.getUserMedia === 'function' &&
        typeof navigator.mediaDevices.enumerateDevices === 'function';

    // --- Local preview functions ---
    const detachVideo = () => {
        if (videoRef.current) videoRef.current.srcObject = null;
        streamRef.current = null;
    };

    const stopStream = () => {
        detachVideo();
        if (cameraId) releaseStream(cameraId);
        if (frameRef.current) frameRef.current.style.aspectRatio = '';
        setStreamStatus('idle');
    };

    useEffect(() => {
        const video = videoRef.current;
        const stream = streamRef.current ?? (cameraId ? getStream(cameraId)?.stream ?? null : null);
        if (!video || !stream) return;
        streamRef.current = stream;
        video.srcObject = stream;
        const playVideo = async () => {
            await video.play().catch(() => undefined);
        };
        if (video.readyState >= 1) {
            void playVideo();
            return;
        }
        video.onloadedmetadata = () => {
            void playVideo();
        };
        return () => {
            video.onloadedmetadata = null;
        };
    }, [streamStatus, cameraId]);

    const refreshDevices = async () => {
        if (!hasMediaDevices) {
            setErrorMessage('Camera access is not supported in this browser.');
            return;
        }
        try {
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            if (!mountedRef.current) return;
            const videoDevices = allDevices
                .filter((device) => device.kind === 'videoinput')
                .map((device, index) => ({
                    deviceId: device.deviceId,
                    label: device.label || `Camera ${index + 1}`,
                }));
            setDevices(videoDevices);
            if (videoDevices.length > 0 && selectedDeviceId !== 'default' && !videoDevices.some((d) => d.deviceId === selectedDeviceId)) {
                setSelectedDeviceId(videoDevices[0].deviceId);
            }
        } catch {
            if (!mountedRef.current) return;
            setErrorMessage('Unable to read available cameras.');
        }
    };

    const connectCamera = async (deviceId = selectedDeviceId) => {
        if (!hasMediaDevices) {
            setStreamStatus('error');
            setErrorMessage('Camera access is not supported in this browser.');
            return;
        }
        setStreamStatus('loading');
        setErrorMessage(null);
        detachVideo();
        if (cameraId) releaseStream(cameraId);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: deviceId === 'default'
                    ? { facingMode: 'user' }
                    : { deviceId: { exact: deviceId } },
                audio: false,
            });
            if (!mountedRef.current) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            streamRef.current = stream;
            if (cameraId) saveStream(cameraId, stream, deviceId);
            setStreamStatus('live');
            await refreshDevices();
        } catch (error) {
            if (!mountedRef.current) return;
            const message = error instanceof Error ? error.message : 'Camera permission was denied.';
            setStreamStatus('error');
            setErrorMessage(message);
        }
    };

    useEffect(() => {
        mountedRef.current = true;
        void refreshDevices();
        const handleDeviceChange = () => {
            void refreshDevices();
        };
        navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
        return () => {
            mountedRef.current = false;
            navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
            detachVideo();
        };
    }, []);

    // --- Go Live (backend detection) functions ---
    const handleGoLive = async () => {
        if (!cameraId) return;
        setDetectionMode('starting');
        setDetectionError(null);

        // Stop local preview if running — can't have both at once
        if (streamStatus === 'live') stopStream();

        try {
            const source = camera?.source ?? 0;
            await startCamera(cameraId, source);
            setDetectionMode('live');
            window.dispatchEvent(new Event('ui:camera-status-changed'));
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to start detection.';
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

    // Check backend camera status on mount
    useEffect(() => {
        if (!cameraId) return;
        getCameraStatus(cameraId)
            .then((status) => {
                if (status.is_running) setDetectionMode('live');
            })
            .catch(() => {
                // Backend not reachable — that's fine, detection mode stays off
            });
    }, [cameraId]);

    // Clean up: stop detection when leaving the page
    useEffect(() => {
        return () => {
            // Don't auto-stop — the backend camera might be used by other clients
        };
    }, []);

    const deviceSummary = devices.length === 0
        ? 'No cameras detected'
        : `${devices.length} camera${devices.length === 1 ? '' : 's'} available`;

    const isDetectionActive = detectionMode === 'live';

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

      {/* Video frame — shows either MJPEG detection stream or local preview */}
      <div ref={frameRef} className={`cameraFrame${isClipView ? ' clipFocus' : ''}${(streamStatus === 'live' || isDetectionActive) ? ' is-live' : ''}`}>

        {/* MJPEG detection stream — shown when Go Live is active */}
        {isDetectionActive && cameraId && (
          <img
            src={getVideoFeedUrl(cameraId)}
            alt="Live detection feed with YOLO bounding boxes"
            className="cameraLiveVideo is-visible"
            style={{ objectFit: 'contain', background: '#000' }}
          />
        )}

        {/* Local webcam preview — shown when using browser camera */}
        {!isDetectionActive && (
          <video ref={videoRef} className={`cameraLiveVideo${streamStatus === 'live' ? ' is-visible' : ''}`} muted playsInline autoPlay onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight && frameRef.current) {
                  frameRef.current.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`;
              }
          }}/>
        )}

        {/* Placeholder — shown when nothing is streaming */}
        {streamStatus !== 'live' && !isDetectionActive && (<div className="cameraPlaceholder">
            <div className="cameraPlaceholderInner">
              <span className="cameraPlaceholderEyebrow">
                {isClipView ? `Clip${clipAt ? ` · ${clipAt}` : ''}` : 'Live preview'}
              </span>
              <strong className="cameraPlaceholderHeading">
                {hasMediaDevices ? 'Connect a camera to stream.' : 'This browser cannot access cameras.'}
              </strong>
              <span className="cameraPlaceholderBody">
                Use "Start preview" for a local camera check, or "Go Live" to start YOLO object detection through the backend.
              </span>
            </div>
          </div>)}
      </div>

      {/* Control panels */}
      <div className="cameraControlGrid">

        {/* Left panel: camera inputs + Go Live */}
        <section className="cameraPanel">
          <div className="cameraPanelHeader">
            <div>
              <div className="cameraPanelTitle">Camera Controls</div>
              <div className="cameraPanelSub">{deviceSummary}</div>
            </div>
            <span className={`cameraStatusPill cameraStatus-${isDetectionActive ? 'live' : streamStatus}`}>
              {isDetectionActive ? 'Detecting' : streamStatus === 'live' ? 'Preview' : streamStatus === 'loading' ? 'Connecting...' : streamStatus === 'error' ? 'Error' : 'Idle'}
            </span>
          </div>

          <label className="cameraField">
            <span className="cameraFieldLabel">Video source</span>
            <select value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)} disabled={isDetectionActive}>
              <option value="default">Default webcam</option>
              {devices.map((device) => (<option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>))}
            </select>
          </label>

          <div className="cameraPanelActions">
            {/* Go Live button — starts backend YOLO detection */}
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

          <div className="cameraPanelActions">
            {/* Local preview controls */}
            <button type="button" className="cameraSecondaryBtn" onClick={() => void connectCamera()} disabled={streamStatus === 'loading' || isDetectionActive}>
              {streamStatus === 'loading' ? 'Connecting...' : 'Start preview'}
            </button>
            <button type="button" className="cameraSecondaryBtn" onClick={() => void refreshDevices()}>
              <IconRefresh />
              Refresh
            </button>
            <button type="button" className="cameraSecondaryBtn" onClick={() => stopStream()} disabled={isDetectionActive}>
              Disconnect
            </button>
          </div>

          {errorMessage && <div className="cameraError">{errorMessage}</div>}
          {detectionError && <div className="cameraError">{detectionError}</div>}
        </section>

        {/* Right panel: notes */}
        <section className="cameraPanel">
          <div className="cameraPanelTitle">How it works</div>
          <ul className="cameraNotesList">
            <li><strong>Start preview</strong> connects your browser camera for a local check — no detection runs.</li>
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
