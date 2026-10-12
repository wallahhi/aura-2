"""
Distance-Free Danger Scoring & Safety Engine for SoundSense.
Implements the 4-factor composite formula:
D = 0.45 * S_type + 0.35 * S_intensity + 0.10 * S_approach_dB + 0.10 * S_context
With 5-second per-class cooldown, 3-second hysteresis filter (+5 pts),
parallel NIOSH noise dose tracking, and 10-second cancelable SOS trigger logic.
Strictly distance-free: no amplitude-based distance estimation.
"""

import time
from collections import deque
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from app.core.sound_ontology import get_sound_info, Priority

@dataclass
class DangerFactors:
    type_score: float        # S_type [0 - 100]
    intensity_score: float   # S_intensity [0 - 100]
    approach_score: float    # S_approach_dB [0 - 100]
    context_score: float     # S_context [0 - 100]
    db_spl: float            # Measured dB SPL
    delta_db_per_sec: float  # Intensity slope dB/s

@dataclass
class DangerState:
    score: float             # Composite danger score D [0 - 100]
    raw_score: float         # Pre-hysteresis score
    level: str               # "SAFE", "AWARE", "CAUTION", "DANGER"
    color: str               # Semantic color code
    factors: DangerFactors
    noise_dose: float        # Cumulative NIOSH dose [0.0 - 1.0+]
    sos_auto_triggered: bool # True if D >= 90 sustained
    countdown_seconds: int = 10

class DangerEngine:
    def __init__(
        self,
        cooldown_sec: float = 5.0,
        hysteresis_sec: float = 3.0,
        hysteresis_delta_pts: float = 5.0,
        sos_threshold: float = 90.0,
        sos_sustained_sec: float = 3.0
    ):
        self.cooldown_sec = cooldown_sec
        self.hysteresis_sec = hysteresis_sec
        self.hysteresis_delta_pts = hysteresis_delta_pts
        self.sos_threshold = sos_threshold
        self.sos_sustained_sec = sos_sustained_sec
        
        # State tracking
        self.current_score: float = 0.0
        self.current_level: str = "SAFE"
        self.level_candidates: deque = deque()  # (timestamp, candidate_score)
        
        # Cooldown state: class_name -> {"timestamp": float, "confidence": float, "db_spl": float}
        self.class_cooldowns: Dict[str, Dict[str, float]] = {}
        
        # Intensity history for delta dB / dt (timestamp, db_spl)
        self.intensity_history: deque = deque()
        
        # NIOSH noise dose tracking (cumulative)
        self.cumulative_noise_dose: float = 0.0
        self.last_dose_update_time: float = time.time()
        
        # High danger sustained tracking for SOS
        self.high_danger_start_time: Optional[float] = None
        self.sos_active: bool = False
        
        # Context score default
        self.current_context_score: float = 50.0  # Urban/pedestrian baseline

    def update_context(self, context_score: float):
        """Set environmental context score (e.g. 25=Home, 50=Sidewalk, 70=Busy Road)."""
        self.current_context_score = float(max(0.0, min(100.0, context_score)))

    def calculate_intensity_score(self, db_spl: float) -> Tuple[float, float]:
        """
        Calculates S_intensity and rolling delta dB / dt approach rate.
        S_intensity = clip((dB_SPL - 40) / (100 - 40) * 100, 0, 100)
        """
        now = time.time()
        s_intensity = float(max(0.0, min(100.0, ((db_spl - 40.0) / 60.0) * 100.0)))
        
        # Update rolling intensity history (keep last 3.0 seconds)
        self.intensity_history.append((now, db_spl))
        while self.intensity_history and (now - self.intensity_history[0][0]) > 3.0:
            self.intensity_history.popleft()
            
        # Compute delta dB / dt
        if len(self.intensity_history) >= 2:
            oldest_time, oldest_db = self.intensity_history[0]
            dt = max(0.1, now - oldest_time)
            delta_db_per_sec = (db_spl - oldest_db) / dt
        else:
            delta_db_per_sec = 0.0
            
        # Map approach rate to S_approach_dB
        if delta_db_per_sec >= 3.0:
            s_approach = 100.0  # Surging / rapidly approaching
        elif delta_db_per_sec >= 1.0:
            s_approach = 75.0   # Moderately approaching
        elif delta_db_per_sec >= -1.0:
            s_approach = 50.0   # Stationary
        else:
            s_approach = 15.0   # Receding
            
        return s_intensity, s_approach, delta_db_per_sec

    def update_niosh_dose(self, db_spl: float):
        """
        Calculates parallel NIOSH cumulative noise dose.
        T(L) = 8 / (2 ** ((L - 85) / 3)) hours
        Dose += (dt_hours / T) * 100%
        """
        now = time.time()
        dt_seconds = max(0.0, now - self.last_dose_update_time)
        self.last_dose_update_time = now
        
        if dt_seconds > 0.0 and db_spl > 70.0:
            dt_hours = dt_seconds / 3600.0
            # NIOSH reference duration in hours
            allowed_hours = 8.0 / (2.0 ** ((db_spl - 85.0) / 3.0))
            dose_increment = dt_hours / max(0.0001, allowed_hours)
            self.cumulative_noise_dose += dose_increment

    def check_cooldown(self, sound_class: str, confidence: float, db_spl: float) -> bool:
        """
        Checks 5-second per-class cooldown.
        Returns True if sound should trigger an alert, False if suppressed.
        Override cooldown if confidence jumps > 0.15 or intensity spikes > 10 dB.
        """
        now = time.time()
        if sound_class not in self.class_cooldowns:
            self.class_cooldowns[sound_class] = {"timestamp": now, "confidence": confidence, "db_spl": db_spl}
            return True
            
        last = self.class_cooldowns[sound_class]
        elapsed = now - last["timestamp"]
        conf_diff = confidence - last["confidence"]
        db_diff = db_spl - last["db_spl"]
        
        # Override cooldown if significant surge
        if elapsed < self.cooldown_sec:
            if conf_diff > 0.15 or db_diff > 10.0:
                self.class_cooldowns[sound_class] = {"timestamp": now, "confidence": confidence, "db_spl": db_spl}
                return True
            return False
            
        self.class_cooldowns[sound_class] = {"timestamp": now, "confidence": confidence, "db_spl": db_spl}
        return True

    def evaluate(
        self,
        sound_class: str,
        confidence: float,
        db_spl: float
    ) -> Tuple[DangerState, bool]:
        """
        Evaluates the danger score, applies hysteresis and cooldown,
        and checks for sustained high-danger SOS triggering.
        
        Returns:
            danger_state: Current processed DangerState
            is_new_alert: Boolean indicating if this sound should emit an alert
        """
        now = time.time()
        
        # 1. Sound Type Severity
        sound_info = get_sound_info(sound_class)
        s_type = sound_info.s_type
        
        # 2. Intensity & Approach Rate
        s_intensity, s_approach, delta_db_per_sec = self.calculate_intensity_score(db_spl)
        
        # 3. Context Score
        s_context = self.current_context_score
        
        # 4. Composite 4-Factor Danger Score
        # D = 0.45 * S_type + 0.35 * S_intensity + 0.10 * S_approach_dB + 0.10 * S_context
        raw_d = (
            0.45 * s_type +
            0.35 * s_intensity +
            0.10 * s_approach +
            0.10 * s_context
        )
        raw_d = float(max(0.0, min(100.0, raw_d)))
        
        # 5. Cooldown check for sound event
        is_new_alert = self.check_cooldown(sound_class, confidence, db_spl)
        
        # 6. NIOSH dose update
        self.update_niosh_dose(db_spl)
        
        # 7. Apply 3-Second Hysteresis Filter (+5 pts)
        filtered_score, current_level = self._apply_hysteresis(raw_d, now)
        self.current_score = filtered_score
        self.current_level = current_level
        
        # 8. Check for SOS Trigger (D >= 90 sustained for 3.0 seconds)
        sos_auto_triggered = False
        if filtered_score >= self.sos_threshold:
            if self.high_danger_start_time is None:
                self.high_danger_start_time = now
            elif (now - self.high_danger_start_time) >= self.sos_sustained_sec:
                sos_auto_triggered = True
                self.sos_active = True
        else:
            self.high_danger_start_time = None
            
        color = self._level_to_color(current_level)
        
        state = DangerState(
            score=round(filtered_score, 1),
            raw_score=round(raw_d, 1),
            level=current_level,
            color=color,
            factors=DangerFactors(
                type_score=round(s_type, 1),
                intensity_score=round(s_intensity, 1),
                approach_score=round(s_approach, 1),
                context_score=round(s_context, 1),
                db_spl=round(db_spl, 1),
                delta_db_per_sec=round(delta_db_per_sec, 2)
            ),
            noise_dose=round(self.cumulative_noise_dose, 5),
            sos_auto_triggered=sos_auto_triggered,
            countdown_seconds=10
        )
        
        return state, is_new_alert

    def _apply_hysteresis(self, raw_score: float, now: float) -> Tuple[float, str]:
        """
        Hysteresis filter:
        Levels:
          SAFE: 0 - 25
          AWARE: 26 - 50
          CAUTION: 51 - 75
          DANGER: 76 - 100
        Upward escalation is immediate.
        Downward de-escalation requires raw_score < (threshold - 5) for 3 consecutive seconds.
        """
        # Determine candidate level from raw score
        if raw_score >= 76.0:
            candidate_level = "DANGER"
        elif raw_score >= 51.0:
            candidate_level = "CAUTION"
        elif raw_score >= 26.0:
            candidate_level = "AWARE"
        else:
            candidate_level = "SAFE"
            
        level_ranks = {"SAFE": 0, "AWARE": 1, "CAUTION": 2, "DANGER": 3}
        current_rank = level_ranks[self.current_level]
        candidate_rank = level_ranks[candidate_level]
        
        # Upward escalation: immediate
        if candidate_rank > current_rank:
            self.level_candidates.clear()
            return raw_score, candidate_level
            
        # Same level: update score directly
        if candidate_rank == current_rank:
            self.level_candidates.clear()
            return raw_score, self.current_level
            
        # Downward de-escalation: requires score < (level_min_threshold - delta) sustained for 3.0s
        thresholds = {"DANGER": 76.0, "CAUTION": 51.0, "AWARE": 26.0, "SAFE": 0.0}
        curr_min = thresholds[self.current_level]
        deescalation_target = curr_min - self.hysteresis_delta_pts
        
        if raw_score <= deescalation_target:
            self.level_candidates.append((now, candidate_level, raw_score))
            # Check duration of candidates
            earliest_time = self.level_candidates[0][0]
            if (now - earliest_time) >= self.hysteresis_sec:
                # Sustained downward transition confirmed
                self.level_candidates.clear()
                return raw_score, candidate_level
        else:
            # Score fluctuated back up within hysteresis band, cancel downward candidate
            self.level_candidates.clear()
            
        # Retain current level during hysteresis transition
        return max(curr_min, raw_score), self.current_level

    @staticmethod
    def _level_to_color(level: str) -> str:
        """Light-theme high-contrast semantic colors."""
        if level == "SAFE":
            return "#10B981"    # Sage Green
        elif level == "AWARE":
            return "#F59E0B"    # Amber
        elif level == "CAUTION":
            return "#F97316"    # Warm Orange
        else:
            return "#EF4444"    # Crimson Red
