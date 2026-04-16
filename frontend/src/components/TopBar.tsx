export default function TopBar({ onOpenSettings, onAddCamera }) {
    return (<div className="topBar visionGlass">
      <div className="topBarLeft">
        <span className="logo">Sense</span>
      </div>

      <div className="topActions">
        {onAddCamera && (<button className="topBarButton primary" onClick={onAddCamera}>
            + Add Camera
          </button>)}
        <button className="topBarButton" onClick={onOpenSettings}>
          Settings
        </button>
      </div>
    </div>);
}
