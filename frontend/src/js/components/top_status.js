/**
 * Top Status Header Component.
 * Minimalist single-line header with mic state and semantic danger status pill.
 */

import { appState } from "../state.js";

export function initTopStatus(containerEl, onOpenSettings) {
  const headerHtml = `
    <header class="top-status-header" style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-subtle);
      background-color: var(--bg-surface);
      flex: 0 0 auto;
    ">
      <!-- Left: Audio / Mic State -->
      <div style="display: flex; align-items: center; gap: 8px;">
        <span id="mic-status-dot" class="status-dot"></span>
        <span id="mic-status-text" style="font-size: 13px; font-weight: 500; color: var(--text-secondary);">
          16 kHz Idle
        </span>
      </div>

      <!-- Right: Danger Pill & Settings -->
      <div style="display: flex; align-items: center; gap: 10px;">
        <div id="danger-status-pill" class="pill" style="
          background-color: var(--status-safe-bg);
          color: var(--status-safe-text);
          border-color: var(--status-safe-border);
        ">
          <span id="danger-pill-dot" style="
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: var(--status-safe-dot);
          "></span>
          <span id="danger-pill-text">Safe (0)</span>
        </div>

        <button id="btn-open-settings" style="
          padding: 6px;
          border-radius: 50%;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        " title="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </header>
  `;

  containerEl.innerHTML = headerHtml;

  const micDot = containerEl.querySelector("#mic-status-dot");
  const micText = containerEl.querySelector("#mic-status-text");
  const dangerPill = containerEl.querySelector("#danger-status-pill");
  const dangerPillDot = containerEl.querySelector("#danger-pill-dot");
  const dangerPillText = containerEl.querySelector("#danger-pill-text");
  const btnSettings = containerEl.querySelector("#btn-open-settings");

  btnSettings.addEventListener("click", onOpenSettings);

  appState.subscribe(state => {
    // 1. Mic & Connection indicator
    if (state.connectionStatus === "offline") {
      micDot.className = "status-dot";
      micText.textContent = "Offline (Reconnecting)";
      micDot.style.backgroundColor = "var(--text-tertiary)";
    } else if (state.audioState === "48kHz_active") {
      micDot.className = "status-dot active";
      micDot.style.backgroundColor = "#10B981";
      micText.textContent = `48 kHz Active (${Math.round(state.dbSpl)} dB)`;
    } else {
      micDot.className = "status-dot";
      micDot.style.backgroundColor = "var(--text-secondary)";
      micText.textContent = "16 kHz Idle";
    }

    // 2. Danger Status Pill
    const level = state.dangerLevel || "SAFE";
    const score = Math.round(state.dangerScore || 0);

    dangerPillText.textContent = `${level.charAt(0) + level.slice(1).toLowerCase()} (${score})`;

    if (level === "DANGER") {
      dangerPill.style.backgroundColor = "var(--status-danger-bg)";
      dangerPill.style.color = "var(--status-danger-text)";
      dangerPill.style.borderColor = "var(--status-danger-border)";
      dangerPillDot.style.backgroundColor = "var(--status-danger-dot)";
    } else if (level === "CAUTION") {
      dangerPill.style.backgroundColor = "var(--status-caution-bg)";
      dangerPill.style.color = "var(--status-caution-text)";
      dangerPill.style.borderColor = "var(--status-caution-border)";
      dangerPillDot.style.backgroundColor = "var(--status-caution-dot)";
    } else if (level === "AWARE") {
      dangerPill.style.backgroundColor = "var(--status-aware-bg)";
      dangerPill.style.color = "var(--status-aware-text)";
      dangerPill.style.borderColor = "var(--status-aware-border)";
      dangerPillDot.style.backgroundColor = "var(--status-aware-dot)";
    } else {
      dangerPill.style.backgroundColor = "var(--status-safe-bg)";
      dangerPill.style.color = "var(--status-safe-text)";
      dangerPill.style.borderColor = "var(--status-safe-border)";
      dangerPillDot.style.backgroundColor = "var(--status-safe-dot)";
    }
  });
}
