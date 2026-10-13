"""
GCC-PHAT Spatial Audio Direction & TDOA Localization Engine.
Computes Time Difference of Arrival (TDOA) across dual 48 kHz stereo channels
using FFT cross-power spectrum with PHAT whitening, IFFT peak lag search,
and angle theta = arccos(-c * tau / d) mapped to 8 compass zones.
Strictly distance-free: no amplitude-based distance estimation.
"""

import numpy as np
from typing import Tuple, Optional

def compute_gcc_phat(
    signal_left: np.ndarray,
    signal_right: np.ndarray,
    fs: int = 48000,
    d: float = 0.14,
    c: float = 343.0,
    max_tau: float = None,
    is_rear: Optional[bool] = None
) -> Tuple[float, float, float, str]:
    """
    Computes TDOA and directional angle theta using GCC-PHAT.
    
    Convention:
        tau > 0: Sound reached Left first, Right is delayed -> theta in (90°, 180°] (West / NW)
        tau = 0: Sound reached Left & Right simultaneously -> theta = 90° (North / Ahead)
        tau < 0: Sound reached Right first, Left is delayed -> theta in [0°, 90°) (East / NE)
    """
    if len(signal_left) != len(signal_right):
        min_len = min(len(signal_left), len(signal_right))
        signal_left = signal_left[:min_len]
        signal_right = signal_right[:min_len]
        
    n = len(signal_left)
    if n < 64:
        return 0.0, 90.0, 0.0, "N"
        
    n_fft = 2 * int(2 ** np.ceil(np.log2(n)))
    
    # 1. Discrete Fourier Transforms
    X_L = np.fft.rfft(signal_left, n=n_fft)
    X_R = np.fft.rfft(signal_right, n=n_fft)
    
    # 2. Cross-Power Spectrum: G_RL = X_R * conj(X_L)
    # With this definition, if right is delayed (x_R(t) = x_L(t - tau)),
    # X_R * conj(X_L) has positive phase slope -> peak at positive lag
    G_RL = X_R * np.conj(X_L)
    
    # 3. PHAT Whitening Transform
    eps = 1e-12
    psi = G_RL / (np.abs(G_RL) + eps)
    
    # 4. Inverse FFT to obtain GCC-PHAT in time domain
    cc = np.fft.irfft(psi, n=n_fft)
    
    max_physical_lag_s = (d / c) if max_tau is None else max_tau
    max_lag_samples = int(np.ceil(max_physical_lag_s * fs))
    
    # Slicing from -max_lag_samples to +max_lag_samples
    lags = np.arange(-max_lag_samples, max_lag_samples + 1)
    cc_slice = np.concatenate((cc[-max_lag_samples:], cc[:max_lag_samples + 1]))
    
    # 5. Search for peak lag
    peak_idx = int(np.argmax(cc_slice))
    peak_lag = lags[peak_idx]
    peak_val = float(cc_slice[peak_idx])
    
    mean_floor = float(np.mean(np.abs(cc_slice))) + eps
    raw_snr = peak_val / mean_floor
    confidence = float(np.clip((raw_snr - 1.0) / 10.0, 0.0, 1.0))
    
    # 6. TDOA in seconds
    tau_seconds = float(peak_lag / fs)
    
    # 7. Acoustic Arrival Angle theta:
    # tau > 0 (Left first) => arg < 0 => theta in (90°, 180°] (West / Left)
    # tau = 0 (Center) => arg = 0 => theta = 90° (North / Center)
    # tau < 0 (Right first) => arg > 0 => theta in [0°, 90°) (East / Right)
    arg = np.clip(- (c * tau_seconds) / d, -1.0, 1.0)
    theta_rad = float(np.arccos(arg))
    angle_deg = float(np.degrees(theta_rad))
    
    # Check for rear arrival (Behind / South hemisphere)
    if is_rear is True:
        # Reflect angle across 0-180 axis into [180°, 360°]
        angle_deg = (360.0 - angle_deg) % 360.0
    
    # 8. Compass Zone Mapping
    compass_zone = angle_to_compass_zone(angle_deg)
    
    return tau_seconds, angle_deg, confidence, compass_zone

def detect_rear_hemisphere(signal_left: np.ndarray, signal_right: np.ndarray, fs: int = 48000) -> bool:
    """
    Evaluates whether sound arrives from the rear of the phone using
    acoustic chassis diffraction and spectral high-frequency shadowing.
    Sounds originating behind the phone chassis suffer >6-12 dB diffraction attenuation
    in the 3.5 kHz - 9.0 kHz band relative to the 500 Hz - 2.5 kHz band.
    """
    mono = 0.5 * (signal_left + signal_right)
    if len(mono) < 128:
        return False
        
    n_fft = int(2 ** np.ceil(np.log2(len(mono))))
    spec = np.abs(np.fft.rfft(mono, n=n_fft))
    freqs = np.fft.rfftfreq(n_fft, d=1.0 / fs)
    
    # Reference band (500 Hz - 2500 Hz)
    mid_mask = (freqs >= 500) & (freqs <= 2500)
    # Chassis-shadowed high-frequency band (3500 Hz - 9000 Hz)
    high_mask = (freqs >= 3500) & (freqs <= 9000)
    
    e_mid = float(np.sum(spec[mid_mask] ** 2)) + 1e-12
    e_high = float(np.sum(spec[high_mask] ** 2)) + 1e-12
    
    ratio = e_high / e_mid
    # Rear sound exhibits low HF/MF energy ratio due to physical body shadowing
    return ratio < 0.085

def angle_to_compass_zone(angle_deg: float) -> str:
    """
    Maps arrival angle theta [0° - 360°] to standard 8 compass zones.
    0° / 360° = East (Right)
    45° = North-East (Front-Right)
    90° = North (Center / Straight Ahead)
    135° = North-West (Front-Left)
    180° = West (Left)
    225° = South-West (Back-Left)
    270° = South (Behind / Back)
    315° = South-East (Back-Right)
    """
    deg = float(angle_deg) % 360.0
    if deg < 22.5 or deg >= 337.5:
        return "E"
    elif deg < 67.5:
        return "NE"
    elif deg < 112.5:
        return "N"
    elif deg < 157.5:
        return "NW"
    elif deg < 202.5:
        return "W"
    elif deg < 247.5:
        return "SW"
    elif deg < 292.5:
        return "S"
    else:
        return "SE"

def simulate_stereo_delay(
    mono_signal: np.ndarray,
    delay_samples: int
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Synthetic stereo delay injector for single-microphone development or automated tests.
    delay_samples > 0: Right channel delayed (Sound from Left/West).
    delay_samples < 0: Left channel delayed (Sound from Right/East).
    delay_samples == 0: Broadside arrival (Straight ahead / North).
    """
    n = len(mono_signal)
    left = np.zeros(n, dtype=np.float32)
    right = np.zeros(n, dtype=np.float32)
    
    abs_delay = abs(delay_samples)
    if delay_samples > 0:
        # Left arrives first, Right delayed
        left[:n - abs_delay] = mono_signal[:n - abs_delay]
        right[abs_delay:] = mono_signal[:n - abs_delay]
    elif delay_samples < 0:
        # Right arrives first, Left delayed
        right[:n - abs_delay] = mono_signal[:n - abs_delay]
        left[abs_delay:] = mono_signal[:n - abs_delay]
    else:
        left[:] = mono_signal[:]
        right[:] = mono_signal[:]
        
    return left, right
