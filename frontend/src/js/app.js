/**
 * AURA Application Bootstrap Entrypoint.
 * Mounts:
 * - WebSocket Client with auto-reconnection
 * - Stereo Audio Capture Service
 * - 3 Main Views: Home (Screen 1), History (Screen 3), Settings (Screen 2)
 * - Fixed Bottom Navigation Tab Switcher
 * - Modals: Cancelable SOS countdown & Evacuation Action Guide
 * - Developer Simulator Drawer for synthetic acoustic testing
 */

import { appState } from "./state.js";
import { SoundSenseWebSocketClient } from "./network/websocket_client.js";
import { AudioCaptureService } from "./audio/audio_capture.js";
import { initHomeView } from "./components/home_view.js";
import { initHistoryView } from "./components/history_view.js";
import { initSettingsView } from "./components/settings_view.js";
import { initModals } from "./components/modals.js";

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize WebSocket Connection to FastAPI Backend
  const wsClient = new SoundSenseWebSocketClient();
  wsClient.connect();

  // 2. Initialize Stereo Audio Capture Engine
  const audioCapture = new AudioCaptureService(wsClient);

  // 3. View Containers
  const homeViewEl = document.getElementById("home-view");
  const historyViewEl = document.getElementById("history-view");
  const settingsViewEl = document.getElementById("settings-view");
  const modalsMountEl = document.getElementById("modals-mount");

  // 4. Mount Components
  initHomeView(homeViewEl, audioCapture, wsClient);
  initHistoryView(historyViewEl);
  initSettingsView(settingsViewEl, wsClient);
  initModals(modalsMountEl, wsClient, audioCapture);

  // 5. Header State Synchronization
  const headerSubtitle = document.getElementById("aura-header-subtitle");
  const listeningPill = document.getElementById("header-listening-pill");
  const listeningText = document.getElementById("header-listening-text");

  // Live Clock Updater
  const clockEl = document.getElementById("current-clock");
  function updateClock() {
    const d = new Date();
    let hours = d.getHours();
    let minutes = d.getMinutes();
    if (minutes < 10) minutes = "0" + minutes;
    if (clockEl) clockEl.textContent = `${hours}:${minutes}`;
  }
  updateClock();
  setInterval(updateClock, 30000);

  // Quick settings and avatar buttons
  const quickSettingsBtn = document.getElementById("btn-quick-settings");
  if (quickSettingsBtn) {
    quickSettingsBtn.addEventListener("click", () => {
      appState.switchTab("settings");
    });
  }

  const avatarBtn = document.getElementById("btn-avatar-profile");
  if (avatarBtn) {
    avatarBtn.addEventListener("click", () => {
      appState.switchTab("settings");
    });
  }

  // 6. Bottom Navigation Tabs Handling
  const tabButtons = document.querySelectorAll(".nav-tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      appState.switchTab(targetTab);
    });
  });

  // 7. Subscribe to Reactive State Updates
  appState.subscribe(state => {
    // A. Switch Visible View Panel
    const curTab = state.currentTab || "home";
    [homeViewEl, historyViewEl, settingsViewEl].forEach(panel => panel.classList.remove("active"));

    if (curTab === "home") {
      homeViewEl.classList.add("active");
      if (headerSubtitle) headerSubtitle.textContent = "Sound Radar";
    } else if (curTab === "history") {
      historyViewEl.classList.add("active");
      if (headerSubtitle) headerSubtitle.textContent = "Sound History";
    } else if (curTab === "settings") {
      settingsViewEl.classList.add("active");
      if (headerSubtitle) headerSubtitle.textContent = "Haptic Settings";
    }

    // B. Update Bottom Nav Active Styling
    tabButtons.forEach(btn => {
      if (btn.getAttribute("data-tab") === curTab) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // C. Update Header Listening Pill
    if (listeningPill && listeningText) {
      if (state.isListening) {
        listeningPill.classList.remove("paused");
        listeningText.textContent = "LIVE LISTENING";
      } else {
        listeningPill.classList.add("paused");
        listeningText.textContent = "STANDBY";
      }
    }
  });

  // 8. Wire WebSocket Events to Application State
  wsClient.on("sound_event", (msg) => {
    console.log("[AURA] Incoming sound event:", msg.display_name, msg.compass_zone);
    appState.addSoundEvent(msg);
  });

  wsClient.on("danger_update", (msg) => {
    console.log("[AURA] Danger update received:", msg.level, msg.score);
    let statusText = "Safe Condition";
    if (msg.level === "DANGER") statusText = "High Hazard Active";
    else if (msg.level === "CAUTION") statusText = "Caution Advised";
    else if (msg.level === "AWARE") statusText = "Notice Active";

    appState.set({
      dangerScore: msg.score,
      dangerLevel: msg.level,
      dangerColor: msg.color,
      threatStatusText: statusText,
      dangerFactors: msg.factors,
      noiseDose: msg.noise_dose
    });
  });

  wsClient.on("transcription", (msg) => {
    console.log("[AURA] Live transcription:", msg.text);
    appState.addTranscript({
      text: msg.text,
      speaker: msg.speaker,
      confidence: msg.confidence,
      timestamp: msg.timestamp
    });
  });

  wsClient.on("sos_auto_trigger", (msg) => {
    console.warn("[AURA] SOS auto trigger invoked:", msg.reason);
    appState.triggerSos(msg.countdown_seconds || 10);
  });

  console.log("[AURA] Application mounted and ready for real-time operation.");
});
