from fastapi import FastAPI, APIRouter

router = APIRouter()

# Just to check if the website is working
@router.get("/health")
def get_web_health():
    return {"status" : "Up and running :)"}

# Grabs current version, shows where we are at in working and last update
@router.get("/version")
def get_version():
    return {
        "version" : "0.1.0",
        "service" : "sense-backend",
        "phase" : "Phase 1 - Foundations",
        "last_update" : "Working on current api endpoints and foundations, no previous updates"
        }
