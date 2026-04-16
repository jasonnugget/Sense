import { useEffect, useMemo, useState } from 'react';
import CameraCard from '../components/CameraCard';
import AddCameraModal from '../components/AddCameraModal';
import SettingsModal from '../components/SettingsModal';
export default function MainPage({ cameras, groups, onSaveDetails, onTogglePin, onAssignGroups, onAddGroup, onDeleteGroup, onRemove, onAddCamera, }) {
    const [addOpen, setAddOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [selectedGroupId, setSelectedGroupId] = useState('all');
    const [assigningCameraId, setAssigningCameraId] = useState(null);
    const [assignDraftGroupIds, setAssignDraftGroupIds] = useState([]);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [createGroupName, setCreateGroupName] = useState('');
    const [createGroupTarget, setCreateGroupTarget] = useState('tabs');
    const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState(null);
    const openAdd = () => { setEditingId(null); setAddOpen(true); };
    const openEdit = (id) => { setEditingId(id); setAddOpen(true); };
    const closeModal = () => { setAddOpen(false); setEditingId(null); };
    const closeAssignModal = () => { setAssigningCameraId(null); setAssignDraftGroupIds([]); };
    const closeCreateGroupModal = () => { setCreateGroupOpen(false); setCreateGroupName(''); };
    useEffect(() => {
        const handler = () => openAdd();
        window.addEventListener('ui:add-camera', handler);
        return () => window.removeEventListener('ui:add-camera', handler);
    }, []);
    useEffect(() => {
        if (selectedGroupId !== 'all' && !groups.some((g) => g.id === selectedGroupId)) {
            setSelectedGroupId('all');
        }
    }, [groups, selectedGroupId]);
    const editingCamera = useMemo(() => (editingId ? cameras.find((c) => c.id === editingId) : undefined), [editingId, cameras]);
    const assigningCamera = useMemo(() => (assigningCameraId ? cameras.find((c) => c.id === assigningCameraId) : undefined), [assigningCameraId, cameras]);
    const camerasForPage = useMemo(() => {
        if (selectedGroupId === 'all')
            return cameras;
        return cameras.filter((c) => (c.groupIds ?? []).includes(selectedGroupId));
    }, [cameras, selectedGroupId]);
    const handleSave = (name, location, groupIds) => {
        onSaveDetails(name, location, editingId, groupIds);
        closeModal();
    };
    const openAssignGroups = (id) => {
        const camera = cameras.find((c) => c.id === id);
        setAssigningCameraId(id);
        setAssignDraftGroupIds(camera?.groupIds ?? []);
    };
    const toggleDraftGroup = (groupId) => {
        setAssignDraftGroupIds((prev) => prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]);
    };
    const saveAssignedGroups = () => {
        if (!assigningCameraId)
            return;
        onAssignGroups(assigningCameraId, assignDraftGroupIds);
        closeAssignModal();
    };
    const openCreateGroupModal = (target) => {
        setCreateGroupTarget(target);
        setCreateGroupName('');
        setCreateGroupOpen(true);
    };
    const handleCreateGroup = (name) => {
        const createdId = onAddGroup(name);
        if (!createdId)
            return;
        if (createGroupTarget === 'tabs')
            setSelectedGroupId(createdId);
        if (createGroupTarget === 'assign') {
            setAssignDraftGroupIds((prev) => (prev.includes(createdId) ? prev : [...prev, createdId]));
        }
        closeCreateGroupModal();
    };
    return (<>
      <section className="contentPanel contentPanelCameras">
        <div className="sectionRow">
          <span className="sectionTitle">Cameras</span>
          <div className="sectionActionsGroup">
            <button className="sectionAction sectionActionPrimary" onClick={onAddCamera}>Add new +</button>
          </div>
        </div>

        <div className="cameraGroupTabs" role="tablist" aria-label="Camera groups">
          <button type="button" className={`cameraGroupTab${selectedGroupId === 'all' ? ' active' : ''}`} onClick={() => setSelectedGroupId('all')}>
            All
          </button>
          {groups.map((group) => {
            const count = cameras.filter((c) => (c.groupIds ?? []).includes(group.id)).length;
            const isConfirming = confirmDeleteGroupId === group.id;
            return (<span key={group.id} className={`cameraGroupTabWrap${selectedGroupId === group.id ? ' active' : ''}`}>
                <button type="button" className={`cameraGroupTab${selectedGroupId === group.id ? ' active' : ''}`} onClick={() => setSelectedGroupId(group.id)}>
                  {group.name}
                  <span className="cameraGroupTabCount">{count}</span>
                </button>
                <button type="button" className="cameraGroupTabDelete" aria-label={`Delete group ${group.name}`} onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteGroupId(group.id);
                }}>
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                {isConfirming && (<div className="groupDeletePopover" role="dialog" aria-label="Confirm delete">
                    <button className="groupDeletePopoverBackdrop" onClick={(e) => { e.stopPropagation(); setConfirmDeleteGroupId(null); }} aria-label="Cancel"/>
                    <div className="groupDeletePopoverCard" onClick={(e) => e.stopPropagation()}>
                      <div className="groupDeletePopoverMsg">
                        Delete <strong>{group.name}</strong>?
                        <span className="groupDeletePopoverSub">Cameras will be unassigned.</span>
                      </div>
                      <div className="groupDeletePopoverActions">
                        <button type="button" className="groupDeletePopoverCancel" onClick={(e) => { e.stopPropagation(); setConfirmDeleteGroupId(null); }}>
                          Cancel
                        </button>
                        <button type="button" className="groupDeletePopoverConfirm" onClick={(e) => { e.stopPropagation(); onDeleteGroup(group.id); setConfirmDeleteGroupId(null); }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>)}
              </span>);
        })}
          <button type="button" className="cameraGroupTab cameraGroupTabCreate" onClick={() => openCreateGroupModal('tabs')}>
            + Group
          </button>
        </div>

        <div className="dashboard">
          {camerasForPage.map((cam) => (<CameraCard key={cam.id} id={cam.id} name={cam.name} location={cam.location} preview={cam.preview} online={!!cam.online} pinned={!!cam.pinned} onTogglePin={onTogglePin} onEdit={openEdit} onAssignGroups={openAssignGroups} onRemove={onRemove}/>))}
          {camerasForPage.length === 0 && (<div className="emptyState">No cameras match this group.</div>)}
        </div>
      </section>

      <AddCameraModal open={addOpen} onClose={closeModal} onSaveDetails={handleSave} onCreateGroup={onAddGroup} groups={groups} title={editingId ? 'Edit Camera' : 'Add Camera'} saveLabel={editingId ? 'Save changes' : 'Add Camera'} initialName={editingCamera?.name ?? ''} initialLocation={editingCamera?.location ?? ''} initialGroupIds={editingCamera?.groupIds ?? []}/>

      <SettingsModal open={createGroupOpen} onClose={closeCreateGroupModal} onSave={() => {
            const name = createGroupName.trim();
            if (!name)
                return;
            handleCreateGroup(name);
        }} title="Create Group">
        <div className="modalFormStack">
          <div className="modalLead">
            Create a camera group folder to organize related feeds.
          </div>
          <div className="modalField">
            <label htmlFor="createGroupNameInput">Group name</label>
            <input id="createGroupNameInput" value={createGroupName} onChange={(e) => setCreateGroupName(e.target.value)} placeholder="e.g. Parking Lot" autoFocus onKeyDown={(e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const name = createGroupName.trim();
                if (!name)
                    return;
                handleCreateGroup(name);
            }
        }}/>
          </div>
        </div>
      </SettingsModal>

      {assigningCamera && (<div className="groupAssignOverlay" role="dialog" aria-modal="true" aria-label="Assign camera groups">
          <button type="button" className="groupAssignBackdrop" onClick={closeAssignModal} aria-label="Close"/>
          <div className="groupAssignCard">
            <div className="groupAssignHeader">
              <div>
                <div className="groupAssignTitle">Assign Groups</div>
                <div className="groupAssignSubtitle">{assigningCamera.name}</div>
              </div>
              <button type="button" className="groupAssignClose" onClick={closeAssignModal}>X</button>
            </div>
            <div className="groupAssignList">
              {groups.map((group) => {
                const checked = assignDraftGroupIds.includes(group.id);
                return (<label key={group.id} className={`groupAssignItem${checked ? ' checked' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleDraftGroup(group.id)}/>
                    <span>{group.name}</span>
                  </label>);
            })}
              {groups.length === 0 && <div className="emptyState">Create a group first.</div>}
            </div>
            <div className="groupAssignActions">
              <button type="button" className="sectionAction" onClick={() => openCreateGroupModal('assign')}>+ New group</button>
              <div className="groupAssignActionsRight">
                <button type="button" className="sectionAction" onClick={closeAssignModal}>Cancel</button>
                <button type="button" className="sectionAction sectionActionPrimary" onClick={saveAssignedGroups}>Save</button>
              </div>
            </div>
          </div>
        </div>)}
    </>);
}
