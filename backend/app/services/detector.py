from pathlib import Path
from ultralytics import YOLO

from app.schemas.detection import ObjectDetection, BBox
from app.schemas.frame_meta import FrameMeta

model = None

def load_model(model_path: str) -> dict:
    p = Path(model_path)

    if not p.exists():
        raise FileNotFoundError(f"Model path does not exist: {model_path}")
    if not p.is_file():
        raise ValueError(f"Model path is not a file: {model_path}")
    
    global model
    model = YOLO(str(p))

    return {"loaded": True, "model_path": str(p)}

def run_inference(frame, frame_meta: FrameMeta) -> list[ObjectDetection]:
    if model is None:
        raise RuntimeError("Model not loaded. Call load_model() first.")

    results=model(frame, verbose=False)
    if not results:
        return []

    r = results[0]
    names = r.names if hasattr(r, "names") else{}

    detections: list[ObjectDetection] = []

    for b in r.boxes:
        cls_id = int(b.cls[0])
        conf = float(b.conf[0])
        x1, y1, x2, y2 = b.xyxy[0].tolist()

        x = int(x1)
        y = int(y1)
        w = max(0, int(x2-x1))
        h = max(0, int(y2 - y1))

        det = ObjectDetection(
            camera_id = str(frame_meta.source),
            class_name = str(names.get(cls_id, cls_id)),
            confidence = conf,
            bbox = BBox(x=x, y=y, w=w, h=h),
            frame_id = frame_meta.frame_id,
            timestamp = frame_meta.timestamp
        )
        detections.append(det)

    return detections
