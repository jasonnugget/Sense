import { useEffect, useMemo, useRef, useState } from 'react'
import SettingsModal from './SettingsModal'
import type { CameraGroup } from '../app/App'

type Props = {
  open: boolean
  onClose: () => void

  // When editing, pass initial values + a different title/button label
  title?: string
  saveLabel?: string
  initialName?: string
  initialLocation?: string
  initialGroupIds?: string[]
  groups: CameraGroup[]
  onCreateGroup: (name: string) => string | null

  // One submit handler for both add & edit
  onSaveDetails: (name: string, location: string, groupIds: string[]) => void
}

export default function AddCameraModal({
  open,
  onClose,
  onSaveDetails,
  title = 'Add Camera',
  saveLabel = 'Save',
  initialName = '',
  initialLocation = '',
  initialGroupIds = [],
  groups,
  onCreateGroup,
}: Props) {
  const [draftName, setDraftName] = useState('')
  const [draftLocation, setDraftLocation] = useState('')
  const [draftGroupIds, setDraftGroupIds] = useState<string[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [groupPickerOpen, setGroupPickerOpen] = useState(false)
  const groupPickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    setDraftName(initialName)
    setDraftLocation(initialLocation)
    setDraftGroupIds(initialGroupIds)
    setNewGroupName('')
    setGroupPickerOpen(false)
  }, [open, initialName, initialLocation, initialGroupIds])

  useEffect(() => {
    if (!groupPickerOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (!groupPickerRef.current) return
      if (groupPickerRef.current.contains(e.target as Node)) return
      setGroupPickerOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGroupPickerOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [groupPickerOpen])

  const selectedGroups = useMemo(
    () => groups.filter((g) => draftGroupIds.includes(g.id)),
    [groups, draftGroupIds],
  )

  const save = () => {
    const name = draftName.trim()
    const location = draftLocation.trim()
    if (!name) return
    onSaveDetails(name, location, draftGroupIds)
  }

  const toggleDraftGroup = (groupId: string) => {
    setDraftGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    )
  }

  const createGroupInModal = () => {
    const createdId = onCreateGroup(newGroupName)
    if (!createdId) return
    setDraftGroupIds((prev) => (prev.includes(createdId) ? prev : [...prev, createdId]))
    setNewGroupName('')
    setGroupPickerOpen(true)
  }

  return (
    <SettingsModal open={open} onClose={onClose} onSave={save} title={title}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <label htmlFor="cameraName" style={{ opacity: 0.85 }}>
            Camera name
          </label>
          <input
            id="cameraName"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="e.g. Front Door"
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface-raised)',
              color: 'inherit',
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
            autoFocus
          />
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <label htmlFor="cameraLocation" style={{ opacity: 0.85 }}>
            Location
          </label>
          <input
            id="cameraLocation"
            value={draftLocation}
            onChange={(e) => setDraftLocation(e.target.value)}
            placeholder="e.g. Home, Lobby, Warehouse"
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface-raised)',
              color: 'inherit',
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
          />
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ opacity: 0.85 }}>Groups</label>
          <div ref={groupPickerRef} style={{ display: 'grid', gap: 8, position: 'relative' }}>
            <button
              type="button"
              className="settingsBtn ghost"
              onClick={() => setGroupPickerOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={groupPickerOpen}
              style={{
                justifyContent: 'space-between',
                width: '100%',
                height: 40,
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                background: 'var(--surface)',
              }}
            >
              <span style={{ color: draftGroupIds.length ? 'var(--text-1)' : 'var(--text-3)' }}>
                {draftGroupIds.length ? `${draftGroupIds.length} group${draftGroupIds.length > 1 ? 's' : ''} selected` : 'Select groups'}
              </span>
              <span style={{ opacity: 0.8 }}>{groupPickerOpen ? '▴' : '▾'}</span>
            </button>

            {selectedGroups.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedGroups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleDraftGroup(group.id)}
                    style={{
                      height: 24,
                      padding: '0 8px',
                      borderRadius: 999,
                      border: '1px solid var(--border)',
                      background: 'var(--surface-raised)',
                      color: 'var(--text-1)',
                      fontSize: 11,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    aria-label={`Remove ${group.name} group`}
                  >
                    <span>{group.name}</span>
                    <span style={{ opacity: 0.7 }}>✕</span>
                  </button>
                ))}
              </div>
            )}

            {groupPickerOpen && (
              <div
                role="listbox"
                aria-multiselectable="true"
                style={{
                  border: '1px solid var(--border-bright)',
                  borderRadius: 14,
                  background: 'var(--surface)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: 10,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <div style={{ display: 'grid', gap: 8, maxHeight: 160, overflow: 'auto', paddingRight: 2 }}>
                  {groups.map((group) => {
                    const checked = draftGroupIds.includes(group.id)
                    return (
                      <label
                        key={group.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '9px 10px',
                          borderRadius: 12,
                          border: `1px solid ${checked ? 'var(--border-bright)' : 'var(--border)'}`,
                          background: checked ? 'var(--surface-raised)' : 'var(--surface)',
                          color: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{group.name}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDraftGroup(group.id)}
                        />
                      </label>
                    )
                  })}
                  {groups.length === 0 && (
                    <div style={{ opacity: 0.72, fontSize: 12 }}>No groups yet. Create one below.</div>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Create new group"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        createGroupInModal()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="settingsBtn ghost"
                    onClick={createGroupInModal}
                    disabled={!newGroupName.trim()}
                    style={!newGroupName.trim() ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                  >
                    + Group
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Optional: show the actual save label somewhere if SettingsModal doesn't */}
        {/* <div style={{ opacity: 0.7, fontSize: 12 }}> */ }
        {/*   {saveLabel} */ }
        {/* </div> */}
      </div>
    </SettingsModal>
  )
}
