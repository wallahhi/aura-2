/**
 * AURA Home View Component.
 * Implements Screen 1 from Stitch Reference:
 * - Active Sound Radar with animated equalizer visualizer & pause/resume
 * - Threat Evaluation (Safe / Aware / Caution / Danger)
 * - Critical Hazard Alert card (Fire alarm / siren with action guide & dismiss)
 * - 360° Directional Compass with relative heading & distance
 * - Recent Sounds list
 * - SOS Emergency Assistance card
 */

import { appState } from "../state.js";

export function initHomeView(container, audioCapture, wsClient) {
  let visualizerAnimId = null;

  function getIconSvg(iconName) {
    switch (iconName) {
      case "alarm":
        return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><line x1="2" y1="4" x2="4" y2="2"></line><line x1="22" y1="4" x2="20" y2="2"></line></svg>`;
      case "doorbell":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
      case "paw":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="4" r="2"></circle><circle cx="18" cy="8" r="2"></circle><circle cx="4" cy="8" r="2"></circle><path d="M12 19c-3.3 0-6-2-6-5 0-3 2.5-4 6-4s6 1 6 4c0 3-2.7 5-6 5z"></path></svg>`;
      case "water":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>`;
      case "car":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="9" rx="2"></rect><path d="M5 11l2-6h10l2 6"></path><circle cx="7.5" cy="16.5" r="1.5"></circle><circle cx="16.5" cy="16.5" r="1.5"></circle></svg>`;
      case "speech":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
      default:
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    }
  }

  function render(state) {
    const isPaused = !state.isListening;
    const alert = state.criticalAlert;
    const compass = state.compass;
    const dangerLevel = state.dangerLevel || "SAFE";

    container.innerHTML = `
      <!-- Subheader Status Badges -->
      <div class="aura-status-badges-row">
        <div class="status-badge-pill">
          <span class="dot ${isPaused ? 'green' : 'red'}"></span>
          <span>${isPaused ? 'Microphone Standby' : 'Microphone Active · Noise Reduction On'}</span>
        </div>
        <div class="status-badge-pill">
          <span>🔊</span>
          <span>Haptics: ${state.settings.vibrationForce || 'Strong'} · Flash: ${state.settings.screenFlash ? 'On' : 'Off'}</span>
        </div>
      </div>
      <div class="proto-info-banner">
        <span>ⓘ</span>
        <span>${isPaused ? 'Illustrative Prototype · Simulated Audio Sensor Data' : 'Live Real-Time Spatial Audio Ingestion Active'}</span>
      </div>

      <!-- 1. Active Sound Radar Card -->
      <div class="sound-radar-card">
        <div class="radar-header">
          <div class="radar-title">
            <span class="radar-title-icon">📶</span>
            <span>Active Sound Radar</span>
          </div>
          <div class="aura-pill-db" id="live-db-pill">
            <span>●</span>
            <span id="live-db-val">${state.dbSpl || 42} dB</span>
          </div>
        </div>

        <!-- Animated Audio Equalizer Visualizer -->
        <div class="audio-visualizer-container" id="visualizer-box">
          ${Array.from({ length: 16 }).map((_, i) => `<div class="visualizer-bar" id="vbar-${i}"></div>`).join('')}
        </div>

        <div class="visualizer-subpills">
          <div class="radar-subpill">
            <span>🎛</span>
            <span>Built-in Mic Array...</span>
          </div>
          <div class="radar-subpill">
            <span>📳</span>
            <span>${state.settings.vibrationForce === 'strong' ? 'Strong' : 'Medium'} Vibration P...</span>
          </div>
        </div>

        <button class="radar-pause-btn ${isPaused ? 'resuming' : ''}" id="radar-toggle-mic-btn">
          <span>${isPaused ? '▶' : '⏸'}</span>
          <span>${isPaused ? 'Start Listening (48 kHz Mic)' : 'Pause Listening'}</span>
        </button>
      </div>

      <!-- 2. Threat Evaluation Card -->
      <div class="threat-card">
        <div class="threat-card-header">
          <span class="threat-label">Threat Evaluation</span>
          <span class="threat-status-badge hazard-${dangerLevel.toLowerCase()}">
            ${state.threatStatusText || (dangerLevel === 'DANGER' ? 'High Hazard Active' : dangerLevel === 'CAUTION' ? 'Caution Advised' : 'Safe Condition')}
          </span>
        </div>
        <div class="threat-levels-row">
          <div class="threat-level-box ${dangerLevel === 'SAFE' ? 'active-SAFE' : ''}">
            <span class="level-icon">🛡</span>
            <span>SAFE</span>
          </div>
          <div class="threat-level-box ${dangerLevel === 'AWARE' ? 'active-AWARE' : ''}">
            <span class="level-icon">👂</span>
            <span>AWARE</span>
          </div>
          <div class="threat-level-box ${dangerLevel === 'CAUTION' ? 'active-CAUTION' : ''}">
            <span class="level-icon">⚠</span>
            <span>CAUTION</span>
          </div>
          <div class="threat-level-box ${dangerLevel === 'DANGER' ? 'active-DANGER' : ''}">
            <span class="level-icon">🚨</span>
            <span>DANGER</span>
          </div>
        </div>
      </div>

      <!-- 3. Critical Hazard Alert Card (Conditionally shown if active) -->
      ${alert ? `
        <div class="critical-alert-card" id="critical-alert-container">
          <div class="critical-alert-top">
            <div class="critical-priority-badge">
              <span>🚨</span>
              <span>CRITICAL HAZARD · HIGH PRIORITY</span>
            </div>
            <span class="critical-time-ago">${alert.time_ago || '2s ago'}</span>
          </div>

          <div class="critical-alert-body">
            <div class="critical-alert-icon-square">
              ${getIconSvg("alarm")}
            </div>
            <div class="critical-alert-info">
              <div class="critical-alert-title">${alert.display_name}</div>
              <div class="critical-alert-desc">${alert.description}</div>
            </div>
          </div>

          <div class="critical-origin-box">
            <div class="origin-left">
              <span class="origin-icon">🔺</span>
              <div class="origin-text-group">
                <span class="origin-label">Relative Origin</span>
                <span class="origin-heading">${alert.relative_origin}</span>
              </div>
            </div>
            <div class="origin-conf-pill">${Math.round((alert.confidence || 0.94) * 100)}% Conf.</div>
          </div>

          <div class="critical-actions-row">
            <button class="aura-btn aura-btn-critical" id="btn-action-guide">
              <span>✱</span>
              <span>Action Guide</span>
            </button>
            <button class="aura-btn aura-btn-outline-critical" id="btn-dismiss-alert">
              <span>✔</span>
              <span>Dismiss Alert</span>
            </button>
          </div>
        </div>
      ` : ''}

      <!-- 4. Directional Compass Card -->
      <div class="compass-card">
        <div class="compass-card-header">
          <div class="compass-title">
            <span style="color: var(--brand-teal);">🧭</span>
            <span>Directional Compass</span>
          </div>
          <span class="compass-subtitle-tag">Multi-Mic Arrival Delay</span>
        </div>

        <div class="compass-dial-container">
          <!-- Concentric rings -->
          <div class="compass-ring-outer"></div>
          <div class="compass-ring-inner"></div>

          <!-- Cardinal Labels -->
          <span class="cardinal-label n">N</span>
          <span class="cardinal-label s">S</span>
          <span class="cardinal-label e">E</span>
          <span class="cardinal-label w">W</span>

          <!-- Rotating Needle & Beacon -->
          <div class="compass-needle-layer" id="compass-needle" style="transform: rotate(${compass.angle_deg || 195}deg);">
            <div class="compass-needle-line"></div>
            <div class="compass-beacon-point">i</div>
          </div>

          <!-- Center Heading Pod -->
          <div class="compass-center-pod">
            <div class="pod-icon">🔻</div>
            <div class="pod-heading-text">${compass.relative_heading || 'BEHIND YOU'}</div>
            <div class="pod-sub-angle">${compass.sub_heading || '195° SSW'}</div>
          </div>
        </div>

        <div class="compass-distance-footer">
          <div class="distance-primary">
            <span>📏</span>
            <span>Estimated Distance: ${compass.estimated_distance || '8–12 meters'}</span>
          </div>
          <span>${compass.line_of_sight || 'Indoor Line-of-Sight'}</span>
        </div>
      </div>

      <!-- 5. Recent Sounds List Card -->
      <div class="recent-sounds-card">
        <div class="recent-sounds-header">
          <div class="aura-card-title">Recent Sounds</div>
          <a class="view-all-link" id="link-view-all-history">View All &gt;</a>
        </div>

        <div class="recent-sounds-list">
          ${(state.recentSounds || []).map(sound => `
            <div class="recent-sound-item">
              <div class="sound-item-left">
                <div class="sound-item-icon">
                  ${getIconSvg(sound.icon)}
                </div>
                <div class="sound-item-details">
                  <div class="sound-item-title-row">
                    <span class="sound-item-title">${sound.display_name}</span>
                    <span class="sound-tier-pill ${sound.tier}">${sound.tier}</span>
                  </div>
                  <span class="sound-item-submeta">${sound.submeta}</span>
                </div>
              </div>
              <span class="sound-item-arrow">${sound.arrow || '↗'}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 6. SOS Emergency Assistance Card -->
      <div class="sos-card">
        <div class="sos-card-top">
          <div class="sos-badge-square">SOS</div>
          <div class="sos-card-text">
            <div class="sos-card-title">SOS Emergency Assistance</div>
            <div class="sos-card-desc">Triggers continuous strobe &amp; alerts designated emergency network.</div>
          </div>
        </div>
        <button class="sos-open-btn" id="btn-open-sos-home">
          <span>🛡</span>
          <span>Open SOS Emergency</span>
        </button>
      </div>
    `;

    // Bind Event Listeners
    const toggleMicBtn = container.querySelector("#radar-toggle-mic-btn");
    if (toggleMicBtn) {
      toggleMicBtn.addEventListener("click", async () => {
        if (!audioCapture.isCapturing) {
          const ok = await audioCapture.start();
          if (ok) {
            appState.set({ isListening: true, threatStatusText: "Acoustic Surveillance Active" });
          }
        } else {
          audioCapture.stop();
          appState.set({ isListening: false });
        }
      });
    }

    const dismissBtn = container.querySelector("#btn-dismiss-alert");
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        appState.dismissAlert();
      });
    }

    const actionGuideBtn = container.querySelector("#btn-action-guide");
    if (actionGuideBtn) {
      actionGuideBtn.addEventListener("click", () => {
        appState.openActionGuide();
      });
    }

    const viewAllLink = container.querySelector("#link-view-all-history");
    if (viewAllLink) {
      viewAllLink.addEventListener("click", () => {
        appState.switchTab("history");
      });
    }

    const openSosBtn = container.querySelector("#btn-open-sos-home");
    if (openSosBtn) {
      openSosBtn.addEventListener("click", () => {
        appState.triggerSos(10);
      });
    }

    // Start Audio Visualizer loop
    startVisualizerLoop(state);
  }

  function startVisualizerLoop(state) {
    if (visualizerAnimId) cancelAnimationFrame(visualizerAnimId);

    const bars = container.querySelectorAll(".visualizer-bar");
    if (!bars || bars.length === 0) return;

    let tick = 0;
    function updateBars() {
      tick += 0.08;
      const curState = appState.get();
      const baseDb = curState.dbSpl || 42;
      const isListening = curState.isListening;

      bars.forEach((bar, index) => {
        let height = 8;
        if (isListening) {
          // React to real RMS or dynamic acoustic noise
          const wave = Math.sin(tick + index * 0.45) * 0.5 + 0.5;
          const heightFactor = Math.min(1.0, (baseDb - 25) / 60);
          height = Math.max(8, Math.min(50, Math.floor(10 + wave * 40 * heightFactor)));
        } else {
          // Idle ambient shimmer matching Stitch screenshot
          const heights = [14, 28, 42, 22, 38, 48, 44, 48, 30, 18, 26, 34, 24, 40, 30, 22];
          height = heights[index % heights.length];
        }

        bar.style.height = `${height}px`;

        // Color bars: middle high amplitude bars turn red/amber like screenshot
        if (index >= 4 && index <= 7 && height > 32) {
          bar.className = "visualizer-bar high";
        } else if (height > 38) {
          bar.className = "visualizer-bar medium";
        } else {
          bar.className = "visualizer-bar";
        }
      });

      visualizerAnimId = requestAnimationFrame(updateBars);
    }

    visualizerAnimId = requestAnimationFrame(updateBars);
  }

  appState.subscribe(state => {
    if (state.currentTab === "home") {
      render(state);
    }
  });

  render(appState.get());
}
