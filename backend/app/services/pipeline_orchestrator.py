"""
Pipeline Orchestrator for SoundSense.
Coordinates the entire dual-stage processing pipeline:
RMS Gate -> 80 Hz High-Pass Filter -> YAMNet Classification & Routing ->
Branch A (Whisper ASR) OR Branch B (GCC-PHAT Direction + Danger Engine).
"""

import time
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from scipy import signal
from collections import deque

from app.config import settings
from app.services.audio_preprocessor import AudioPreprocessor
from app.services.yamnet_service import YAMNetService
from app.services.whisper_service import WhisperService
from app.core.gcc_phat import compute_gcc_phat, simulate_stereo_delay, detect_rear_hemisphere
from app.core.danger_service import DangerEngine, DangerState
from app.core.sound_ontology import get_sound_info
from app.api.websocket.protocol import (
    SoundEventMessage,
    DangerUpdateMessage,
    TranscriptionMessage,
    SosAutoTriggerMessage,
    StatusMessage,
    DangerFactorsDict
)

class PipelineOrchestrator:
    def __init__(self):
        self.preprocessor = AudioPreprocessor(hp_cutoff_hz=80.0)
        self.yamnet = YAMNetService(confidence_threshold=0.70)
        self.whisper = WhisperService(api_key=settings.OPENAI_API_KEY)
        self.danger_engine = DangerEngine(
            cooldown_sec=settings.COOLDOWN_SECONDS,
            hysteresis_sec=settings.HYSTERESIS_SECONDS,
            hysteresis_delta_pts=settings.HYSTERESIS_DELTA_PTS,
            sos_threshold=settings.SOS_TRIGGER_THRESHOLD,
            sos_sustained_sec=settings.SOS_SUSTAINED_SECONDS
        )
        
        self.rms_threshold = settings.DEFAULT_RMS_THRESHOLD
        self.mic_spacing_m = settings.MIC_SPACING_M
        self.speed_of_sound = settings.SPEED_OF_SOUND_MPS
        
        # State tracking
        self.current_state = "16kHz_idle"
        self.last_loud_time = 0.0
        self.audio_buffer_left = deque(maxlen=48000)
        self.audio_buffer_right = deque(maxlen=48000)

    def set_config(
        self,
        rms_threshold: Optional[float] = None,
        mic_spacing_m: Optional[float] = None,
        context_score: Optional[float] = None,
        openai_key: Optional[str] = None
    ):
        if rms_threshold is not None:
            self.rms_threshold = max(0.001, rms_threshold)
        if mic_spacing_m is not None:
            self.mic_spacing_m = max(0.05, min(0.50, mic_spacing_m))
        if context_score is not None:
            self.danger_engine.update_context(context_score)
        if openai_key is not None:
            self.whisper.update_api_key(openai_key)

    def process_audio_chunk(
        self,
        b64_data: str,
        fs: int,
        channels: int,
        seq: int
    ) -> List[Dict[str, Any]]:
        """
        Processes a single incoming audio chunk from the WebSocket.
        Returns list of outgoing messages to broadcast to the client.
        """
        now = time.time()
        events_to_emit = []

        # 1. Decode PCM
        left, right = self.preprocessor.decode_pcm_bytes(b64_data, channels=channels)
        if right is None:
            # Mono audio: duplicate to right channel
            right = left.copy()
            
        # 2. Apply 80 Hz High-Pass Filter to both channels
        left_hp = self.preprocessor.apply_highpass_filter(left, fs)
        right_hp = self.preprocessor.apply_highpass_filter(right, fs)
        mono_mix = 0.5 * (left_hp + right_hp)

        # Append to rolling ring buffer for stable YAMNet and Whisper processing
        self.audio_buffer_left.extend(left_hp)
        self.audio_buffer_right.extend(right_hp)
        buffered_mono = 0.5 * (np.array(self.audio_buffer_left, dtype=np.float32) + np.array(self.audio_buffer_right, dtype=np.float32))

        # 3. Compute Frame RMS & dB SPL
        rms, db_spl = self.preprocessor.compute_rms_and_db(mono_mix)

        # Evaluate Dual-Stage Ingestion Gate
        if rms >= self.rms_threshold:
            self.current_state = "48kHz_active"
            self.last_loud_time = now
        else:
            if (now - self.last_loud_time) > settings.IDLE_TIMEOUT_SECONDS:
                self.current_state = "16kHz_idle"

        # Emit Status Message
        status_msg = StatusMessage(
            state=self.current_state,
            rms=round(rms, 4),
            db_spl=round(db_spl, 1),
            timestamp=now
        )
        events_to_emit.append(status_msg.model_dump(by_alias=True))

        # If audio is quiet and in idle state, do not trigger heavy inference
        if rms < 0.005 and self.current_state == "16kHz_idle":
            return events_to_emit

        # 4. Resample mono to 16 kHz if necessary for YAMNet
        eval_mono = buffered_mono if len(buffered_mono) >= 8000 else mono_mix
        if fs != 16000 and len(eval_mono) > 0:
            num_16k_samples = int(len(eval_mono) * 16000 / fs)
            audio_16k = signal.resample(eval_mono, num_16k_samples).astype(np.float32)
        else:
            audio_16k = eval_mono

        # 5. YAMNet Classification & Branch Routing
        top_class, confidence, meets_threshold, is_speech = self.yamnet.classify_and_route(audio_16k)

        # If confidence is below 70%, evaluate danger baseline but suppress active sound event
        if not meets_threshold:
            danger_state, _ = self.danger_engine.evaluate("Traffic noise, roadway noise", 0.50, db_spl)
            events_to_emit.append(self._format_danger_update(danger_state, now))
            return events_to_emit

        # Compute GCC-PHAT spatial direction across channels
        channel_diff = float(np.max(np.abs(left_hp - right_hp))) if right_hp is not None else 0.0
        is_distinct = channel_diff > 1e-4
        is_rear = detect_rear_hemisphere(left_hp, right_hp, fs=fs) if is_distinct else False

        tau, angle_deg, gcc_conf, zone = compute_gcc_phat(
            left_hp,
            right_hp,
            fs=fs,
            d=self.mic_spacing_m,
            c=self.speed_of_sound,
            is_rear=is_rear
        )
        if not is_distinct:
            zone = "OMNI"

        # === BRANCH A: HUMAN SPEECH ===
        if is_speech:
            transcript = self.whisper.transcribe(audio_16k)
            trans_msg = TranscriptionMessage(
                text=transcript["text"],
                speaker=transcript["speaker"],
                confidence=transcript["confidence"],
                is_final=transcript["is_final"],
                timestamp=now
            )
            events_to_emit.append(trans_msg.model_dump())

            # Update danger engine with speech event
            danger_state, is_new_alert = self.danger_engine.evaluate(top_class, confidence, db_spl)
            events_to_emit.append(self._format_danger_update(danger_state, now))

            # Display speaker direction on compass if active voice/shout
            if db_spl >= 50.0 and is_new_alert:
                sound_info = get_sound_info(top_class)
                display_name = "Human Speech" if "speech" in top_class.lower() else ("Loud Shout" if "shout" in top_class.lower() else sound_info.display_name)
                sound_msg = SoundEventMessage(
                    sound_class=top_class,
                    display_name=display_name,
                    confidence=round(confidence, 2),
                    priority=sound_info.priority.value,
                    angle_deg=round(angle_deg, 1),
                    compass_zone=zone,
                    tdoa_tau_s=round(tau, 6),
                    db_spl=round(db_spl, 1),
                    haptic_pattern="gentle_tap" if sound_info.priority.value != "P0" else "3_strong",
                    timestamp=now
                )
                events_to_emit.append(sound_msg.model_dump(by_alias=True))

            return events_to_emit

        # === BRANCH B: ENVIRONMENTAL SOUNDS & SPATIAL LOCALIZATION ===
        # 1. GCC-PHAT TDOA on Left & Right channels
        channel_diff = float(np.max(np.abs(left_hp - right_hp))) if right_hp is not None else 0.0
        is_distinct = channel_diff > 1e-4
        is_rear = detect_rear_hemisphere(left_hp, right_hp, fs=fs) if is_distinct else False

        tau, angle_deg, gcc_conf, zone = compute_gcc_phat(
            left_hp,
            right_hp,
            fs=fs,
            d=self.mic_spacing_m,
            c=self.speed_of_sound,
            is_rear=is_rear
        )
        if not is_distinct:
            zone = "OMNI"

        # 2. Danger Assessment with Cooldown & Hysteresis
        danger_state, is_new_alert = self.danger_engine.evaluate(top_class, confidence, db_spl)
        sound_info = get_sound_info(top_class)

        # 3. Emit Sound Event if cooldown passed or surge detected
        if is_new_alert:
            sound_msg = SoundEventMessage(
                sound_class=top_class,
                display_name=sound_info.display_name,
                confidence=round(confidence, 2),
                priority=sound_info.priority.value,
                angle_deg=round(angle_deg, 1),
                compass_zone=zone,
                tdoa_tau_s=round(tau, 6),
                db_spl=round(db_spl, 1),
                haptic_pattern=sound_info.haptic_pattern,
                timestamp=now
            )
            events_to_emit.append(sound_msg.model_dump(by_alias=True))

        # 4. Emit Danger Update
        events_to_emit.append(self._format_danger_update(danger_state, now))

        # 5. Check if SOS Auto-Trigger occurred
        if danger_state.sos_auto_triggered:
            sos_msg = SosAutoTriggerMessage(
                reason="danger_sustained",
                danger_score=danger_state.score,
                countdown_seconds=10,
                timestamp=now
            )
            events_to_emit.append(sos_msg.model_dump())

        return events_to_emit

    def process_synthetic_trigger(
        self,
        sound_class: str,
        delay_samples: int,
        db_spl: float,
        confidence: float,
        text: Optional[str] = None,
        is_rear: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Simulator endpoint: generates synthetic delay and processes through the pipeline.
        Enables testing directional angles, transcription, and danger alerts without multi-mic hardware.
        """
        now = time.time()
        events_to_emit = []

        # If speech trigger with text -> Branch A
        if text or sound_class in ["Speech", "Conversation"]:
            trans_msg = TranscriptionMessage(
                text=text or "Attention: Emergency vehicle approaching from the right.",
                speaker="Speaker 1",
                confidence=0.96,
                is_final=True,
                timestamp=now
            )
            events_to_emit.append(trans_msg.model_dump())
            danger_state, _ = self.danger_engine.evaluate(sound_class, confidence, db_spl)
            events_to_emit.append(self._format_danger_update(danger_state, now))
            return events_to_emit

        # Synthesize mono chirp/harmonic
        fs = 48000
        n_samples = int(fs * 0.5)
        t = np.linspace(0, 0.5, n_samples, endpoint=False)
        center_freq = 1000.0 if "siren" in sound_class.lower() else 800.0
        mono = (np.sin(2 * np.pi * center_freq * t) * np.hanning(n_samples)).astype(np.float32)

        # Apply synthetic delay
        left, right = simulate_stereo_delay(mono, delay_samples)

        # Compute GCC-PHAT on synthetic stereo
        tau, angle_deg, gcc_conf, zone = compute_gcc_phat(
            left, right, fs=fs, d=self.mic_spacing_m, c=self.speed_of_sound, is_rear=is_rear
        )

        # Evaluate Danger Engine
        danger_state, is_new_alert = self.danger_engine.evaluate(sound_class, confidence, db_spl)
        sound_info = get_sound_info(sound_class)

        # Build Sound Event Message
        sound_msg = SoundEventMessage(
            sound_class=sound_class,
            display_name=sound_info.display_name,
            confidence=round(confidence, 2),
            priority=sound_info.priority.value,
            angle_deg=round(angle_deg, 1),
            compass_zone=zone,
            tdoa_tau_s=round(tau, 6),
            db_spl=round(db_spl, 1),
            haptic_pattern=sound_info.haptic_pattern,
            timestamp=now
        )
        events_to_emit.append(sound_msg.model_dump(by_alias=True))

        # Build Danger Update Message
        events_to_emit.append(self._format_danger_update(danger_state, now))

        if danger_state.sos_auto_triggered or danger_state.score >= 90.0:
            sos_msg = SosAutoTriggerMessage(
                reason="danger_sustained",
                danger_score=danger_state.score,
                countdown_seconds=10,
                timestamp=now
            )
            events_to_emit.append(sos_msg.model_dump())

        return events_to_emit

    @staticmethod
    def _format_danger_update(danger_state: DangerState, timestamp: float) -> Dict[str, Any]:
        return DangerUpdateMessage(
            score=danger_state.score,
            raw_score=danger_state.raw_score,
            level=danger_state.level,
            color=danger_state.color,
            factors=DangerFactorsDict(
                type_score=danger_state.factors.type_score,
                intensity_score=danger_state.factors.intensity_score,
                approach_score=danger_state.factors.approach_score,
                context_score=danger_state.factors.context_score,
                db_spl=danger_state.factors.db_spl,
                delta_db_per_sec=danger_state.factors.delta_db_per_sec
            ),
            noise_dose=danger_state.noise_dose,
            timestamp=timestamp
        ).model_dump()
