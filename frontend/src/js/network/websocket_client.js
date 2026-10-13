/**
 * SoundSense WebSocket Client.
 * Bidirectional low-latency connection to FastAPI /ws/audio-stream.
 * Implements automatic reconnection with exponential backoff.
 */

import { appState } from "../state.js";

export class SoundSenseWebSocketClient {
  constructor(wsUrl = null) {
    this.wsUrl = wsUrl || this._getDefaultWsUrl();
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 10000;
    this.isExplicitlyClosed = false;
    this.listeners = new Map();
  }

  _getDefaultWsUrl() {
    const loc = window.location;
    const proto = loc.protocol === "https:" ? "wss:" : "ws:";
    const host = loc.hostname || "localhost";
    const portStr = loc.port ? `:${loc.port}` : "";
    return `${proto}//${host}${portStr}/ws/audio-stream`;
  }

  connect() {
    this.isExplicitlyClosed = false;
    appState.set({ connectionStatus: "connecting" });

    try {
      this.socket = new WebSocket(this.wsUrl);

      this.socket.onopen = () => {
        console.log("[WebSocket] Connected to backend:", this.wsUrl);
        this.reconnectAttempts = 0;
        appState.set({ connectionStatus: "connected" });
        this._emit("open");
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleMessage(msg);
        } catch (e) {
          console.error("[WebSocket] Failed to parse message:", e);
        }
      };

      this.socket.onclose = () => {
        if (!this.isExplicitlyClosed) {
          console.warn("[WebSocket] Disconnected. Scheduling reconnect...");
          appState.set({ connectionStatus: "offline" });
          this._scheduleReconnect();
        }
      };

      this.socket.onerror = (err) => {
        console.error("[WebSocket] Error occurred:", err);
      };
    } catch (err) {
      console.error("[WebSocket] Connection attempt failed:", err);
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.connect();
      }
    }, delay);
  }

  _handleMessage(msg) {
    const type = msg.type;

    if (type === "connected") {
      console.log("[WebSocket] Handshake confirmed. Session:", msg.session_id);
    } else if (type === "status") {
      appState.set({
        audioState: msg.state,
        rms: msg.rms,
        dbSpl: msg.db_spl
      });
    } else if (type === "sound_event") {
      appState.set({
        activeSound: {
          class: msg.class,
          display_name: msg.display_name,
          confidence: msg.confidence,
          priority: msg.priority,
          angle_deg: msg.angle_deg,
          compass_zone: msg.compass_zone,
          haptic_pattern: msg.haptic_pattern,
          timestamp: msg.timestamp
        }
      });
      this._triggerHaptic(msg.haptic_pattern);
    } else if (type === "danger_update") {
      appState.set({
        dangerScore: msg.score,
        dangerLevel: msg.level,
        dangerColor: msg.color,
        dangerFactors: msg.factors,
        noiseDose: msg.noise_dose
      });
    } else if (type === "transcription") {
      appState.addTranscript({
        text: msg.text,
        speaker: msg.speaker,
        confidence: msg.confidence,
        timestamp: msg.timestamp
      });
      this._triggerHaptic("gentle_tap");
    } else if (type === "sos_auto_trigger") {
      appState.triggerSos(msg.countdown_seconds || 10);
    }

    this._emit(type, msg);
  }

  _triggerHaptic(pattern) {
    if (!navigator.vibrate) return;
    try {
      if (pattern === "3_strong") {
        navigator.vibrate([500, 200, 500, 200, 500]);
      } else if (pattern === "2_medium") {
        navigator.vibrate([300, 200, 300]);
      } else if (pattern === "1_short") {
        navigator.vibrate(200);
      } else {
        navigator.vibrate(50);
      }
    } catch (e) {
      // Haptics might be blocked without user gesture
    }
  }

  send(obj) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(obj));
    }
  }

  sendAudioChunk(b64Data, fs = 48000, channels = 2, seq = 0) {
    this.send({
      type: "audio_chunk",
      data: b64Data,
      fs,
      channels,
      seq,
      timestamp: Date.now() / 1000
    });
  }

  sendSyntheticTrigger(soundClass, delaySamples, dbSpl, confidence, text, isRear = false) {
    this.send({
      type: "synthetic_trigger",
      sound_class: soundClass,
      delay_samples: delaySamples,
      db_spl: dbSpl,
      confidence,
      text,
      is_rear: isRear
    });
  }

  sendConfigUpdate(config) {
    this.send({
      type: "config_update",
      ...config
    });
  }

  sendSosAction(action) {
    this.send({
      type: "sos_action",
      action
    });
  }

  on(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(handler);
  }

  _emit(eventType, data) {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      for (const h of handlers) h(data);
    }
  }
}
