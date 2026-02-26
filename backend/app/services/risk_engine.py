from app.schemas.detection import ObjectDetection
from app.schemas.frame_meta import FrameMeta
from datetime import timedelta, datetime

# first run the frames data base

# makes a storage of detections per camera
buffers: dict[str, list[FrameMeta]] = {}

current_time = datetime.now()

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
    while len(buffers[c_id]) > 0 and buffers[c_id][0].timestamp < baseline: # 
        buffers[c_id].pop(0)
# return the new list
    return buffers[c_id]
        

def extract_recent_evidence(buffers,camera_id): # get detections from current window for one camera
    camera_window = buffers[camera_id] #create camera window
    class_data: dict[str, list[ObjectDetection]] = {} # create class_data dict that will group it by class
    for frame_meta in camera_window: # check frame_meta in camera_window
        for det in frame_meta.detections: # for each detection cehck wether class is in it 
            if det.class_name not in class_data: # if it's not add it
                class_data[det.class_name] = []
            class_data[det.class_name].append(det) # append at the end

    return class_data # return the classes and each class will have a list of frames 



def check_persistence(): # check if the same object appears over mutiple frames close in time

def check_confidence(): # check confidence levels they have to be above 0.67%


def find_matching_active_incident(): # looking for matching incidents (camera_id + object_class + frames_time)

def apply_cooldown(): # apply cooldown stop duplicate alerts

def compute_risk_level(): # map class/condifdence to low or high




def incident_condtions(frame, timestamp, buffers, current_time, frame_det):
    cur_frame = frame
    cur_detec = frame_det
    window = maintain_frame_data(cur_detec,cur_frame)
    
    for i in range(len(window)):
        if window[cur_detec.camera_id][i] && window[cur_detec.camera_id][i++]

