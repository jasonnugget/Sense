import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './CameraCard.css'

type Props = {
  id: string
  name: string
  location?: string
  preview?: string
  pinned?: boolean
  onTogglePin?: (id: string) => void
  onEdit?: (id: string) => void
  onAssignGroups?: (id: string) => void
  onRemove?: (id: string) => void
}

export default function CameraCard({
  id,
  name,
  location,
  preview,
  pinned = false,
  onTogglePin,
  onEdit,
  onAssignGroups,
  onRemove,
}: Props) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [menuDirection, setMenuDirection] = useState<'up' | 'down'>('up')

  const toggleMenu: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation()
    setMenuOpen((v) => !v)
  }

  const closeMenu = () => setMenuOpen(false)

  const run =
    (fn?: (id: string) => void) =>
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      fn?.(id)
      closeMenu()
    }

  useEffect(() => {
    if (!menuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (menuRef.current.contains(e.target as Node)) return
      closeMenu()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  useLayoutEffect(() => {
    if (!menuOpen) return

    const updateMenuDirection = () => {
      const button = buttonRef.current
      const dropdown = dropdownRef.current
      if (!button || !dropdown) return

      const buttonRect = button.getBoundingClientRect()
      const dropdownRect = dropdown.getBoundingClientRect()
      const gap = 8
      const viewportPad = 12
      const scrollBounds =
        button.closest('.cameraGroupsScroll, .contentPanelCameras')?.getBoundingClientRect() ?? {
          top: viewportPad,
          bottom: window.innerHeight - viewportPad,
        }
      const roomAbove = buttonRect.top - Math.max(scrollBounds.top, viewportPad)
      const roomBelow = Math.min(scrollBounds.bottom, window.innerHeight - viewportPad) - buttonRect.bottom
      const needed = dropdownRect.height + gap

      if (roomAbove < needed && roomBelow > roomAbove) {
        setMenuDirection('down')
        return
      }
      setMenuDirection('up')
    }

    updateMenuDirection()
    window.addEventListener('resize', updateMenuDirection)
    window.addEventListener('scroll', updateMenuDirection, true)
    return () => {
      window.removeEventListener('resize', updateMenuDirection)
      window.removeEventListener('scroll', updateMenuDirection, true)
    }
  }, [menuOpen])

  return (
    <div className="cameraCard" role="button" tabIndex={0} onClick={() => navigate(`/camera/${id}`)}>
      <div className="cameraShell">
        <div className="cameraPreview">
          {preview ? (
            <img src={preview} alt={name} />
          ) : (
            <div className="cameraOffline">
              <div className="offlineContent">
                <div className="offlineDot" />
                <span>Camera Offline</span>
              </div>
            </div>
          )}
        </div>

        <div className="cameraOverlay">
          <div className="overlayContent">
            <div className="cameraText">
              <span className="cameraTitle">{name}</span>
              {location?.trim() ? <span className="cameraLocation">{location.trim()}</span> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="cameraMenu" ref={menuRef}>
        <button
          type="button"
          className="menuButton"
          ref={buttonRef}
          aria-label="Camera menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={toggleMenu}
        >
          ⋮
        </button>

        {menuOpen && (
          <div
            className={`menuDropdown menuDropdown-${menuDirection}`}
            ref={dropdownRef}
            role="menu"
          >
            <button type="button" className="menuItem" role="menuitem" onClick={run(onTogglePin)}>
              {pinned ? 'Unpin' : 'Pin to top'}
            </button>

            <button
              type="button"
              className="menuItem"
              role="menuitem"
              onClick={run(onEdit)}
              disabled={!onEdit}
            >
              Edit
            </button>

            <button
              type="button"
              className="menuItem"
              role="menuitem"
              onClick={run(onAssignGroups)}
              disabled={!onAssignGroups}
            >
              Assign groups
            </button>

            <button
              type="button"
              className="menuItem danger"
              role="menuitem"
              onClick={run(onRemove)}
              disabled={!onRemove}
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
