from app.schemas.detection import ObjectDetection
from app.schemas.frame_meta import FrameMeta
from datetime import timedelta

# first run the frames data base

# makes a storage of detections per camera
buffers: dict[str, list[FrameMeta]] = {}

async def maintain_frame_data (frame_det : ObjectDetection, frame : FrameMeta):
    c_id = frame_det.camera_id #get he camera_id
    threshold = timedelta(seconds=3) # bernard said i have to do this idk why tbh
    if c_id in buffers: # if a list already exists just append newst frame
        buffers[c_id].append(frame)
    else:  # else create list and add frame
        buffers[c_id] = []
        buffers[c_id].append(frame)

# basline equation to delete frames olderthen the newest one 
# to not back up storage
    cur = frame.timestamp
    baseline = cur - threshold
    # if we hold more then 30 frames delete untill we below limit
    while len(buffers[c_id]) > 30:
        buffers[c_id].pop(0)
    # while list isn't empty and the oldest frames timestamp is less then baseline pop the old frames
    while len(buffers[c_id]) > 0 & buffers[c_id][0].timestamp < baseline: # 
        buffers[c_id].pop(0)
# return the new list
    return buffers[c_id]
        



