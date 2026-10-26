"""
YAMNet Environmental Sound Classifier & Branch Router.
Evaluates 521 AudioSet classes using Google's official YAMNet deep neural network,
and routes audio to Branch A (Speech / Whisper) or Branch B (Environmental / GCC-PHAT + Danger).
"""

import os
import csv
import logging
import numpy as np
from typing import Tuple, Dict, Any, List, Optional
from app.core.sound_ontology import is_speech_category, get_sound_info

logger = logging.getLogger("yamnet_service")

# Generic background context tags in AudioSet to deprioritize when an actionable sound event is present
GENERIC_BACKGROUND_CLASSES = {
    "Inside, small room",
    "Inside, large room or hall",
    "Inside, public space",
    "Outside, urban or manmade",
    "Outside, rural or natural",
    "Noise",
    "Environmental noise",
    "White noise",
    "Pink noise",
    "Wind noise (microphone)",
    "Sound effect",
}

class YAMNetService:
    def __init__(self, confidence_threshold: float = 0.25):
        self.confidence_threshold = confidence_threshold
        self.model = None
        self.class_names: List[str] = []
        self._init_model()

    def _init_model(self):
        """Loads official YAMNet model from local path or TensorFlow Hub."""
        try:
            import tensorflow_hub as hub

            # Check local models directory first
            local_model_dir = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "../models/yamnet")
            )
            if os.path.isdir(local_model_dir) and os.path.exists(os.path.join(local_model_dir, "saved_model.pb")):
                logger.info(f"[YAMNetService] Loading YAMNet from local directory: {local_model_dir}")
                self.model = hub.load(local_model_dir)
            else:
                logger.info("[YAMNetService] Loading YAMNet from TFHub...")
                self.model = hub.load("https://tfhub.dev/google/yamnet/1")

            # Load the 521 AudioSet class map with standard CSV parsing
            class_map_path = self.model.class_map_path().numpy().decode("utf-8")
            with open(class_map_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader)  # Skip header (index,mid,display_name)
                self.class_names = [row[2] for row in reader]

            print(f"[YAMNetService] Successfully loaded official YAMNet with {len(self.class_names)} AudioSet classes.")
        except Exception as e:
            print(f"[YAMNetService] Error initializing YAMNet model ({e}). Using minimal safety fallback.")
            self.model = None
            self.class_names = [
                "Speech", "Siren", "Vehicle horn, car horn, honking", "Fire alarm",
                "Smoke detector, smoke alarm", "Glass", "Bicycle bell", "Dog",
                "Doorbell", "Knock", "Explosion", "Clapping", "Applause", "Whistle",
                "Water", "Traffic noise, roadway noise", "Silence", "Conversation", "Shout"
            ]

    def classify_and_route(
        self,
        audio_16k_mono: np.ndarray
    ) -> Tuple[str, float, bool, bool]:
        """
        Runs sound classification on 16 kHz mono audio chunk.

        Returns:
            top_class: Identified sound class name
            confidence: Probability score [0.0 - 1.0]
            meets_threshold: True if confidence >= confidence_threshold
            is_speech: True if class belongs to Human Speech (Branch A), False if Environmental (Branch B)
        """
        if len(audio_16k_mono) == 0:
            return "Silence", 1.0, True, False

        # Energy gate: silence or idle mic noise floor squelched immediately
        rms = float(np.sqrt(np.mean(audio_16k_mono ** 2)))
        if rms < 0.0075:
            return "Silence", 0.95, True, False

        if self.model is None:
            # Fallback if model failed to load
            top_class = "Speech" if rms >= 0.03 else "Silence"
            return top_class, 0.50, True, is_speech_category(top_class)

        # Run official YAMNet deep neural network
        scores, embeddings, spectrogram = self.model(audio_16k_mono)
        mean_scores = np.mean(scores.numpy(), axis=0)

        # Inspect top prediction candidates
        top_k_indices = np.argsort(mean_scores)[-5:][::-1]
        best_idx = top_k_indices[0]

        # If top class is a generic acoustic background tag (e.g. 'Sound effect' or 'Inside, small room'),
        # check if an actionable sound event is present in the top-5 candidates.
        if self.class_names[best_idx] in GENERIC_BACKGROUND_CLASSES:
            for cand_idx in top_k_indices[1:]:
                cand_name = self.class_names[cand_idx]
                cand_score = float(mean_scores[cand_idx])
                if cand_name not in GENERIC_BACKGROUND_CLASSES and cand_score >= 0.15:
                    best_idx = cand_idx
                    break

        top_class = self.class_names[best_idx]
        confidence = float(mean_scores[best_idx])
        meets_threshold = bool(confidence >= self.confidence_threshold)
        is_speech = is_speech_category(top_class)

        return top_class, confidence, meets_threshold, is_speech
