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

def test_environmental_acoustic_signatures():
    """Verify acoustic signature fallback classifies clapping, knocking, whistle, and silence."""
    yamnet = YAMNetService(confidence_threshold=0.70)
    fs = 16000
    t = np.linspace(0, 0.5, int(fs * 0.5), endpoint=False)

    # 1. Clapping transient
    noise = np.random.randn(len(t)).astype(np.float32)
    envelope_clap = np.zeros_like(t)
    envelope_clap[1000:1500] = np.exp(-np.linspace(0, 5, 500))
    clap_raw = noise * envelope_clap * 0.8
    clap_signal = np.convolve(clap_raw, np.ones(5)/5.0, mode="same").astype(np.float32)
    top_class, conf, meets, is_speech = yamnet.classify_and_route(clap_signal)
    assert meets is True
    assert is_speech is False
    assert top_class in ["Clapping", "Applause", "Sudden sound"]

    # 2. Knock impulse
    envelope_knock = np.zeros_like(t)
    envelope_knock[1000:1800] = np.exp(-np.linspace(0, 4, 800))
    knock_signal = (np.sin(2 * np.pi * 200 * t) * envelope_knock * 0.8).astype(np.float32)
    top_class_k, conf_k, meets_k, is_speech_k = yamnet.classify_and_route(knock_signal)
    assert meets_k is True
    assert is_speech_k is False
    assert top_class_k in ["Knock", "Door", "Sudden sound"]

    # 3. Whistle tone
    whistle_signal = (0.5 * np.sin(2 * np.pi * 2400 * t)).astype(np.float32)
    top_class_w, conf_w, meets_w, is_speech_w = yamnet.classify_and_route(whistle_signal)
    assert meets_w is True
    assert is_speech_w is False
    assert top_class_w in ["Whistle", "Smoke detector, smoke alarm", "Siren"]

    # 4. Silence
    silence_signal = (np.random.randn(len(t)) * 0.0001).astype(np.float32)
    top_class_s, conf_s, meets_s, is_speech_s = yamnet.classify_and_route(silence_signal)
    assert top_class_s == "Silence"

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

    # Test speech synthetic trigger produces both transcription and sound_event
    events_speech = orchestrator.process_synthetic_trigger(
        sound_class="Speech",
        delay_samples=0,
        db_spl=65.0,
        confidence=0.95,
        text="Hello, how can I help you?"
    )
    speech_types = [e["type"] for e in events_speech]
    assert "transcription" in speech_types
    assert "sound_event" in speech_types
    speech_evt = next(e for e in events_speech if e["type"] == "sound_event")
    assert speech_evt["display_name"] == "Human Speech"

if __name__ == "__main__":
    test_highpass_filter()
    test_yamnet_speech_vs_environmental_routing()
    test_environmental_acoustic_signatures()
    test_pipeline_orchestrator_synthetic()
    print("All YAMNet and Pipeline Orchestrator tests passed successfully!")
