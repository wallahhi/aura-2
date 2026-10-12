/**
 * Settings Bottom Sheet Component.
 * Minimalist configuration for API keys, acoustic parameters, and emergency contacts.
 */

import { appState } from "../state.js";

export function initSettingsModal(containerEl, onSaveSettings) {
  const modalHtml = `
    <div id="settings-modal-overlay" class="modal-overlay">
      <div class="bottom-sheet">
        <div class="sheet-header">
          <h3 class="sheet-title">Settings & Safety</h3>
          <button id="btn-close-settings" class="sheet-close" aria-label="Close">&times;</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 20px;">
          <!-- OpenAI API Key -->
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
              OpenAI API Key (Whisper ASR)
            </label>
            <input type="password" id="input-api-key" placeholder="sk-..." style="
              width: 100%;
              padding: 10px 12px;
              border-radius: var(--radius-input);
              border: 1px solid var(--border-subtle);
              background-color: var(--bg-subtle);
              font-size: 13px;
              font-family: inherit;
              color: var(--text-primary);
            " />
            <p style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
              Used exclusively for Branch A live speech transcription.
            </p>
          </div>

          <!-- RMS Gate Threshold X -->
          <div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <label style="font-size: 13px; font-weight: 600; color: var(--text-primary);">
                Audio Gate Threshold (X)
              </label>
              <span id="display-threshold-x" style="font-size: 12px; color: var(--text-secondary);">0.015</span>
            </div>
            <input type="range" id="input-threshold-x" min="0.005" max="0.060" step="0.005" value="0.015" style="width: 100%; accent-color: var(--text-primary);" />
            <p style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
              Escalates from 16 kHz idle to 48 kHz stereo PCM when ambient amplitude crosses X.
            </p>
          </div>

          <!-- Microphone Spacing d -->
          <div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <label style="font-size: 13px; font-weight: 600; color: var(--text-primary);">
                Microphone Distance (d)
              </label>
              <span id="display-mic-d" style="font-size: 12px; color: var(--text-secondary);">14 cm</span>
            </div>
            <input type="range" id="input-mic-d" min="0.08" max="0.22" step="0.01" value="0.14" style="width: 100%; accent-color: var(--text-primary);" />
          </div>

          <!-- Emergency Contacts -->
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
              Emergency Contacts
            </label>
            <div id="contacts-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;"></div>
            
            <button id="btn-save-settings" class="btn-secondary" style="
              width: 100%;
              padding: 12px;
              background-color: var(--text-primary);
              color: #FFFFFF;
              font-weight: 600;
              margin-top: 8px;
            ">Save Settings</button>
          </div>
        </div>
      </div>
    </div>
  `;

  containerEl.innerHTML = modalHtml;

  const overlay = containerEl.querySelector("#settings-modal-overlay");
  const btnClose = containerEl.querySelector("#btn-close-settings");
  const inputApiKey = containerEl.querySelector("#input-api-key");
  const inputThreshold = containerEl.querySelector("#input-threshold-x");
  const displayThreshold = containerEl.querySelector("#display-threshold-x");
  const inputMicD = containerEl.querySelector("#input-mic-d");
  const displayMicD = containerEl.querySelector("#display-mic-d");
  const contactsList = containerEl.querySelector("#contacts-list");
  const btnSave = containerEl.querySelector("#btn-save-settings");

  // Load current settings into inputs
  const currentSettings = appState.get().settings;
  inputApiKey.value = currentSettings.apiKey || "";
  inputThreshold.value = currentSettings.thresholdX || 0.015;
  displayThreshold.textContent = currentSettings.thresholdX || "0.015";
  inputMicD.value = currentSettings.micSpacingD || 0.14;
  displayMicD.textContent = `${Math.round((currentSettings.micSpacingD || 0.14) * 100)} cm`;

  inputThreshold.addEventListener("input", (e) => {
    displayThreshold.textContent = e.target.value;
  });

  inputMicD.addEventListener("input", (e) => {
    displayMicD.textContent = `${Math.round(e.target.value * 100)} cm`;
  });

  function renderContacts() {
    contactsList.innerHTML = "";
    for (const c of currentSettings.emergencyContacts || []) {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-subtle); border-radius: var(--radius-input); font-size: 13px;";
      row.innerHTML = `
        <div>
          <div style="font-weight: 600; color: var(--text-primary);">${c.name}</div>
          <div style="font-size: 11px; color: var(--text-secondary);">${c.phone} · ${c.relationship}</div>
        </div>
      `;
      contactsList.appendChild(row);
    }
  }

  renderContacts();

  btnClose.addEventListener("click", () => {
    overlay.classList.remove("open");
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.remove("open");
    }
  });

  btnSave.addEventListener("click", () => {
    const updated = {
      apiKey: inputApiKey.value.trim(),
      thresholdX: parseFloat(inputThreshold.value),
      micSpacingD: parseFloat(inputMicD.value)
    };
    appState.updateSettings(updated);
    onSaveSettings(updated);
    overlay.classList.remove("open");
  });

  return {
    open: () => overlay.classList.add("open"),
    close: () => overlay.classList.remove("open")
  };
}
