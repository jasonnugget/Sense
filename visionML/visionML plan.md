# VisionML YOLO Plan (Beginner-Friendly)

## Quick setup (Day 0)
- Ensure venv is active: `source ../.venv/bin/activate`
- From `visionML/`: install deps (already done) and set `.env`:
  - `DATA_DIR=/absolute/path/to/your/dataset`
  - `RUNS_DIR=./runs`
  - `PROJECT_NAME=visionml`
  - `DEVICE=0` (GPU), or `cpu`/`mps`
- Update `configs/dataset.yaml` class names to match your problem.

## Dataset prep (Day 1)
- Structure: `${DATA_DIR}/images/{train,val}` and `${DATA_DIR}/labels/{train,val}` with matching filenames.
- Label format per line: `class x_center y_center width height` normalized 0–1.
- Spot-check a few labels in each split; fix empty or misaligned boxes.
- Optional: create a small 20–50 image “smoke” subset for fast tests.

## First smoke train (Day 1)
- Command (from `visionML/`):  
  `python -m src.train --epochs 1 --batch 4 --imgsz 640 --model yolov8n.pt --workers 2 --mode train`
- Verify it finishes and writes to `${RUNS_DIR}/visionml/`. Check `results.csv` and sample preds.

## Baseline training (Day 2)
- Bump epochs (e.g., 50–100) and adjust batch to fit GPU.
- If you have GPU headroom, try `--model yolov8s.pt`; otherwise stay with `yolov8n.pt`.
- Keep patience=20 for early stop; monitor loss curves.

## Evaluation & sanity
- Run validation on best weights:  
  `python -m src.train --mode val --weights ${RUNS_DIR}/visionml/weights/best.pt`
- Run quick predictions to visually inspect:  
  `yolo predict model=${RUNS_DIR}/visionml/weights/best.pt source=/path/to/images`
- Check class balance and typical failure cases (missed detections, wrong classes).

## Handoff to backend/frontend
- Decide export format: TorchScript or ONNX; note input size (e.g., 640) and class list.
- Provide API contract: outputs as list of `{class, confidence, bbox[x1,y1,x2,y2]}`.
- Share sample prediction images and label map so frontend can render legends.

## Iteration ideas
- Tune augmentations (mosaic, flips) if over/underfitting.
- Try higher-resolution (`--imgsz 800`) only if latency budget allows.
- Consider class weights or focal loss if you have class imbalance.

## Checklist before long runs
- `.env` points to real data; `dataset.yaml` names updated.
- Venv active; command runs from `visionML/`.
- Enough disk in `RUNS_DIR`; GPU/CPU choice set via `DEVICE`.
