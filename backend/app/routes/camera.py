from fastapi import FastAPI, UploadFile, HTTPException , APIRouter
from datetime import datetime, timezone
from app.schemas.frame_meta import FrameMeta

frame_store: dict[int, FrameMeta] = {}


router = APIRouter()
# Receive the frames from front end
@router.post("/receive-frames", response_model = FrameMeta)
# the two parameters will be we need an uploaded file and we need a frame_id for data purposes
# the frontend should randomize it so they dont have to manuely input it every time but for now it works
async def receive_frames(frame_file : UploadFile,frame_id : int):
    if frame_file.content_type not in ("image/jpeg", "image/png"): # checks if file type is images
        raise HTTPException(status_code = 415, detail = "Jpeg and PNG only file type supported") # if not gives error code
    imgbytes = await frame_file.read() # waits to read the image 
    meta_data = FrameMeta(
    frame_id=frame_id,
    content_type=frame_file.content_type,
    num_bytes=len(imgbytes),
    timestamp=datetime.now(timezone.utc)
)
    frame_store[frame_id] = meta_data
    return meta_data

@router.get("/frames/{frame_id}", response_model = FrameMeta)
def search_frames(frame_id : int):
    if frame_id not in frame_store:
        raise HTTPException(status_code = 404, detail = "Frame Not Found")
    return frame_store[frame_id]