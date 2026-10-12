"""
SoundSense Unified Development Server Runner.
Launches the FastAPI backend and serves the mobile web app on http://localhost:8000.
"""

import sys
import os
import uvicorn

# Ensure backend directory is in python search path
base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
backend_dir = os.path.join(base_dir, "backend")
sys.path.insert(0, backend_dir)

if __name__ == "__main__":
    print("=" * 60)
    print("  SoundSense Standalone Assistive Mobile System")
    print("  FastAPI Backend + Minimalist Light-Theme Mobile UI")
    print("=" * 60)
    print("  Web App URL: http://localhost:8000")
    print("  WebSocket:   ws://localhost:8000/ws/audio-stream")
    print("  Health:      http://localhost:8000/health")
    print("=" * 60)
    
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True, app_dir=backend_dir)
