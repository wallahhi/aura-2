/**
 * Center 360° Directional Compass Component.
 * Minimalist geometric circular radar ring pointing to arrival angle theta.
 */

import { appState } from "../state.js";

export function initCompass(containerEl) {
  const compassHtml = `
    <section class="compass-section">
      <div class="compass-container">
        <div class="compass-dial">
          <div class="compass-inner-ring"></div>
          
          <!-- Cardinal Markers -->
          <span class="cardinal-marker marker-n">N</span>
          <span class="cardinal-marker marker-e">E</span>
          <span class="cardinal-marker marker-s">S</span>
          <span class="cardinal-marker marker-w">W</span>

          <!-- Rotating Needle -->
          <div id="compass-needle" class="compass-needle" style="transform: rotate(0deg);">
            <div class="needle-pointer"></div>
          </div>

          <!-- Center Pivot -->
          <div class="compass-pivot"></div>
        </div>
      </div>

      <!-- Direction Sound Badge Pill -->
      <div class="sound-badge-container">
        <div id="sound-badge" class="sound-badge" style="opacity: 0.6;">
          <span id="sound-badge-name">Ambient Listening</span>
          <span id="sound-badge-zone" class="sound-badge-zone">· 360°</span>
        </div>
      </div>
    </section>
  `;

  containerEl.innerHTML = compassHtml;

  const needle = containerEl.querySelector("#compass-needle");
  const soundBadge = containerEl.querySelector("#sound-badge");
  const soundBadgeName = containerEl.querySelector("#sound-badge-name");
  const soundBadgeZone = containerEl.querySelector("#sound-badge-zone");

  appState.subscribe(state => {
    const sound = state.activeSound;

    if (sound && (Date.now() / 1000 - sound.timestamp) < 6.0) {
      // Rotate needle:
      // In phone orientation:
      // 90° = North (0° on clock)
      // 0° = East (90° clockwise)
      // 180° = West (-90° / 270° clockwise)
      // Clockwise angle offset: (90 - theta) degrees
      const rotationDeg = 90 - sound.angle_deg;
      needle.style.transform = `rotate(${rotationDeg}deg)`;

      // Update sound pill badge
      soundBadgeName.textContent = sound.display_name || sound.class;
      soundBadgeZone.textContent = `· ${Math.round(sound.angle_deg)}° ${sound.compass_zone}`;
      soundBadge.style.opacity = "1";
      soundBadge.style.borderColor = "var(--text-primary)";

      // Priority border tint
      if (sound.priority === "P0") {
        soundBadge.style.backgroundColor = "var(--status-danger-bg)";
        soundBadge.style.color = "var(--status-danger-text)";
      } else if (sound.priority === "P1") {
        soundBadge.style.backgroundColor = "var(--status-caution-bg)";
        soundBadge.style.color = "var(--status-caution-text)";
      } else {
        soundBadge.style.backgroundColor = "var(--bg-surface)";
        soundBadge.style.color = "var(--text-primary)";
      }
    } else {
      // Ambient default
      soundBadge.style.opacity = "0.6";
      soundBadge.style.backgroundColor = "var(--bg-surface)";
      soundBadge.style.color = "var(--text-primary)";
      soundBadge.style.borderColor = "var(--border-subtle)";
      soundBadgeName.textContent = state.audioState === "48kHz_active" ? "Sound Detected" : "Ambient Listening";
      soundBadgeZone.textContent = state.audioState === "48kHz_active" ? `· ${Math.round(state.dbSpl)} dB` : "· 360°";
    }
  });
}
