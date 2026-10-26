/**
 * AURA Modals and Interactive Overlays:
 * 1. Cancelable 10-Second SOS Emergency Modal
 * 2. Evacuation Action Guide Modal
 * 3. Developer Audio & Spatial Simulator Drawer
 * 
 * Engineered with persistent DOM nodes so that continuous state updates
 * do not tear down the simulator drawer or interrupt user interactions.
 */

import { appState } from "../state.js";

export function initModals(mountContainer, wsClient, audioCapture) {
  let sosInterval = null;
  let isMounted = false;

  function mountSkeleton() {
    mountContainer.innerHTML = `
      <!-- 1. SOS Emergency 10-Second Modal Overlay -->
      <div class="aura-modal-backdrop" id="sos-modal-backdrop" style="display: none;">
        <div class="sos-modal-content">
          <div class="sos-countdown-ring">
            <span class="sos-countdown-number" id="sos-countdown-num">10</span>
          </div>

          <div class="sos-modal-title">Emergency Alert Active</div>
          <div class="sos-modal-desc">
            High danger condition sustained. Emergency contacts and local safety responders will receive your spatial location in <strong id="sos-countdown-text-bold">10s</strong>.
          </div>

          <button class="sos-cancel-btn" id="btn-cancel-sos" type="button">
            <span>✕ CANCEL SOS EMERGENCY</span>
          </button>
        </div>
      </div>

      <!-- 2. Evacuation Action Guide Modal -->
      <div class="aura-modal-backdrop" id="guide-modal-backdrop" style="display: none;">
        <div class="guide-modal-content">
          <div class="guide-header">
            <div class="guide-title-group">
              <span class="status-badge-pill" style="align-self: flex-start; color: #C5221F; border-color: #FDCACA;">🚨 Safety Protocol</span>
              <div class="guide-title">Fire Evacuation Guide</div>
            </div>
            <button class="aura-icon-btn" id="btn-close-guide" style="border: none;" type="button">✕</button>
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

          <button class="aura-btn aura-btn-critical" id="btn-guide-got-it" style="width: 100%; margin-top: 6px;" type="button">
            <span>Understood · Proceeding</span>
          </button>
        </div>
      </div>

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
            <button class="sim-btn danger-sim" data-sound="Fire alarm" data-delay="5" data-db="88" data-conf="0.94" data-rear="true" type="button">
              🔥 Fire Alarm (195° SSW)
            </button>
            <button class="sim-btn" data-sound="Car horn" data-delay="-14" data-db="84" data-conf="0.92" data-rear="false" type="button">
              🚗 Car Horn (45° NE · Right)
            </button>
            <button class="sim-btn" data-sound="Dog" data-delay="14" data-db="72" data-conf="0.88" data-rear="false" type="button">
              🐕 Dog Bark (315° NW · Left)
            </button>
            <button class="sim-btn" data-sound="Doorbell" data-delay="0" data-db="65" data-conf="0.90" data-rear="false" type="button">
              🚪 Doorbell (0° N · Ahead)
            </button>
            <button class="sim-btn" data-sound="Siren" data-delay="14" data-db="92" data-conf="0.96" data-rear="true" type="button">
              🚨 Siren (225° SW · Behind)
            </button>
            <button class="sim-btn" data-speech="Hello! Can you hear me clearly? We are heading out now." type="button">
              🗣 Speech ASR
            </button>
          </div>

          <div class="sim-row-mic">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 12px; font-weight: 700;">Live 48 kHz Hardware Mic</span>
              <span style="font-size: 11px; color: var(--text-tertiary);" id="sim-mic-status-label">${audioCapture.isCapturing ? 'Streaming dual-channel PCM' : 'Microphone standby'}</span>
            </div>
            <button class="aura-btn ${audioCapture.isCapturing ? 'aura-btn-critical' : 'aura-btn-primary'}" id="sim-mic-toggle-btn" style="padding: 7px 14px; font-size: 12px;" type="button">
              ${audioCapture.isCapturing ? 'Stop Mic' : 'Start Mic'}
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind SOS Cancel
    const cancelSosBtn = mountContainer.querySelector("#btn-cancel-sos");
    if (cancelSosBtn) {
      cancelSosBtn.addEventListener("click", (e) => {
        e.preventDefault();
        appState.cancelSos();
        wsClient.sendSosAction("cancel");
      });
    }

    // Bind Guide Close
    const closeGuideBtn = mountContainer.querySelector("#btn-close-guide");
    const gotItGuideBtn = mountContainer.querySelector("#btn-guide-got-it");
    if (closeGuideBtn) {
      closeGuideBtn.addEventListener("click", (e) => {
        e.preventDefault();
        appState.closeActionGuide();
      });
    }
    if (gotItGuideBtn) {
      gotItGuideBtn.addEventListener("click", (e) => {
        e.preventDefault();
        appState.closeActionGuide();
      });
    }

    // Bind Simulator Drawer Expand/Collapse
    const simDrawer = mountContainer.querySelector("#dev-simulator-drawer");
    const simHandle = mountContainer.querySelector("#sim-drawer-handle");
    const simToggleText = mountContainer.querySelector("#sim-drawer-toggle-text");
    if (simHandle && simDrawer) {
      simHandle.addEventListener("click", (e) => {
        e.preventDefault();
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
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const speech = btn.getAttribute("data-speech");
        if (speech) {
          wsClient.sendSyntheticTrigger("Speech", 0, 68.0, 0.95, speech, false);
          return;
        }

        const sound = btn.getAttribute("data-sound");
        const delay = parseInt(btn.getAttribute("data-delay") || "0", 10);
        const db = parseFloat(btn.getAttribute("data-db") || "75.0");
        const conf = parseFloat(btn.getAttribute("data-conf") || "0.88");
        const isRear = btn.getAttribute("data-rear") === "true";

        wsClient.sendSyntheticTrigger(sound, delay, db, conf, null, isRear);
      });
    });

    // Bind Mic Toggle inside Simulator
    const simMicBtn = mountContainer.querySelector("#sim-mic-toggle-btn");
    if (simMicBtn) {
      simMicBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (!audioCapture.isCapturing) {
          await audioCapture.start();
        } else {
          audioCapture.stop();
        }
      });
    }

    isMounted = true;
  }

  function updateModals(state) {
    if (!isMounted) return;

    // 1. SOS Modal Visibility & Countdown
    const sosModal = mountContainer.querySelector("#sos-modal-backdrop");
    const sosNum = mountContainer.querySelector("#sos-countdown-num");
    const sosBold = mountContainer.querySelector("#sos-countdown-text-bold");
    if (sosModal) {
      sosModal.style.display = state.isSosActive ? "flex" : "none";
      if (sosNum) sosNum.textContent = String(state.sosCountdown);
      if (sosBold) sosBold.textContent = `${state.sosCountdown}s`;
    }

    // 2. Guide Modal Visibility
    const guideModal = mountContainer.querySelector("#guide-modal-backdrop");
    if (guideModal) {
      guideModal.style.display = state.isActionGuideOpen ? "flex" : "none";
    }

    // 3. Simulator Mic Button & Status
    const simMicBtn = mountContainer.querySelector("#sim-mic-toggle-btn");
    const simStatusLabel = mountContainer.querySelector("#sim-mic-status-label");
    if (simMicBtn && simStatusLabel) {
      const capturing = audioCapture.isCapturing;
      simMicBtn.className = `aura-btn ${capturing ? 'aura-btn-critical' : 'aura-btn-primary'}`;
      simMicBtn.textContent = capturing ? 'Stop Mic' : 'Start Mic';
      simStatusLabel.textContent = capturing ? 'Streaming dual-channel PCM' : 'Microphone standby';
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

    if (!isMounted) mountSkeleton();
    updateModals(state);
  });

  mountSkeleton();
  updateModals(appState.get());
}
