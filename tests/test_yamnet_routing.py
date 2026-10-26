"""
Unit and integration tests for YAMNet audio routing and branch execution.
Validates official Google YAMNet model classification, Speech (Branch A) vs
Environmental (Branch B) routing, silence squelching, and pipeline orchestration.
"""

import os
import sys
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app.services.audio_preprocessor import AudioPreprocessor
from app.services.yamnet_service import YAMNetService
from app.services.pipeline_orchestrator import PipelineOrchestrator
from app.core.sound_ontology import get_sound_info, is_speech_category, Priority

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

def test_yamnet_speech_routing():
    """Verify YAMNet classifier accurately identifies real speech and routes to Branch A."""
    yamnet = YAMNetService(confidence_threshold=0.25)
    
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures/speech_sample.npy")
    if os.path.exists(fixture_path):
        speech_audio = np.load(fixture_path)
    else:
        # Fallback 16kHz speech harmonic fixture
        fs = 16000
        t = np.linspace(0, 1.0, fs, endpoint=False)
        speech_audio = (0.5 * np.sin(2 * np.pi * 200 * t) + 0.3 * np.sin(2 * np.pi * 400 * t)).astype(np.float32)

    top_class, conf, meets_thresh, is_speech = yamnet.classify_and_route(speech_audio)
    
    assert meets_thresh is True
    assert is_speech is True
    assert top_class in ["Speech", "Conversation", "Narration, monologue", "Child speech, kid speaking"]
    assert conf >= 0.50

def test_yamnet_environmental_alarm_routing():
    """Verify YAMNet identifies environmental warning/danger sound and routes to Branch B."""
    yamnet = YAMNetService(confidence_threshold=0.25)
    
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures/alarm_sample.npy")
    if os.path.exists(fixture_path):
        alarm_audio = np.load(fixture_path)
    else:
        fs = 16000
        t = np.linspace(0, 1.0, fs, endpoint=False)
        alarm_audio = (0.4 * np.sin(2 * np.pi * 3000 * t)).astype(np.float32)

    top_class, conf, meets_thresh, is_speech = yamnet.classify_and_route(alarm_audio)
    
    assert meets_thresh is True
    assert is_speech is False
    assert top_class in ["Alarm", "Smoke detector, smoke alarm", "Buzzer", "Beep, bleep", "Siren"]
    assert conf >= 0.25

def test_yamnet_silence_squelching():
    """Verify quiet microphone noise and empty chunks are squelched as Silence."""
    yamnet = YAMNetService(confidence_threshold=0.25)
    
    # 1. Empty buffer
    empty = np.array([], dtype=np.float32)
    top_class, conf, meets, is_speech = yamnet.classify_and_route(empty)
    assert top_class == "Silence"
    assert is_speech is False
    
    # 2. Quiet room noise (RMS < 0.0075)
    noise = (np.random.randn(8000) * 0.001).astype(np.float32)
    top_class, conf, meets, is_speech = yamnet.classify_and_route(noise)
    assert top_class == "Silence"
    assert is_speech is False
    assert meets is True

def test_ontology_sound_mapping():
    """Verify AudioSet classes correctly map to priorities, severities, and haptics."""
    # Emergency P0
    siren_info = get_sound_info("Siren")
    assert siren_info.priority == Priority.P0
    assert siren_info.s_type == 100.0
    assert siren_info.haptic_pattern == "3_strong"

    # Warning P1
    horn_info = get_sound_info("Vehicle horn, car horn, honking")
    assert horn_info.priority == Priority.P1
    assert horn_info.s_type == 75.0
    assert horn_info.haptic_pattern == "2_medium"

    # Alert P2
    doorbell_info = get_sound_info("Doorbell")
    assert doorbell_info.priority == Priority.P2
    assert doorbell_info.s_type == 45.0
    assert doorbell_info.haptic_pattern == "1_short"

    # Info P3
    traffic_info = get_sound_info("Traffic noise, roadway noise")
    assert traffic_info.priority == Priority.P3
    assert traffic_info.s_type == 25.0

    # Speech category check
    assert is_speech_category("Speech") is True
    assert is_speech_category("Conversation") is True
    assert is_speech_category("Siren") is False

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
    test_yamnet_speech_routing()
    test_yamnet_environmental_alarm_routing()
    test_yamnet_silence_squelching()
    test_ontology_sound_mapping()
    test_pipeline_orchestrator_synthetic()
    print("All YAMNet and Pipeline Orchestrator tests passed successfully!")
