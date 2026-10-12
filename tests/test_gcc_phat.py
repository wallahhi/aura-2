"""
Unit tests for GCC-PHAT TDOA and directional angle estimation.
"""

import numpy as np
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app.core.gcc_phat import compute_gcc_phat, simulate_stereo_delay, angle_to_compass_zone

def test_gcc_phat_broadside_center():
    """Verify that identical left and right channels yield tau=0, theta=90° (North)."""
    fs = 48000
    t = np.linspace(0, 0.1, int(fs * 0.1), endpoint=False)
    # Bandpass pulse (e.g. 500 Hz to 2000 Hz)
    sig = np.sin(2 * np.pi * 1000 * t) * np.hanning(len(t))
    
    tau, angle, conf, zone = compute_gcc_phat(sig, sig, fs=fs, d=0.14)
    
    assert abs(tau) < 1e-5
    assert abs(angle - 90.0) < 1.0
    assert zone == "N"
    assert conf > 0.5

def test_gcc_phat_positive_delay_west():
    """Verify sound reaching Left first yields tau > 0, angle > 90° (NW/W)."""
    fs = 48000
    d = 0.14
    c = 343.0
    t = np.linspace(0, 0.1, int(fs * 0.1), endpoint=False)
    sig = np.sin(2 * np.pi * 800 * t) * np.hanning(len(t))
    
    # Introduce +8 samples delay on right channel
    delay_samples = 8
    left, right = simulate_stereo_delay(sig, delay_samples)
    
    tau, angle, conf, zone = compute_gcc_phat(left, right, fs=fs, d=d, c=c)
    
    expected_tau = delay_samples / fs
    expected_angle = float(np.degrees(np.arccos(np.clip(- (c * expected_tau / d), -1.0, 1.0))))
    
    assert abs(tau - expected_tau) < (1.0 / fs)  # Within 1 sample precision
    assert abs(angle - expected_angle) < 3.0
    assert angle > 90.0
    assert zone in ["NW", "W"]

def test_gcc_phat_negative_delay_east():
    """Verify sound reaching Right first yields tau < 0, angle < 90° (NE/E)."""
    fs = 48000
    d = 0.14
    c = 343.0
    t = np.linspace(0, 0.1, int(fs * 0.1), endpoint=False)
    sig = np.sin(2 * np.pi * 1200 * t) * np.hanning(len(t))
    
    # Introduce -8 samples delay (Right channel arrives first)
    delay_samples = -8
    left, right = simulate_stereo_delay(sig, delay_samples)
    
    tau, angle, conf, zone = compute_gcc_phat(left, right, fs=fs, d=d, c=c)
    
    expected_tau = delay_samples / fs
    expected_angle = float(np.degrees(np.arccos(np.clip(- (c * expected_tau / d), -1.0, 1.0))))
    
    assert abs(tau - expected_tau) < (1.0 / fs)
    assert abs(angle - expected_angle) < 3.0
    assert angle < 90.0
    assert zone in ["NE", "E"]

def test_compass_zone_boundaries():
    """Verify exact 8-octant compass boundaries."""
    assert angle_to_compass_zone(10.0) == "E"
    assert angle_to_compass_zone(45.0) == "NE"
    assert angle_to_compass_zone(90.0) == "N"
    assert angle_to_compass_zone(135.0) == "NW"
    assert angle_to_compass_zone(175.0) == "W"

if __name__ == "__main__":
    test_gcc_phat_broadside_center()
    test_gcc_phat_positive_delay_west()
    test_gcc_phat_negative_delay_east()
    test_compass_zone_boundaries()
    print("All GCC-PHAT tests passed successfully!")
