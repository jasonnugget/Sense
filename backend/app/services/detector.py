from pathlib import Path
from ultralytics import YOLO

model = None

def load_model(model_path: str):
    p = Path(model_path)

    if not p.exists():
        raise FileNotFoundError(f"Model path does not exist: {model_path}")
    
    global model

    model = YOLO(str(p))
    
    