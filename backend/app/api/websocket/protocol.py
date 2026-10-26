"""
WebSocket Protocol Definitions and Pydantic Schemas for SoundSense.
Defines bidirectional JSON messaging structure between mobile frontend and FastAPI backend.
"""

from typing import Dict, Any, Optional, List, Literal
from pydantic import BaseModel, Field

# --- INCOMING MESSAGES (Client -> Server) ---

class AudioChunkMessage(BaseModel):
    type: Literal["audio_chunk"] = "audio_chunk"
    data: str                           # Base64-encoded 16-bit PCM (mono, stereo, or 3-channel interleaved)
    fs: int = 48000                     # 16000 or 48000 Hz
    channels: int = 2                   # 1 (mono), 2 (stereo L/R), or 3 (planar array M1/M2/M3)
    seq: int = 0
    timestamp: Optional[float] = None

class SyntheticTriggerMessage(BaseModel):
    type: Literal["synthetic_trigger"] = "synthetic_trigger"
    sound_class: str = "Car horn"       # Any AudioSet / YAMNet sound class
    delay_samples: int = 0              # Artificial delay in samples
    db_spl: float = 85.0
    confidence: float = 0.88
    text: Optional[str] = None          # If provided, triggers speech branch with transcription
    is_rear: bool = False               # If true, models rear-hemisphere acoustic arrival (South/Behind)
    mic_count: int = 2                  # 1 (Mono Omni), 2 (Dual-mic 14cm), 3 (Tri-mic 30mm planar array)
    target_angle_deg: Optional[float] = None

class ConfigUpdateMessage(BaseModel):
    type: Literal["config_update"] = "config_update"
    rms_threshold: Optional[float] = None
    mic_spacing_m: Optional[float] = None
    context_score: Optional[float] = None

class SosActionMessage(BaseModel):
    type: Literal["sos_action"] = "sos_action"
    action: Literal["trigger", "cancel", "resolve"]

# --- OUTGOING MESSAGES (Server -> Client) ---

class ConnectedMessage(BaseModel):
    type: Literal["connected"] = "connected"
    session_id: str
    server_time: float
    message: str = "Connected to SoundSense Backend"

class StatusMessage(BaseModel):
    type: Literal["status"] = "status"
    state: Literal["16kHz_idle", "48kHz_active"]
    rms: float
    db_spl: float
    timestamp: float
    mic_count: int = 1
    mic_mode: str = "1_mic_mono"
    mic_mode_label: str = "1 Mic (Mono Omni)"

class SoundEventMessage(BaseModel):
    type: Literal["sound_event"] = "sound_event"
    sound_class: str = Field(alias="class")
    display_name: str
    confidence: float
    priority: str                       # "P0", "P1", "P2", "P3"
    angle_deg: float                    # Heading in degrees [0° - 360°]
    compass_zone: str                   # "N", "NE", "E", "SE", "S", "SW", "W", "NW", "OMNI"
    tdoa_tau_s: float
    db_spl: float
    haptic_pattern: str                 # "3_strong", "2_medium", "1_short", "gentle_tap"
    timestamp: float
    mic_count: int = 2
    mic_mode: str = "2_mic_dual"
    mic_mode_label: str = "2 Mics (Dual Stereo)"

    class Config:
        populate_by_name = True

class DangerFactorsDict(BaseModel):
    type_score: float
    intensity_score: float
    approach_score: float
    context_score: float
    db_spl: float
    delta_db_per_sec: float

class DangerUpdateMessage(BaseModel):
    type: Literal["danger_update"] = "danger_update"
    score: float
    raw_score: float
    level: str                          # "SAFE", "AWARE", "CAUTION", "DANGER"
    color: str
    factors: DangerFactorsDict
    noise_dose: float
    timestamp: float

class TranscriptionMessage(BaseModel):
    type: Literal["transcription"] = "transcription"
    text: str
    speaker: str = "Speaker 1"
    confidence: float = 0.95
    is_final: bool = True
    timestamp: float

class SosAutoTriggerMessage(BaseModel):
    type: Literal["sos_auto_trigger"] = "sos_auto_trigger"
    reason: str = "danger_sustained"
    danger_score: float
    countdown_seconds: int = 10
    timestamp: float
