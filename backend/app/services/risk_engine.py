from app.schemas.detection import ObjectDetection
from app.schemas.incident import Incident_Status
from app.schemas.frame_meta import FrameMeta
from app.services.incident_manager import incident_storage
from datetime import timedelta, datetime

# first run the frames data base

# makes a storage of detections per camera
buffers: dict[str, list[FrameMeta]] = {}
cooldown_store: dict[tuple[str,str], datetime] = {}

current_time = datetime.now()
active_window = timedelta(seconds=60)
cooldown_window = timedelta(seconds=10)

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


def check_persistence(class_data): # check if the same object appears over mutiple frames close in time
    min_frames = 4 # threshold we can change 
    passing_classes = [] # list of passing classes
    for class_na in class_data: # checking each class nam in the class data dict we pass
        unique_frames = [] # create a list to check if we have unique ids
        for detection in class_data[class_na]: # checking each detection schema for their class name
            if detection.frame_id not in unique_frames: # if the frame id isn't there we add it 
                unique_frames.append(detection.frame_id) # if it is dont add it (no duplicates)
        if len(unique_frames) >= min_frames: # if it's greater than or equal to our threshold we add to list
            passing_classes.append(class_na)
    return passing_classes # return list of passing classes 
            
        


def check_confidence(passing_classes, class_data): # check confidence levels they have to be above 0.67%
    confidence_threshold = 0.67 # confidence threshold (can change)
    passed_confidence = [] # list that will hold passed objects 

    for class_name in passing_classes: # for each class name in the list of passing classes
        for detection in class_data[class_name]: # for each detection in a list of detections from that class
            if detection.confidence >= confidence_threshold: # if a detection is greater then the threshold
                passed_confidence.append(class_name) # add the class to the list 
                break # break so we don't add duplicates
            
    return passed_confidence # return the passed classes


def find_matching_active_incident(camera_id, class_name, incident_storage, current_time, active_window): # looking for matching incidents (camera_id + object_class + frames_time)
    

    active_statuses = {Incident_Status.open, Incident_Status.acknowledged} # check if incidents active or seen
    for incident in incident_storage.values(): # for each incident in the incident storage
        if incident.status not in active_statuses: # if incident.statues doesnt exist check next incident
            continue
        if not incident.objects: # if object list doesnt exist check next incident
            continue 
        for obj in incident.objects: # for eahc object check if cur camera == camera _ id and cur class = class
            cur_camera = obj.camera_id
            cur_class_name = obj.class_name
            if cur_camera == camera_id and cur_class_name == class_name:
                if current_time - incident.last_seen <= active_window:
                    return incident.id # return incident.id 
    return None # if none matching return   

def apply_cooldown(camera_id,class_name): # apply cooldown stop duplicate alerts

    if (camera_id,class_name) not in cooldown_store:
        cooldown_store[(camera_id,class_name)] = current_time
        return True

    else:
        last_time_seen = cooldown_store[(camera_id,class_name)]
        if current_time - last_time_seen <= cooldown_window:
            return False
        else:
            cooldown_store[(camera_id,class_name)] = current_time
            return True

def compute_risk_level(): # map class/condifdence to low or high




def incident_condtions(frame, timestamp, buffers, current_time, frame_det):
    cur_frame = frame
    cur_detec = frame_det
    window = maintain_frame_data(cur_detec,cur_frame)
    
    for i in range(len(window)):
        if window[cur_detec.camera_id][i] && window[cur_detec.camera_id][i++]

