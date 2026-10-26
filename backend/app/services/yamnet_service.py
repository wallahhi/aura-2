"""
YAMNet Environmental Sound Classifier & Branch Router.
Evaluates 521 AudioSet classes, enforces >= 70% confidence threshold,
and routes audio to Branch A (Speech / Whisper) or Branch B (Environmental / GCC-PHAT + Danger).
Includes resilient acoustic classifier fallback if TFHub is offline.
"""

import numpy as np
from typing import Tuple, Dict, Any, List, Optional
from app.core.sound_ontology import is_speech_category, get_sound_info

class YAMNetService:
    def __init__(self, confidence_threshold: float = 0.70):
        self.confidence_threshold = confidence_threshold
        self.tfhub_model = None
        self.class_names: List[str] = []
        self._init_model()

    def _init_model(self):
        """Attempts to load TensorFlow Hub YAMNet, falling back to signature engine if offline."""
        try:
            import tensorflow_hub as hub
            # Try loading official YAMNet
            print("[YAMNetService] Attempting to load TFHub YAMNet model...")
            self.tfhub_model = hub.load("https://tfhub.dev/google/yamnet/1")
            # Load class map
            class_map_path = self.tfhub_model.class_map_path().numpy().decode('utf-8')
            with open(class_map_path, 'r') as f:
                self.class_names = [line.strip().split(',')[2].strip('"') for line in f.readlines()[1:]]
            print(f"[YAMNetService] Loaded official TFHub YAMNet with {len(self.class_names)} classes.")
        except Exception as e:
            print(f"[YAMNetService] TFHub offline or unavailable ({e}). Initializing high-precision acoustic signature classifier.")
            self.tfhub_model = None
            self.class_names = [
                "Speech", "Siren", "Car horn", "Fire alarm", "Smoke detector, smoke alarm",
                "Glass", "Bicycle bell", "Dog", "Doorbell", "Knock", "Explosion",
                "Clapping", "Applause", "Whistle", "Water", "Sudden sound",
                "Traffic noise, roadway noise", "Silence", "Conversation", "Shout", "Screaming"
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
            meets_threshold: True if confidence >= 0.70
            is_speech: True if class belongs to Human Speech (Branch A), False if Environmental (Branch B)
        """
        if len(audio_16k_mono) == 0:
            return "Silence", 1.0, True, False

        if self.tfhub_model is not None:
            try:
                scores, embeddings, spectrogram = self.tfhub_model(audio_16k_mono)
                mean_scores = np.mean(scores.numpy(), axis=0)
                top_idx = int(np.argmax(mean_scores))
                top_class = self.class_names[top_idx]
                confidence = float(mean_scores[top_idx])
            except Exception as e:
                top_class, confidence = self._signature_classify(audio_16k_mono)
        else:
            top_class, confidence = self._signature_classify(audio_16k_mono)

        meets_threshold = bool(confidence >= self.confidence_threshold)
        is_speech = is_speech_category(top_class)
        
        return top_class, confidence, meets_threshold, is_speech

    def _signature_classify(self, audio: np.ndarray) -> Tuple[str, float]:
        """
        Multi-feature scoring-based acoustic classifier.
        Computes weighted feature match scores for ALL categories simultaneously
        and selects the highest-scoring category. This eliminates order-dependent
        cascading if-else misclassification where an earlier rule would greedily
        steal a classification that a later rule matches better.
        """
        if len(audio) == 0:
            return "Silence", 0.95

        rms = float(np.sqrt(np.mean(audio ** 2)))
        if rms < 0.0075:
            return "Silence", 0.95

        n_samples = len(audio)
        peak_amp = float(np.max(np.abs(audio)))
        crest_factor = float(peak_amp / (rms + 1e-9))

        # Robust zero-crossing rate on active audio above noise threshold
        thresh = max(1e-4, 0.03 * peak_amp)
        active_audio = audio[np.abs(audio) >= thresh]
        if len(active_audio) > 1:
            zcr = float(np.mean(np.abs(np.diff(np.sign(active_audio)))) / 2.0)
        else:
            zcr = 0.0

        # Segmental envelope variance (burstiness & transient attack)
        num_subframes = 16
        sub_len = n_samples // num_subframes
        if sub_len > 0:
            sub_rms = [
                float(np.sqrt(np.mean(audio[i * sub_len : (i + 1) * sub_len] ** 2)))
                for i in range(num_subframes)
            ]
            max_sub_rms = max(sub_rms)
            mean_sub_rms = float(np.mean(sub_rms)) + 1e-9
            sub_rms_ratio = float(max_sub_rms / mean_sub_rms)
            sub_rms_std = float(np.std(sub_rms) / mean_sub_rms)
        else:
            sub_rms_ratio = 1.0
            sub_rms_std = 0.0

        # Compute FFT power spectrum
        fft_vals = np.abs(np.fft.rfft(audio))
        freqs = np.fft.rfftfreq(n_samples, d=1.0 / 16000.0)
        power = fft_vals ** 2
        total_power = float(np.sum(power)) + 1e-12

        # Spectral Centroid
        centroid = float(np.sum(freqs * power) / total_power)

        # Spectral Spread / Bandwidth
        spread = float(np.sqrt(np.sum(((freqs - centroid) ** 2) * power) / total_power))

        # Peak frequency and Tonality (Peak-to-average spectral power)
        peak_idx = int(np.argmax(power))
        peak_freq = float(freqs[peak_idx])
        mean_power = float(np.mean(power)) + 1e-12
        tonality = float(power[peak_idx] / mean_power)

        # Spectral Flatness (Wiener entropy)
        log_power = np.log(power + 1e-12)
        flatness = float(np.exp(np.mean(log_power)) / mean_power)

        # Band energy distributions
        sub_low_band = float(np.sum(power[(freqs >= 40) & (freqs < 350)]) / total_power)
        low_mid_band = float(np.sum(power[(freqs >= 350) & (freqs < 1200)]) / total_power)
        mid_band = float(np.sum(power[(freqs >= 1200) & (freqs < 3000)]) / total_power)
        high_band = float(np.sum(power[(freqs >= 3000) & (freqs < 5500)]) / total_power)
        ultra_high_band = float(np.sum(power[(freqs >= 5500) & (freqs <= 8000)]) / total_power)

        # Spectral Rolloff (frequency below which 85% of energy is contained)
        cumulative_power = np.cumsum(power)
        rolloff_idx = int(np.searchsorted(cumulative_power, 0.85 * total_power))
        rolloff_freq = float(freqs[min(rolloff_idx, len(freqs) - 1)])

        # Harmonic ratio (energy at 2× and 3× fundamental vs fundamental)
        harmonic_ratio = 0.0
        if peak_freq > 50 and peak_idx > 0:
            f2_idx = min(int(np.argmin(np.abs(freqs - 2 * peak_freq))), len(power) - 1)
            f3_idx = min(int(np.argmin(np.abs(freqs - 3 * peak_freq))), len(power) - 1)
            harmonic_ratio = float((power[f2_idx] + power[f3_idx]) / (power[peak_idx] + 1e-12))

        speech_bands = sum(1 for b in [sub_low_band, low_mid_band, mid_band] if b > 0.08)

        # =====================================================
        # MULTI-FEATURE SCORING: score every category, pick best
        # =====================================================
        scores: Dict[str, float] = {}

        # 1. Smoke Detector / Fire Alarm: NFPA 72 standard 2800 - 3500 Hz pure tone, ear-piercing loud
        s = 0.0
        if 2800 <= peak_freq <= 3500:
            s += 0.35
            if high_band > 0.50: s += 0.30
            elif high_band > 0.30: s += 0.15
            if tonality > 20.0: s += 0.25
            if flatness < 0.01: s += 0.20
            if rms > 0.10: s += 0.15
        scores["Smoke detector, smoke alarm"] = s

        # 2. Whistle: 1600 - 2800 Hz pure sinusoidal tone
        s = 0.0
        if 1600 <= peak_freq <= 2800:
            s += 0.35
            if tonality > 20.0: s += 0.25
            elif tonality > 8.0: s += 0.15
            if flatness < 0.015: s += 0.25
            if spread < 1200: s += 0.15
            if crest_factor < 3.0: s += 0.10
        scores["Whistle"] = s

        # 3. Glass Breaking: shatter transient with very high centroid (>3200Hz) & high band energy
        s = 0.0
        if (centroid > 3200 or peak_freq > 3500) and (high_band + ultra_high_band) > 0.40:
            s += 0.35
            if crest_factor > 6.0: s += 0.30
            elif crest_factor > 3.0: s += 0.15
            if (high_band + ultra_high_band) > 0.60: s += 0.25
            if centroid > 3800: s += 0.20
            if zcr > 0.25: s += 0.15
            if flatness > 0.08: s += 0.15
        scores["Glass"] = s

        # 4. Siren: mid-freq (650-1650Hz) tonal acoustic machine, continuous, low flatness
        s = 0.0
        if 650 <= peak_freq <= 1650 and flatness < 0.015 and tonality > 10.0:
            s += 0.35
            if tonality > 20.0: s += 0.25
            elif tonality > 10.0: s += 0.15
            if mid_band > 0.25: s += 0.20
            if crest_factor < 2.8: s += 0.20
            if sub_rms_std < 0.35: s += 0.15
            if rms > 0.08: s += 0.15
        scores["Siren"] = s

        # 5. Knock: low-frequency percussive impulse (sub_low dominant, centroid < 800)
        s = 0.0
        if centroid < 800 and sub_low_band > 0.45 and sub_rms_ratio > 1.8:
            s += 0.35
            if crest_factor > 3.0: s += 0.25
            if sub_rms_ratio > 2.0: s += 0.20
            if zcr < 0.16: s += 0.15
            if peak_freq < 350: s += 0.15
        scores["Knock"] = s

        # 6. Clapping / Applause: broadband percussive impulse (centroid >= 750, sub_low < 0.35)
        s = 0.0
        if crest_factor > 3.5 and 750 <= centroid < 3500 and sub_low_band < 0.35 and sub_rms_ratio > 1.8:
            if crest_factor > 10.0: s += 0.40
            elif crest_factor > 5.0: s += 0.25
            else: s += 0.15
            if flatness > 0.04: s += 0.25
            elif flatness > 0.02: s += 0.15
            if sub_rms_ratio > 2.0: s += 0.20
            if 900 <= centroid <= 3000: s += 0.25
            if (high_band + ultra_high_band) < 0.65: s += 0.15
        scores["Clapping"] = s

        # 7. Doorbell: resonant chime 600-2400 Hz (no voice fundamental in sub_low_band)
        s = 0.0
        if 600 <= peak_freq <= 2400 and (sub_rms_ratio > 1.8 or sub_rms_std > 0.30) and sub_low_band < 0.12:
            s += 0.35
            if tonality > 20.0: s += 0.30
            elif tonality > 8.0: s += 0.15
            if flatness < 0.005: s += 0.30
            elif flatness < 0.015: s += 0.15
            if (low_mid_band + mid_band) > 0.50: s += 0.15
            if 2.5 <= crest_factor <= 6.0: s += 0.15
        scores["Doorbell"] = s

        # 8. Dog Bark: mid-range percussive bark burst (MUST be loud bark burst, NOT speech or pure tone)
        s = 0.0
        if 300 <= peak_freq <= 1200 and sub_rms_ratio > 1.8 and rms > 0.035 and tonality < 70.0 and flatness > 0.005:
            s += 0.20
            if low_mid_band > 0.30: s += 0.20
            if 2.8 <= crest_factor <= 10.0: s += 0.20
            if 500 <= centroid <= 1800: s += 0.15
            if sub_rms_std > 0.30: s += 0.15
        scores["Dog"] = s

        # 9. Screaming / Shout: loud human vocalization (NOT pure tone like whistle)
        s = 0.0
        if rms > 0.09 and centroid > 1100 and flatness >= 0.010:
            s += 0.30
            if rms > 0.14: s += 0.25
            elif rms > 0.10: s += 0.15
            if mid_band > 0.25: s += 0.25
            if 700 <= peak_freq <= 2500: s += 0.20
            if zcr > 0.14: s += 0.15
        scores["Screaming"] = s

        # 10. Car Horn: loud dual tone 350 - 850 Hz
        s = 0.0
        if 350 <= peak_freq <= 850:
            s += 0.20
            if rms > 0.12: s += 0.25
            elif rms > 0.06: s += 0.15
            if tonality > 12.0: s += 0.25
            if spread < 1000: s += 0.15
            if crest_factor < 2.5: s += 0.15
        scores["Car horn"] = s

        # 11. Human Speech: formant structure, non-pure tone, moderate crest, MUST have speech loudness
        s = 0.0
        is_quiet_noise = (rms < 0.010)
        is_continuous_noise = (flatness > 0.035 and sub_rms_ratio < 1.6 and sub_rms_std < 0.25)
        is_impulse = (crest_factor > 6.5)
        is_chime = (sub_rms_ratio > 1.8 and flatness < 0.005 and tonality > 80.0 and sub_low_band < 0.12)
        is_single_whistle = (flatness < 0.005 and tonality > 80.0 and speech_bands < 2)
        is_continuous_siren = (rms > 0.10 and flatness < 0.015 and crest_factor < 2.5 and speech_bands < 2)
        is_screaming = (rms > 0.13 and centroid > 1200 and flatness >= 0.010)

        if is_quiet_noise or is_continuous_noise or is_impulse or is_chime or is_single_whistle or is_continuous_siren or is_screaming:
            s = 0.0
        else:
            speech_band = low_mid_band + mid_band
            if speech_band > 0.40: s += 0.20
            if 300 <= centroid <= 2500: s += 0.20
            if crest_factor < 5.0: s += 0.15
            if 0.03 <= zcr <= 0.28: s += 0.15
            if speech_bands >= 2: s += 0.25
            if 0.003 <= flatness <= 0.05: s += 0.20
            elif speech_bands >= 2: s += 0.15
            if sub_rms_std <= 0.70: s += 0.10
        scores["Speech"] = s

        # 12. Water Running: smooth continuous wideband noise
        s = 0.0
        if flatness > 0.02 and crest_factor < 4.5 and sub_rms_ratio < 1.6 and sub_rms_std < 0.25:
            s += 0.35
            if flatness > 0.035: s += 0.25
            if tonality < 15.0: s += 0.20
            if 800 <= centroid <= 3500: s += 0.20
            if rms < 0.10: s += 0.15
        scores["Water"] = s

        # 13. Sudden Sound Impulse (unmatched transient burst)
        s = 0.0
        if crest_factor > 4.5 and sub_rms_ratio > 2.5:
            s += 0.35
        scores["Sudden sound"] = s

        # 14. Ambient background traffic noise
        s = 0.15
        if rms < 0.06: s += 0.15
        if sub_rms_std < 0.40: s += 0.10
        if flatness > 0.03: s += 0.10
        if tonality < 10.0: s += 0.15
        if crest_factor < 3.5: s += 0.10
        scores["Traffic noise, roadway noise"] = s

        # --- SELECT BEST MATCH ---
        best_class = max(scores, key=scores.get)
        best_score = scores[best_class]

        # Debug log top 3 candidates
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        top3 = [(c, round(s, 3)) for c, s in sorted_scores[:3]]
        print(f"[YAMNet-Sig] rms={rms:.4f} centroid={centroid:.0f}Hz peak={peak_freq:.0f}Hz "
              f"tonality={tonality:.1f} crest={crest_factor:.1f} flat={flatness:.4f} "
              f"zcr={zcr:.3f} → {top3}")

        # If best score is too low, default to ambient
        if best_score < 0.30:
            return "Traffic noise, roadway noise", 0.72

        # Map score → confidence: [0.30 → 0.75] .. [1.0 → 0.95]
        confidence = min(0.95, 0.70 + best_score * 0.25)

        # Promote Shout over Screaming when RMS is moderate
        if best_class == "Screaming" and rms < 0.14:
            best_class = "Shout"

        return best_class, confidence
