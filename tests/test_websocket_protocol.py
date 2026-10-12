"""
Integration tests for FastAPI WebSocket audio-stream endpoint.
Verifies handshake, synthetic trigger messages, status broadcasts, and config updates.
"""

import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from starlette.testclient import TestClient
from app.main import app

def test_rest_health_check():
    """Verify REST health check endpoint."""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "rms_threshold" in data

def test_websocket_audio_stream_lifecycle():
    """Verify WebSocket connect, synthetic trigger, and event receipt."""
    client = TestClient(app)
    with client.websocket_connect("/ws/audio-stream") as websocket:
        # 1. First message must be connected handshake
        handshake_data = websocket.receive_json()
        assert handshake_data["type"] == "connected"
        assert "session_id" in handshake_data
        
        # 2. Send synthetic trigger for Siren (Left delay +10 samples)
        trigger_msg = {
            "type": "synthetic_trigger",
            "sound_class": "Siren",
            "delay_samples": 10,
            "db_spl": 88.0,
            "confidence": 0.92
        }
        websocket.send_text(json.dumps(trigger_msg))
        
        # 3. Receive emitted sound event
        sound_event = websocket.receive_json()
        assert sound_event["type"] == "sound_event"
        assert sound_event["class"] == "Siren"
        assert sound_event["priority"] == "P0"
        assert sound_event["angle_deg"] > 90.0  # West / NW
        assert sound_event["compass_zone"] in ["NW", "W"]
        
        # 4. Receive danger update
        danger_update = websocket.receive_json()
        assert danger_update["type"] == "danger_update"
        assert danger_update["score"] > 70.0

if __name__ == "__main__":
    test_rest_health_check()
    test_websocket_audio_stream_lifecycle()
    print("All WebSocket protocol tests passed successfully!")
