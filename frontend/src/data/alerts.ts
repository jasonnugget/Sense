import type { Camera } from '../app/App'

export type ThreatLevel = 'low' | 'medium' | 'high'

export type AlertEvent = {
  id: string
  cameraId: string
  level: ThreatLevel
  label: string
  camera: string
  time: Date
  status: string
  summary: string
  action: string
}

export function relTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export function buildAlertEvents(cameras: Camera[], statusOverrides: Record<string, string> = {}): AlertEvent[] {
  const now = Date.now()
  const mins = (m: number) => new Date(now - m * 60_000)

  const offlineAlerts: AlertEvent[] = cameras
    .filter((c) => c.online === false)
    .map((c, i) => {
      const base: AlertEvent = {
        id: `offline-${c.id}`,
        cameraId: c.id,
        level: 'high',
        label: 'Camera offline',
        camera: c.name,
        time: mins((i + 1) * 12),
        status: 'Open',
        summary: `${c.name} stopped reporting and has been marked offline. Video feed is unavailable and no new frames are being received.`,
        action: 'Check device power/network and confirm the camera reconnects to the recorder.',
      }
      return { ...base, status: statusOverrides[base.id] ?? base.status }
    })

  const examples: AlertEvent[] = [
    {
      id: 'motion-lot',
      cameraId: 'parking-lot',
      level: 'low',
      label: 'Motion detected',
      camera: 'Parking Lot',
      time: mins(18),
      status: 'Reviewed',
      summary: 'Short-duration movement detected across the outer parking rows. Pattern matches normal vehicle circulation and pedestrian foot traffic.',
      action: 'No action required. Keep for audit trail.',
    },
    {
      id: 'person-front',
      cameraId: 'front-door',
      level: 'medium',
      label: 'Unknown person',
      camera: 'Front Door',
      time: mins(54),
      status: 'Needs review',
      summary: 'A person approached the front door and remained in frame briefly without recognized badge or face match in the current allow-list.',
      action: 'Review clip and confirm whether the visitor was expected.',
    },
    {
      id: 'vehicle-lot',
      cameraId: 'parking-lot',
      level: 'low',
      label: 'Vehicle movement',
      camera: 'Parking Lot',
      time: mins(130),
      status: 'Open',
      summary: 'Vehicle movement was detected in the parking lot and remained within expected lane flow and duration thresholds.',
      action: 'No immediate action needed unless traffic pattern appears abnormal.',
    },
    {
      id: 'forced-entry',
      cameraId: 'rear-gate',
      level: 'high',
      label: 'Forced entry attempt',
      camera: 'Rear Gate',
      time: mins(210),
      status: 'Escalated',
      summary: 'Rapid repeated gate contact and abrupt movement patterns were detected near the rear access point, triggering a forced-entry alert.',
      action: 'Escalate to security response and review surrounding camera feeds for context.',
    },
    {
      id: 'motion-lot-2',
      cameraId: 'parking-lot',
      level: 'low',
      label: 'Motion detected',
      camera: 'Parking Lot',
      time: mins(380),
      status: 'Open',
      summary: 'Short motion event was detected in the parking lot and cleared automatically after no sustained activity was observed.',
      action: 'No action required. Monitor for repeat events.',
    },
    {
      id: 'loiter-lot',
      cameraId: 'parking-lot',
      level: 'medium',
      label: 'Loitering detected',
      camera: 'Parking Lot',
      time: mins(570),
      status: 'Open',
      summary: 'A person remained in the monitored parking lot zone longer than the configured dwell threshold.',
      action: 'Review clip and assess if loiter threshold needs tuning.',
    },
    {
      id: 'motion-dock',
      cameraId: 'loading-dock',
      level: 'low',
      label: 'Motion detected',
      camera: 'Loading Dock',
      time: mins(760),
      status: 'Reviewed',
      summary: 'Motion detected near the loading dock during normal operations window with no unusual motion pattern.',
      action: 'No action required.',
    },
    {
      id: 'person-hallway',
      cameraId: 'hallway-east',
      level: 'medium',
      label: 'Unknown person',
      camera: 'Hallway East',
      time: mins(930),
      status: 'Needs review',
      summary: 'An unidentified person passed through Hallway East without a recognized badge match in the associated access logs.',
      action: 'Review clip and verify badge/access records.',
    },
    {
      id: 'vehicle-rear-gate',
      cameraId: 'rear-gate',
      level: 'low',
      label: 'Vehicle movement',
      camera: 'Rear Gate',
      time: mins(1110),
      status: 'Open',
      summary: 'Vehicle movement detected near Rear Gate appears consistent with scheduled service access.',
      action: 'No action required unless timing conflicts with access schedule.',
    },
    {
      id: 'unauth-server',
      cameraId: 'server-room',
      level: 'high',
      label: 'Unauthorized access',
      camera: 'Server Room',
      time: mins(1290),
      status: 'Open',
      summary: 'Access event near the server room was flagged as unauthorized due to missing matching credential activity during the same time window.',
      action: 'Validate physical access logs and investigate who entered the area.',
    },
  ].map((event) => ({ ...event, status: statusOverrides[event.id] ?? event.status }))

  return [...offlineAlerts, ...examples].sort((a, b) => b.time.getTime() - a.time.getTime())
}
