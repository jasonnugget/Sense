import { useEffect, useMemo, useState, type ReactNode } from 'react'
import CameraCard from '../components/CameraCard'
import AddCameraModal from '../components/AddCameraModal'
import SettingsModal from '../components/SettingsModal'
import { Camera, CameraGroup } from '../app/App'

export type MainPageProps = {
  cameras: Camera[]
  groups: CameraGroup[]
  onSaveDetails: (name: string, location: string, editingId: string | null, groupIds: string[]) => void
  onTogglePin: (id: string) => void
  onAssignGroups: (cameraId: string, groupIds: string[]) => void
  onAddGroup: (name: string) => string | null
  onRemove: (id: string) => void
  onAddCamera: () => void
  totalCameras: number
  onlineCameras: number
  showOverview?: boolean
}

function IconCamera() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  )
}

function IconAlert() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

type OverviewCard = {
  label: string
  value: string | number
  subtext: ReactNode
  icon: ReactNode
  iconToneClass: string
  valueToneClass?: string
}

export default function MainPage({
  cameras,
  groups,
  onSaveDetails,
  onTogglePin,
  onAssignGroups,
  onAddGroup,
  onRemove,
  onAddCamera,
  totalCameras,
  onlineCameras,
  showOverview = true,
}: MainPageProps) {
  const [addOpen,    setAddOpen]    = useState(false)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all')
  const [homeSelectedGroupId, setHomeSelectedGroupId] = useState<string>('all')
  const [assigningCameraId, setAssigningCameraId] = useState<string | null>(null)
  const [assignDraftGroupIds, setAssignDraftGroupIds] = useState<string[]>([])
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [createGroupName, setCreateGroupName] = useState('')
  const [createGroupTarget, setCreateGroupTarget] = useState<'home-tabs' | 'cameras-tabs' | 'assign'>('cameras-tabs')
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Record<string, boolean>>({})
  const [cameraDensity, setCameraDensity] = useState<'comfortable' | 'compact'>(() => {
    const saved = localStorage.getItem('cameraDensity')
    return saved === 'compact' ? 'compact' : 'comfortable'
  })

  const openAdd  = () => { setEditingId(null); setAddOpen(true) }
  const openEdit = (id: string) => { setEditingId(id); setAddOpen(true) }
  const closeModal = () => { setAddOpen(false); setEditingId(null) }
  const closeAssignModal = () => { setAssigningCameraId(null); setAssignDraftGroupIds([]) }
  const closeCreateGroupModal = () => { setCreateGroupOpen(false); setCreateGroupName('') }

  useEffect(() => {
    const handler = () => openAdd()
    window.addEventListener('ui:add-camera', handler)
    return () => window.removeEventListener('ui:add-camera', handler)
  }, [])

  useEffect(() => {
    localStorage.setItem('cameraDensity', cameraDensity)
  }, [cameraDensity])

  useEffect(() => {
    if (selectedGroupId !== 'all' && !groups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId('all')
    }
    if (homeSelectedGroupId !== 'all' && !groups.some((g) => g.id === homeSelectedGroupId)) {
      setHomeSelectedGroupId('all')
    }
  }, [groups, selectedGroupId, homeSelectedGroupId])

  const editingCamera = useMemo(
    () => editingId ? cameras.find(c => c.id === editingId) : undefined,
    [editingId, cameras]
  )

  const handleSave = (name: string, location: string, groupIds: string[]) => {
    onSaveDetails(name, location, editingId, groupIds)
    closeModal()
  }

  const handleRemove = (id: string) => {
    onRemove(id)
    if (editingId === id) closeModal()
  }

  const openAssignGroups = (id: string) => {
    const camera = cameras.find((c) => c.id === id)
    setAssigningCameraId(id)
    setAssignDraftGroupIds(camera?.groupIds ?? [])
  }

  const toggleDraftGroup = (groupId: string) => {
    setAssignDraftGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    )
  }

  const saveAssignedGroups = () => {
    if (!assigningCameraId) return
    onAssignGroups(assigningCameraId, assignDraftGroupIds)
    closeAssignModal()
  }

  const openCreateGroupModal = (target: 'home-tabs' | 'cameras-tabs' | 'assign') => {
    setCreateGroupTarget(target)
    setCreateGroupName('')
    setCreateGroupOpen(true)
  }

  const handleCreateGroup = (name: string) => {
    const createdId = onAddGroup(name)
    if (!createdId) return
    if (createGroupTarget === 'home-tabs') setHomeSelectedGroupId(createdId)
    if (createGroupTarget === 'cameras-tabs') setSelectedGroupId(createdId)
    if (createGroupTarget === 'assign') {
      setAssignDraftGroupIds((prev) => (prev.includes(createdId) ? prev : [...prev, createdId]))
    }
    closeCreateGroupModal()
  }

  const toggleGroupCollapsed = (groupId: string) => {
    setCollapsedGroupIds((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const offlineCameras = totalCameras - onlineCameras
  const isAlert = offlineCameras > 0
  const assigningCamera = useMemo(
    () => (assigningCameraId ? cameras.find((c) => c.id === assigningCameraId) : undefined),
    [assigningCameraId, cameras],
  )

  const camerasForCamerasPage = useMemo(() => {
    if (selectedGroupId === 'all') return cameras
    return cameras.filter((c) => (c.groupIds ?? []).includes(selectedGroupId))
  }, [cameras, selectedGroupId])

  const homeCameraGroups = useMemo(() => {
    const byGroup = groups
      .map((group) => ({
        group,
        cameras: cameras.filter((camera) => (camera.groupIds ?? []).includes(group.id)),
      }))
      .filter((entry) => entry.cameras.length > 0)
    const ungrouped = cameras.filter((camera) => !camera.groupIds || camera.groupIds.length === 0)
    return { byGroup, ungrouped }
  }, [cameras, groups])

  const overviewCards: OverviewCard[] = [
    {
      label: 'Total Cameras',
      value: totalCameras,
      subtext: (
        <>
          <span className="statusPip online" />
          {onlineCameras} online
          {offlineCameras > 0 && (
            <> &middot; <span className="statusPip offline" />{offlineCameras} offline</>
          )}
        </>
      ),
      icon: <IconCamera />,
      iconToneClass: 'overviewCardIcon-accent',
    },
    {
      label: 'Alerts · 24h',
      value: offlineCameras,
      subtext: isAlert ? `${offlineCameras} camera${offlineCameras > 1 ? 's' : ''} offline` : 'No active alerts',
      icon: <IconAlert />,
      iconToneClass: 'overviewCardIcon-danger',
      valueToneClass: isAlert ? 'overviewCardValue-danger' : undefined,
    },
    {
      label: 'Status',
      value: isAlert ? 'Alert' : 'Normal',
      subtext: (
        <>
          <span className={`statusPip ${isAlert ? 'offline' : 'online'}`} />
          {isAlert ? 'Needs attention' : 'All systems OK'}
        </>
      ),
      icon: <IconShield />,
      iconToneClass: isAlert ? 'overviewCardIcon-danger' : 'overviewCardIcon-accent',
      valueToneClass: isAlert ? 'overviewCardValue-statusAlert' : 'overviewCardValue-statusNormal',
    },
  ]

  return (
    <>
      {showOverview && (
        <section className="contentPanel contentPanelOverview">
          {/* ── Overview strip ──────────────────────────────── */}
          <div className="sectionRow">
            <span className="sectionTitle">Overview</span>
          </div>

          <div className="overviewStrip">
            {overviewCards.map((card) => (
              <div key={card.label} className="overviewCard">
                <div className="overviewCardTop">
                  <span className="overviewCardLabel">{card.label}</span>
                  <div className={`overviewCardIcon ${card.iconToneClass}`}>
                    {card.icon}
                  </div>
                </div>
                <div className={`overviewCardValue${card.valueToneClass ? ` ${card.valueToneClass}` : ''}`}>
                  {card.value}
                </div>
                <div className="overviewCardSub">{card.subtext}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="contentPanel contentPanelCameras">
        {/* ── Cameras grid ────────────────────────────────── */}
        <div className="sectionRow">
          <span className="sectionTitle">Cameras</span>
          <div className="sectionActionsGroup">
            <div className="miniToggle" role="tablist" aria-label="Camera card density">
              <button
                type="button"
                className={`miniToggleBtn${cameraDensity === 'comfortable' ? ' active' : ''}`}
                onClick={() => setCameraDensity('comfortable')}
              >
                Comfortable
              </button>
              <button
                type="button"
                className={`miniToggleBtn${cameraDensity === 'compact' ? ' active' : ''}`}
                onClick={() => setCameraDensity('compact')}
              >
                Compact
              </button>
            </div>
            <button className="sectionAction sectionActionPrimary" onClick={onAddCamera}>Add new +</button>
          </div>
        </div>

        {showOverview && (
          <div className="cameraGroupSortRow">
            <span className="cameraGroupSortLabel">Groups</span>
            <div className="cameraGroupSortTabs" role="tablist" aria-label="Home camera groups">
              <button
                type="button"
                className={`cameraGroupTab${homeSelectedGroupId === 'all' ? ' active' : ''}`}
                onClick={() => setHomeSelectedGroupId('all')}
              >
                All
              </button>
              {groups.map((group) => {
                const count = cameras.filter((c) => (c.groupIds ?? []).includes(group.id)).length
                if (count === 0) return null
                return (
                  <button
                    key={`home-${group.id}`}
                    type="button"
                    className={`cameraGroupTab${homeSelectedGroupId === group.id ? ' active' : ''}`}
                    onClick={() => setHomeSelectedGroupId(group.id)}
                  >
                    {group.name}
                    <span className="cameraGroupTabCount">{count}</span>
                  </button>
                )
              })}
              <button type="button" className="cameraGroupTab cameraGroupTabCreate" onClick={() => openCreateGroupModal('home-tabs')}>
                + Group
              </button>
            </div>
          </div>
        )}

        {!showOverview && (
          <div className="cameraGroupTabs" role="tablist" aria-label="Camera groups">
            <button
              type="button"
              className={`cameraGroupTab${selectedGroupId === 'all' ? ' active' : ''}`}
              onClick={() => setSelectedGroupId('all')}
            >
              All
            </button>
            {groups.map((group) => {
              const count = cameras.filter((c) => (c.groupIds ?? []).includes(group.id)).length
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`cameraGroupTab${selectedGroupId === group.id ? ' active' : ''}`}
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  {group.name}
                  <span className="cameraGroupTabCount">{count}</span>
                </button>
              )
            })}
            <button type="button" className="cameraGroupTab cameraGroupTabCreate" onClick={() => openCreateGroupModal('cameras-tabs')}>
              + Group
            </button>
          </div>
        )}

        {showOverview ? (
          <div className="cameraGroupsScroll">
            {homeSelectedGroupId === 'all' ? (
              <div className={`dashboard${cameraDensity === 'compact' ? ' compact' : ''}`}>
                {cameras.map((cam) => (
                  <CameraCard
                    key={cam.id}
                    id={cam.id}
                    name={cam.name}
                    location={cam.location}
                    preview={cam.preview}
                    pinned={!!cam.pinned}
                    onTogglePin={onTogglePin}
                    onEdit={openEdit}
                    onAssignGroups={openAssignGroups}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            ) : (
              <>
                {homeCameraGroups.byGroup
                  .filter(({ group }) => group.id === homeSelectedGroupId)
                  .map(({ group, cameras: groupCameras }) => {
                    const collapsed = !!collapsedGroupIds[group.id]
                    return (
                      <section key={group.id} className="cameraFolderSection">
                        <button
                          type="button"
                          className="cameraFolderHeader"
                          onClick={() => toggleGroupCollapsed(group.id)}
                          aria-expanded={!collapsed}
                        >
                          <span className="cameraFolderTitle">{group.name}</span>
                          <span className="cameraFolderMeta">{groupCameras.length}</span>
                        </button>
                        {!collapsed && (
                          <div className={`dashboard cameraFolderGrid${cameraDensity === 'compact' ? ' compact' : ''}`}>
                            {groupCameras.map((cam) => (
                              <CameraCard
                                key={cam.id}
                                id={cam.id}
                                name={cam.name}
                                location={cam.location}
                                preview={cam.preview}
                                pinned={!!cam.pinned}
                                onTogglePin={onTogglePin}
                                onEdit={openEdit}
                                onAssignGroups={openAssignGroups}
                                onRemove={handleRemove}
                              />
                            ))}
                          </div>
                        )}
                      </section>
                    )
                  })}
              </>
            )}

            {homeSelectedGroupId !== 'all' && homeCameraGroups.byGroup.every(({ group }) => group.id !== homeSelectedGroupId) && (
              <div className="emptyState">No cameras match this group.</div>
            )}
          </div>
        ) : (
          <div className={`dashboard${cameraDensity === 'compact' ? ' compact' : ''}`}>
            {camerasForCamerasPage.map(cam => (
              <CameraCard
                key={cam.id}
                id={cam.id}
                name={cam.name}
                location={cam.location}
                preview={cam.preview}
                pinned={!!cam.pinned}
                onTogglePin={onTogglePin}
                onEdit={openEdit}
                onAssignGroups={openAssignGroups}
                onRemove={handleRemove}
              />
            ))}
            {camerasForCamerasPage.length === 0 && (
              <div className="emptyState">No cameras match this group.</div>
            )}
          </div>
        )}
      </section>

      <AddCameraModal
        open={addOpen}
        onClose={closeModal}
        onSaveDetails={handleSave}
        onCreateGroup={onAddGroup}
        groups={groups}
        title={editingId ? 'Edit Camera' : 'Add Camera'}
        saveLabel={editingId ? 'Save changes' : 'Add Camera'}
        initialName={editingCamera?.name ?? ''}
        initialLocation={editingCamera?.location ?? ''}
        initialGroupIds={editingCamera?.groupIds ?? []}
      />

      <SettingsModal
        open={createGroupOpen}
        onClose={closeCreateGroupModal}
        onSave={() => {
          const name = createGroupName.trim()
          if (!name) return
          handleCreateGroup(name)
        }}
        title="Create Group"
      >
        <div className="modalFormStack">
          <div className="modalLead">
            Create a camera group folder to organize related feeds.
          </div>
          <div className="modalField">
            <label htmlFor="createGroupNameInput">Group name</label>
            <input
              id="createGroupNameInput"
              value={createGroupName}
              onChange={(e) => setCreateGroupName(e.target.value)}
              placeholder="e.g. Parking Lot"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const name = createGroupName.trim()
                  if (!name) return
                  handleCreateGroup(name)
                }
              }}
            />
          </div>
        </div>
      </SettingsModal>

      {assigningCamera && (
        <div className="groupAssignOverlay" role="dialog" aria-modal="true" aria-label="Assign camera groups">
          <button type="button" className="groupAssignBackdrop" onClick={closeAssignModal} aria-label="Close" />
          <div className="groupAssignCard">
            <div className="groupAssignHeader">
              <div>
                <div className="groupAssignTitle">Assign Groups</div>
                <div className="groupAssignSubtitle">{assigningCamera.name}</div>
              </div>
              <button type="button" className="groupAssignClose" onClick={closeAssignModal}>✕</button>
            </div>
            <div className="groupAssignList">
              {groups.map((group) => {
                const checked = assignDraftGroupIds.includes(group.id)
                return (
                  <label key={group.id} className={`groupAssignItem${checked ? ' checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDraftGroup(group.id)}
                    />
                    <span>{group.name}</span>
                  </label>
                )
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
        </div>
      )}
    </>
  )
}
