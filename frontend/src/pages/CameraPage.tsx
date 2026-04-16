import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { getStream, hasLiveStream, releaseStream, saveStream } from '../data/cameraStreamStore';
import './CameraPage.css';
function formatCameraName(cameraId) {
    if (!cameraId)
        return 'Camera';
    return cameraId
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
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
export default function CameraPage({ cameras = [] }) {
    const { cameraId } = useParams();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const videoRef = useRef(null);
    const frameRef = useRef(null);
    const streamRef = useRef(null);
    const mountedRef = useRef(true);
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState(() => getStream(cameraId ?? '')?.deviceId ?? 'default');
    const [streamStatus, setStreamStatus] = useState(() => (cameraId && hasLiveStream(cameraId) ? 'live' : 'idle'));
    const [errorMessage, setErrorMessage] = useState(null);
    const isClipView = searchParams.get('clip') === '1';
    const clipAt = searchParams.get('at');
    const clipThreat = searchParams.get('threat');
    const clipThreatClass = clipThreat === 'high' || clipThreat === 'medium' || clipThreat === 'low'
        ? clipThreat
        : 'low';
    const fromAlert = Boolean(location.state?.fromAlert);
    const zoomTransition = location.state?.cameraTransition === 'zoom-card';
    const camera = useMemo(() => cameras.find(c => c.id === cameraId), [cameras, cameraId]);
    const pageTitle = useMemo(() => camera?.name ?? formatCameraName(cameraId), [camera, cameraId]);
    const hasMediaDevices = typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices !== 'undefined' &&
        typeof navigator.mediaDevices.getUserMedia === 'function' &&
        typeof navigator.mediaDevices.enumerateDevices === 'function';
    const detachVideo = () => {
        if (videoRef.current)
            videoRef.current.srcObject = null;
        streamRef.current = null;
    };
    const stopStream = () => {
        detachVideo();
        if (cameraId)
            releaseStream(cameraId);
        if (frameRef.current)
            frameRef.current.style.aspectRatio = '';
        setStreamStatus('idle');
    };
    useEffect(() => {
        const video = videoRef.current;
        const stream = streamRef.current ?? (cameraId ? getStream(cameraId)?.stream ?? null : null);
        if (!video || !stream)
            return;
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
            if (!mountedRef.current)
                return;
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
        }
        catch {
            if (!mountedRef.current)
                return;
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
        if (cameraId)
            releaseStream(cameraId);
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
            if (cameraId)
                saveStream(cameraId, stream, deviceId);
            setStreamStatus('live');
            await refreshDevices();
        }
        catch (error) {
            if (!mountedRef.current)
                return;
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
    const deviceSummary = devices.length === 0
        ? 'No cameras detected'
        : `${devices.length} camera${devices.length === 1 ? '' : 's'} available`;
    return (<div className={`cameraPage${zoomTransition ? ' cameraPageZoomIn' : ''}`}>

      
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
        </div>
      </div>

      
      <div ref={frameRef} className={`cameraFrame${isClipView ? ' clipFocus' : ''}${streamStatus === 'live' ? ' is-live' : ''}`}>
        <video ref={videoRef} className={`cameraLiveVideo${streamStatus === 'live' ? ' is-visible' : ''}`} muted playsInline autoPlay onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight && frameRef.current) {
                frameRef.current.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`;
            }
        }}/>
        {streamStatus !== 'live' && (<div className="cameraPlaceholder">
            <div className="cameraPlaceholderInner">
              <span className="cameraPlaceholderEyebrow">
                {isClipView ? `Clip${clipAt ? ` · ${clipAt}` : ''}` : 'Live preview'}
              </span>
              <strong className="cameraPlaceholderHeading">
                {hasMediaDevices ? 'Connect a camera to stream.' : 'This browser cannot access cameras.'}
              </strong>
              <span className="cameraPlaceholderBody">
                {errorMessage ?? 'Grant browser permission when prompted to use your webcam or external capture device.'}
              </span>
            </div>
          </div>)}
      </div>

      
      <div className="cameraControlGrid">

        
        <section className="cameraPanel">
          <div className="cameraPanelHeader">
            <div>
              <div className="cameraPanelTitle">Available inputs</div>
              <div className="cameraPanelSub">{deviceSummary}</div>
            </div>
            <span className={`cameraStatusPill cameraStatus-${streamStatus}`}>
              {streamStatus === 'live' ? 'Live' : streamStatus === 'loading' ? 'Connecting…' : streamStatus === 'error' ? 'Error' : 'Idle'}
            </span>
          </div>

          <label className="cameraField">
            <span className="cameraFieldLabel">Video source</span>
            <select value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)}>
              <option value="default">Default webcam</option>
              {devices.map((device) => (<option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>))}
            </select>
          </label>

          <div className="cameraPanelActions">
            <button type="button" className="cameraPrimaryBtn" onClick={() => void connectCamera()} disabled={streamStatus === 'loading'}>
              {streamStatus === 'loading' ? 'Connecting…' : 'Start preview'}
            </button>
            <button type="button" className="cameraSecondaryBtn" onClick={() => void refreshDevices()}>
              <IconRefresh />
              Refresh
            </button>
            <button type="button" className="cameraSecondaryBtn" onClick={() => stopStream()}>
              Disconnect
            </button>
          </div>

          {errorMessage && <div className="cameraError">{errorMessage}</div>}
        </section>

        
        <section className="cameraPanel">
          <div className="cameraPanelTitle">Connection notes</div>
          <ul className="cameraNotesList">
            <li>Works with built-in webcams and most external USB cameras exposed as video inputs.</li>
            <li>If device labels are blank, click Start preview once to grant permission, then Refresh.</li>
            {isClipView && (<li className={`threat-${clipThreatClass}`}>
                Clip marker preserved — threat level: <strong>{clipThreatClass}</strong>
              </li>)}
            {fromAlert && (<li>Navigated here from an alert. Review the clip badge above the feed.</li>)}
          </ul>
        </section>

      </div>
    </div>);
}
