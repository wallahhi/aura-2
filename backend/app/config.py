from pydantic_settings import BaseSettings
from pydantic import Field
import os

class Settings(BaseSettings):
    APP_NAME: str = "SoundSense Backend"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    
    # OpenAI Whisper API
    OPENAI_API_KEY: str = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    
    # Audio Ingestion & DSP Parameters
    DEFAULT_RMS_THRESHOLD: float = 0.015  # Frame RMS threshold X for 48kHz escalation (~ -36 dBFS)
    IDLE_TIMEOUT_SECONDS: float = 3.0    # Drop back to 16kHz idle after silence
    SPEED_OF_SOUND_MPS: float = 343.0    # c = 343 m/s in air at ~20°C
    MIC_SPACING_M: float = 0.14          # d = 0.14 m (~14 cm phone top to bottom mic)
    FS_IDLE: int = 16000                 # 16 kHz idle monitoring
    FS_ACTIVE: int = 48000               # 48 kHz stereo active escalation
    
    # Danger Engine Parameters
    COOLDOWN_SECONDS: float = 5.0        # Per-class alert cooldown
    HYSTERESIS_SECONDS: float = 3.0      # Downward hysteresis duration
    HYSTERESIS_DELTA_PTS: float = 5.0    # Downward threshold delta (-5 pts)
    SOS_TRIGGER_THRESHOLD: float = 90.0  # Danger score to trigger SOS countdown
    SOS_SUSTAINED_SECONDS: float = 3.0   # Must sustain D >= 90 for 3 seconds

    # Output Cooldown & Preemption Parameters
    OUTPUT_COOLDOWN_SECONDS: float = 2.0 # Minimum cooldown interval between emitted sound events
    AMPLITUDE_SURGE_RATIO: float = 1.5   # Ratio of amplitude increase (1.5x) to immediately break cooldown
    
    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
