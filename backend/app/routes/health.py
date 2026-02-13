from fastapi import FastAPI, APIRouter

router = APIRouter()

# Just to check if the website is working
@router.get("/health")
def get_web_health():
    return {"status" : "Up and running :)"}