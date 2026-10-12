/**
 * 10-Second Cancelable SOS Countdown Modal Component.
 * Triggered when Danger Score D >= 90 sustained or manually triggered.
 */

import { appState } from "../state.js";

export function initSosModal(containerEl, onCancelSos, onTriggerSosComplete) {
  const modalHtml = `
    <div id="sos-modal-overlay" class="modal-overlay">
      <div class="bottom-sheet" style="text-align: center; padding: 28px 24px;">
        <div style="
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background-color: var(--status-danger-bg);
          color: var(--status-danger-text);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px auto;
          border: 1px solid var(--status-danger-border);
        ">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>

        <h2 style="font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">
          High Danger Detected
        </h2>
        <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 20px;">
          Sustained critical hazard detected. Emergency contacts will be alerted with your live location.
        </p>

        <!-- Large Countdown Indicator -->
        <div id="sos-countdown-display" style="
          font-size: 44px;
          font-weight: 800;
          color: var(--status-danger-text);
          letter-spacing: -0.02em;
          margin-bottom: 24px;
        ">
          10
        </div>

        <!-- Prominent Cancel Button -->
        <button id="btn-cancel-sos" style="
          width: 100%;
          padding: 14px;
          border-radius: var(--radius-card);
          background-color: var(--text-primary);
          color: #FFFFFF;
          font-size: 15px;
          font-weight: 600;
          border: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        ">
          I'm Safe — Cancel Alert
        </button>
      </div>
    </div>
  `;

  containerEl.innerHTML = modalHtml;

  const overlay = containerEl.querySelector("#sos-modal-overlay");
  const countdownDisplay = containerEl.querySelector("#sos-countdown-display");
  const btnCancel = containerEl.querySelector("#btn-cancel-sos");

  btnCancel.addEventListener("click", () => {
    onCancelSos();
  });

  appState.subscribe(state => {
    if (state.isSosActive) {
      overlay.classList.add("open");
      countdownDisplay.textContent = state.sosCountdown;
    } else {
      overlay.classList.remove("open");
    }
  });
}
