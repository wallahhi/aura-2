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
    print("  AURA Assistive Sound Awareness & Spatial Radar Platform")
    print("=" * 60)
    print("  🟢 OPEN THIS URL IN YOUR BROWSER:")
    print("     👉 http://localhost:8000")
    print("=" * 60)
    print("  ⚠  NOTE: Do NOT click 'http://0.0.0.0:8000'.")
    print("     Browsers block microphone access on 0.0.0.0.")
    print("     FastAPI will automatically redirect 0.0.0.0 to localhost.")
    print("=" * 60)
    print(f"  Phone (Wi-Fi):  http://{local_ip}:8000")
    print(f"  WebSocket:      ws://localhost:8000/ws/audio-stream")
    print("=" * 60)
    print("  FOR MOBILE MICROPHONE ON PHONE:")
    print("  - Instant HTTPS tunnel: run 'npx localtunnel --port 8000'")
    print(f"  - On Android Chrome: enable chrome://flags/#unsafely-treat-insecure-origin-as-secure")
    print(f"    and add http://{local_ip}:8000")
    print("=" * 60)
    
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True, app_dir=backend_dir)
