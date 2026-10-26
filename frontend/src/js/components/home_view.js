/**
 * AURA Home View Component.
 * Implements Screen 1 from Google Stitch Reference:
 * - Active Sound Radar with animated equalizer visualizer & responsive pause/resume
 * - Threat Evaluation (Safe / Aware / Caution / Danger)
 * - Critical Hazard Alert card (Fire alarm / siren with action guide & dismiss)
 * - 360° Directional Compass with relative heading & distance
 * - Recent Sounds list
 * - SOS Emergency Assistance card
 * 
 * Engineered with high-performance persistent DOM nodes so continuous
 * 85ms PCM audio telemetry never destroys interactive buttons or interrupts click events.
 */

import { appState } from "../state.js";

export function initHomeView(container, audioCapture, wsClient) {
  let visualizerAnimId = null;
  let isMounted = false;
  let lastRecentSoundsJson = "";
  let lastCriticalAlertId = null;

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

  function mountSkeleton(initialState) {
    const isPaused = !initialState.isListening;
    const compass = initialState.compass || {};
    const dangerLevel = initialState.dangerLevel || "SAFE";

    container.innerHTML = `
      <!-- Subheader Status Badges -->
      <div class="aura-status-badges-row">
        <div class="status-badge-pill" id="radar-mic-badge-pill">
          <span class="dot ${isPaused ? 'green' : 'red'}" id="radar-mic-dot"></span>
          <span id="radar-mic-text">${isPaused ? 'Microphone Standby' : 'Microphone Active · Noise Reduction On'}</span>
        </div>
        <div class="status-badge-pill mic-system-pill mode-${initialState.micCount || 1}" id="radar-mic-system-badge">
          <span>🎙</span>
          <span id="radar-mic-system-text">${initialState.micCount || 1} Mic (${initialState.micCount === 3 ? '3-Mic Smartwatch' : initialState.micCount === 2 ? 'Dual Stereo' : 'Mono Omni'})</span>
        </div>
        <div class="status-badge-pill" id="radar-haptics-pill">
          <span>🔊</span>
          <span id="radar-haptics-text">Haptics: ${initialState.settings?.vibrationForce || 'Strong'}</span>
        </div>
      </div>
      <div class="proto-info-banner">
        <span>ⓘ</span>
        <span id="proto-info-banner-text">${isPaused ? 'Illustrative Prototype · Simulated Audio Sensor Data' : 'Live Real-Time Spatial Audio Ingestion Active'}</span>
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
            <span id="live-db-val">${initialState.dbSpl || 42} dB</span>
          </div>
        </div>

        <!-- Animated Audio Equalizer Visualizer -->
        <div class="audio-visualizer-container" id="visualizer-box">
          ${Array.from({ length: 16 }).map((_, i) => `<div class="visualizer-bar" id="vbar-${i}"></div>`).join('')}
        </div>

        <div class="visualizer-subpills">
          <div class="radar-subpill" id="radar-subpill-mic-hardware">
            <span>🎙</span>
            <span id="radar-subpill-mic-hw">${initialState.micDeviceName || 'System Mic'} (${initialState.micCount || 1} Mic Active)</span>
          </div>
          <div class="radar-subpill">
            <span>📳</span>
            <span id="radar-subpill-vibe">${initialState.settings?.vibrationForce === 'strong' ? 'Strong' : 'Medium'} Vibration P...</span>
          </div>
        </div>

        <button class="radar-pause-btn ${isPaused ? 'resuming' : ''}" id="radar-toggle-mic-btn" type="button">
          <span id="radar-btn-icon">${isPaused ? '▶' : '⏸'}</span>
          <span id="radar-btn-text">${isPaused ? 'Start Listening (48 kHz Mic)' : 'Pause Listening'}</span>
        </button>
      </div>

      <!-- 2. Threat Evaluation Card -->
      <div class="threat-card">
        <div class="threat-card-header">
          <span class="threat-label">Threat Evaluation</span>
          <span class="threat-status-badge hazard-${dangerLevel.toLowerCase()}" id="threat-status-badge">
            ${initialState.threatStatusText || (dangerLevel === 'DANGER' ? 'High Hazard Active' : dangerLevel === 'CAUTION' ? 'Caution Advised' : dangerLevel === 'AWARE' ? 'Notice Active' : 'Safe Condition')}
          </span>
        </div>
        <div class="threat-levels-row">
          <div class="threat-level-box ${dangerLevel === 'SAFE' ? 'active-SAFE' : ''}" id="threat-box-safe">
            <span class="level-icon">🛡</span>
            <span>SAFE</span>
          </div>
          <div class="threat-level-box ${dangerLevel === 'AWARE' ? 'active-AWARE' : ''}" id="threat-box-aware">
            <span class="level-icon">👂</span>
            <span>AWARE</span>
          </div>
          <div class="threat-level-box ${dangerLevel === 'CAUTION' ? 'active-CAUTION' : ''}" id="threat-box-caution">
            <span class="level-icon">⚠</span>
            <span>CAUTION</span>
          </div>
          <div class="threat-level-box ${dangerLevel === 'DANGER' ? 'active-DANGER' : ''}" id="threat-box-danger">
            <span class="level-icon">🚨</span>
            <span>DANGER</span>
          </div>
        </div>
      </div>

      <!-- 3. Critical Hazard Alert Card Container -->
      <div id="critical-alert-wrapper"></div>

      <!-- 4. Directional Compass Card -->
      <div class="compass-card">
        <div class="compass-card-header">
          <div class="compass-title">
            <span style="color: var(--brand-teal);">🧭</span>
            <span>Directional Compass</span>
          </div>
          <span class="compass-subtitle-tag" id="compass-mic-tag">${initialState.micCount === 3 ? '3-Mic Planar Smartwatch Array (360°)' : initialState.micCount === 2 ? 'Dual-Mic TDOA Array (14cm)' : 'Single-Mic Omnidirectional Mode'}</span>
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

          <!-- Rotating Needle & Beacon (Coherent unified arrow pointing outward) -->
          <div class="compass-needle-layer" id="compass-needle" style="transform: rotate(${compass.angle_deg ?? 195}deg);">
            <div class="compass-needle-line"></div>
            <div class="compass-beacon-point">i</div>
          </div>

          <!-- Center Heading Pod -->
          <div class="compass-center-pod">
            <div class="pod-icon" id="pod-icon-indicator">🔻</div>
            <div class="pod-heading-text" id="pod-heading-text">${compass.relative_heading || 'BEHIND YOU'}</div>
            <div class="pod-sub-angle" id="pod-sub-angle">${compass.sub_heading || '195° SSW'}</div>
          </div>
        </div>

        <div class="compass-distance-footer">
          <div class="distance-primary">
            <span>📏</span>
            <span id="compass-dist-val">Estimated Distance: ${compass.estimated_distance || '8–12 meters'}</span>
          </div>
          <span id="compass-los-val">${compass.line_of_sight || 'Indoor Line-of-Sight'}</span>
        </div>
      </div>

      <!-- 5. Recent Sounds List Card -->
      <div class="recent-sounds-card">
        <div class="recent-sounds-header">
          <div class="aura-card-title">Recent Sounds</div>
          <a class="view-all-link" id="link-view-all-history">View All &gt;</a>
        </div>
        <div class="recent-sounds-list" id="recent-sounds-list-body"></div>
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
        <button class="sos-open-btn" id="btn-open-sos-home" type="button">
          <span>🛡</span>
          <span>Open SOS Emergency</span>
        </button>
      </div>
    `;

    // Bind Event Listeners ONCE
    const toggleMicBtn = container.querySelector("#radar-toggle-mic-btn");
    if (toggleMicBtn) {
      toggleMicBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!audioCapture.isCapturing) {
          const ok = await audioCapture.start();
          if (ok) {
            appState.set({ isListening: true, threatStatusText: "Acoustic Surveillance Active" });
          }
        } else {
          audioCapture.stop();
          appState.set({ isListening: false, threatStatusText: "Standby Condition" });
        }
      });
    }

    const viewAllLink = container.querySelector("#link-view-all-history");
    if (viewAllLink) {
      viewAllLink.addEventListener("click", (e) => {
        e.preventDefault();
        appState.switchTab("history");
      });
    }

    const openSosBtn = container.querySelector("#btn-open-sos-home");
    if (openSosBtn) {
      openSosBtn.addEventListener("click", (e) => {
        e.preventDefault();
        appState.triggerSos(10);
      });
    }

    // Delegate click events for critical alert actions (Action Guide & Dismiss)
    const alertWrapper = container.querySelector("#critical-alert-wrapper");
    if (alertWrapper) {
      alertWrapper.addEventListener("click", (e) => {
        if (e.target.closest("#btn-dismiss-alert")) {
          e.preventDefault();
          appState.dismissAlert();
        } else if (e.target.closest("#btn-action-guide")) {
          e.preventDefault();
          appState.openActionGuide();
        }
      });
    }

    isMounted = true;
    startVisualizerLoop();
  }

  function updateDynamicFields(state) {
    if (!isMounted) return;

    const isPaused = !state.isListening;
    const compass = state.compass || {};
    const dangerLevel = state.dangerLevel || "SAFE";

    // 1. Microphone status pill & banner
    const dot = container.querySelector("#radar-mic-dot");
    const micText = container.querySelector("#radar-mic-text");
    const bannerText = container.querySelector("#proto-info-banner-text");

    if (dot) dot.className = `dot ${isPaused ? 'green' : 'red'}`;
    if (micText) micText.textContent = isPaused ? 'Microphone Standby' : 'Microphone Active · Noise Reduction On';
    if (bannerText) bannerText.textContent = isPaused ? 'Illustrative Prototype · Simulated Audio Sensor Data' : 'Live Real-Time Spatial Audio Ingestion Active';

    // 1b. Microphone system mode badge & hardware pill
    const micBadge = container.querySelector("#radar-mic-system-badge");
    const micBadgeText = container.querySelector("#radar-mic-system-text");
    const micHwText = container.querySelector("#radar-subpill-mic-hw");
    const compassMicTag = container.querySelector("#compass-mic-tag");
    const micCount = state.micCount || 1;

    if (micBadge && micBadgeText) {
      micBadge.className = `status-badge-pill mic-system-pill mode-${micCount}`;
      micBadgeText.textContent = `${micCount} Mic${micCount > 1 ? 's' : ''} (${micCount === 3 ? '3-Mic Smartwatch' : micCount === 2 ? 'Dual Stereo' : 'Mono Omni'})`;
    }
    if (micHwText) {
      micHwText.textContent = `${state.micDeviceName || 'System Mic'} (${micCount} Mic Active)`;
    }
    if (compassMicTag) {
      compassMicTag.textContent = micCount === 3
        ? '3-Mic Planar Smartwatch Array (360°)'
        : micCount === 2
          ? 'Dual-Mic TDOA Array (14cm)'
          : 'Single-Mic Omnidirectional Mode';
    }

    // 2. Live dB readout
    const dbVal = container.querySelector("#live-db-val");
    if (dbVal) {
      dbVal.textContent = `${state.dbSpl || 42} dB`;
    }

    // 3. Radar Toggle Button (Preserve node, only toggle classes and content)
    const toggleBtn = container.querySelector("#radar-toggle-mic-btn");
    const btnIcon = container.querySelector("#radar-btn-icon");
    const btnText = container.querySelector("#radar-btn-text");
    if (toggleBtn && btnIcon && btnText) {
      if (isPaused) {
        toggleBtn.classList.add("resuming");
        btnIcon.textContent = "▶";
        btnText.textContent = "Start Listening (48 kHz Mic)";
      } else {
        toggleBtn.classList.remove("resuming");
        btnIcon.textContent = "⏸";
        btnText.textContent = "Pause Listening";
      }
    }

    // 4. Threat Evaluation Card
    const threatBadge = container.querySelector("#threat-status-badge");
    if (threatBadge) {
      threatBadge.className = `threat-status-badge hazard-${dangerLevel.toLowerCase()}`;
      threatBadge.textContent = state.threatStatusText || (
        dangerLevel === 'DANGER' ? 'High Hazard Active' :
        dangerLevel === 'CAUTION' ? 'Caution Advised' :
        dangerLevel === 'AWARE' ? 'Notice Active' : 'Safe Condition'
      );
    }

    const boxSafe = container.querySelector("#threat-box-safe");
    const boxAware = container.querySelector("#threat-box-aware");
    const boxCaution = container.querySelector("#threat-box-caution");
    const boxDanger = container.querySelector("#threat-box-danger");

    if (boxSafe) boxSafe.className = `threat-level-box ${dangerLevel === 'SAFE' ? 'active-SAFE' : ''}`;
    if (boxAware) boxAware.className = `threat-level-box ${dangerLevel === 'AWARE' ? 'active-AWARE' : ''}`;
    if (boxCaution) boxCaution.className = `threat-level-box ${dangerLevel === 'CAUTION' ? 'active-CAUTION' : ''}`;
    if (boxDanger) boxDanger.className = `threat-level-box ${dangerLevel === 'DANGER' ? 'active-DANGER' : ''}`;

    // 5. Critical Alert Card
    const alertWrapper = container.querySelector("#critical-alert-wrapper");
    if (alertWrapper) {
      const alert = state.criticalAlert;
      if (!alert) {
        if (lastCriticalAlertId !== null) {
          alertWrapper.innerHTML = "";
          lastCriticalAlertId = null;
        }
      } else {
        const curAlertId = alert.id || (alert.class_name + alert.timestamp);
        if (lastCriticalAlertId !== curAlertId) {
          lastCriticalAlertId = curAlertId;
          alertWrapper.innerHTML = `
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
                <button class="aura-btn aura-btn-critical" id="btn-action-guide" type="button">
                  <span>✱</span>
                  <span>Action Guide</span>
                </button>
                <button class="aura-btn aura-btn-outline-critical" id="btn-dismiss-alert" type="button">
                  <span>✔</span>
                  <span>Dismiss Alert</span>
                </button>
              </div>
            </div>
          `;
        }
      }
    }

    // 6. Directional Compass Needle & Center Pod
    const needleEl = container.querySelector("#compass-needle");
    const podHeadingText = container.querySelector("#pod-heading-text");
    const podSubAngle = container.querySelector("#pod-sub-angle");
    const distText = container.querySelector("#compass-dist-val");
    const losText = container.querySelector("#compass-los-val");

    if (needleEl) {
      const rotDeg = compass.angle_deg ?? 195;
      needleEl.style.transform = `rotate(${rotDeg}deg)`;
    }
    if (podHeadingText) podHeadingText.textContent = compass.relative_heading || 'BEHIND YOU';
    if (podSubAngle) podSubAngle.textContent = compass.sub_heading || '195° SSW';
    if (distText) distText.textContent = `Estimated Distance: ${compass.estimated_distance || '8–12 meters'}`;
    if (losText) losText.textContent = compass.line_of_sight || 'Indoor Line-of-Sight';

    // 7. Recent Sounds List (Update only when content changes)
    const soundsListBody = container.querySelector("#recent-sounds-list-body");
    const currentSoundsJson = JSON.stringify(state.recentSounds || []);
    if (soundsListBody && currentSoundsJson !== lastRecentSoundsJson) {
      lastRecentSoundsJson = currentSoundsJson;
      soundsListBody.innerHTML = (state.recentSounds || []).map(sound => `
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
      `).join('');
    }
  }

  function startVisualizerLoop() {
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
          // React dynamically to live audio RMS and dB SPL
          const wave = Math.sin(tick + index * 0.45) * 0.5 + 0.5;
          const heightFactor = Math.min(1.0, Math.max(0.1, (baseDb - 25) / 60));
          height = Math.max(8, Math.min(50, Math.floor(10 + wave * 40 * heightFactor)));
        } else {
          // Idle ambient shimmer matching Stitch screenshot
          const heights = [14, 28, 42, 22, 38, 48, 44, 48, 30, 18, 26, 34, 24, 40, 30, 22];
          height = heights[index % heights.length];
        }

        bar.style.height = `${height}px`;

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

  // Subscribe to Application State
  appState.subscribe(state => {
    if (state.currentTab === "home") {
      if (!isMounted) {
        mountSkeleton(state);
      }
      updateDynamicFields(state);
    }
  });

  // Initial mount
  mountSkeleton(appState.get());
  updateDynamicFields(appState.get());
}
