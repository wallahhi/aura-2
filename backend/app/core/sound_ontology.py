"""
Sound Ontology & Priority Registry for SoundSense.
Maps 521 AudioSet / YAMNet classes into priority tiers (P0-P3),
evaluates severity weights S_type (0-100), and classifies Speech vs Environmental sound.
"""

from enum import Enum
from dataclasses import dataclass
from typing import Dict, Optional, Set

class Priority(str, Enum):
    P0 = "P0"  # Emergency / Life-safety
    P1 = "P1"  # Warning / Imminent hazard
    P2 = "P2"  # Alert / Actionable notification
    P3 = "P3"  # Info / Ambient awareness

@dataclass(frozen=True)
class SoundCategoryInfo:
    class_name: str
    display_name: str
    priority: Priority
    s_type: float        # Baseline severity score [0.0 - 100.0]
    is_speech: bool = False
    haptic_pattern: str = "1_short"

# Speech categories routed to Branch A (Whisper ASR)
SPEECH_CLASSES: Set[str] = {
    "Speech",
    "Narration, monologue",
    "Conversation",
    "Babbling",
    "Yip",
    "Whispering",
    "Laughter",
    "Snicker",
    "Giggle",
    "Baby laughter",
    "Cough",
    "Throat clearing",
    "Singing",
    "Child singing",
    "Synthetic singing",
    "Choir",
    "Male speech, man speaking",
    "Female speech, woman speaking",
    "Child speech, kid speaking",
    "Speech synthesizer",
    "Shout",
    "Yell",
    "Children shouting",
    "Screaming",
    "Crying, sobbing",
    "Cheering",
    "Chatter",
    "Hubbub, speech noise, speech babble",
}

# Explicit ontology table with priority and severity weights
ONTOLOGY_MAP: Dict[str, SoundCategoryInfo] = {
    # --- P0: EMERGENCY (S_type = 100.0) ---
    "Siren": SoundCategoryInfo("Siren", "Emergency Siren", Priority.P0, 100.0, haptic_pattern="3_strong"),
    "Civil defense siren": SoundCategoryInfo("Civil defense siren", "Tornado / Defense Siren", Priority.P0, 100.0, haptic_pattern="3_strong"),
    "Police car (siren)": SoundCategoryInfo("Police car (siren)", "Police Siren", Priority.P0, 100.0, haptic_pattern="3_strong"),
    "Ambulance (siren)": SoundCategoryInfo("Ambulance (siren)", "Ambulance Siren", Priority.P0, 100.0, haptic_pattern="3_strong"),
    "Fire engine, fire truck (siren)": SoundCategoryInfo("Fire engine, fire truck (siren)", "Fire Truck Siren", Priority.P0, 100.0, haptic_pattern="3_strong"),
    "Smoke detector, smoke alarm": SoundCategoryInfo("Smoke detector, smoke alarm", "Smoke Detector Alarm", Priority.P0, 100.0, haptic_pattern="3_strong"),
    "Fire alarm": SoundCategoryInfo("Fire alarm", "Fire Alarm", Priority.P0, 100.0, haptic_pattern="3_strong"),
    "Explosion": SoundCategoryInfo("Explosion", "Explosion", Priority.P0, 100.0, haptic_pattern="3_strong"),
    "Gunshot, gunfire": SoundCategoryInfo("Gunshot, gunfire", "Gunshot", Priority.P0, 100.0, haptic_pattern="3_strong"),
    "Screaming": SoundCategoryInfo("Screaming", "Human Scream", Priority.P0, 95.0, is_speech=True, haptic_pattern="3_strong"),
    "Shout": SoundCategoryInfo("Shout", "Loud Shout / Yell", Priority.P0, 90.0, is_speech=True, haptic_pattern="3_strong"),
    
    # --- P1: WARNING (S_type = 70.0 - 85.0) ---
    "Car horn": SoundCategoryInfo("Car horn", "Car Horn", Priority.P1, 75.0, haptic_pattern="2_medium"),
    "Vehicle horn, car horn, honking": SoundCategoryInfo("Vehicle horn, car horn, honking", "Vehicle Horn", Priority.P1, 75.0, haptic_pattern="2_medium"),
    "Air horn, truck horn": SoundCategoryInfo("Air horn, truck horn", "Truck Air Horn", Priority.P1, 75.0, haptic_pattern="2_medium"),
    "Train horn": SoundCategoryInfo("Train horn", "Train Horn", Priority.P1, 80.0, haptic_pattern="2_medium"),
    "Foghorn": SoundCategoryInfo("Foghorn", "Foghorn", Priority.P1, 70.0, haptic_pattern="2_medium"),
    "Honking": SoundCategoryInfo("Honking", "Honking", Priority.P1, 75.0, haptic_pattern="2_medium"),
    "Car alarm": SoundCategoryInfo("Car alarm", "Car Alarm", Priority.P1, 75.0, haptic_pattern="2_medium"),
    "Bicycle bell": SoundCategoryInfo("Bicycle bell", "Bicycle Bell", Priority.P1, 65.0, haptic_pattern="2_medium"),
    "Tire squeal": SoundCategoryInfo("Tire squeal", "Tire Squeal", Priority.P1, 80.0, haptic_pattern="2_medium"),
    "Skidding": SoundCategoryInfo("Skidding", "Vehicle Skidding", Priority.P1, 80.0, haptic_pattern="2_medium"),
    "Glass": SoundCategoryInfo("Glass", "Glass Breaking", Priority.P1, 85.0, haptic_pattern="2_medium"),
    "Chirp, chime": SoundCategoryInfo("Chirp, chime", "Alarm Chime", Priority.P1, 60.0, haptic_pattern="2_medium"),
    "Buzzer": SoundCategoryInfo("Buzzer", "Industrial Buzzer", Priority.P1, 70.0, haptic_pattern="2_medium"),
    "Alarm": SoundCategoryInfo("Alarm", "General Alarm", Priority.P1, 75.0, haptic_pattern="2_medium"),
    
    # --- P2: ALERT (S_type = 35.0 - 55.0) ---
    "Doorbell": SoundCategoryInfo("Doorbell", "Doorbell Ring", Priority.P2, 45.0, haptic_pattern="1_short"),
    "Door": SoundCategoryInfo("Door", "Door Opening/Closing", Priority.P2, 35.0, haptic_pattern="1_short"),
    "Knock": SoundCategoryInfo("Knock", "Door Knock", Priority.P2, 40.0, haptic_pattern="1_short"),
    "Bark": SoundCategoryInfo("Bark", "Dog Barking", Priority.P2, 45.0, haptic_pattern="1_short"),
    "Dog": SoundCategoryInfo("Dog", "Dog", Priority.P2, 40.0, haptic_pattern="1_short"),
    "Telephone": SoundCategoryInfo("Telephone", "Telephone Ringing", Priority.P2, 35.0, haptic_pattern="1_short"),
    "Telephone bell ringing": SoundCategoryInfo("Telephone bell ringing", "Telephone Ringing", Priority.P2, 35.0, haptic_pattern="1_short"),
    "Ringtone": SoundCategoryInfo("Ringtone", "Phone Ringtone", Priority.P2, 35.0, haptic_pattern="1_short"),
    "Alarm clock": SoundCategoryInfo("Alarm clock", "Alarm Clock", Priority.P2, 50.0, haptic_pattern="2_medium"),
    "Baby cry, infant cry": SoundCategoryInfo("Baby cry, infant cry", "Baby Crying", Priority.P2, 55.0, haptic_pattern="2_medium"),
    "Clapping": SoundCategoryInfo("Clapping", "Applause / Clapping", Priority.P2, 35.0, haptic_pattern="1_short"),
    "Applause": SoundCategoryInfo("Applause", "Applause / Clapping", Priority.P2, 35.0, haptic_pattern="1_short"),
    "Beep, bleep": SoundCategoryInfo("Beep, bleep", "Beep / Chime", Priority.P2, 40.0, haptic_pattern="1_short"),
    "Whistle": SoundCategoryInfo("Whistle", "Whistle Sound", Priority.P2, 45.0, haptic_pattern="1_short"),
    "Sudden sound": SoundCategoryInfo("Sudden sound", "Sudden Acoustic Impulse", Priority.P2, 50.0, haptic_pattern="2_medium"),
    
    # --- P3: INFO / SPEECH / AMBIENT (S_type = 5.0 - 25.0) ---
    "Speech": SoundCategoryInfo("Speech", "Human Speech", Priority.P3, 15.0, is_speech=True, haptic_pattern="gentle_tap"),
    "Child speech, kid speaking": SoundCategoryInfo("Child speech, kid speaking", "Child Speech", Priority.P3, 15.0, is_speech=True, haptic_pattern="gentle_tap"),
    "Speech synthesizer": SoundCategoryInfo("Speech synthesizer", "Synthesized Speech", Priority.P3, 15.0, is_speech=True, haptic_pattern="gentle_tap"),
    "Conversation": SoundCategoryInfo("Conversation", "Conversation", Priority.P3, 15.0, is_speech=True, haptic_pattern="gentle_tap"),
    "Narration, monologue": SoundCategoryInfo("Narration, monologue", "Speech Monologue", Priority.P3, 15.0, is_speech=True, haptic_pattern="gentle_tap"),
    "Whispering": SoundCategoryInfo("Whispering", "Whispering", Priority.P3, 10.0, is_speech=True, haptic_pattern="gentle_tap"),
    "Footstep": SoundCategoryInfo("Footstep", "Footstep", Priority.P3, 20.0, haptic_pattern="gentle_tap"),
    "Footsteps": SoundCategoryInfo("Footsteps", "Footsteps", Priority.P3, 20.0, haptic_pattern="gentle_tap"),
    "Water": SoundCategoryInfo("Water", "Water Running", Priority.P3, 15.0, haptic_pattern="gentle_tap"),
    "Water tap, faucet": SoundCategoryInfo("Water tap, faucet", "Water Tap Running", Priority.P3, 15.0, haptic_pattern="gentle_tap"),
    "Ambient acoustic surge": SoundCategoryInfo("Ambient acoustic surge", "Acoustic Surge", Priority.P3, 20.0, haptic_pattern="gentle_tap"),
    "Traffic noise, roadway noise": SoundCategoryInfo("Traffic noise, roadway noise", "Traffic Ambience", Priority.P3, 25.0, haptic_pattern="gentle_tap"),
    "Car": SoundCategoryInfo("Car", "Passing Car", Priority.P3, 25.0, haptic_pattern="gentle_tap"),
    "Vehicle": SoundCategoryInfo("Vehicle", "Passing Vehicle", Priority.P3, 25.0, haptic_pattern="gentle_tap"),
    "Music": SoundCategoryInfo("Music", "Background Music", Priority.P3, 10.0, haptic_pattern="gentle_tap"),
    "Silence": SoundCategoryInfo("Silence", "Quiet Ambient", Priority.P3, 0.0, haptic_pattern="none"),
}

def get_sound_info(class_name: str) -> SoundCategoryInfo:
    """Retrieve category info or construct default heuristic mapping."""
    if class_name in ONTOLOGY_MAP:
        return ONTOLOGY_MAP[class_name]
    
    # Check if name contains speech identifiers
    is_speech = any(s.lower() in class_name.lower() for s in ["speech", "speaking", "conversation", "whisper", "singing", "voice"])
    
    # Heuristic fallback based on keywords
    lower = class_name.lower()
    if any(k in lower for k in ["siren", "alarm", "explosion", "gunshot", "scream"]):
        return SoundCategoryInfo(class_name, class_name, Priority.P0, 90.0, is_speech, "3_strong")
    elif any(k in lower for k in ["horn", "squeal", "brake", "crash", "glass", "hazard"]):
        return SoundCategoryInfo(class_name, class_name, Priority.P1, 70.0, is_speech, "2_medium")
    elif any(k in lower for k in ["bell", "bark", "knock", "door", "ring", "cry"]):
        return SoundCategoryInfo(class_name, class_name, Priority.P2, 40.0, is_speech, "1_short")
    else:
        return SoundCategoryInfo(class_name, class_name, Priority.P3, 15.0, is_speech, "gentle_tap")

def is_speech_category(class_name: str) -> bool:
    """Check if class is Speech according to YAMNet routing."""
    if class_name in SPEECH_CLASSES:
        return True
    info = get_sound_info(class_name)
    return info.is_speech
