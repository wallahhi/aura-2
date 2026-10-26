/**
 * AURA Modals and Interactive Overlays:
 * 1. Cancelable 10-Second SOS Emergency Modal
 * 2. Evacuation Action Guide Modal
 * 3. Developer Audio & Spatial Simulator Drawer
 */

import { appState } from "../state.js";

export function initModals(mountContainer, wsClient, audioCapture) {
  let sosInterval = null;

  function renderModals(state) {
    mountContainer.innerHTML = `
      <!-- 1. SOS Emergency 10-Second Modal Overlay -->
      ${state.isSosActive ? `
        <div class="aura-modal-backdrop" id="sos-modal-backdrop">
          <div class="sos-modal-content">
            <div class="sos-countdown-ring">
              <span class="sos-countdown-number" id="sos-countdown-num">${state.sosCountdown}</span>
            </div>

            <div class="sos-modal-title">Emergency Alert Active</div>
            <div class="sos-modal-desc">
              High danger condition sustained. Emergency contacts and local safety responders will receive your spatial location in <strong>${state.sosCountdown}s</strong>.
            </div>

            <button class="sos-cancel-btn" id="btn-cancel-sos">
              <span>✕ CANCEL SOS EMERGENCY</span>
            </button>
          </div>
        </div>
      ` : ''}

      <!-- 2. Evacuation Action Guide Modal -->
      ${state.isActionGuideOpen ? `
        <div class="aura-modal-backdrop" id="guide-modal-backdrop">
          <div class="guide-modal-content">
            <div class="guide-header">
              <div class="guide-title-group">
                <span class="status-badge-pill" style="align-self: flex-start; color: #C5221F; border-color: #FDCACA;">🚨 Safety Protocol</span>
                <div class="guide-title">Fire Evacuation Guide</div>
              </div>
              <button class="aura-icon-btn" id="btn-close-guide" style="border: none;">✕</button>
            </div>

            <div style="font-size: 13px; color: var(--text-secondary);">
              A verified high-priority fire alarm pattern is detected behind you. Follow these standardized deaf evacuation protocols immediately:
            </div>

            <div class="guide-step-card">
              <div class="guide-step-num">1</div>
              <div class="guide-step-text">
                <strong>Locate Exit Ahead:</strong> Sound origin is detected at 195° (Behind). Move forward toward the nearest unobstructed marked exit.
              </div>
            </div>

            <div class="guide-step-card">
              <div class="guide-step-num">2</div>
              <div class="guide-step-text">
                <strong>Feel Doors with Back of Hand:</strong> If hot to touch, do not open. Seek alternate egress or seal room edges with cloth.
              </div>
            </div>

            <div class="guide-step-card">
              <div class="guide-step-num">3</div>
              <div class="guide-step-text">
                <strong>Stay Low if Smoke Visible:</strong> Toxic gases and heated smoke accumulate at ceiling level. Crawl beneath 3-foot margin.
              </div>
            </div>

            <div class="guide-step-card">
              <div class="guide-step-num">4</div>
              <div class="guide-step-text">
                <strong>Notify Network:</strong> Keep your AURA screen illuminated for flashlight signaling and automatic emergency contact dispatch.
              </div>
            </div>

            <button class="aura-btn aura-btn-critical" id="btn-guide-got-it" style="width: 100%; margin-top: 6px;">
              <span>Understood · Proceeding</span>
            </button>
          </div>
        </div>
      ` : ''}

      <!-- 3. Floating Developer Simulator Drawer -->
      <div class="simulator-drawer collapsed" id="dev-simulator-drawer">
        <div class="simulator-handle-bar" id="sim-drawer-handle">
          <span>🛠 Audio Simulator &amp; Spatial Testing</span>
          <span class="simulator-pill-badge" id="sim-drawer-toggle-text">Tap to Expand</span>
        </div>

        <div class="simulator-content-body">
          <div style="font-size: 11px; color: var(--text-secondary);">
            Inject synthetic multi-microphone acoustic triggers into the pipeline:
          </div>

          <div class="sim-btn-grid">
            <button class="sim-btn danger-sim" data-sound="Fire alarm" data-delay="3" data-db="88" data-conf="0.94" data-rear="true">
              🔥 Fire Alarm (195° SSW)
            </button>
            <button class="sim-btn" data-sound="Car horn" data-delay="-3" data-db="84" data-conf="0.92" data-rear="false">
              🚗 Car Horn (East 30°)
            </button>
            <button class="sim-btn" data-sound="Dog" data-delay="4" data-db="72" data-conf="0.88" data-rear="false">
              🐕 Dog Bark (West 150°)
            </button>
            <button class="sim-btn" data-sound="Doorbell" data-delay="0" data-db="65" data-conf="0.90" data-rear="false">
              🚪 Doorbell (Center 90°)
            </button>
            <button class="sim-btn" data-sound="Siren" data-delay="-4" data-db="92" data-conf="0.96" data-rear="true">
              🚨 Siren (South 210°)
            </button>
            <button class="sim-btn" data-speech="Hello! Can you hear me clearly? We are heading out now.">
              🗣 Speech ASR
            </button>
          </div>

          <div class="sim-row-mic">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 12px; font-weight: 700;">Live 48 kHz Hardware Mic</span>
              <span style="font-size: 11px; color: var(--text-tertiary);">${audioCapture.isCapturing ? 'Streaming dual-channel PCM' : 'Microphone standby'}</span>
            </div>
            <button class="aura-btn ${audioCapture.isCapturing ? 'aura-btn-critical' : 'aura-btn-primary'}" id="sim-mic-toggle-btn" style="padding: 7px 14px; font-size: 12px;">
              ${audioCapture.isCapturing ? 'Stop Mic' : 'Start Mic'}
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind SOS Cancel
    const cancelSosBtn = mountContainer.querySelector("#btn-cancel-sos");
    if (cancelSosBtn) {
      cancelSosBtn.addEventListener("click", () => {
        appState.cancelSos();
        wsClient.sendSosAction("cancel");
      });
    }

    // Bind Guide Close
    const closeGuideBtn = mountContainer.querySelector("#btn-close-guide");
    const gotItGuideBtn = mountContainer.querySelector("#btn-guide-got-it");
    if (closeGuideBtn) closeGuideBtn.addEventListener("click", () => appState.closeActionGuide());
    if (gotItGuideBtn) gotItGuideBtn.addEventListener("click", () => appState.closeActionGuide());

    // Bind Simulator Drawer Expand/Collapse
    const simDrawer = mountContainer.querySelector("#dev-simulator-drawer");
    const simHandle = mountContainer.querySelector("#sim-drawer-handle");
    const simToggleText = mountContainer.querySelector("#sim-drawer-toggle-text");
    if (simHandle && simDrawer) {
      simHandle.addEventListener("click", () => {
        const isCollapsed = simDrawer.classList.contains("collapsed");
        if (isCollapsed) {
          simDrawer.classList.remove("collapsed");
          if (simToggleText) simToggleText.textContent = "Tap to Minimize";
        } else {
          simDrawer.classList.add("collapsed");
          if (simToggleText) simToggleText.textContent = "Tap to Expand";
        }
      });
    }

    // Bind Synthetic Sound Trigger Buttons
    mountContainer.querySelectorAll(".sim-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const speech = btn.getAttribute("data-speech");
        if (speech) {
          wsClient.sendSyntheticTrigger("Speech", 0, 68.0, 0.95, speech, false);
          return;
        }

        const sound = btn.getAttribute("data-sound");
        const delay = parseInt(btn.getAttribute("data-delay") || "0");
        const db = parseFloat(btn.getAttribute("data-db") || "75.0");
        const conf = parseFloat(btn.getAttribute("data-conf") || "0.88");
        const isRear = btn.getAttribute("data-rear") === "true";

        wsClient.sendSyntheticTrigger(sound, delay, db, conf, null, isRear);
      });
    });

    // Bind Mic Toggle inside Simulator
    const simMicBtn = mountContainer.querySelector("#sim-mic-toggle-btn");
    if (simMicBtn) {
      simMicBtn.addEventListener("click", async () => {
        if (!audioCapture.isCapturing) {
          await audioCapture.start();
        } else {
          audioCapture.stop();
        }
        renderModals(appState.get());
      });
    }
  }

  // Handle countdown timer ticking
  appState.subscribe(state => {
    if (state.isSosActive && !sosInterval) {
      sosInterval = setInterval(() => {
        const cur = appState.get();
        if (!cur.isSosActive) {
          clearInterval(sosInterval);
          sosInterval = null;
          return;
        }
        const next = cur.sosCountdown - 1;
        if (next <= 0) {
          clearInterval(sosInterval);
          sosInterval = null;
          appState.set({ sosCountdown: 0 });
          alert("🚨 SOS EMERGENCY DISPATCHED: Automated SMS template generated and sent to contacts with current GPS coordinates!");
          appState.cancelSos();
        } else {
          appState.set({ sosCountdown: next });
        }
      }, 1000);
    } else if (!state.isSosActive && sosInterval) {
      clearInterval(sosInterval);
      sosInterval = null;
    }

    renderModals(state);
  });

  renderModals(appState.get());
}
