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

import socket

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

if __name__ == "__main__":
    local_ip = get_local_ip()
    print("=" * 60)
    print("  SoundSense Standalone Assistive Mobile System")
    print("  FastAPI Backend + Minimalist Light-Theme Mobile UI")
    print("=" * 60)
    print("  Local PC URL:   http://localhost:8000")
    print(f"  Phone (Wi-Fi):  http://{local_ip}:8000")
    print(f"  WebSocket:      ws://{local_ip}:8000/ws/audio-stream")
    print("=" * 60)
    print("  TIP FOR MOBILE MICROPHONE:")
    print("  Mobile browsers require HTTPS or localhost for microphone access.")
    print("  - For iPhone or easy HTTPS: run 'npx localtunnel --port 8000'")
    print(f"  - For Android Wi-Fi: visit chrome://flags/#unsafely-treat-insecure-origin-as-secure")
    print(f"    and add http://{local_ip}:8000")
    print("=" * 60)
    
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True, app_dir=backend_dir)
