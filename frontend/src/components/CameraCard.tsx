import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getStream, subscribe, unsubscribe } from '../data/cameraStreamStore';
import { getVideoFeedUrl } from '../services/api';
import './CameraCard.css';
export default function CameraCard({ id, name, location, preview, online = false, pinned = false, backendLive = false, onTogglePin, onEdit, onAssignGroups, onRemove, }) {
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const menuRef = useRef(null);
    const liveVideoRef = useRef(null);
    const [liveStream, setLiveStream] = useState(() => getStream(id)?.stream ?? null);
    useEffect(() => {
        setLiveStream(getStream(id)?.stream ?? null);
        const fn = (changedId) => {
            if (changedId === id)
                setLiveStream(getStream(id)?.stream ?? null);
        };
        subscribe(fn);
        return () => unsubscribe(fn);
    }, [id]);
    useEffect(() => {
        const video = liveVideoRef.current;
        if (!video)
            return;
        if (liveStream) {
            video.srcObject = liveStream;
            video.play().catch(() => undefined);
        }
        else {
            video.srcObject = null;
        }
    }, [liveStream]);
    const dropdownRef = useRef(null);
    const buttonRef = useRef(null);
    const [menuDirection, setMenuDirection] = useState('up');
    const toggleMenu = (e) => {
        e.stopPropagation();
        setMenuOpen((v) => !v);
    };
    const closeMenu = () => setMenuOpen(false);
    const run = (fn) => (e) => {
        e.stopPropagation();
        fn?.(id);
        closeMenu();
    };
    useEffect(() => {
        if (!menuOpen)
            return;
        const onDocMouseDown = (e) => {
            if (!menuRef.current)
                return;
            if (menuRef.current.contains(e.target))
                return;
            closeMenu();
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [menuOpen]);
    useEffect(() => {
        if (!menuOpen)
            return;
        const onKeyDown = (e) => {
            if (e.key === 'Escape')
                closeMenu();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [menuOpen]);
    useLayoutEffect(() => {
        if (!menuOpen)
            return;
        const updateMenuDirection = () => {
            const button = buttonRef.current;
            const dropdown = dropdownRef.current;
            if (!button || !dropdown)
                return;
            const buttonRect = button.getBoundingClientRect();
            const dropdownRect = dropdown.getBoundingClientRect();
            const gap = 8;
            const viewportPad = 12;
            const scrollBounds = button.closest('.cameraGroupsScroll, .contentPanelCameras')?.getBoundingClientRect() ?? {
                top: viewportPad,
                bottom: window.innerHeight - viewportPad,
            };
            const roomAbove = buttonRect.top - Math.max(scrollBounds.top, viewportPad);
            const roomBelow = Math.min(scrollBounds.bottom, window.innerHeight - viewportPad) - buttonRect.bottom;
            const needed = dropdownRect.height + gap;
            if (roomAbove < needed && roomBelow > roomAbove) {
                setMenuDirection('down');
                return;
            }
            setMenuDirection('up');
        };
        updateMenuDirection();
        window.addEventListener('resize', updateMenuDirection);
        window.addEventListener('scroll', updateMenuDirection, true);
        return () => {
            window.removeEventListener('resize', updateMenuDirection);
            window.removeEventListener('scroll', updateMenuDirection, true);
        };
    }, [menuOpen]);
    return (<div className="cameraCard" role="button" tabIndex={0} onClick={() => navigate(`/camera/${id}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ')
        navigate(`/camera/${id}`); }}>
      
      <div className="cameraShell">
        <div className="cameraPreview">
          {/* Preview priority:
              1. backendLive → MJPEG feed from /api/video/feed/{id}. This is
                 the annotated detection stream, so the card shows live
                 bounding boxes even after the user navigates off CameraPage.
              2. liveStream → local browser getUserMedia preview (no boxes).
              3. static preview image, if provided.
              4. Offline placeholder. */}
          {backendLive ? (
            <img
              className="cameraLiveThumb"
              src={getVideoFeedUrl(id)}
              alt={`${name} live detection feed`}
            />
          ) : liveStream ? (
            <video ref={liveVideoRef} className="cameraLiveThumb" muted playsInline autoPlay/>
          ) : preview ? (
            <img src={preview} alt={name}/>
          ) : (
            <div className="cameraOffline">
              <div className="offlineContent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="1" y1="1" x2="23" y2="23"/>
                  <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06A4 4 0 1 1 7.75 7.75"/>
                </svg>
                <span>Offline</span>
              </div>
            </div>
          )}
        </div>

        <div className={`cameraStatusBadge${(backendLive || online || !!liveStream) ? ' online' : ' offline'}`} aria-label={backendLive ? 'Detecting' : (online || !!liveStream) ? 'Live' : 'Offline'}>
          <span className="cameraStatusDot"/>
          <span>{backendLive ? 'Detecting' : (online || !!liveStream) ? 'Live' : 'Offline'}</span>
        </div>

        
        {pinned && (<div className="cameraPinnedBadge" aria-label="Pinned">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a1 1 0 0 1 .894.553l2.618 5.234 5.776.839a1 1 0 0 1 .554 1.706l-4.179 4.074.987 5.749a1 1 0 0 1-1.451 1.054L12 18.785l-5.2 2.424a1 1 0 0 1-1.45-1.054l.987-5.749L2.158 10.332a1 1 0 0 1 .554-1.706l5.776-.839L11.106 2.553A1 1 0 0 1 12 2z"/>
            </svg>
          </div>)}
      </div>

      
      <div className="cardInfo">
        <div className="cardMeta">
          <div className="cameraTitle">{name}</div>
          {location?.trim() ? (<div className="cameraLocation">{location.trim()}</div>) : null}
        </div>

        <div className="cameraMenu" ref={menuRef}>
          <button type="button" className="menuButton" ref={buttonRef} aria-label="Camera options" aria-haspopup="menu" aria-expanded={menuOpen} onClick={toggleMenu}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>

          {menuOpen && (<div className={`menuDropdown menuDropdown-${menuDirection}`} ref={dropdownRef} role="menu">
              <button type="button" className="menuItem" role="menuitem" onClick={run(onTogglePin)}>
                {pinned ? 'Unpin' : 'Pin to top'}
              </button>
              <button type="button" className="menuItem" role="menuitem" onClick={run(onEdit)} disabled={!onEdit}>
                Edit
              </button>
              <button type="button" className="menuItem" role="menuitem" onClick={run(onAssignGroups)} disabled={!onAssignGroups}>
                Assign groups
              </button>
              <div className="menuDivider" role="separator"/>
              <button type="button" className="menuItem danger" role="menuitem" disabled={!onRemove} onClick={(e) => { e.stopPropagation(); closeMenu(); setConfirmRemove(true); }}>
                Remove
              </button>
            </div>)}
        </div>
      </div>

      {confirmRemove && createPortal(<div className="cameraRemoveModal" role="dialog" aria-modal="true" aria-label="Remove camera">
          <button type="button" className="cameraRemoveModalBackdrop" onClick={(e) => { e.stopPropagation(); setConfirmRemove(false); }} aria-label="Close"/>
          <div className="cameraRemoveModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="cameraRemoveModalIconWrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </div>
            <div className="cameraRemoveModalTitle">Remove camera?</div>
            <div className="cameraRemoveModalMsg">
              <strong>{name}</strong> will be permanently removed from your dashboard.
            </div>
            <div className="cameraRemoveModalActions">
              <button type="button" className="cameraSecondaryBtn" onClick={(e) => { e.stopPropagation(); setConfirmRemove(false); }}>
                Cancel
              </button>
              <button type="button" className="cameraDangerConfirmBtn" onClick={(e) => { e.stopPropagation(); onRemove?.(id); setConfirmRemove(false); }}>
                Remove
              </button>
            </div>
          </div>
        </div>, document.body)}
    </div>);
}
