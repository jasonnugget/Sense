import { useEffect, useMemo, useState } from 'react';
import SettingsModal from './SettingsModal';
import './AddCameraModal.css';
export default function AddCameraModal({ open, onClose, onSaveDetails, title = 'Add Camera', initialName = '', initialLocation = '', initialGroupIds = [], groups, onCreateGroup, }) {
    const [draftName, setDraftName] = useState('');
    const [draftLocation, setDraftLocation] = useState('');
    const [draftGroupIds, setDraftGroupIds] = useState([]);
    const [newGroupName, setNewGroupName] = useState('');
    useEffect(() => {
        if (!open)
            return;
        setDraftName(initialName);
        setDraftLocation(initialLocation);
        setDraftGroupIds(initialGroupIds);
        setNewGroupName('');
    }, [open, initialName, initialLocation, initialGroupIds]);
    const selectedGroups = useMemo(() => groups.filter((g) => draftGroupIds.includes(g.id)), [groups, draftGroupIds]);
    const save = () => {
        const name = draftName.trim();
        const location = draftLocation.trim();
        if (!name)
            return;
        onSaveDetails(name, location, draftGroupIds);
    };
    const toggleGroup = (groupId) => {
        setDraftGroupIds((prev) => prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]);
    };
    const createGroup = () => {
        const trimmed = newGroupName.trim();
        if (!trimmed)
            return;
        const createdId = onCreateGroup(trimmed);
        if (!createdId)
            return;
        setDraftGroupIds((prev) => (prev.includes(createdId) ? prev : [...prev, createdId]));
        setNewGroupName('');
    };
    return (<SettingsModal open={open} onClose={onClose} onSave={save} title={title}>
      <div className="modalFormGrid">

        
        <div className="modalField">
          <label className="modalLabel" htmlFor="addCameraName">Camera name</label>
          <input id="addCameraName" value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. Front Door" autoFocus onKeyDown={(e) => { if (e.key === 'Enter')
        save(); }}/>
        </div>

        
        <div className="modalField">
          <label className="modalLabel" htmlFor="addCameraLocation">Location</label>
          <input id="addCameraLocation" value={draftLocation} onChange={(e) => setDraftLocation(e.target.value)} placeholder="e.g. Home, Lobby, Warehouse" onKeyDown={(e) => { if (e.key === 'Enter')
        save(); }}/>
        </div>

        
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
