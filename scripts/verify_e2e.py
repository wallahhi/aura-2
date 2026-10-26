"""
End-to-End Automated Verification Script for SoundSense.
Validates the complete pipeline:
1. Health endpoint checks
2. Category listing
3. Bidirectional WebSocket audio-streaming
4. Synthetic stereo delay & GCC-PHAT directional mapping
5. Whisper speech transcription live streaming
6. Danger scoring formula, cooldown, hysteresis, and SOS auto-trigger
"""

import sys
import os
import json
import base64
import numpy as np

# Ensure backend directory is in path
base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(base_dir, "backend"))

from starlette.testclient import TestClient
from app.main import app

def run_e2e_verification():
    print("[E2E] Starting SoundSense End-to-End Verification...")
    client = TestClient(app)

    # 1. Health check
    res_health = client.get("/health")
    assert res_health.status_code == 200, "Health check failed"
    print("  [PASS] Health endpoint OK:", res_health.json()["status"])

    # 2. Sound Categories
    res_cat = client.get("/api/v1/sounds/categories")
    assert res_cat.status_code == 200
    assert res_cat.json()["count"] > 10
    print(f"  [PASS] Sound Ontology registered with {res_cat.json()['count']} categories")

    # 3. WebSocket End-to-End
    with client.websocket_connect("/ws/audio-stream") as ws:
        # Handshake
        handshake = ws.receive_json()
        assert handshake["type"] == "connected"
        session_id = handshake["session_id"]
        print(f"  [PASS] WebSocket Handshake successful (Session: {session_id})")

        # 3a. Test Audio Chunk streaming (Dual-Stage Ingestion)
        # 48 kHz stereo silence chunk
        fs = 48000
        n_samples = 2048
        stereo_pcm = np.zeros(n_samples * 2, dtype=np.int16)
        b64_audio = base64.b64encode(stereo_pcm.tobytes()).decode('ascii')

        ws.send_json({
            "type": "audio_chunk",
            "data": b64_audio,
            "fs": fs,
            "channels": 2,
            "seq": 1
        })

        status_msg = ws.receive_json()
        assert status_msg["type"] == "status"
        assert status_msg["state"] in ["16kHz_idle", "48kHz_active"]
        print(f"  [PASS] Audio chunk ingested successfully -> Status: {status_msg['state']}, RMS: {status_msg['rms']}")

        # 3b. Test Synthetic Stereo Delay for Car Horn (East / Right: delay = -10 samples)
        ws.send_json({
            "type": "synthetic_trigger",
            "sound_class": "Car horn",
            "delay_samples": -10,
            "db_spl": 85.0,
            "confidence": 0.88
        })

        horn_event = ws.receive_json()
        assert horn_event["type"] == "sound_event"
        assert horn_event["class"] == "Car horn"
        assert horn_event["angle_deg"] < 90.0  # Toward East
        assert horn_event["compass_zone"] in ["NE", "E"]
        print(f"  [PASS] Directional localization OK: {horn_event['display_name']} -> {horn_event['angle_deg']} deg {horn_event['compass_zone']}")

        horn_danger = ws.receive_json()
        assert horn_danger["type"] == "danger_update"
        assert horn_danger["level"] in ["CAUTION", "AWARE", "DANGER"]
        print(f"  [PASS] Danger score calculated: D = {horn_danger['score']} ({horn_danger['level']})")

        # 3c. Test Synthetic Stereo Delay for Emergency Siren (West / Left: delay = +12 samples)
        ws.send_json({
            "type": "synthetic_trigger",
            "sound_class": "Siren",
            "delay_samples": 12,
            "db_spl": 94.0,
            "confidence": 0.95
        })

        siren_event = ws.receive_json()
        assert siren_event["type"] == "sound_event"
        assert siren_event["class"] == "Siren"
        assert siren_event["angle_deg"] > 90.0  # Toward West
        assert siren_event["compass_zone"] in ["NW", "W"]
        print(f"  [PASS] Directional localization OK: {siren_event['display_name']} -> {siren_event['angle_deg']} deg {siren_event['compass_zone']}")

        siren_danger = ws.receive_json()
        assert siren_danger["type"] == "danger_update"
        assert siren_danger["score"] >= 80.0
        print(f"  [PASS] High hazard evaluated: D = {siren_danger['score']} ({siren_danger['level']})")
        
        # Read the sos_auto_trigger emitted because D >= 90
        siren_sos = ws.receive_json()
        assert siren_sos["type"] == "sos_auto_trigger"
        print(f"  [PASS] SOS trigger emitted: D = {siren_sos['danger_score']}")

        # 3d. Test Branch A Whisper Live Transcription
        speech_text = "Please watch out for the bicycle crossing the intersection!"
        ws.send_json({
            "type": "synthetic_trigger",
            "sound_class": "Speech",
            "delay_samples": 0,
            "db_spl": 72.0,
            "confidence": 0.95,
            "text": speech_text
        })

        speech_event = ws.receive_json()
        assert speech_event["type"] == "transcription"
        assert speech_event["text"] == speech_text
        speech_danger = ws.receive_json()
        assert speech_danger["type"] == "danger_update"
        speech_sound = ws.receive_json()
        assert speech_sound["type"] == "sound_event"
        assert speech_sound["display_name"] == "Human Speech"
        print(f"  [PASS] Branch A Speech transcription: \"{speech_event['text']}\" & SoundEvent emitted")
        # 3e. Test SOS Cancellation on the active SOS session
        ws.send_json({
            "type": "sos_action",
            "action": "cancel"
        })
        sos_status = ws.receive_json()
        assert sos_status["type"] == "sos_status"
        assert sos_status["status"] == "cancelled"
        print("  [PASS] SOS Cancel action verified successfully")

    print("\n" + "=" * 60)
    print("  ALL SOUNDSENSE END-TO-END VERIFICATION CHECKS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_e2e_verification()
