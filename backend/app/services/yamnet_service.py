"""
YAMNet Environmental Sound Classifier & Branch Router.
Evaluates 521 AudioSet classes using Google's official YAMNet deep neural network,
and routes audio to Branch A (Speech / Whisper) or Branch B (Environmental / GCC-PHAT + Danger).
Includes cross-hardware adaptive amplitude normalization for laptop microphones.
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
        local_model_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../models/yamnet")
        )
        class_map_file = os.path.join(local_model_dir, "assets", "yamnet_class_map.csv")

        # 1. Try loading directly via standard TensorFlow (SavedModel)
        try:
            import tensorflow as tf
            if os.path.isdir(local_model_dir) and os.path.exists(os.path.join(local_model_dir, "saved_model.pb")):
                print(f"[YAMNetService] Loading YAMNet directly via TensorFlow: {local_model_dir}")
                self.model = tf.saved_model.load(local_model_dir)
                if os.path.exists(class_map_file):
                    with open(class_map_file, "r", encoding="utf-8") as f:
                        reader = csv.reader(f)
                        next(reader)
                        self.class_names = [row[2] for row in reader]
                    print(f"[YAMNetService] Successfully loaded offline YAMNet with {len(self.class_names)} classes.")
                    return
        except Exception as e_tf:
            print(f"[YAMNetService] Standard tf.saved_model.load failed ({e_tf}), trying TFHub...")

        # 2. Try loading via TensorFlow Hub
        try:
            import tensorflow_hub as hub
            if os.path.isdir(local_model_dir):
                self.model = hub.load(local_model_dir)
            else:
                self.model = hub.load("https://tfhub.dev/google/yamnet/1")

            class_map_path = self.model.class_map_path().numpy().decode("utf-8")
            with open(class_map_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader)
                self.class_names = [row[2] for row in reader]

            print(f"[YAMNetService] Loaded official TFHub YAMNet with {len(self.class_names)} classes.")
            return
        except Exception as e_hub:
            print(f"[YAMNetService] WARNING: Could not load YAMNet deep neural network ({e_hub}).")
            print("[YAMNetService] Please ensure 'tensorflow' is installed: pip install tensorflow tensorflow-hub")
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
        Applies adaptive amplitude normalization so laptop microphones with
        lower hardware gain are evaluated with identical acoustic precision.

        Returns:
            top_class: Identified sound class name
            confidence: Probability score [0.0 - 1.0]
            meets_threshold: True if confidence >= confidence_threshold
            is_speech: True if class belongs to Human Speech (Branch A), False if Environmental (Branch B)
        """
        if len(audio_16k_mono) == 0:
            return "Silence", 1.0, True, False

        # Energy gate: low noise floor squelched immediately
        rms = float(np.sqrt(np.mean(audio_16k_mono ** 2)))
        if rms < 0.0020:
            return "Silence", 0.95, True, False

        if self.model is None:
            # Fallback if TensorFlow could not be initialized
            top_class = "Speech" if rms >= 0.015 else "Silence"
            return top_class, 0.50, True, is_speech_category(top_class)

        # Cross-hardware Adaptive Gain Normalization:
        # Laptops have vastly different mic gains (Mac vs Realtek/Windows/Linux).
        # We normalize active signals to peak ~0.45 so YAMNet receives optimal log-mel energy.
        peak = float(np.max(np.abs(audio_16k_mono)))
        if peak > 1e-4:
            gain_multiplier = min(20.0, 0.45 / peak)
            normalized_audio = (audio_16k_mono * gain_multiplier).astype(np.float32)
        else:
            normalized_audio = audio_16k_mono

        # Run official YAMNet inference
        scores, embeddings, spectrogram = self.model(normalized_audio)
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
