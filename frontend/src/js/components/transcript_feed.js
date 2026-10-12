/**
 * Bottom Live Conversation Feed Component.
 * Borderless scrolling typography stream for live Whisper speech transcriptions.
 */

import { appState } from "../state.js";

export function initTranscriptFeed(containerEl) {
  const feedHtml = `
    <section class="transcript-section">
      <div class="transcript-header">
        <span class="transcript-title">Live Conversation</span>
        <div class="transcript-actions">
          <button id="btn-clear-transcript" class="btn-secondary" style="padding: 2px 8px; font-size: 11px;">Clear</button>
        </div>
      </div>

      <div id="transcript-feed-list" class="transcript-feed">
        <div id="transcript-empty" class="transcript-empty">
          Live speech from nearby conversations will scroll here automatically.
        </div>
      </div>
    </section>
  `;

  containerEl.innerHTML = feedHtml;

  const feedList = containerEl.querySelector("#transcript-feed-list");
  const emptyPlaceholder = containerEl.querySelector("#transcript-empty");
  const btnClear = containerEl.querySelector("#btn-clear-transcript");

  btnClear.addEventListener("click", () => {
    appState.clearTranscripts();
  });

  appState.subscribe(state => {
    const transcripts = state.transcripts || [];

    if (transcripts.length === 0) {
      emptyPlaceholder.style.display = "block";
      feedList.innerHTML = "";
      feedList.appendChild(emptyPlaceholder);
      return;
    }

    emptyPlaceholder.style.display = "none";
    feedList.innerHTML = "";

    for (const item of transcripts) {
      const el = document.createElement("div");
      el.className = "transcript-item";

      const timeStr = new Date(item.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      el.innerHTML = `
        <div class="transcript-meta">
          <span class="speaker-tag">${escapeHtml(item.speaker || "Speaker 1")}</span>
          <span>·</span>
          <span>${timeStr}</span>
        </div>
        <p class="transcript-text">${escapeHtml(item.text)}</p>
      `;

      feedList.appendChild(el);
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
