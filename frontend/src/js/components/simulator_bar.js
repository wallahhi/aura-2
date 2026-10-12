/**
 * Built-in Demo / Simulator Component.
 * Collapsible developer drawer for synthetic delay injection,
 * sound presets, Whisper speech prompts, and SOS countdown verification.
 */

export function initSimulatorBar(containerEl, onTriggerSynthetic, onToggleMic) {
  const barHtml = `
    <div id="sim-drawer" style="
      border-top: 1px solid var(--border-subtle);
      background-color: var(--bg-surface);
      flex: 0 0 auto;
      transition: all 0.25s ease;
    ">
      <!-- Collapsible Header Toggle -->
      <div id="sim-drawer-toggle" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 20px;
        cursor: pointer;
        user-select: none;
        background-color: var(--bg-subtle);
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary);">
            Simulator & Acoustic Presets
          </span>
          <span style="font-size: 11px; color: var(--text-secondary);">(Single-Mic / Demo)</span>
        </div>
        <span id="sim-drawer-icon" style="font-size: 12px; color: var(--text-secondary); transition: transform 0.2s ease;">▼</span>
      </div>

      <!-- Collapsible Body -->
      <div id="sim-drawer-body" style="padding: 14px 20px; display: flex; flex-direction: column; gap: 12px; max-height: 250px; overflow-y: auto;">
        <!-- Live Microphone Toggle -->
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">Live Microphone Ingestion</span>
          <button id="btn-toggle-mic" class="btn-secondary" style="font-size: 12px; padding: 4px 10px;">
            Start Mic (48kHz)
          </button>
        </div>

        <!-- Synthetic Delay Slider -->
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">
              Synthetic Stereo Delay (τ)
            </span>
            <span id="display-delay-samples" style="font-size: 12px; font-weight: 600; color: var(--text-primary);">
              0 samples (Center N)
            </span>
          </div>
          <input type="range" id="sim-delay-slider" min="-18" max="18" step="1" value="0" style="width: 100%; accent-color: var(--text-primary);" />
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-tertiary); margin-top: 2px;">
            <span>Right (East)</span>
            <span>Ahead (North)</span>
            <span>Left (West)</span>
          </div>
        </div>

        <!-- Presets Row -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
          <button id="btn-preset-horn" class="btn-secondary" style="text-align: left; padding: 8px;">
            <div style="font-weight: 600; font-size: 12px;">Car Horn</div>
            <div style="font-size: 10px; color: var(--text-secondary);">East (Right · NE)</div>
          </button>
          
          <button id="btn-preset-siren" class="btn-secondary" style="text-align: left; padding: 8px;">
            <div style="font-weight: 600; font-size: 12px; color: var(--status-danger-text);">Emergency Siren</div>
            <div style="font-size: 10px; color: var(--text-secondary);">West (Left · NW)</div>
          </button>

          <button id="btn-preset-speech" class="btn-secondary" style="text-align: left; padding: 8px;">
            <div style="font-weight: 600; font-size: 12px;">Speech (Whisper)</div>
            <div style="font-size: 10px; color: var(--text-secondary);">Live transcript prompt</div>
          </button>

          <button id="btn-preset-sos" class="btn-secondary" style="text-align: left; padding: 8px; border-color: var(--status-danger-border);">
            <div style="font-weight: 600; font-size: 12px; color: var(--status-danger-text);">Critical SOS Test</div>
            <div style="font-size: 10px; color: var(--text-secondary);">Danger D >= 90 (10s countdown)</div>
          </button>
        </div>
      </div>
    </div>
  `;

  containerEl.innerHTML = barHtml;

  const drawerToggle = containerEl.querySelector("#sim-drawer-toggle");
  const drawerIcon = containerEl.querySelector("#sim-drawer-icon");
  const drawerBody = containerEl.querySelector("#sim-drawer-body");
  const btnToggleMic = containerEl.querySelector("#btn-toggle-mic");
  const delaySlider = containerEl.querySelector("#sim-delay-slider");
  const displayDelay = containerEl.querySelector("#display-delay-samples");

  const btnHorn = containerEl.querySelector("#btn-preset-horn");
  const btnSiren = containerEl.querySelector("#btn-preset-siren");
  const btnSpeech = containerEl.querySelector("#btn-preset-speech");
  const btnSos = containerEl.querySelector("#btn-preset-sos");

  let isCollapsed = false;

  drawerToggle.addEventListener("click", () => {
    isCollapsed = !isCollapsed;
    drawerBody.style.display = isCollapsed ? "none" : "flex";
    drawerIcon.style.transform = isCollapsed ? "rotate(-90deg)" : "rotate(0deg)";
  });

  delaySlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    let label = `${val} samples`;
    if (val === 0) label = "0 samples (Center · N)";
    else if (val > 0) label = `+${val} samples (Left · W/NW)`;
    else label = `${val} samples (Right · E/NE)`;
    displayDelay.textContent = label;
  });

  btnToggleMic.addEventListener("click", () => {
    onToggleMic(btnToggleMic);
  });

  btnHorn.addEventListener("click", () => {
    const delay = parseInt(delaySlider.value, 10) || -10;
    onTriggerSynthetic("Car horn", delay, 85.0, 0.88, null);
  });

  btnSiren.addEventListener("click", () => {
    const delay = parseInt(delaySlider.value, 10) || 12;
    onTriggerSynthetic("Siren", delay, 92.0, 0.94, null);
  });

  btnSpeech.addEventListener("click", () => {
    const prompts = [
      "Attention: Please mind the gap between the train and the platform.",
      "Watch out, a cyclist is turning quickly across the corner.",
      "Excuse me, do you know which way to the central transit station?"
    ];
    const prompt = prompts[Math.floor(Math.random() * prompts.length)];
    onTriggerSynthetic("Speech", 0, 72.0, 0.95, prompt);
  });

  btnSos.addEventListener("click", () => {
    onTriggerSynthetic("Siren", 14, 98.0, 0.98, null);
  });
}
