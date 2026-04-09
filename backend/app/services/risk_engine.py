from app.schemas.detection import ObjectDetection
from app.schemas.incident import Create_Incident, RiskLevel
from datetime import datetime, timedelta, timezone

dangerous_objects = {"knife", "gun"}
confidence_threshold = .60
time_window = timedelta(seconds=2)
min_frames = 3
cooldown = timedelta(seconds=30)

candidates = {}

def compute_risk_level(class_name: str, confidence: float) -> RiskLevel:
    if class_name == "gun":
        return RiskLevel.high
    if confidence >= 0.85:
        return RiskLevel.high
    if confidence >= 0.70:
        return RiskLevel.medium
    return RiskLevel.low

def process_detection(detection: ObjectDetection):
    if detection.class_name not in dangerous_objects:
        return None
    if detection.confidence < confidence_threshold:
        return None
    key = (detection.camera_id, detection.class_name)
    if key not in candidates:
        candidates[key] = {
            "frame_ids": [],
            "promoted": False,
            "last_incident_time": None
        }
    candidate = candidates[key]

    existing_ids = [fid for fid, _ in candidate["frame_ids"]]
    if detection.frame_id not in existing_ids:
        candidate["frame_ids"].append((detection.frame_id, detection.timestamp))

    now = datetime.now(timezone.utc)
    cutoff = now - time_window
    candidate["frame_ids"] = [
        (fid, ts) for fid, ts in candidate["frame_ids"] if ts >= cutoff
    ]

    if len(candidate["frame_ids"]) >= min_frames and not candidate["promoted"]:
        if candidate["last_incident_time"] is None or (now - candidate["last_incident_time"]) >= cooldown:
            candidate["promoted"] = True
            candidate["last_incident_time"] = now
            return Create_Incident(
                risk_level = compute_risk_level(detection.class_name, detection.confidence),
                objects=[detection],
                summary=f"{detection.class_name} detected on camera {detection.camera_id}"
            )
    
    return None

def resolve_incident(camera_id: str, class_name: str):
    key = (camera_id, class_name)
    if key in candidates:
        candidates[key]["promoted"] = False
        candidates[key]["last_incident_time"] = datetime.now(timezone.utc)