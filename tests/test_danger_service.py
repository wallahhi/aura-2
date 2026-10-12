"""
Unit tests for the DangerEngine, composite scoring, cooldown, hysteresis, and NIOSH dose.
"""

import time
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app.core.danger_service import DangerEngine

def test_danger_formula_calculation():
    """Verify exact 4-factor math: D = 0.45*St + 0.35*Si + 0.10*Sa + 0.10*Sc"""
    engine = DangerEngine()
    engine.update_context(70.0)  # S_context = 70.0
    
    # Siren has S_type = 100.0
    # 85 dB SPL gives S_intensity = (85 - 40)/60 * 100 = 75.0
    # Provide two readings to establish a surging delta dB/dt >= 3.0 (S_approach = 100.0)
    engine.evaluate("Siren", confidence=0.85, db_spl=75.0)
    time.sleep(0.15)
    state, is_new_alert = engine.evaluate("Siren", confidence=0.88, db_spl=85.0)
    
    # Expected D = 0.45 * 100 + 0.35 * 75 + 0.10 * 100 + 0.10 * 70 = 45 + 26.25 + 10 + 7 = 88.25
    assert abs(state.score - 88.25) < 1.0
    assert state.level == "DANGER"
    assert state.color == "#EF4444"

def test_per_class_cooldown():
    """Verify 5-second per-class cooldown and surge override."""
    engine = DangerEngine(cooldown_sec=3.0)
    
    # 1. First trigger emits alert
    _, alert1 = engine.evaluate("Car horn", confidence=0.80, db_spl=75.0)
    assert alert1 is True
    
    # 2. Immediate second trigger is suppressed
    _, alert2 = engine.evaluate("Car horn", confidence=0.82, db_spl=76.0)
    assert alert2 is False
    
    # 3. Third trigger with significant intensity spike (>10 dB) overrides cooldown
    _, alert3 = engine.evaluate("Car horn", confidence=0.85, db_spl=88.0)
    assert alert3 is True

def test_hysteresis_filter():
    """Verify upward escalation is immediate and downward requires sustained duration."""
    engine = DangerEngine(hysteresis_sec=0.5, hysteresis_delta_pts=5.0)
    
    # Jump directly into DANGER (raw score >= 76)
    state1, _ = engine.evaluate("Siren", confidence=0.90, db_spl=90.0)
    assert state1.level == "DANGER"
    
    # Sudden drop to 40 dB ambient (raw score drops into SAFE)
    state2, _ = engine.evaluate("Silence", confidence=0.90, db_spl=40.0)
    # Hysteresis must keep it in DANGER during the initial drop
    assert state2.level == "DANGER"
    
    # Wait for hysteresis duration to expire
    time.sleep(0.6)
    state3, _ = engine.evaluate("Silence", confidence=0.90, db_spl=40.0)
    # Now it de-escalates cleanly
    assert state3.level == "SAFE"

def test_niosh_dose_accumulation():
    """Verify NIOSH cumulative dose increments for loud noise."""
    engine = DangerEngine()
    engine.evaluate("Traffic noise, roadway noise", confidence=0.90, db_spl=95.0)
    time.sleep(0.2)
    state, _ = engine.evaluate("Traffic noise, roadway noise", confidence=0.90, db_spl=95.0)
    assert state.noise_dose > 0.0

if __name__ == "__main__":
    test_danger_formula_calculation()
    test_per_class_cooldown()
    test_hysteresis_filter()
    test_niosh_dose_accumulation()
    print("All DangerEngine tests passed successfully!")
