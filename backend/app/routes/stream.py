from fastapi import APIRouter
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
import asyncio
import json


router = APIRouter()

# notification queue
queue = []

# function to add events to the queue when they happen ex: incident created gets added to queue
def publish(event):
    queue.append(event)

# this the one that killed me 
# its a while loop runing untill list is empty but async means it wont kill our program
# it can still run while we do other stuff
# then if theres events in the queue we pop them and then convert to json
# then yield which is like pretty send and wait
# then the waiting is just so our cpus dont die while it waits for it to fill up
async def streamer():
    while True:
        if queue:
            event = queue.pop(0)
            event_fix = jsonable_encoder(event)
            yield "data: " + json.dumps(event_fix) + "\n\n"
        else: 
            await asyncio.sleep(0.5)

# this the end point where it sends the notis to the front end
@router.get("/stream/alerts")
def stream_alerts():
    return StreamingResponse(streamer(), media_type="text/event-stream")

