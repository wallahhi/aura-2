"""
OpenAI Whisper Speech-to-Text Service (Branch A).
Dispatches speech audio segments to OpenAI's whisper-1 model
for live scrolling transcription.
"""

import io
import time
import numpy as np
import soundfile as sf
from typing import Optional, Dict, Any
from app.config import settings

class WhisperService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.client = None
        if self.api_key:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=self.api_key)
            except Exception as e:
                print(f"[WhisperService] OpenAI client init error: {e}")

    def update_api_key(self, api_key: str):
        """Update API key dynamically from settings."""
        self.api_key = api_key
        try:
            from openai import OpenAI
            self.client = OpenAI(api_key=self.api_key)
        except Exception as e:
            print(f"[WhisperService] OpenAI client update error: {e}")

    def transcribe(
        self,
        audio_16k_mono: np.ndarray,
        prompt_hint: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribes speech audio segment using OpenAI whisper-1.
        Returns dictionary with text, speaker, confidence, and timestamp.
        """
        now = time.time()
        
        # If OpenAI client is configured and has API key
        if self.client and self.api_key:
            try:
                # Convert float32 [-1, 1] to WAV byte stream in-memory
                wav_buffer = io.BytesIO()
                sf.write(wav_buffer, audio_16k_mono, 16000, format='WAV', subtype='PCM_16')
                wav_buffer.seek(0)
                wav_buffer.name = "speech.wav"
                
                response = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=wav_buffer,
                    language="en",
                    prompt=prompt_hint or "Conversational speech with ambient background sounds."
                )
                
                text = response.text.strip()
                if not text:
                    text = "[Speech detected — low intelligibility]"
                    
                return {
                    "text": text,
                    "speaker": "Speaker 1",
                    "confidence": 0.94,
                    "is_final": True,
                    "timestamp": now
                }
            except Exception as e:
                print(f"[WhisperService] API call failed: {e}")
                return {
                    "text": f"[Whisper API notice: {str(e)[:60]}]",
                    "speaker": "Speaker 1",
                    "confidence": 0.50,
                    "is_final": True,
                    "timestamp": now
                }
        else:
            # Fallback transcription when API key is not yet set
            if prompt_hint:
                text = prompt_hint
            elif len(audio_16k_mono) > 0 and float(np.sqrt(np.mean(audio_16k_mono ** 2))) > 0.08:
                text = "[Loud Voice / Shout Detected]"
            else:
                text = "[Voice detected — set OpenAI Key in Settings for live words]"

            return {
                "text": text,
                "speaker": "Speaker 1",
                "confidence": 0.92,
                "is_final": True,
                "timestamp": now
            }
