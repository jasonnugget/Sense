import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import ActivityPanel from '../components/activityPanel';
import AlertDetailsModal from '../components/AlertDetailsModal';
import MainPage from '../pages/MainPage';
import CameraPage from '../pages/CameraPage';
import AlertsPage from '../pages/AlertsPage';
import CamerasPage from '../pages/CamerasPage';
import SettingsModal from '../components/SettingsModal';
import ThemeSegmented from '../components/ThemeSegmented';
import { buildAlertEvents, relTime } from '../data/alerts';
import '../App.css';
const PINNED_KEY = 'pinnedCameras';
const GROUPS_KEY = 'cameraGroups';
const COLORBLIND_KEY = 'colorblindMode';
const DEFAULT_GROUPS = [
    { id: 'parking-lot', name: 'Parking Lot' },
    { id: 'perimeter', name: 'Perimeter' },
    { id: 'lobby', name: 'Lobby' },
];
function slugify(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function uniqueId(base, ids) {
    if (!ids.has(base))
        return base;
    let i = 2;
    while (ids.has(`${base}-${i}`))
        i++;
    return `${base}-${i}`;
}
let _themeTransitionTimer = null;
function applyTheme(mode, animate = false) {
    const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (animate) {
        if (_themeTransitionTimer !== null)
            window.clearTimeout(_themeTransitionTimer);
        document.documentElement.setAttribute('data-theme-transitioning', '');
        _themeTransitionTimer = window.setTimeout(() => {
            document.documentElement.removeAttribute('data-theme-transitioning');
            _themeTransitionTimer = null;
        }, 290);
    }
    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    else {
        document.documentElement.removeAttribute('data-theme');
    }
}
function IconSearch() {
    return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>);
}
function getRouteBucket(pathname) {
    if (pathname === '/')
        return '/';
    if (pathname.startsWith('/alerts'))
        return '/alerts';
    if (pathname.startsWith('/cameras'))
        return '/cameras';
    if (pathname.startsWith('/camera/'))
        return '/cameras';
    return '/other';
}
const NAV_ITEMS = [
    { to: '/', label: 'Home', end: true },
    { to: '/alerts', label: 'Alerts' },
    { to: '/cameras', label: 'Cameras' },
];
export default function App() {
    const location = useLocation();
    const navigate = useNavigate();
    const isHomeRoute = location.pathname === '/';
    const routeOrder = useMemo(() => ({
        '/': 0,
        '/alerts': 1,
        '/cameras': 2,
    }), []);
    const currentRouteRank = routeOrder[getRouteBucket(location.pathname)] ?? 99;
    const [routeAnimDir, setRouteAnimDir] = useState('forward');
    const [routeAnimProfile, setRouteAnimProfile] = useState('default');
    const [isRouteAnimating, setIsRouteAnimating] = useState(false);
    const routeAnimTimeoutRef = useRef(null);
    const routeAnimFrameRef = useRef(null);
    const prevPathRef = useRef(location.pathname);
    const [homePanelSlotExpanded, setHomePanelSlotExpanded] = useState(isHomeRoute);
    const [homePanelVisible, setHomePanelVisible] = useState(isHomeRoute);
    const homePanelTimerRef = useRef(null);
    const searchPlaceholder = useMemo(() => {
        if (location.pathname.startsWith('/alerts'))
            return 'Search alerts…';
        if (location.pathname.startsWith('/help'))
            return 'Search help…';
        if (location.pathname.startsWith('/cameras'))
            return 'Search cameras…';
        return 'Search cameras, events…';
    }, [location.pathname]);
    useEffect(() => {
        if (location.pathname === prevPathRef.current)
            return;
        const prevBucket = getRouteBucket(prevPathRef.current);
        const nextBucket = getRouteBucket(location.pathname);
        const prevRank = routeOrder[prevBucket] ?? 99;
        setRouteAnimDir(currentRouteRank >= prevRank ? 'forward' : 'backward');
        setRouteAnimProfile((prevBucket === '/' && nextBucket === '/cameras') || (prevBucket === '/cameras' && nextBucket === '/')
            ? 'heavy'
            : 'default');
        prevPathRef.current = location.pathname;
        if (routeAnimTimeoutRef.current)
            window.clearTimeout(routeAnimTimeoutRef.current);
        if (routeAnimFrameRef.current)
            window.cancelAnimationFrame(routeAnimFrameRef.current);
        setIsRouteAnimating(false);
        routeAnimFrameRef.current = window.requestAnimationFrame(() => {
            setIsRouteAnimating(true);
            routeAnimTimeoutRef.current = window.setTimeout(() => {
                setIsRouteAnimating(false);
                routeAnimTimeoutRef.current = null;
            }, 520);
        });
    }, [location.pathname, currentRouteRank, routeOrder]);
    useEffect(() => {
        return () => {
            if (routeAnimTimeoutRef.current)
                window.clearTimeout(routeAnimTimeoutRef.current);
            if (routeAnimFrameRef.current)
                window.cancelAnimationFrame(routeAnimFrameRef.current);
        };
    }, []);
    useEffect(() => {
        if (homePanelTimerRef.current) {
            window.clearTimeout(homePanelTimerRef.current);
            homePanelTimerRef.current = null;
        }
        if (isHomeRoute) {
            setHomePanelSlotExpanded(true);
            const f = window.requestAnimationFrame(() => {
                homePanelTimerRef.current = window.setTimeout(() => {
                    setHomePanelVisible(true);
                    homePanelTimerRef.current = null;
                }, 110);
            });
            return () => window.cancelAnimationFrame(f);
        }
        setHomePanelVisible(false);
        homePanelTimerRef.current = window.setTimeout(() => {
            setHomePanelSlotExpanded(false);
            homePanelTimerRef.current = null;
        }, 90);
    }, [isHomeRoute]);
    useEffect(() => {
        return () => {
            if (homePanelTimerRef.current)
                window.clearTimeout(homePanelTimerRef.current);
        };
    }, []);
    const [groups, setGroups] = useState(() => {
        try {
            const raw = localStorage.getItem(GROUPS_KEY);
            if (!raw)
                return DEFAULT_GROUPS;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || parsed.length === 0)
                return DEFAULT_GROUPS;
            return parsed
                .filter((g) => !!g && typeof g.id === 'string' && typeof g.name === 'string')
                .map((g) => ({ id: g.id, name: g.name.trim() || g.id }));
        }
        catch {
            return DEFAULT_GROUPS;
        }
    });
    const [cameras, setCameras] = useState(() => {
        const pinned = new Set(JSON.parse(localStorage.getItem(PINNED_KEY) || '[]'));
        return [
            { id: 'parking-lot', name: 'Parking Lot', location: 'Exterior', pinned: pinned.has('parking-lot'), online: true, groupIds: ['parking-lot'] },
            { id: 'front-door', name: 'Front Door', location: 'Home', pinned: pinned.has('front-door'), online: false, groupIds: [] },
            { id: 'loading-dock', name: 'Loading Dock', location: 'Warehouse', pinned: pinned.has('loading-dock'), online: true, groupIds: ['perimeter'] },
            { id: 'rear-gate', name: 'Rear Gate', location: 'Perimeter', pinned: pinned.has('rear-gate'), online: true, groupIds: ['perimeter'] },
            { id: 'server-room', name: 'Server Room', location: 'IT Floor', pinned: pinned.has('server-room'), online: false, groupIds: [] },
            { id: 'hallway-east', name: 'Hallway East', location: 'Level 2', pinned: pinned.has('hallway-east'), online: true, groupIds: [] },
            { id: 'lobby', name: 'Lobby', location: 'Main Entrance', pinned: pinned.has('lobby'), online: true, groupIds: ['lobby'] },
            { id: 'back-alley', name: 'Back Alley', location: 'Service Area', pinned: pinned.has('back-alley'), online: false, groupIds: ['perimeter'] },
        ];
    });
    useEffect(() => {
        localStorage.setItem(PINNED_KEY, JSON.stringify(cameras.filter(c => c.pinned).map(c => c.id)));
    }, [cameras]);
    useEffect(() => {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    }, [groups]);
    const saveCameraDetails = (name, location, editingId, groupIds = []) => {
        const nextGroupIds = Array.from(new Set(groupIds));
        if (editingId) {
            setCameras(prev => prev.map(c => c.id === editingId ? { ...c, name, location, groupIds: nextGroupIds } : c));
            return;
        }
        setCameras(prev => {
            const ids = new Set(prev.map(c => c.id));
            const id = uniqueId(slugify(name) || 'camera', ids);
            return [...prev.filter(c => c.pinned), ...prev.filter(c => !c.pinned), { id, name, location, online: true, groupIds: nextGroupIds }];
        });
    };
    const togglePin = (id) => {
        setCameras(prev => {
            const cam = prev.find(c => c.id === id);
            if (!cam)
                return prev;
            const rest = prev.filter(c => c.id !== id);
            const updated = { ...cam, pinned: !cam.pinned };
            if (updated.pinned)
                return [updated, ...rest];
            return [...rest.filter(c => c.pinned), updated, ...rest.filter(c => !c.pinned)];
        });
    };
    const removeCamera = (id) => {
        setCameras(prev => prev.filter(c => c.id !== id));
    };
    const addGroup = (name) => {
        const trimmed = name.trim();
        if (!trimmed)
            return null;
        let resultId = null;
        setGroups((prev) => {
            const existingName = prev.find((g) => g.name.toLowerCase() === trimmed.toLowerCase());
            if (existingName) {
                resultId = existingName.id;
                return prev;
            }
            const ids = new Set(prev.map((g) => g.id));
            const id = uniqueId(slugify(trimmed) || 'group', ids);
            resultId = id;
            return [...prev, { id, name: trimmed }];
        });
        return resultId;
    };
    const assignCameraGroups = (cameraId, groupIds) => {
        const valid = new Set(groups.map((g) => g.id));
        const nextGroupIds = Array.from(new Set(groupIds.filter((id) => valid.has(id))));
        setCameras((prev) => prev.map((c) => (c.id === cameraId ? { ...c, groupIds: nextGroupIds } : c)));
    };
    const deleteGroup = (groupId) => {
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
        setCameras((prev) => prev.map((c) => c.groupIds?.includes(groupId)
            ? { ...c, groupIds: (c.groupIds ?? []).filter((id) => id !== groupId) }
            : c));
    };
    const totalCameras = cameras.length;
    const onlineCameras = cameras.filter(c => c.online).length;
    const [searchQuery, setSearchQuery] = useState('');
    const [alertStatusOverrides, setAlertStatusOverrides] = useState({});
    const [alertReviewDecisions, setAlertReviewDecisions] = useState({});
    const alertEvents = useMemo(() => buildAlertEvents(cameras, alertStatusOverrides), [cameras, alertStatusOverrides]);
    const filteredCameras = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q)
            return cameras;
        return cameras.filter((camera) => {
            const haystack = [camera.name, camera.location, camera.id].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(q);
        });
    }, [cameras, searchQuery]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [theme, setTheme] = useState(() => {
        const s = localStorage.getItem('theme');
        return (s === 'light' || s === 'dark' || s === 'system') ? s : 'light';
    });
    const [draftTheme, setDraftTheme] = useState(theme);
    const [colorblindMode, setColorblindMode] = useState(() => {
        const saved = localStorage.getItem(COLORBLIND_KEY);
        if (saved === '1')
            return 'deuteranopia';
        return saved === 'deuteranopia' || saved === 'protanopia' || saved === 'tritanopia' ? saved : 'off';
    });
    const [draftColorblindMode, setDraftColorblindMode] = useState(colorblindMode);
    const effectiveTheme = useMemo(() => settingsOpen ? draftTheme : theme, [settingsOpen, draftTheme, theme]);
    const [homeModalAlertId, setHomeModalAlertId] = useState(null);
    const [homeModalExitVariant, setHomeModalExitVariant] = useState('default');
    const isFirstThemeRender = useRef(true);
    useEffect(() => {
        const animate = !isFirstThemeRender.current;
        isFirstThemeRender.current = false;
        applyTheme(effectiveTheme, animate);
        if (effectiveTheme !== 'system')
            return;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const fn = () => applyTheme('system', true);
        media.addEventListener('change', fn);
        return () => media.removeEventListener('change', fn);
    }, [effectiveTheme]);
    useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);
    useEffect(() => {
        localStorage.setItem(COLORBLIND_KEY, colorblindMode);
        if (colorblindMode !== 'off')
            document.documentElement.setAttribute('data-colorblind', colorblindMode);
        else
            document.documentElement.removeAttribute('data-colorblind');
    }, [colorblindMode]);
    const openSettings = () => { setDraftTheme(theme); setDraftColorblindMode(colorblindMode); setSettingsOpen(true); };
    const closeSettings = () => setSettingsOpen(false);
    const saveSettings = () => { setTheme(draftTheme); setColorblindMode(draftColorblindMode); setSettingsOpen(false); };
    const openAddCamera = () => window.dispatchEvent(new Event('ui:add-camera'));
    const reviewAlert = (id, decision) => {
        setAlertStatusOverrides((prev) => ({ ...prev, [id]: 'Reviewed' }));
        setAlertReviewDecisions((prev) => ({ ...prev, [id]: decision }));
    };
    const homeModalAlert = useMemo(() => alertEvents.find((a) => a.id === homeModalAlertId) ?? null, [alertEvents, homeModalAlertId]);
    const closeHomeAlertModal = () => {
        setHomeModalExitVariant('default');
        setHomeModalAlertId(null);
    };
    const viewCameraFromHomeAlert = (alert) => {
        setHomeModalExitVariant('to-camera');
        setHomeModalAlertId(null);
        window.setTimeout(() => {
            navigate(`/camera/${alert.cameraId}`, { state: { cameraTransition: 'zoom-card', fromAlert: true } });
            setHomeModalExitVariant('default');
        }, 200);
    };
    const openClipFromHomeAlert = (alert) => {
        setHomeModalExitVariant('to-camera');
        setHomeModalAlertId(null);
        const params = new URLSearchParams({
            clip: '1',
            alert: alert.id,
            at: relTime(alert.time),
        });
        params.set('threat', alert.level);
        window.setTimeout(() => {
            navigate(`/camera/${alert.cameraId}?${params.toString()}`, {
                state: { cameraTransition: 'zoom-card', fromAlert: true, openClip: true },
            });
            setHomeModalExitVariant('default');
        }, 200);
    };
    const cameraPageProps = {
        cameras: filteredCameras,
        groups,
        onSaveDetails: saveCameraDetails,
        onTogglePin: togglePin,
        onRemove: removeCamera,
        onAddGroup: addGroup,
        onDeleteGroup: deleteGroup,
        onAssignGroups: assignCameraGroups,
        onAddCamera: openAddCamera,
        totalCameras,
        onlineCameras,
    };
    return (<div className={`appContainer routeAnim-${routeAnimDir} routeAnimProfile-${routeAnimProfile}${isRouteAnimating ? ' routeAnimating' : ''}`}>

      <header className="topBar">
        <div className="topBarLeft">
          <div className="topBarLogo">
            <span className="topBarWordmark">Sense</span>
          </div>
          <nav className="topNav" aria-label="Primary">
            {NAV_ITEMS.map((item) => (<NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `topNavLink${isActive ? ' active' : ''}`}>
                {item.label}
              </NavLink>))}
          </nav>
        </div>

        <div className="topActions">
          <label className="topSearch" aria-label="Search cameras">
            <IconSearch />
            <input className="topSearchInput" type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={searchPlaceholder}/>
          </label>
          <button className="topBarButton" onClick={openSettings}>Settings</button>
        </div>
      </header>

      <div className="appBody">
        <div className={`activityPanelSlot${homePanelSlotExpanded ? ' visible' : ''}`}>
          <div className={`activityPanelSlotInner${homePanelVisible ? ' visible' : ''}`} aria-hidden={!homePanelVisible}>
            <ActivityPanel events={alertEvents} onEventClick={(event) => setHomeModalAlertId(event.id)}/>
          </div>
        </div>
        <div className={`contentArea${isHomeRoute ? ' homeContentArea' : ''}`}>
          <div className="routeSurface">
            <Routes>
              <Route path="/" element={<MainPage {...cameraPageProps}/>}/>
              <Route path="/alerts" element={<AlertsPage cameras={cameras} alerts={alertEvents} reviewDecisions={alertReviewDecisions} searchQuery={searchQuery} onReviewAlert={reviewAlert}/>}/>
              <Route path="/cameras" element={<CamerasPage {...cameraPageProps}/>}/>
              <Route path="/help" element={<Navigate to="/" replace/>}/>
              <Route path="/camera/:cameraId" element={<CameraPage cameras={filteredCameras}/>}/>
            </Routes>
          </div>
        </div>

      </div>

      <SettingsModal open={settingsOpen} onClose={closeSettings} onSave={saveSettings}>
        <div className="appSettingsStack">
          <div className="settingsSection">
            <span className="settingsSectionTitle">Appearance</span>
            <ThemeSegmented value={draftTheme} onChange={setDraftTheme}/>
          </div>
          <div className="settingsRow">
            <div className="settingsTextBlock">
              <span className="settingsSectionTitle">Colorblind mode</span>
              <span className="settingsDescription">Adjusts threat/status colors for different color-vision needs.</span>
            </div>
            <select className="settingsSelect" value={draftColorblindMode} onChange={(e) => setDraftColorblindMode(e.target.value)} aria-label="Colorblind preset">
              <option value="off">Off</option>
              <option value="deuteranopia">Deuteranopia</option>
              <option value="protanopia">Protanopia</option>
              <option value="tritanopia">Tritanopia</option>
            </select>
          </div>
        </div>
      </SettingsModal>

      <AlertDetailsModal alert={homeModalAlert} onClose={closeHomeAlertModal} onViewCamera={viewCameraFromHomeAlert} onOpenClip={openClipFromHomeAlert} onReviewAlert={reviewAlert} reviewDecision={homeModalAlert ? alertReviewDecisions[homeModalAlert.id] : undefined} exitVariant={homeModalExitVariant}/>

    </div>);
}
