"""
Audio Preprocessing Pipeline for SoundSense.
Performs 80 Hz high-pass Butterworth filtering, RMS amplitude & dB SPL computation,
STFT (25 ms Hann window, 10 ms hop size), and log-mel spectrogram generation.
"""

import base64
import numpy as np
from scipy import signal
from typing import Tuple, Dict, Any, Optional

class AudioPreprocessor:
    def __init__(self, hp_cutoff_hz: float = 80.0):
        self.hp_cutoff_hz = hp_cutoff_hz
        
        # Precompute 4th-order Butterworth high-pass filter for 16 kHz and 48 kHz
        self.sos_16k = signal.butter(4, hp_cutoff_hz, btype='highpass', fs=16000, output='sos')
        self.sos_48k = signal.butter(4, hp_cutoff_hz, btype='highpass', fs=48000, output='sos')

    def decode_pcm_bytes(
        self,
        b64_data: str,
        channels: int = 2
    ) -> Tuple[np.ndarray, Optional[np.ndarray], Optional[np.ndarray]]:
        """
        Decodes base64-encoded 16-bit little-endian PCM into normalized float32 arrays [-1.0, 1.0].
        Returns (ch1, ch2, ch3). If mono, ch2 and ch3 are None. If stereo, ch3 is None.
        """
        raw_bytes = base64.b64decode(b64_data)
        int16_samples = np.frombuffer(raw_bytes, dtype=np.int16)
        float_samples = int16_samples.astype(np.float32) / 32768.0
        
        if channels == 3:
            m1 = float_samples[0::3]
            m2 = float_samples[1::3]
            m3 = float_samples[2::3]
            return m1, m2, m3
        elif channels == 2:
            left = float_samples[0::2]
            right = float_samples[1::2]
            return left, right, None
        else:
            return float_samples, None, None

    def apply_highpass_filter(self, audio: np.ndarray, fs: int) -> np.ndarray:
        """Applies 80 Hz high-pass Butterworth filter."""
        if len(audio) < 16:
            return audio
        sos = self.sos_48k if fs >= 32000 else self.sos_16k
        return signal.sosfilt(sos, audio).astype(np.float32)

    def compute_rms_and_db(self, audio: np.ndarray) -> Tuple[float, float]:
        """
        Computes frame Root Mean Square (RMS) and calibrated dB SPL.
        Reference: 20 uPa (2e-5) in air.
        """
        if len(audio) == 0:
            return 0.0, 30.0
        rms = float(np.sqrt(np.mean(audio ** 2)))
        eps = 1e-9
        # Digital full scale to dB SPL calibration
        # RMS 1.0 (0 dBFS) ~ 100 dB SPL peak in phone calibration
        db_spl = float(np.clip(100.0 + 20.0 * np.log10(rms + eps), 30.0, 120.0))
        return rms, db_spl

    def compute_stft_mel(
        self,
        audio: np.ndarray,
        fs: int = 16000,
        n_mels: int = 64
    ) -> np.ndarray:
        """
        Computes STFT (25 ms Hann window, 10 ms hop size) and log-mel spectrogram.
        Compatible with YAMNet feature expectations.
        """
        win_length = int(fs * 0.025)  # 25 ms
        hop_length = int(fs * 0.010)  # 10 ms
        n_fft = 512
        
        # Spectrogram via Short-Time Fourier Transform
        frequencies, times, Zxx = signal.stft(
            audio,
            fs=fs,
            window='hann',
            nperseg=win_length,
            noverlap=win_length - hop_length,
            nfft=n_fft,
            boundary=None,
            padded=False
        )
        power_spec = np.abs(Zxx) ** 2
        
        # Mel filterbank
        mel_basis = self._create_mel_filterbank(fs, n_fft, n_mels)
        mel_spec = np.dot(mel_basis, power_spec[:mel_basis.shape[1], :])
        log_mel_spec = np.log(mel_spec + 1e-6)
        
        return log_mel_spec.astype(np.float32)

    def _create_mel_filterbank(self, fs: int, n_fft: int, n_mels: int) -> np.ndarray:
        """Constructs triangular Mel filterbank matrix."""
        low_freq = 125.0
        high_freq = float(fs) / 2.0
        
        # Mel scale conversion
        def hz_to_mel(hz):
            return 2595.0 * np.log10(1.0 + hz / 700.0)
            
        def mel_to_hz(mel):
            return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)
            
        low_mel = hz_to_mel(low_freq)
        high_mel = hz_to_mel(high_freq)
        mel_points = np.linspace(low_mel, high_mel, n_mels + 2)
        hz_points = mel_to_hz(mel_points)
        
        bin_points = np.floor((n_fft + 1) * hz_points / fs).astype(int)
        num_bins = n_fft // 2 + 1
        filterbank = np.zeros((n_mels, num_bins), dtype=np.float32)
        
        for m in range(1, n_mels + 1):
            f_m_minus = bin_points[m - 1]
            f_m = bin_points[m]
            f_m_plus = bin_points[m + 1]
            
            for k in range(f_m_minus, min(f_m, num_bins)):
                filterbank[m - 1, k] = (k - f_m_minus) / max(1, (f_m - f_m_minus))
            for k in range(f_m, min(f_m_plus, num_bins)):
                filterbank[m - 1, k] = (f_m_plus - k) / max(1, (f_m_plus - f_m))
                
        return filterbank
