/**
 * AURA Settings View Component.
 * Implements Screen 2 from Stitch Reference:
 * - System Configuration Header
 * - Listening & Alerts (Visual Intensity, Haptics, 360 Direction, Audio Threshold Slider)
 * - Sound Alert Library (6 Monitored categories with individual toggles)
 * - Language & Accessibility (Speech language, High contrast, Screen flash, Font scaling)
 * - Appearance & Theme (Warm Light vs OLED Dark card selection)
 * - Privacy & Permissions (Microphone status)
 * - Emergency SOS Contacts (List, Add contact, Dispatch notice)
 */

import { appState } from "../state.js";

export function initSettingsView(container, wsClient) {
  function render(state) {
    const s = state.settings;
    const theme = state.theme || "light";

    container.innerHTML = `
      <div class="settings-view-container">
        <!-- Header Block -->
        <div class="settings-header-block">
          <div class="settings-sys-pill">System Configuration</div>
          <h1 class="settings-main-title">Settings &amp; Preferences</h1>
          <p class="settings-subtitle">Customize detection sensitivity, sensory alerts, and accessibility.</p>
        </div>

        <!-- 1. Listening & Alerts Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">
              <span style="color: var(--brand-teal);">👂</span>
              <span>Listening &amp; Alerts</span>
            </div>
            <span class="settings-section-badge">Engine Active</span>
          </div>

          <div class="settings-card">
            <!-- Visual Alert Intensity -->
            <div class="setting-row">
              <div class="setting-row-top">
                <div class="setting-label-group">
                  <div class="setting-title">Visual Alert Intensity</div>
                  <div class="setting-desc">Specifies screen flash luminance and alert card animation speed.</div>
                </div>
              </div>
              <div class="segmented-control" id="ctrl-visual-intensity">
                <button class="segment-btn ${s.visualIntensity === 'subtle' ? 'active' : ''}" data-val="subtle">Subtle</button>
                <button class="segment-btn ${s.visualIntensity === 'standard' || !s.visualIntensity ? 'active' : ''}" data-val="standard">Standard</button>
                <button class="segment-btn ${s.visualIntensity === 'strobe' ? 'active' : ''}" data-val="strobe">📍 Strobe Flash</button>
              </div>
            </div>

            <!-- Haptic Vibration Engine -->
            <div class="setting-row">
              <div class="setting-row-top">
                <div class="setting-label-group">
                  <div class="setting-title">
                    <span>📳</span>
                    <span>Haptic Vibration Engine</span>
                  </div>
                  <div class="setting-desc">Tactile pulses customized by sound severity on device motor.</div>
                </div>
                <label class="aura-switch">
                  <input type="checkbox" id="toggle-haptics" ${s.hapticsEnabled ? 'checked' : ''} />
                  <span class="aura-slider"></span>
                </label>
              </div>

              <!-- Vibration Force Selector -->
              <div style="font-size: 11px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; margin-top: 4px;">Vibration Force</div>
              <div class="segmented-control" id="ctrl-vibration-force">
                <button class="segment-btn ${s.vibrationForce === 'light' ? 'active brand' : ''}" data-val="light">Light</button>
                <button class="segment-btn ${s.vibrationForce === 'medium' ? 'active brand' : ''}" data-val="medium">Medium</button>
                <button class="segment-btn ${s.vibrationForce === 'strong' || !s.vibrationForce ? 'active brand' : ''}" data-val="strong">Strong</button>
              </div>
            </div>

            <!-- Show 360° Sound Direction -->
            <div class="setting-row">
              <div class="setting-row-top">
                <div class="setting-label-group">
                  <div class="setting-title">
                    <span>🧭</span>
                    <span>Show 360° Sound Direction</span>
                  </div>
                  <div class="setting-desc">Requires multi-microphone smartphone array to render vector origin.</div>
                </div>
                <label class="aura-switch">
                  <input type="checkbox" id="toggle-360-direction" ${s.showDirection360 !== false ? 'checked' : ''} />
                  <span class="aura-slider"></span>
                </label>
              </div>
            </div>

            <!-- Minimum Audio Threshold Slider -->
            <div class="setting-row">
              <div class="setting-row-top">
                <div class="setting-label-group">
                  <div class="setting-title">Minimum Audio Threshold</div>
                  <div class="setting-desc">Ignore sounds below <span id="label-db-threshold">${s.thresholdX || 40} dB</span> (Whisper/Ambient noise floor).</div>
                </div>
                <div class="aura-pill-db" id="badge-db-val">${s.thresholdX || 40} dB</div>
              </div>
              <div class="range-slider-wrapper">
                <input type="range" class="aura-range-input" id="range-audio-threshold" min="20" max="85" value="${s.thresholdX || 40}" />
                <div class="range-labels-row">
                  <span>20 dB (Quiet)</span>
                  <span>40 dB</span>
                  <span>85 dB (Loud only)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Sound Alert Library Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">
              <span style="color: var(--brand-teal);">🎛</span>
              <span>Sound Alert Library</span>
            </div>
            <span class="settings-section-badge">6 Monitored</span>
          </div>

          <div class="settings-card">
            <div class="alert-library-list">
              <!-- Smoke & Fire Alarms (Locked Always Enabled) -->
              <div class="alert-library-item">
                <div class="alert-item-left">
                  <div class="alert-item-icon-square critical">🔥</div>
                  <div class="setting-label-group">
                    <div class="setting-title">
                      <span>Smoke &amp; Fire Alarms</span>
                      <span style="font-size: 12px;">🔒</span>
                    </div>
                    <div class="setting-desc" style="color: #C5221F; font-weight: 600;">● Always Enabled · Level 3 Critical</div>
                  </div>
                </div>
                <label class="aura-switch">
                  <input type="checkbox" checked disabled />
                  <span class="aura-slider" style="background-color: #C5221F;"></span>
                </label>
              </div>

              <!-- Emergency Sirens & Horns -->
              <div class="alert-library-item">
                <div class="alert-item-left">
                  <div class="alert-item-icon-square caution">🚨</div>
                  <div class="setting-label-group">
                    <div class="setting-title">Emergency Sirens &amp; Horns</div>
                    <div class="setting-desc">Critical · Strobe + Max Haptic</div>
                  </div>
                </div>
                <label class="aura-switch">
                  <input type="checkbox" id="toggle-sirens" ${s.alertLibrary?.sirens_horns !== false ? 'checked' : ''} />
                  <span class="aura-slider"></span>
                </label>
              </div>

              <!-- Doorbells & Knocking -->
              <div class="alert-library-item">
                <div class="alert-item-left">
                  <div class="alert-item-icon-square notice">🚪</div>
                  <div class="setting-label-group">
                    <div class="setting-title">Doorbells &amp; Knocking</div>
                    <div class="setting-desc">Caution · Subtle Banner + Pulse</div>
                  </div>
                </div>
                <label class="aura-switch">
                  <input type="checkbox" id="toggle-doorbells" ${s.alertLibrary?.doorbells_knocking !== false ? 'checked' : ''} />
                  <span class="aura-slider"></span>
                </label>
              </div>

              <!-- Baby Crying / Voice Calls -->
              <div class="alert-library-item">
                <div class="alert-item-left">
                  <div class="alert-item-icon-square notice">👶</div>
                  <div class="setting-label-group">
                    <div class="setting-title">Baby Crying / Voice Calls</div>
                    <div class="setting-desc">Caution · Triple Haptic Tap</div>
                  </div>
                </div>
                <label class="aura-switch">
                  <input type="checkbox" id="toggle-baby" ${s.alertLibrary?.baby_crying !== false ? 'checked' : ''} />
                  <span class="aura-slider"></span>
                </label>
              </div>

              <!-- Appliance Beeps & Timers -->
              <div class="alert-library-item">
                <div class="alert-item-left">
                  <div class="alert-item-icon-square notice">⏱</div>
                  <div class="setting-label-group">
                    <div class="setting-title">Appliance Beeps &amp; Timers</div>
                    <div class="setting-desc">Notice · Single Micro-Tap</div>
                  </div>
                </div>
                <label class="aura-switch">
                  <input type="checkbox" id="toggle-appliances" ${s.alertLibrary?.appliance_beeps !== false ? 'checked' : ''} />
                  <span class="aura-slider"></span>
                </label>
              </div>

              <!-- Ambient Background Sounds -->
              <div class="alert-library-item">
                <div class="alert-item-left">
                  <div class="alert-item-icon-square muted">🍃</div>
                  <div class="setting-label-group">
                    <div class="setting-title">Ambient Background Sounds</div>
                    <div class="setting-desc">Muted · Traffic, wind &amp; HVAC</div>
                  </div>
                </div>
                <label class="aura-switch">
                  <input type="checkbox" id="toggle-ambient" ${s.alertLibrary?.ambient_background === true ? 'checked' : ''} />
                  <span class="aura-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Language & Accessibility Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">
              <span style="color: var(--brand-teal);">♿</span>
              <span>Language &amp; Accessibility</span>
            </div>
          </div>

          <div class="settings-card">
            <!-- Language Dropdown -->
            <div class="setting-row">
              <div class="setting-title">Primary Speech Recognition Language</div>
              <select class="aura-select" id="select-language">
                <option value="en-US" ${s.language === 'en-US' ? 'selected' : ''}>English (US) - Atkinson Hyperlegible</option>
                <option value="es-ES" ${s.language === 'es-ES' ? 'selected' : ''}>Spanish (ES)</option>
                <option value="fr-FR" ${s.language === 'fr-FR' ? 'selected' : ''}>French (FR)</option>
                <option value="de-DE" ${s.language === 'de-DE' ? 'selected' : ''}>German (DE)</option>
              </select>
            </div>

            <!-- Extra High Contrast Colors -->
            <div class="setting-row">
              <div class="setting-row-top">
                <div class="setting-label-group">
                  <div class="setting-title">
                    <span>Extra High Contrast Colors</span>
                    <span class="aura-pill-db" style="padding: 1px 6px; font-size: 10px;">AAA</span>
                  </div>
                  <div class="setting-desc">Elevates luminance margins and thickens indicator glyph boundaries.</div>
                </div>
                <label class="aura-switch">
                  <input type="checkbox" id="toggle-contrast" ${s.highContrast ? 'checked' : ''} />
                  <span class="aura-slider"></span>
                </label>
              </div>
            </div>

            <!-- Screen Flash on Critical Alarms -->
            <div class="setting-row">
              <div class="setting-row-top">
                <div class="setting-label-group">
                  <div class="setting-title">Screen Flash on Critical Alarms</div>
                  <div class="setting-desc">Pulsates display perimeter with high-contrast red warning borders.</div>
                </div>
                <label class="aura-switch">
                  <input type="checkbox" id="toggle-screen-flash" ${s.screenFlash !== false ? 'checked' : ''} />
                  <span class="aura-slider"></span>
                </label>
              </div>
            </div>

            <!-- Live Transcription Font Scaling -->
            <div class="setting-row">
              <div class="setting-row-top">
                <div class="setting-title">Live Transcription Font Scaling</div>
                <div style="font-size: 11px; font-weight: 700; color: var(--brand-teal);">
                  ${s.fontScaling === 'large' ? 'Large 120%' : s.fontScaling === 'xl' ? 'XL 140%' : 'Default (100%)'}
                </div>
              </div>
              <div class="segmented-control" id="ctrl-font-scaling">
                <button class="segment-btn ${s.fontScaling === 'default' || !s.fontScaling ? 'active' : ''}" data-val="default">Default 100%</button>
                <button class="segment-btn ${s.fontScaling === 'large' ? 'active' : ''}" data-val="large">Large 120%</button>
                <button class="segment-btn ${s.fontScaling === 'xl' ? 'active' : ''}" data-val="xl">XL 140%</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Appearance & Theme Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">
              <span style="color: var(--brand-teal);">🎨</span>
              <span>Appearance &amp; Theme</span>
            </div>
          </div>

          <div class="settings-card">
            <div style="font-size: 13.5px; font-weight: 700;">Display Aesthetic</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: -8px;">Calm warmth tuned for prolonged daytime wakefulness or low-fatigue night vision.</div>

            <div class="theme-selector-grid">
              <!-- Light (Warm) Option -->
              <div class="theme-card-option ${theme === 'light' ? 'active' : ''}" id="opt-theme-light">
                <div class="theme-option-top">
                  <span style="font-size: 20px;">☀</span>
                  <span style="color: var(--brand-teal); font-weight: 800;">${theme === 'light' ? '✔' : '○'}</span>
                </div>
                <div class="theme-option-name">Light (Warm)</div>
                <div class="theme-option-desc">Off-white soft canvas</div>
              </div>

              <!-- Dark (OLED) Option -->
              <div class="theme-card-option ${theme === 'dark' ? 'active' : ''}" id="opt-theme-dark">
                <div class="theme-option-top">
                  <span style="font-size: 20px;">🌙</span>
                  <span style="color: var(--brand-teal); font-weight: 800;">${theme === 'dark' ? '✔' : '○'}</span>
                </div>
                <div class="theme-option-name">Dark (OLED)</div>
                <div class="theme-option-desc">Pure black battery saver</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. Privacy & Permissions Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">
              <span style="color: var(--brand-teal);">🛡</span>
              <span>Privacy &amp; Permissions</span>
            </div>
          </div>

          <div class="settings-card">
            <div style="display: flex; gap: 12px; align-items: flex-start;">
              <div style="font-size: 24px; color: var(--brand-teal);">🛡</div>
              <div class="setting-label-group">
                <div class="setting-title">Microphone &amp; On-Device Processing</div>
                <div class="setting-desc">Audio is analyzed 100% on-device in volatile memory. No audio recordings or voice transcripts are ever stored, uploaded, or shared with cloud servers.</div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--border-light);">
              <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600;">
                <span class="dot green" style="width: 8px; height: 8px; border-radius: 50%; background-color: #2E7D32;"></span>
                <span>Microphone Permission</span>
              </div>
              <div class="aura-pill-db" style="background-color: var(--brand-cyan-pill); color: var(--brand-cyan-text);">Granted</div>
            </div>
          </div>
        </div>

        <!-- 6. Emergency SOS Contacts Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">
              <span style="color: #C5221F;">🆘</span>
              <span>Emergency SOS Contacts</span>
            </div>
            <span class="settings-section-badge" style="color: var(--text-secondary);">${(s.emergencyContacts || []).length} Configured</span>
          </div>

          <div class="settings-card">
            <div class="contacts-list">
              ${(s.emergencyContacts || []).map(contact => `
                <div class="contact-card-item">
                  <div class="contact-left">
                    <div class="contact-avatar">${contact.initials || 'C'}</div>
                    <div class="contact-info">
                      <div class="contact-name">${contact.name}</div>
                      <div class="contact-meta">${contact.role || contact.relationship} · ${contact.phone}</div>
                    </div>
                  </div>
                  <button class="contact-edit-btn" title="Edit Contact" data-id="${contact.id}">✏</button>
                </div>
              `).join('')}
            </div>

            <button class="add-contact-btn" id="btn-add-contact">
              <span>👤+</span>
              <span>Add Emergency Contact</span>
            </button>

            <div class="settings-notice-box">
              <span style="font-size: 15px;">ℹ</span>
              <div>
                <strong>SOS Alert Dispatch Notice:</strong> In this prototype, SOS activates local flashing and generates a ready-to-send SMS template on your device. Automated background 911 calling is not available without cellular carrier emergency integration.
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Info -->
        <div class="settings-footer-info">
          <div>🚀 AURA Version 1.4.0 (Build 384) · Prototype Edition</div>
          <div style="color: var(--brand-teal); font-weight: 600; cursor: pointer;">Acoustic Accessibility Guidelines · Feedback</div>
        </div>
      </div>
    `;

    // Event Bindings

    // 1. Threshold Range Slider
    const rangeInput = container.querySelector("#range-audio-threshold");
    const badgeDb = container.querySelector("#badge-db-val");
    const labelDb = container.querySelector("#label-db-threshold");
    if (rangeInput) {
      rangeInput.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        if (badgeDb) badgeDb.textContent = `${val} dB`;
        if (labelDb) labelDb.textContent = `${val} dB`;
      });
      rangeInput.addEventListener("change", (e) => {
        const val = parseInt(e.target.value);
        appState.updateSettings({ thresholdX: val });
        // Send backend config update
        const linearRms = Math.pow(10, (val - 100) / 20);
        wsClient.sendConfigUpdate({ rms_threshold: linearRms });
      });
    }

    // 2. Visual Alert Intensity Segmented Control
    container.querySelectorAll("#ctrl-visual-intensity .segment-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-val");
        appState.updateSettings({ visualIntensity: val });
      });
    });

    // 3. Vibration Force Control
    container.querySelectorAll("#ctrl-vibration-force .segment-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-val");
        appState.updateSettings({ vibrationForce: val });
      });
    });

    // 4. Haptics switch
    const toggleHaptics = container.querySelector("#toggle-haptics");
    if (toggleHaptics) {
      toggleHaptics.addEventListener("change", (e) => {
        appState.updateSettings({ hapticsEnabled: e.target.checked });
      });
    }

    // 5. 360 Direction switch
    const toggle360 = container.querySelector("#toggle-360-direction");
    if (toggle360) {
      toggle360.addEventListener("change", (e) => {
        appState.updateSettings({ showDirection360: e.target.checked });
      });
    }

    // 6. Theme Switching Cards (Light vs Dark)
    const optLight = container.querySelector("#opt-theme-light");
    const optDark = container.querySelector("#opt-theme-dark");
    if (optLight) {
      optLight.addEventListener("click", () => {
        appState.setTheme("light");
      });
    }
    if (optDark) {
      optDark.addEventListener("click", () => {
        appState.setTheme("dark");
      });
    }

    // 7. Contrast & Flash
    const toggleContrast = container.querySelector("#toggle-contrast");
    if (toggleContrast) {
      toggleContrast.addEventListener("change", (e) => {
        document.documentElement.setAttribute("data-contrast", e.target.checked ? "high" : "normal");
        appState.updateSettings({ highContrast: e.target.checked });
      });
    }

    const toggleFlash = container.querySelector("#toggle-screen-flash");
    if (toggleFlash) {
      toggleFlash.addEventListener("change", (e) => {
        appState.updateSettings({ screenFlash: e.target.checked });
      });
    }

    // 8. Font Scaling
    container.querySelectorAll("#ctrl-font-scaling .segment-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-val");
        document.documentElement.setAttribute("data-font-scale", val);
        appState.updateSettings({ fontScaling: val });
      });
    });

    // 9. Add Contact Button
    const addContactBtn = container.querySelector("#btn-add-contact");
    if (addContactBtn) {
      addContactBtn.addEventListener("click", () => {
        const name = prompt("Enter Emergency Contact Name:");
        if (!name) return;
        const phone = prompt("Enter Phone Number (e.g. +1 (555) 000-0000):") || "+1 (555) 000-0000";
        const role = prompt("Enter Relationship (e.g. Family / Caregiver):") || "Family";
        const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
        const contacts = [...(s.emergencyContacts || []), { id: Date.now(), name, phone, role, initials }];
        appState.updateSettings({ emergencyContacts: contacts });
      });
    }
  }

  appState.subscribe(state => {
    if (state.currentTab === "settings") {
      render(state);
    }
  });

  render(appState.get());
}
