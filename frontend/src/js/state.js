/**
 * SoundSense Reactive Application State.
 * Provides observable state and local storage persistence.
 */

class AppState {
  constructor() {
    this.listeners = new Set();

    // Default configuration with LocalStorage fallback
    const savedSettings = this._loadSettings();

    this.state = {
      // Network & Hardware Status
      connectionStatus: "connecting", // "connected" | "connecting" | "offline"
      audioState: "16kHz_idle",        // "16kHz_idle" | "48kHz_active"
      isListening: false,
      rms: 0.0,
      dbSpl: 30.0,

      // Safety & Danger Engine State
      dangerScore: 0.0,
      dangerLevel: "SAFE",             // "SAFE" | "AWARE" | "CAUTION" | "DANGER"
      dangerColor: "#10B981",
      dangerFactors: {
        type_score: 0,
        intensity_score: 0,
        approach_score: 0,
        context_score: 50,
        delta_db_per_sec: 0
      },
      noiseDose: 0.0,

      // Spatial Acoustic State
      activeSound: null,               // { class, display_name, confidence, priority, angle_deg, compass_zone, timestamp }
      
      // Live Speech Transcript
      transcripts: [],

      // SOS Emergency State
      isSosActive: false,
      sosCountdown: 10,
      sosTimerId: null,

      // Persistent Settings
      settings: savedSettings
    };
  }

  get() {
    return this.state;
  }

  set(partialState) {
    this.state = { ...this.state, ...partialState };
    this._notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error("[State] Listener error:", err);
      }
    }
  }

  updateSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    localStorage.setItem("soundsense_settings", JSON.stringify(this.state.settings));
    this._notify();
  }

  _loadSettings() {
    try {
      const data = localStorage.getItem("soundsense_settings");
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("[State] Could not parse stored settings:", e);
    }
    return {
      apiKey: "",
      thresholdX: 0.015,       // RMS ~ -36 dBFS
      micSpacingD: 0.14,       // 14 cm
      contextScore: 50.0,
      emergencyContacts: [
        { name: "Dr. Sarah Adams", phone: "+1 (555) 019-2831", relationship: "Primary Physician" },
        { name: "David Chen", phone: "+1 (555) 018-9922", relationship: "Family" }
      ]
    };
  }

  addTranscript(item) {
    const transcripts = [item, ...this.state.transcripts].slice(0, 50);
    this.set({ transcripts });
  }

  clearTranscripts() {
    this.set({ transcripts: [] });
  }

  triggerSos(countdown = 10) {
    if (this.state.isSosActive) return;
    this.set({ isSosActive: true, sosCountdown: countdown });
  }

  cancelSos() {
    if (this.state.sosTimerId) {
      clearInterval(this.state.sosTimerId);
    }
    this.set({ isSosActive: false, sosCountdown: 10, sosTimerId: null });
  }
}

export const appState = new AppState();
