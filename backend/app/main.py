from fastapi import FastAPI
# importing, all route .py files
from app.routes import health, camera, incidents, stream

app = FastAPI()
# giving all the routers direct acess to the main APP
app.include_router(health.router)
app.include_router(camera.router)
app.include_router(incidents.router)
app.include_router(stream.router)

