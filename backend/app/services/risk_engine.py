"""
Risk engine — turns raw per-frame detections into incidents.

A detection becomes an incident when all three hold:
  1. The detected class matches a known dangerous-object keyword
     (case-insensitive substring match — see is_dangerous_class below).
  2. Confidence >= CONFIDENCE_THRESHOLD.
  3. Same (camera, class) fires in >= MIN_FRAMES frames inside TIME_WINDOW.

After firing we enforce a COOLDOWN to avoid spamming the feed with the
same sustained detection. Called from the per-camera capture thread.
"""

from app.schemas.detection import ObjectDetection
from app.schemas.incident import Create_Incident, RiskLevel
from datetime import datetime, timedelta, timezone

# ── Weapon / dangerous-object keywords ──────────────────────────────────────
# Matching is case-insensitive substring: any detected class name that
# CONTAINS one of these tokens is treated as a weapon. That way class names
# like "Handgun", "HAND_GUN", "assault_rifle", "kitchen knife" all resolve
# to "dangerous" without having to list every variant.
DANGEROUS_KEYWORDS: set[str] = {
    # firearms
    "gun", "pistol", "handgun", "rifle", "shotgun", "firearm", "revolver",
    # bladed weapons
    "knife", "blade", "dagger", "sword", "machete",
    # impact / improvised weapons
    "axe", "hatchet", "crowbar", "bat",
    # generic buckets some custom models use
    "weapon",
}

CONFIDENCE_THRESHOLD = 0.60
TIME_WINDOW = timedelta(seconds=2)
MIN_FRAMES = 3
COOLDOWN = timedelta(seconds=30)

# Back-compat aliases — older code imported these lowercase names.
dangerous_objects = DANGEROUS_KEYWORDS
confidence_threshold = CONFIDENCE_THRESHOLD
time_window = TIME_WINDOW
min_frames = MIN_FRAMES
cooldown = COOLDOWN


candidates: dict = {}


def is_dangerous_class(class_name: str) -> bool:
    """True if the class name contains any dangerous-object keyword.

    Case-insensitive and tolerant of separators ("hand_gun", "Hand Gun",
    "handgun" all match). Keeps the keyword list small while still catching
    real-world YOLO class naming variety.
    """
    if not class_name:
        return False
    normalized = class_name.lower().replace("_", " ").replace("-", " ")
    return any(k in normalized for k in DANGEROUS_KEYWORDS)


def compute_risk_level(class_name: str, confidence: float) -> RiskLevel:
    """Guns always escalate to high; other weapons scale with confidence."""
    lowered = (class_name or "").lower()
    if any(k in lowered for k in ("gun", "pistol", "rifle", "shotgun", "firearm", "revolver")):
        return RiskLevel.high
    if confidence >= 0.85:
        return RiskLevel.high
    if confidence >= 0.70:
        return RiskLevel.medium
    return RiskLevel.low


def process_detection(detection: ObjectDetection):
    if not is_dangerous_class(detection.class_name):
        return None
    if detection.confidence < CONFIDENCE_THRESHOLD:
        return None

    key = (detection.camera_id, detection.class_name.lower())
    if key not in candidates:
        candidates[key] = {
            "frame_ids": [],
            "promoted": False,
            "last_incident_time": None,
        }
    candidate = candidates[key]

    existing_ids = [fid for fid, _ in candidate["frame_ids"]]
    if detection.frame_id not in existing_ids:
        candidate["frame_ids"].append((detection.frame_id, detection.timestamp))

    now = datetime.now(timezone.utc)
    cutoff = now - TIME_WINDOW
    candidate["frame_ids"] = [
        (fid, ts) for fid, ts in candidate["frame_ids"] if ts >= cutoff
    ]

    if len(candidate["frame_ids"]) >= MIN_FRAMES and not candidate["promoted"]:
        if candidate["last_incident_time"] is None or (now - candidate["last_incident_time"]) >= COOLDOWN:
            candidate["promoted"] = True
            candidate["last_incident_time"] = now
            return Create_Incident(
                risk_level=compute_risk_level(detection.class_name, detection.confidence),
                objects=[detection],
                summary=f"{detection.class_name} detected on camera {detection.camera_id}",
            )

    return None


def resolve_incident(camera_id: str, class_name: str):
    key = (camera_id, class_name.lower())
    if key in candidates:
        candidates[key]["promoted"] = False
        candidates[key]["last_incident_time"] = datetime.now(timezone.utc)
