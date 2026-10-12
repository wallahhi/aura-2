/**
 * SoundSense Mobile Application Bootstrap.
 * Connects WebSocket, AudioCapture, State, and UI Components.
 */

import { appState } from "./state.js";
import { SoundSenseWebSocketClient } from "./network/websocket_client.js";
import { AudioCaptureService } from "./audio/audio_capture.js";
import { initTopStatus } from "./components/top_status.js";
import { initCompass } from "./components/compass.js";
import { initTranscriptFeed } from "./components/transcript_feed.js";
import { initSettingsModal } from "./components/settings_modal.js";
import { initSosModal } from "./components/sos_modal.js";
import { initSimulatorBar } from "./components/simulator_bar.js";

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize WebSocket Connection
  const wsClient = new SoundSenseWebSocketClient();
  wsClient.connect();

  // 2. Initialize Audio Capture Engine
  const audioCapture = new AudioCaptureService(wsClient);

  // 3. Mount UI Components
  const topStatusContainer = document.getElementById("top-status-mount");
  const compassContainer = document.getElementById("compass-mount");
  const transcriptContainer = document.getElementById("transcript-mount");
  const settingsModalContainer = document.getElementById("settings-modal-mount");
  const sosModalContainer = document.getElementById("sos-modal-mount");
  const simBarContainer = document.getElementById("simulator-bar-mount");

  // Mount Settings Modal
  const settingsSheet = initSettingsModal(settingsModalContainer, (updatedSettings) => {
    wsClient.sendConfigUpdate({
      rms_threshold: updatedSettings.thresholdX,
      mic_spacing_m: updatedSettings.micSpacingD,
      openai_key: updatedSettings.apiKey
    });
  });

  // Mount Top Status
  initTopStatus(topStatusContainer, () => {
    settingsSheet.open();
  });

  // Mount Center Compass
  initCompass(compassContainer);

  // Mount Live Transcript Feed
  initTranscriptFeed(transcriptContainer);

  // Mount SOS Modal with Countdown Engine
  let countdownTimer = null;
  initSosModal(
    sosModalContainer,
    // On Cancel
    () => {
      if (countdownTimer) clearInterval(countdownTimer);
      appState.cancelSos();
      wsClient.sendSosAction("cancel");
    },
    // On Countdown Complete
    () => {
      console.log("[SOS] Countdown finished. Incident persisted.");
    }
  );

  // Handle SOS Countdown ticks
  appState.subscribe(state => {
    if (state.isSosActive && !countdownTimer) {
      countdownTimer = setInterval(() => {
        const curState = appState.get();
        if (!curState.isSosActive) {
          clearInterval(countdownTimer);
          countdownTimer = null;
          return;
        }

        const newCount = curState.sosCountdown - 1;
        if (newCount <= 0) {
          clearInterval(countdownTimer);
          countdownTimer = null;
          appState.set({ sosCountdown: 0 });
          // Persist incident log
          const incident = {
            id: Date.now(),
            dangerScore: curState.dangerScore,
            dangerLevel: curState.dangerLevel,
            timestamp: new Date().toISOString()
          };
          const logs = JSON.parse(localStorage.getItem("soundsense_sos_logs") || "[]");
          logs.unshift(incident);
          localStorage.setItem("soundsense_sos_logs", JSON.stringify(logs.slice(0, 20)));
          alert("Emergency alert dispatched to contacts!");
        } else {
          appState.set({ sosCountdown: newCount });
        }
      }, 1000);
    } else if (!state.isSosActive && countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  });

  // Mount Developer Simulator Bar
  initSimulatorBar(
    simBarContainer,
    // onTriggerSynthetic
    (soundClass, delaySamples, dbSpl, confidence, text) => {
      wsClient.sendSyntheticTrigger(soundClass, delaySamples, dbSpl, confidence, text);
    },
    // onToggleMic
    async (btnEl) => {
      if (!audioCapture.isCapturing) {
        const started = await audioCapture.start();
        if (started) {
          btnEl.textContent = "Stop Mic";
          btnEl.style.backgroundColor = "var(--status-danger-bg)";
          btnEl.style.color = "var(--status-danger-text)";
        }
      } else {
        audioCapture.stop();
        btnEl.textContent = "Start Mic (48kHz)";
        btnEl.style.backgroundColor = "var(--bg-subtle)";
        btnEl.style.color = "var(--text-primary)";
      }
    }
  );

  console.log("[SoundSense] Mobile client mounted cleanly.");
});
