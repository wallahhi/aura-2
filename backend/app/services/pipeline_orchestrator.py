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
from app.core.gcc_phat import (
    compute_gcc_phat,
    simulate_stereo_delay,
    detect_rear_hemisphere,
    compute_3mic_doa,
    simulate_3mic_delay
)
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
        self._last_emitted_angle = 90.0
        self._last_sound_emit_time = 0.0
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

        # 1. Decode PCM (supports 1, 2, or 3 channels)
        ch1, ch2, ch3 = self.preprocessor.decode_pcm_bytes(b64_data, channels=channels)

        # Detect mic array configuration and compute high-pass audio
        if ch3 is not None and channels >= 3:
            mic_count = 3
            mic_mode = "3_mic_planar"
            mic_mode_label = "3-Mic Array (Smartwatch Planar)"
            m1_hp = self.preprocessor.apply_highpass_filter(ch1, fs)
            m2_hp = self.preprocessor.apply_highpass_filter(ch2, fs)
            m3_hp = self.preprocessor.apply_highpass_filter(ch3, fs)
            mono_mix = (m1_hp + m2_hp + m3_hp) / 3.0
            
            self.audio_buffer_left.extend(m1_hp)
            self.audio_buffer_right.extend(m2_hp)
            
            # Compute 3-Mic Planar Array DOA (360° unambiguous)
            tau, angle_deg, gcc_conf, zone, metrics = compute_3mic_doa(
                m1_hp, m2_hp, m3_hp, fs=fs, d=0.03, c=self.speed_of_sound
            )
            is_distinct = zone != "OMNI"
            
        elif ch2 is not None and channels == 2:
            left_hp = self.preprocessor.apply_highpass_filter(ch1, fs)
            right_hp = self.preprocessor.apply_highpass_filter(ch2, fs)
            mono_mix = 0.5 * (left_hp + right_hp)
            
            self.audio_buffer_left.extend(left_hp)
            self.audio_buffer_right.extend(right_hp)
            
            channel_diff = float(np.max(np.abs(left_hp - right_hp)))
            is_distinct = channel_diff > 1e-4
            
            if is_distinct:
                mic_count = 2
                mic_mode = "2_mic_dual"
                mic_mode_label = "2-Mic System (Dual Stereo Array)"
                is_rear = detect_rear_hemisphere(left_hp, right_hp, fs=fs)
                tau, angle_deg, gcc_conf, zone = compute_gcc_phat(
                    left_hp, right_hp, fs=fs, d=self.mic_spacing_m, c=self.speed_of_sound, is_rear=is_rear
                )
            else:
                # Built-in mono mic duplicated to stereo
                mic_count = 1
                mic_mode = "1_mic_mono"
                mic_mode_label = "1-Mic System (Mono Omni)"
                tau, angle_deg, gcc_conf, zone = 0.0, 0.0, 1.0, "OMNI"
        else:
            mic_count = 1
            mic_mode = "1_mic_mono"
            mic_mode_label = "1-Mic System (Mono Omni)"
            mono_hp = self.preprocessor.apply_highpass_filter(ch1, fs)
            mono_mix = mono_hp
            self.audio_buffer_left.extend(mono_hp)
            self.audio_buffer_right.extend(mono_hp)
            is_distinct = False
            tau, angle_deg, gcc_conf, zone = 0.0, 0.0, 1.0, "OMNI"

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
            timestamp=now,
            mic_count=mic_count,
            mic_mode=mic_mode,
            mic_mode_label=mic_mode_label
        )
        events_to_emit.append(status_msg.model_dump(by_alias=True))

        # If audio is quiet and in idle state, do not trigger heavy inference
        if rms < 0.008 and self.current_state == "16kHz_idle":
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

        # Silence / ambient background: do not emit sound event or trigger alerts
        if top_class == "Silence":
            danger_state, _ = self.danger_engine.evaluate("Traffic noise, roadway noise", 0.30, db_spl)
            if not hasattr(self, "_last_danger_emit_time") or (now - self._last_danger_emit_time) >= 2.0:
                self._last_danger_emit_time = now
                events_to_emit.append(self._format_danger_update(danger_state, now))
            return events_to_emit

        # If confidence is below threshold, but there is an active acoustic surge (db_spl >= 50 dB),
        # treat as an active acoustic event so the user gets real-time spatial directional feedback.
        if not meets_threshold:
            if db_spl >= 50.0 or rms >= self.rms_threshold:
                top_class = "Sudden sound" if db_spl >= 68.0 else "Ambient acoustic surge"
                confidence = 0.72
                meets_threshold = True
                is_speech = False
            else:
                # Quiet ambient noise: only evaluate danger baseline periodically (avoid UI event flooding)
                danger_state, _ = self.danger_engine.evaluate("Traffic noise, roadway noise", 0.30, db_spl)
                # Only emit danger update if level changed or every 2 seconds
                if not hasattr(self, "_last_danger_emit_time") or (now - self._last_danger_emit_time) >= 2.0:
                    self._last_danger_emit_time = now
                    events_to_emit.append(self._format_danger_update(danger_state, now))
                return events_to_emit

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
            is_speech_refresh = (now - self._last_sound_emit_time) >= 1.5
            if db_spl >= 44.0 and (is_new_alert or is_speech_refresh):
                self._last_sound_emit_time = now
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
                    timestamp=now,
                    mic_count=mic_count,
                    mic_mode=mic_mode,
                    mic_mode_label=mic_mode_label
                )
                events_to_emit.append(sound_msg.model_dump(by_alias=True))

            return events_to_emit

        # === BRANCH B: ENVIRONMENTAL SOUNDS & SPATIAL LOCALIZATION ===
        # 1. Danger Assessment with Cooldown & Hysteresis
        danger_state, is_new_alert = self.danger_engine.evaluate(top_class, confidence, db_spl)
        sound_info = get_sound_info(top_class)

        # 2. Emit Sound Event if cooldown passed, sound direction shifted, or periodic refresh during active sound
        is_angle_shift = is_distinct and (abs(angle_deg - self._last_emitted_angle) >= 15.0) and (db_spl >= 46.0)
        is_refresh = (now - self._last_sound_emit_time) >= 1.0 and (db_spl >= 46.0)

        # Suppress periodic refresh if class is just ambient traffic and not loud
        if top_class == "Traffic noise, roadway noise" and db_spl < 58.0:
            is_refresh = False

        if is_new_alert or is_angle_shift or is_refresh:
            self._last_emitted_angle = angle_deg
            self._last_sound_emit_time = now
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
                timestamp=now,
                mic_count=mic_count,
                mic_mode=mic_mode,
                mic_mode_label=mic_mode_label
            )
            events_to_emit.append(sound_msg.model_dump(by_alias=True))

        # 3. Emit Danger Update
        events_to_emit.append(self._format_danger_update(danger_state, now))

        # 4. Check if SOS Auto-Trigger occurred
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
        is_rear: bool = False,
        mic_count: int = 2,
        target_angle_deg: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Simulator endpoint: supports 1-Mic (Mono Omni), 2-Mic (Dual Stereo), and 3-Mic (Planar Smartwatch Array).
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

            target = target_angle_deg if target_angle_deg is not None else 90.0
            sound_msg = SoundEventMessage(
                sound_class=sound_class,
                display_name="Human Speech",
                confidence=0.96,
                priority="P3",
                angle_deg=round(target, 1),
                compass_zone="E" if target == 90.0 else "N",
                tdoa_tau_s=0.0,
                db_spl=round(db_spl, 1),
                haptic_pattern="gentle_tap",
                timestamp=now,
                mic_count=mic_count,
                mic_mode="3_mic_planar" if mic_count == 3 else ("2_mic_dual" if mic_count == 2 else "1_mic_mono"),
                mic_mode_label="3-Mic Smartwatch Array" if mic_count == 3 else ("2-Mic Dual Array" if mic_count == 2 else "1-Mic Mono Omni")
            )
            events_to_emit.append(sound_msg.model_dump(by_alias=True))
            return events_to_emit

        # Synthesize mono chirp/harmonic
        fs = 48000
        n_samples = int(fs * 0.5)
        t = np.linspace(0, 0.5, n_samples, endpoint=False)
        center_freq = 1000.0 if "siren" in sound_class.lower() else 800.0
        mono = (np.sin(2 * np.pi * center_freq * t) * np.hanning(n_samples)).astype(np.float32)

        # Process based on mic_count
        if mic_count == 3:
            # 3-Mic Equilateral Planar Smartwatch Array (d = 30 mm)
            target = target_angle_deg if target_angle_deg is not None else (195.0 if is_rear else 45.0)
            m1, m2, m3 = simulate_3mic_delay(mono, target, fs=fs, d=0.03, c=self.speed_of_sound)
            tau, angle_deg, gcc_conf, zone, metrics = compute_3mic_doa(
                m1, m2, m3, fs=fs, d=0.03, c=self.speed_of_sound
            )
            mic_mode = "3_mic_planar"
            mic_mode_label = "3-Mic Array (Smartwatch Planar)"
        elif mic_count == 2:
            # 2-Mic Dual Stereo Array (d = 14 cm)
            left, right = simulate_stereo_delay(mono, delay_samples)
            tau, angle_deg, gcc_conf, zone = compute_gcc_phat(
                left, right, fs=fs, d=self.mic_spacing_m, c=self.speed_of_sound, is_rear=is_rear
            )
            mic_mode = "2_mic_dual"
            mic_mode_label = "2-Mic System (Dual Stereo Array)"
        else:
            # 1-Mic Single Channel (Mono Omni)
            tau = 0.0
            angle_deg = 0.0
            zone = "OMNI"
            mic_mode = "1_mic_mono"
            mic_mode_label = "1-Mic System (Mono Omni)"

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
            timestamp=now,
            mic_count=mic_count,
            mic_mode=mic_mode,
            mic_mode_label=mic_mode_label
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
