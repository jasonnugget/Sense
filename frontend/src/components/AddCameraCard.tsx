// Clickable "+" tile that lives inside the camera grid. It mirrors the
// "Add new +" button in the section header so users can add a camera from
// either spot. The parent passes `onClick` which should open AddCameraModal.
export default function AddCameraCard({ onClick }: { onClick?: () => void }) {
    return (<button
      type="button"
      className="cameraCard addCard"
      onClick={onClick}
      aria-label="Add a new camera"
    >
      <div className="addCardInner">
        <span className="addCardPlus" aria-hidden="true">+</span>
        <span className="addCardLabel">Add Camera</span>
        <span className="addCardHint">Webcam · IP · RTSP · File</span>
      </div>
    </button>);
}
