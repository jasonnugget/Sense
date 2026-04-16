import { useEffect, useMemo, useState } from 'react';
import SettingsModal from './SettingsModal';
import './AddCameraModal.css';

const SOURCE_TYPES = [
    { value: 'local', label: 'Local camera' },
    { value: 'rtsp', label: 'RTSP Stream' },
    { value: 'ip', label: 'IP Camera (HTTP)' },
    { value: 'file', label: 'Video File' },
];

export default function AddCameraModal({ open, onClose, onSaveDetails, title = 'Add Camera', initialName = '', initialLocation = '', initialGroupIds = [], groups, onCreateGroup }) {
    const [draftName, setDraftName] = useState('');
    const [draftLocation, setDraftLocation] = useState('');
    const [draftGroupIds, setDraftGroupIds] = useState([]);
    const [newGroupName, setNewGroupName] = useState('');

    // Source config
    const [sourceType, setSourceType] = useState('local');
    const [localDeviceIndex, setLocalDeviceIndex] = useState('0');
    const [localDevices, setLocalDevices] = useState<MediaDeviceInfo[]>([]);
    const [enumError, setEnumError] = useState<string | null>(null);
    const [enumerating, setEnumerating] = useState(false);
    const [streamUrl, setStreamUrl] = useState('');

    useEffect(() => {
        // Seed draft state only when the modal opens. Parents pass fresh
        // defaults like `initialGroupIds={cam?.groupIds ?? []}` — including
        // them as deps would wipe the user's in-progress input every time
        // the parent re-renders (camera status polling, SSE alerts, etc.).
        if (!open) return;
        setDraftName(initialName);
        setDraftLocation(initialLocation);
        setDraftGroupIds(initialGroupIds);
        setNewGroupName('');
        setSourceType('local');
        setLocalDeviceIndex('0');
        setStreamUrl('');
        setEnumError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Enumerate the device's video inputs when Local camera is selected.
    // Labels are only populated after the user grants getUserMedia permission,
    // so we briefly open a stream, grab the list, then release it.
    useEffect(() => {
        if (!open || sourceType !== 'local') return;
        let cancelled = false;
        let tempStream: MediaStream | null = null;
        setEnumerating(true);
        (async () => {
            try {
                tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const devices = await navigator.mediaDevices.enumerateDevices();
                if (cancelled) return;
                const videoInputs = devices.filter((d) => d.kind === 'videoinput');
                setLocalDevices(videoInputs);
                setEnumError(null);
                if (parseInt(localDeviceIndex, 10) >= videoInputs.length) {
                    setLocalDeviceIndex('0');
                }
            } catch (err) {
                if (cancelled) return;
                setEnumError(err instanceof Error ? err.message : 'Could not access cameras');
                setLocalDevices([]);
            } finally {
                if (tempStream) tempStream.getTracks().forEach((t) => t.stop());
                if (!cancelled) setEnumerating(false);
            }
        })();
        return () => {
            cancelled = true;
            if (tempStream) tempStream.getTracks().forEach((t) => t.stop());
        };
    }, [open, sourceType]);

    const selectedGroups = useMemo(() => groups.filter((g) => draftGroupIds.includes(g.id)), [groups, draftGroupIds]);

    const getSource = (): string | number => {
        if (sourceType === 'local') return parseInt(localDeviceIndex, 10) || 0;
        return streamUrl.trim();
    };

    const save = () => {
        const name = draftName.trim();
        const location = draftLocation.trim();
        if (!name) return;
        const source = getSource();
        onSaveDetails(name, location, draftGroupIds, source);
    };

    const toggleGroup = (groupId) => {
        setDraftGroupIds((prev) => prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]);
    };

    const createGroup = () => {
        const trimmed = newGroupName.trim();
        if (!trimmed) return;
        const createdId = onCreateGroup(trimmed);
        if (!createdId) return;
        setDraftGroupIds((prev) => (prev.includes(createdId) ? prev : [...prev, createdId]));
        setNewGroupName('');
    };

    return (<SettingsModal open={open} onClose={onClose} onSave={save} title={title}>
      <div className="modalFormGrid">

        <div className="modalField">
          <label className="modalLabel" htmlFor="addCameraName">Camera name</label>
          <input id="addCameraName" value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. Front Door" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') save(); }}/>
        </div>

        <div className="modalField">
          <label className="modalLabel" htmlFor="addCameraLocation">Location</label>
          <input id="addCameraLocation" value={draftLocation} onChange={(e) => setDraftLocation(e.target.value)} placeholder="e.g. Home, Lobby, Warehouse" onKeyDown={(e) => { if (e.key === 'Enter') save(); }}/>
        </div>

        {/* Source type selection */}
        <div className="modalField">
          <label className="modalLabel" htmlFor="addCameraSourceType">Source type</label>
          <select id="addCameraSourceType" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
            {SOURCE_TYPES.map((st) => (
              <option key={st.value} value={st.value}>{st.label}</option>
            ))}
          </select>
        </div>

        {/* Dynamic source input based on type */}
        <div className="modalField">
          {sourceType === 'local' && (
            <>
              <label className="modalLabel" htmlFor="addCameraLocalDevice">Local camera</label>
              {enumError ? (
                <>
                  <input id="addCameraLocalDevice" type="number" min="0" value={localDeviceIndex} onChange={(e) => setLocalDeviceIndex(e.target.value)} placeholder="0"/>
                  <span className="modalFieldHint" style={{ color: '#ef4444' }}>
                    Couldn't list cameras ({enumError}). Enter an index manually — 0 is the default.
                  </span>
                </>
              ) : enumerating ? (
                <>
                  <select id="addCameraLocalDevice" disabled>
                    <option>Scanning for cameras…</option>
                  </select>
                  <span className="modalFieldHint">Grant camera access when prompted to see device names.</span>
                </>
              ) : localDevices.length === 0 ? (
                <>
                  <input id="addCameraLocalDevice" type="number" min="0" value={localDeviceIndex} onChange={(e) => setLocalDeviceIndex(e.target.value)} placeholder="0"/>
                  <span className="modalFieldHint">No cameras detected. Enter an index manually (0 = default).</span>
                </>
              ) : (
                <>
                  <select id="addCameraLocalDevice" value={localDeviceIndex} onChange={(e) => setLocalDeviceIndex(e.target.value)}>
                    {localDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={String(i)}>
                        {d.label || `Camera ${i}`}
                      </option>
                    ))}
                  </select>
                  <span className="modalFieldHint">Pick a camera detected on this device.</span>
                </>
              )}
            </>
          )}
          {sourceType === 'rtsp' && (
            <>
              <label className="modalLabel" htmlFor="addCameraRtspUrl">RTSP URL</label>
              <input id="addCameraRtspUrl" value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="rtsp://user:pass@192.168.1.10:554/stream"/>
            </>
          )}
          {sourceType === 'ip' && (
            <>
              <label className="modalLabel" htmlFor="addCameraIpUrl">IP Camera URL</label>
              <input id="addCameraIpUrl" value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="http://192.168.1.10/video"/>
            </>
          )}
          {sourceType === 'file' && (
            <>
              <label className="modalLabel" htmlFor="addCameraFilePath">Video file path</label>
              <input id="addCameraFilePath" value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="demo.mp4"/>
            </>
          )}
        </div>

        {/* Groups */}
        <div className="modalField">
          <label className="modalLabel">
            Groups
            {selectedGroups.length > 0 && (<span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none', marginLeft: 6 }}>
                — {selectedGroups.map((g) => g.name).join(', ')}
              </span>)}
          </label>

          {groups.length > 0 && (<div className="modalGroupPills">
              {groups.map((group) => {
                const selected = draftGroupIds.includes(group.id);
                return (<button key={group.id} type="button" className={`modalGroupPill${selected ? ' selected' : ''}`} onClick={() => toggleGroup(group.id)} aria-pressed={selected}>
                    {selected && <span className="modalGroupPillCheck" aria-hidden="true">✓</span>}
                    {group.name}
                  </button>);
            })}
            </div>)}

          <div className="modalCreateGroup">
            <input className="modalCreateGroupInput" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder={groups.length === 0 ? 'No groups yet — name one to create it' : 'New group name…'} onKeyDown={(e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                createGroup();
            }
        }}/>
            <button type="button" className="modalCreateGroupBtn" onClick={createGroup} disabled={!newGroupName.trim()}>
              + Create
            </button>
          </div>
        </div>

      </div>
    </SettingsModal>);
}
