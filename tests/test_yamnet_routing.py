"""
Unit and integration tests for YAMNet audio routing and branch execution.
"""

import numpy as np
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app.services.audio_preprocessor import AudioPreprocessor
from app.services.yamnet_service import YAMNetService
from app.services.pipeline_orchestrator import PipelineOrchestrator

def test_highpass_filter():
    """Verify 80 Hz high-pass filter attenuates sub-80Hz rumble."""
    pre = AudioPreprocessor(hp_cutoff_hz=80.0)
    fs = 48000
    t = np.linspace(0, 0.2, int(fs * 0.2), endpoint=False)
    # 30 Hz sub-bass rumble
    low_rumble = np.sin(2 * np.pi * 30 * t)
    # 1000 Hz acoustic tone
    tone = np.sin(2 * np.pi * 1000 * t)
    mixed = low_rumble + tone
    
    filtered = pre.apply_highpass_filter(mixed, fs)
    
    # Low rumble power should be suppressed significantly
    power_orig = np.mean(mixed ** 2)
    power_filt = np.mean(filtered ** 2)
    assert power_filt < power_orig

def test_yamnet_speech_vs_environmental_routing():
    """Verify YAMNet classifier differentiates speech and environmental siren."""
    yamnet = YAMNetService(confidence_threshold=0.70)
    fs = 16000
    t = np.linspace(0, 0.5, int(fs * 0.5), endpoint=False)
    
    # 1. Synthesize Speech-like harmonic formant (formants at 500 Hz, 1500 Hz)
    speech_signal = (
        0.5 * np.sin(2 * np.pi * 300 * t) +
        0.3 * np.sin(2 * np.pi * 800 * t) +
        0.2 * np.sin(2 * np.pi * 1500 * t)
    ).astype(np.float32)
    top_class, conf, meets_thresh, is_speech = yamnet.classify_and_route(speech_signal)
    
    assert meets_thresh is True
    assert is_speech is True
    assert top_class in ["Speech", "Conversation"]
    
    # 2. Synthesize Siren (frequency modulated carrier around 1200 Hz with high ZCR)
    siren_signal = (np.sin(2 * np.pi * 1400 * t) * np.hanning(len(t))).astype(np.float32)
    top_class_env, conf_env, meets_env, is_speech_env = yamnet.classify_and_route(siren_signal)
    
    assert meets_env is True
    assert is_speech_env is False
    assert top_class_env in ["Siren", "Car horn", "Glass"]

def test_pipeline_orchestrator_synthetic():
    """Verify end-to-end pipeline orchestrator with synthetic test trigger."""
    orchestrator = PipelineOrchestrator()
    events = orchestrator.process_synthetic_trigger(
        sound_class="Car horn",
        delay_samples=-10,  # Sound coming from Right/East (NE zone)
        db_spl=82.0,
        confidence=0.89
    )
    
    # Must produce sound_event and danger_update
    types = [e["type"] for e in events]
    assert "sound_event" in types
    assert "danger_update" in types
    
    sound_evt = next(e for e in events if e["type"] == "sound_event")
    assert sound_evt["class"] == "Car horn"
    assert sound_evt["angle_deg"] < 90.0  # Eastward
    assert sound_evt["compass_zone"] in ["NE", "E"]

if __name__ == "__main__":
    test_highpass_filter()
    test_yamnet_speech_vs_environmental_routing()
    test_pipeline_orchestrator_synthetic()
    print("All YAMNet and Pipeline Orchestrator tests passed successfully!")
