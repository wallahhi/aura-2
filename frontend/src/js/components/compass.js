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
          
          <!-- Cardinal & Ordinal Markers Ring (8-Octant 360° Radar) -->
          <div id="compass-cardinals-ring" class="compass-cardinals-ring">
            <span class="cardinal-marker marker-n">N</span>
            <span class="ordinal-marker marker-ne">NE</span>
            <span class="cardinal-marker marker-e">E</span>
            <span class="ordinal-marker marker-se">SE</span>
            <span class="cardinal-marker marker-s">S</span>
            <span class="ordinal-marker marker-sw">SW</span>
            <span class="cardinal-marker marker-w">W</span>
            <span class="ordinal-marker marker-nw">NW</span>
          </div>

          <!-- Rotating Needle (points relative to phone orientation) -->
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

      <!-- Mode Toggle & Heading Label -->
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 8px;">
        <button id="btn-toggle-compass-mode" class="btn-secondary" style="font-size: 11px; padding: 2px 10px; border-radius: 12px; cursor: pointer;">
          🧭 Screen Radar (Top=Ahead)
        </button>
        <div id="compass-heading-label" style="font-size: 11px; color: var(--text-tertiary); text-align: center;">
          Front: Ahead (N) · Back: Behind (S)
        </div>
      </div>
    </section>
  `;

  containerEl.innerHTML = compassHtml;

  const needle = containerEl.querySelector("#compass-needle");
  const cardinalsRing = containerEl.querySelector("#compass-cardinals-ring");
  const headingLabel = containerEl.querySelector("#compass-heading-label");
  const btnCompassMode = containerEl.querySelector("#btn-toggle-compass-mode");
  const soundBadge = containerEl.querySelector("#sound-badge");
  const soundBadgeName = containerEl.querySelector("#sound-badge-name");
  const soundBadgeZone = containerEl.querySelector("#sound-badge-zone");

  // Mode: 'radar' (Fixed to phone screen: Top=Ahead/N, Bottom=Behind/S) vs 'magnetic' (Sensor rotates)
  let compassMode = "radar";
  let phoneHeading = 0;

  btnCompassMode.addEventListener("click", () => {
    compassMode = compassMode === "radar" ? "magnetic" : "radar";
    if (compassMode === "radar") {
      btnCompassMode.textContent = "🧭 Screen Radar (Top=Ahead)";
      cardinalsRing.style.transform = "rotate(0deg)";
      headingLabel.textContent = "Front: Ahead (N) · Back: Behind (S)";
    } else {
      btnCompassMode.textContent = "🧭 Magnetic Compass (Sensor)";
      cardinalsRing.style.transform = `rotate(${-phoneHeading}deg)`;
      headingLabel.textContent = `Device Heading: ${phoneHeading}°`;
    }
  });

  // Track physical device orientation (compass sensor)
  function handleOrientation(e) {
    let heading = null;
    if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
      heading = e.webkitCompassHeading;
    } else if (e.alpha !== undefined && e.alpha !== null) {
      // Android Chrome: alpha represents rotation around Z-axis
      heading = (360 - e.alpha) % 360;
    }

    if (heading !== null && !isNaN(heading)) {
      phoneHeading = Math.round(heading);
      if (compassMode === "magnetic") {
        if (cardinalsRing) {
          cardinalsRing.style.transform = `rotate(${-phoneHeading}deg)`;
        }
        if (headingLabel) {
          headingLabel.textContent = `Device Heading: ${phoneHeading}°`;
        }
      }
    }
  }

  if (window.DeviceOrientationEvent) {
    if ("ondeviceorientationabsolute" in window) {
      window.addEventListener("deviceorientationabsolute", handleOrientation, true);
    } else {
      window.addEventListener("deviceorientation", handleOrientation, true);
    }
  }

  function getZoneDescription(deg, zone) {
    if (zone === "OMNI") return "· 360° Omni (Single Mic)";
    const roundedDeg = Math.round(deg);
    if (zone === "S") return `· ${roundedDeg}° South (Behind)`;
    if (zone === "SW") return `· ${roundedDeg}° SW (Behind-Left)`;
    if (zone === "SE") return `· ${roundedDeg}° SE (Behind-Right)`;
    if (zone === "N") return `· ${roundedDeg}° North (Ahead)`;
    if (zone === "NW") return `· ${roundedDeg}° NW (Front-Left)`;
    if (zone === "NE") return `· ${roundedDeg}° NE (Front-Right)`;
    if (zone === "W") return `· ${roundedDeg}° West (Left)`;
    if (zone === "E") return `· ${roundedDeg}° East (Right)`;
    return `· ${roundedDeg}° ${zone}`;
  }

  appState.subscribe(state => {
    const sound = state.activeSound;

    if (sound && (Date.now() / 1000 - sound.timestamp) < 6.0) {
      if (sound.compass_zone === "OMNI") {
        // Mono microphone capture: sound is heard omnidirectionally
        needle.style.opacity = "0.35";
        needle.style.transform = `rotate(0deg)`;

        soundBadgeName.textContent = sound.display_name || sound.class;
        soundBadgeZone.textContent = `· 360° Omni (Single Mic)`;
      } else {
        // 360° Directional localization:
        // 90° = Ahead (Top of phone)
        // 0° = East (Right of phone)
        // 180° = West (Left of phone)
        // 270° = South (Behind / Bottom of phone)
        needle.style.opacity = "1";
        const rotationDeg = 90 - sound.angle_deg;
        needle.style.transform = `rotate(${rotationDeg}deg)`;

        soundBadgeName.textContent = sound.display_name || sound.class;
        soundBadgeZone.textContent = getZoneDescription(sound.angle_deg, sound.compass_zone);
      }

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
      needle.style.opacity = "0.7";
      soundBadge.style.opacity = "0.6";
      soundBadge.style.backgroundColor = "var(--bg-surface)";
      soundBadge.style.color = "var(--text-primary)";
      soundBadge.style.borderColor = "var(--border-subtle)";
      soundBadgeName.textContent = state.audioState === "48kHz_active" ? "Sound Detected" : "Ambient Listening";
      soundBadgeZone.textContent = state.audioState === "48kHz_active" ? `· ${Math.round(state.dbSpl)} dB` : "· 360°";
    }
  });
}
