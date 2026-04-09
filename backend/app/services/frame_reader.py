import cv2
from app.schemas.frame_meta import FrameMeta
import uuid
from datetime import datetime, timezone
from collections import deque
from app.services.detector import load_model, run_inference
from app.services.risk_engine import process_detection
from app.services.incident_manager import create_a_inc
from app.routes.stream import publish
import threading

# This flag lets us tell the frame reader to stop from another thread
# When /camera/stop is called, we set this to True and the loop exits
stop_flag = threading.Event()


def frame_reader(source):
    # Step 1: Open the camera/video source using OpenCV
    camera = cv2.VideoCapture(source)

    # Step 2: Create a buffer to store recent frame metadata (keeps last 500)
    frame_meta_buffer = deque(maxlen=500)

    # Step 3: Load the YOLO model so we can run object detection on each frame
    load_model("models/SenseV2Training.pt")

    # Step 4: Make sure the camera actually opened, otherwise stop here
    if not camera.isOpened():
        raise RuntimeError("Camera could not be opened")

    try:
        # Step 5: Main loop - keep reading frames as long as the camera is open
        # Also check stop_flag each iteration so /camera/stop can shut us down
        while camera.isOpened() and not stop_flag.is_set():
            ok, frame = camera.read()
            if not ok:
                break

            # Step 6: Show the live camera feed in a window
            cv2.imshow("Camera", frame)

            # Step 7: Extract frame dimensions and build metadata for this frame
            # Each frame gets a unique ID and a UTC timestamp so we can track it
            height, width = frame.shape[:2]
            meta = FrameMeta(
                height=height,
                width=width,
                frame_id=str(uuid.uuid4()),
                timestamp=datetime.now(timezone.utc),
                source=source,
                num_bytes=frame.nbytes,
                content_type="image/bgr"
            )

            # Step 8: Run YOLO inference on the frame
            # Returns a list of ObjectDetection objects (one per detected object)
            detections = run_inference(frame, meta)

            # Step 9: Pass each detection through the risk engine
            # The risk engine checks if:
            #   - The object is dangerous (knife, gun)
            #   - Confidence is above threshold (0.60)
            #   - It has appeared in enough consecutive frames (3+ within 2 seconds)
            #   - The cooldown period has passed (30 seconds between incidents for same object)
            # If all conditions are met, it returns a Create_Incident; otherwise None
            for detection in detections:
                incident_request = process_detection(detection)

                # Step 10: If the risk engine triggered, create the incident and push it
                # to the SSE stream so the frontend dashboard gets a live alert
                if incident_request is not None:
                    new_incident = create_a_inc(incident_request)
                    publish(new_incident)

            # Step 11: Save this frame's metadata to the buffer for reference
            frame_meta_buffer.append(meta.model_dump())

            # Step 12: Allow the user to press 'q' to quit the camera feed
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    finally:
        # Step 13: Clean up - release the camera and close the display window
        # This runs even if an error occurs, so we don't leave the camera locked
        camera.release()
        cv2.destroyAllWindows()


