"""
FastAPI Application Entry Point for SoundSense.
Mounts WebSocket audio stream router, CORS, and REST health endpoints.
"""

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
import os

from app.config import settings
from app.api.websocket.audio_stream import router as ws_router
from app.core.sound_ontology import ONTOLOGY_MAP

app = FastAPI(
    title=settings.APP_NAME,
    description="Real-time assistive system for deaf and hard-of-hearing individuals.",
    version="1.0.0"
)

# Auto-redirect 0.0.0.0 to localhost so browsers recognize Secure Context for microphone
@app.middleware("http")
async def redirect_zero_ip_middleware(request: Request, call_next):
    host = request.headers.get("host", "")
    if host.startswith("0.0.0.0"):
        new_host = host.replace("0.0.0.0", "localhost", 1)
        url = request.url.replace(netloc=new_host)
        return RedirectResponse(url=str(url), status_code=307)
    return await call_next(request)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount WebSocket router
app.include_router(ws_router)

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "app": settings.APP_NAME,
        "rms_threshold": settings.DEFAULT_RMS_THRESHOLD,
        "mic_spacing_m": settings.MIC_SPACING_M,
        "speed_of_sound_mps": settings.SPEED_OF_SOUND_MPS,
    }

@app.get("/api/v1/sounds/categories")
def list_sound_categories():
    categories = []
    for name, info in ONTOLOGY_MAP.items():
        categories.append({
            "class": info.class_name,
            "display_name": info.display_name,
            "priority": info.priority.value,
            "severity_score": info.s_type,
            "is_speech": info.is_speech,
            "haptic_pattern": info.haptic_pattern
        })
    return {"count": len(categories), "categories": categories}

# Mount Frontend Static Directory
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend"))
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
