"""
WebSocket Audio Streaming Endpoint (/ws/audio-stream).
Provides bidirectional real-time audio pipeline between mobile client and backend.
"""

import json
import uuid
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.pipeline_orchestrator import PipelineOrchestrator
from app.api.websocket.protocol import ConnectedMessage

router = APIRouter()

@router.websocket("/ws/audio-stream")
async def websocket_audio_stream(websocket: WebSocket):
    await websocket.accept()
    session_id = str(uuid.uuid4())[:8]
    orchestrator = PipelineOrchestrator()
    
    # 1. Send Connected Handshake
    handshake = ConnectedMessage(
        session_id=session_id,
        server_time=time.time()
    )
    await websocket.send_text(json.dumps(handshake.model_dump()))
    print(f"[WebSocket] Client connected: session={session_id}")

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                msg = json.loads(raw_text)
            except Exception as e:
                print(f"[WebSocket] Invalid JSON received: {e}")
                continue

            msg_type = msg.get("type")

            if msg_type == "audio_chunk":
                data_b64 = msg.get("data", "")
                fs = int(msg.get("fs", 48000))
                channels = int(msg.get("channels", 2))
                seq = int(msg.get("seq", 0))

                events = orchestrator.process_audio_chunk(
                    b64_data=data_b64,
                    fs=fs,
                    channels=channels,
                    seq=seq
                )
                for event in events:
                    await websocket.send_text(json.dumps(event))

            elif msg_type == "synthetic_trigger":
                sound_class = msg.get("sound_class", "Car horn")
                delay_samples = int(msg.get("delay_samples", 0))
                db_spl = float(msg.get("db_spl", 85.0))
                confidence = float(msg.get("confidence", 0.88))
                text = msg.get("text")
                is_rear = bool(msg.get("is_rear", False))

                events = orchestrator.process_synthetic_trigger(
                    sound_class=sound_class,
                    delay_samples=delay_samples,
                    db_spl=db_spl,
                    confidence=confidence,
                    text=text,
                    is_rear=is_rear
                )
                for event in events:
                    await websocket.send_text(json.dumps(event))

            elif msg_type == "config_update":
                orchestrator.set_config(
                    rms_threshold=msg.get("rms_threshold"),
                    mic_spacing_m=msg.get("mic_spacing_m"),
                    context_score=msg.get("context_score"),
                    openai_key=msg.get("openai_key")
                )
                await websocket.send_text(json.dumps({
                    "type": "config_ack",
                    "status": "updated",
                    "timestamp": time.time()
                }))

            elif msg_type == "sos_action":
                action = msg.get("action", "cancel")
                if action == "cancel":
                    orchestrator.danger_engine.sos_active = False
                    orchestrator.danger_engine.high_danger_start_time = None
                    await websocket.send_text(json.dumps({
                        "type": "sos_status",
                        "status": "cancelled",
                        "message": "SOS countdown cancelled by user",
                        "timestamp": time.time()
                    }))

    except WebSocketDisconnect:
        print(f"[WebSocket] Client disconnected: session={session_id}")
    except Exception as e:
        print(f"[WebSocket] Session error ({session_id}): {e}")
