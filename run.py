"""
AURA — Assistive Sound Awareness Application Runner
Starts FastAPI Backend and serves the Google Stitch frontend on http://localhost:8000
"""
import os
import sys

# Ensure backend directory is in Python path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import uvicorn
from app.config import settings

if __name__ == "__main__":
    print("=" * 60)
    print("  AURA — Assistive Sound Awareness Platform")
    print(f"  Running on: http://localhost:{settings.PORT}")
    print(f"  API Docs:   http://localhost:{settings.PORT}/docs")
    print("=" * 60)
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True, app_dir=BACKEND_DIR)
