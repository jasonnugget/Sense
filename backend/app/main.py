from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

from app.routes import health, camera, incidents, stream
from app.db.database import create_tables
from app.services.detector import load_model

log = logging.getLogger("uvicorn.error")

# Model filename inside backend/models/. Override with SENSE_MODEL env var.
MODEL_PATH = os.getenv("SENSE_MODEL", "models/SenseV2Training.pt")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once at startup: create DB tables and load the YOLO model.

    Failures here are logged but do not crash the server — the frontend
    still needs to be able to reach endpoints like /health to diagnose.
    """
    try:
        create_tables()
    except Exception as e:
        log.warning("DB init failed (incidents will not persist): %s", e)

    try:
        load_model(MODEL_PATH)
    except Exception as e:
        log.error("YOLO model failed to load from %s: %s", MODEL_PATH, e)

    yield


app = FastAPI(title="Sense Backend", version="0.1.0", lifespan=lifespan)

# CORS: allow the React frontend (Vite dev server) to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_prefix = "/api"
app.include_router(health.router)
app.include_router(camera.router, prefix=api_prefix)
app.include_router(incidents.router, prefix=api_prefix)
app.include_router(stream.router, prefix=api_prefix)
