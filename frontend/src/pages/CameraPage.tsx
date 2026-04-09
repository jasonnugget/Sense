import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import './CameraPage.css'

type CameraDevice = {
  deviceId: string
  label: string
}

function formatCameraName(cameraId: string | undefined) {
  if (!cameraId) return 'Camera'
  return cameraId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function CameraPage() {
  const { cameraId } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)

  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('default')
  const [streamStatus, setStreamStatus] = useState<'idle' | 'loading' | 'live' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isClipView = searchParams.get('clip') === '1'
  const clipAt = searchParams.get('at')
  const clipThreat = searchParams.get('threat')
  const clipThreatClass =
    clipThreat === 'high' || clipThreat === 'medium' || clipThreat === 'low'
      ? clipThreat
      : 'low'
  const fromAlert = Boolean((location.state as { fromAlert?: boolean } | null)?.fromAlert)
  const zoomTransition = (location.state as { cameraTransition?: string } | null)?.cameraTransition === 'zoom-card'
  const pageTitle = useMemo(() => formatCameraName(cameraId), [cameraId])
  const hasMediaDevices =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof navigator.mediaDevices.enumerateDevices === 'function'

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return

    video.srcObject = stream
    const playVideo = async () => {
      await video.play().catch(() => undefined)
    }

    if (video.readyState >= 1) {
      void playVideo()
      return
    }

    video.onloadedmetadata = () => {
      void playVideo()
    }

    return () => {
      video.onloadedmetadata = null
    }
  }, [streamStatus])

  const refreshDevices = async () => {
    if (!hasMediaDevices) {
      setErrorMessage('Camera access is not supported in this browser.')
      return
    }

    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      if (!mountedRef.current) return
      const videoDevices = allDevices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        }))
      setDevices(videoDevices)
      if (videoDevices.length > 0 && selectedDeviceId !== 'default' && !videoDevices.some((d) => d.deviceId === selectedDeviceId)) {
        setSelectedDeviceId(videoDevices[0].deviceId)
      }
    } catch {
      if (!mountedRef.current) return
      setErrorMessage('Unable to read available cameras.')
    }
  }

  const connectCamera = async (deviceId = selectedDeviceId) => {
    if (!hasMediaDevices) {
      setStreamStatus('error')
      setErrorMessage('Camera access is not supported in this browser.')
      return
    }

    setStreamStatus('loading')
    setErrorMessage(null)
    stopStream()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId === 'default'
          ? { facingMode: 'user' }
          : { deviceId: { exact: deviceId } },
        audio: false,
      })

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      setStreamStatus('live')
      await refreshDevices()
    } catch (error) {
      if (!mountedRef.current) return
      const message = error instanceof Error ? error.message : 'Camera permission was denied.'
      setStreamStatus('error')
      setErrorMessage(message)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    void refreshDevices()

    const handleDeviceChange = () => {
      void refreshDevices()
    }

    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange)

    return () => {
      mountedRef.current = false
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange)
      stopStream()
    }
  }, [])

  const deviceSummary = devices.length === 0
    ? 'No external cameras detected yet.'
    : `${devices.length} camera${devices.length === 1 ? '' : 's'} available`

  return (
    <div className={`cameraPage${zoomTransition ? ' cameraPageZoomIn' : ''}`}>
      <div className="cameraHeader">
        <Link to="/" className="backLink">Back</Link>
        <h2 className="cameraTitle">{pageTitle}</h2>
        {fromAlert && <span className="cameraPageBadge">From Alert</span>}
        {isClipView && (
          <span className="cameraPageBadge clip">
            Open clip{clipAt ? ` · ${clipAt}` : ''}
          </span>
        )}
      </div>

      <div className="cameraControlBar">
        <div className="cameraControlCopy">
          <span className="cameraControlEyebrow">Device Connection</span>
          <p className="cameraControlText">
            Connect your built-in webcam or any attached USB / external camera and preview the feed here.
          </p>
        </div>
        <div className="cameraControlActions">
          <button type="button" className="sectionAction" onClick={() => void refreshDevices()}>
            Refresh devices
          </button>
          <button
            type="button"
            className="sectionAction sectionActionPrimary"
            onClick={() => void connectCamera()}
            disabled={streamStatus === 'loading'}
          >
            {streamStatus === 'loading' ? 'Connecting...' : 'Connect camera'}
          </button>
        </div>
      </div>

      <div className={`cameraFrame${isClipView ? ' clipFocus' : ''}`}>
        <div className="cameraLiveStage">
          <video
            ref={videoRef}
            className={`cameraLiveVideo${streamStatus === 'live' ? ' is-visible' : ''}`}
            muted
            playsInline
            autoPlay
          />
          {streamStatus !== 'live' && (
            <div className="cameraPlaceholder">
              <div className="cameraPlaceholderCard">
                <span className="cameraPlaceholderLabel">
                  {isClipView ? `Clip Playback${clipAt ? ` · ${clipAt}` : ''}` : 'Live Preview Ready'}
                </span>
                <strong>{hasMediaDevices ? 'Connect a camera to start streaming.' : 'This browser cannot access cameras.'}</strong>
                <span>
                  {errorMessage ?? 'Grant browser permission when prompted to use your webcam or external capture device.'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="cameraConnectGrid">
        <section className="cameraConnectPanel">
          <div className="cameraConnectPanelHeader">
            <div>
              <div className="cameraConnectTitle">Available Inputs</div>
              <div className="cameraConnectSub">{deviceSummary}</div>
            </div>
            <span className={`cameraStatusBadge cameraStatus-${streamStatus}`}>
              {streamStatus === 'live' ? 'Live' : streamStatus === 'loading' ? 'Connecting' : streamStatus === 'error' ? 'Error' : 'Idle'}
            </span>
          </div>

          <label className="cameraField">
            <span>Video source</span>
            <select value={selectedDeviceId} onChange={(e) => setSelectedDeviceId(e.target.value)}>
              <option value="default">Default webcam</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>

          <div className="cameraInlineActions">
            <button type="button" className="sectionAction sectionActionPrimary" onClick={() => void connectCamera()}>
              Start preview
            </button>
            <button
              type="button"
              className="sectionAction"
              onClick={() => {
                stopStream()
                setStreamStatus('idle')
              }}
            >
              Disconnect
            </button>
          </div>

          {errorMessage && <div className="cameraError">{errorMessage}</div>}
        </section>

        <section className="cameraConnectPanel">
          <div className="cameraConnectTitle">Connected Camera Notes</div>
          <div className="cameraChecklist">
            <div className="cameraChecklistItem">Works with built-in webcams and most external USB cameras that the browser exposes as `videoinput` devices.</div>
            <div className="cameraChecklistItem">If labels are blank at first, click Connect once to grant permission, then refresh devices.</div>
            <div className="cameraChecklistItem">If you opened this page from an alert, the clip badge is preserved while you test the live source.</div>
            {isClipView && (
              <div className={`cameraChecklistItem threat-${clipThreatClass}`}>
                Clip marker preserved for threat level: {clipThreatClass}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
