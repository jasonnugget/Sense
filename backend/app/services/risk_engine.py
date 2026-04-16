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
    """Risk level scales with confidence, with a safety floor for firearms.

    Non-firearm weapons (knife, bat, axe, etc.):
      >= 0.85  → high
      >= 0.70  → medium
      else     → low

    Firearms (gun, pistol, rifle, shotgun, firearm, revolver):
      same ladder, but clamped to a minimum of `medium`. A low-confidence
      firearm detection is still treated seriously — never `low`.
    """
    lowered = (class_name or "").lower()
    is_firearm = any(
        k in lowered for k in ("gun", "pistol", "rifle", "shotgun", "firearm", "revolver")
    )

    if confidence >= 0.85:
        return RiskLevel.high
    if confidence >= 0.70:
        return RiskLevel.medium
    return RiskLevel.medium if is_firearm else RiskLevel.low


def process_detection(detection: ObjectDetection):
    if not is_dangerous_class(detection.class_name):
        return None
    if detection.confidence < CONFIDENCE_THRESHOLD:
        return None

    key = (detection.camera_id, detection.class_name.lower())
    if key not in candidates:
        candidates[key] = {
            "detections": [],
            "last_incident_time": None,
        }
    candidate = candidates[key]

    existing_ids = {d.frame_id for d in candidate["detections"]}
    if detection.frame_id not in existing_ids:
        candidate["detections"].append(detection)

    now = datetime.now(timezone.utc)
    cutoff = now - TIME_WINDOW
    candidate["detections"] = [
        d for d in candidate["detections"] if d.timestamp >= cutoff
    ]

    # Cooldown guard: if we fired recently for this (camera, class), don't
    # fire again until COOLDOWN has elapsed. This lets the same weapon
    # re-trigger after the cooldown window instead of the old behavior
    # where a once-promoted candidate never fired again.
    if candidate["last_incident_time"] is not None:
        if now - candidate["last_incident_time"] < COOLDOWN:
            return None

    if len(candidate["detections"]) >= MIN_FRAMES:
        # Use the peak-confidence detection in the window to set the
        # incident's risk level. Using the "last" detection (the one that
        # tripped MIN_FRAMES) was wrong: a burst like (0.65, 0.90, 0.70)
        # would have fired MEDIUM even though the model clearly saw the
        # weapon at 0.90 (HIGH) within the same window.
        peak = max(candidate["detections"], key=lambda d: d.confidence)
        candidate["last_incident_time"] = now
        # Clear the accumulated frames so the next incident requires a
        # fresh burst of MIN_FRAMES inside TIME_WINDOW rather than re-using
        # stale hits from before the cooldown.
        candidate["detections"] = []
        return Create_Incident(
            risk_level=compute_risk_level(peak.class_name, peak.confidence),
            objects=[peak],
            summary=f"{peak.class_name} detected on camera {peak.camera_id}",
        )

    return None


def resolve_incident(camera_id: str, class_name: str):
    key = (camera_id, class_name.lower())
    if key in candidates:
        candidates[key]["last_incident_time"] = datetime.now(timezone.utc)
