from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.routes import health, camera, incidents, stream
from app.db.database import create_tables
from app.services.detector import load_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once at startup: create DB tables and load the YOLO model."""
    create_tables()
    load_model("models/yolov8n.pt")
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
