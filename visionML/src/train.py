import os
from pathlib import Path
from string import Template
from typing import Optional

import typer
import yaml
from rich import print
from ultralytics import YOLO

from utils.env import load_env

app = typer.Typer(help="Production-ready YOLO training entrypoint.")


def _substitute_env(text: str, env: dict) -> str:
    """Replace ${VAR} placeholders using env mapping."""
    return Template(text).safe_substitute(env)


def load_yaml_with_env(path: Path, env: dict) -> dict:
    substituted = _substitute_env(path.read_text(), env)
    print(f"[blue]Loaded config:[/blue]\n{substituted}")
    return yaml.safe_load(substituted)



def materialize_dataset_yaml(src: Path, env: dict) -> Path:
    """Write a resolved dataset yaml so Ultralytics sees absolute paths."""
    resolved_text = _substitute_env(src.read_text(), env)
    out_path = src.with_stem(src.stem + ".resolved")
    out_path.write_text(resolved_text)
    return out_path


def merge_overrides(base: dict, **overrides) -> dict:
    merged = base.copy()
    for key, value in overrides.items():
        if value is not None:
            merged[key] = value
    return merged


@app.command()
def main(
    config_path: Path = typer.Option(
        Path("configs/training.yaml"),
        help="Training config with defaults and env placeholders.",
    ),
    dataset_path: Path = typer.Option(
        Path("configs/dataset.yaml"), help="Dataset spec with env placeholders."
    ),
    model: Optional[str] = typer.Option(None, help="Model name or weights path."),
    epochs: Optional[int] = typer.Option(None, help="Number of epochs."),
    batch: Optional[int] = typer.Option(None, help="Batch size."),
    imgsz: Optional[int] = typer.Option(None, help="Image size."),
    device: Optional[str] = typer.Option(None, help="Device string (cpu/mps/0/0,1)."),
    workers: Optional[int] = typer.Option(None, help="Data loader workers."),
    mode: str = typer.Option("train", help="train or val."),
    weights: Optional[str] = typer.Option(
        None, help="Existing weights for validation/resume."
    ),
    resume: bool = typer.Option(False, help="Resume from last checkpoint."),
):
    env = load_env()

    # Expose env to downstream libs (e.g., WANDB).
    os.environ.update(env)

    cfg = load_yaml_with_env(config_path, env)
    resolved_dataset = materialize_dataset_yaml(dataset_path, env)
    cfg["data"] = str(resolved_dataset)

    overrides = merge_overrides(
        cfg,
        model=model,
        epochs=epochs,
        batch=batch,
        imgsz=imgsz,
        device=device,
        workers=workers,
    )

    print(f"[bold green]Launching YOLO[/bold green] mode={mode} project={overrides.get('project')}")

    if mode == "train":
        model_name = overrides.pop("model")
        model = YOLO(model_name)
        model.train(resume=resume, **overrides)
    elif mode == "val":
        ckpt = weights or overrides.get("weights") or overrides.get("model")
        if not ckpt:
            raise ValueError("Validation requires --weights or model checkpoint.")
        model = YOLO(ckpt)
        model.val(data=overrides["data"], device=overrides.get("device"))
    else:
        raise ValueError("mode must be 'train' or 'val'")


if __name__ == "__main__":
    app()
