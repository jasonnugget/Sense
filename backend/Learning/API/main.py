from fastapi import FastAPI, UploadFile, HTTPException
from typing import Optional

app = FastAPI()

# Just to check if the website is working
@app.get("/health")
def get_web_health():
    return {"status" : "Up and running :)"}

# Receive the frames from front end
@app.post("/receive-frames")
# the two parameters will be we need an uploaded file and we need a frame_id for data purposes
# the frontend should randomize it so they dont have to manuely input it every time but for now it works
async def receive_frames(frame_file : UploadFile,frame_id : int):
    if frame_file.content_type not in ("image/jpeg", "image/png"): # checks if file type is images
        raise HTTPException(status_code = 415, detail = "Jpeg and PNG only file type supported") # if not gives error code
    imgbytes = await frame_file.read() # waits to read the image 
    return{ # for now returns some info about the image
        "frame_id": frame_id,
        "content_type": frame_file.content_type,
        "num_bytes" : len(imgbytes)
    }

