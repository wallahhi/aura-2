# AURA — Assistive Sound Awareness & Spatial Radar Platform

> **Real-Time Environmental Sound Classification, 360° Direction-of-Arrival (DOA) Spatial Localization, Threat Evaluation, and Emergency Safety System for Deaf and Hard-of-Hearing (DHH) Individuals.**

---

## 1. System Overview

AURA is an end-to-end assistive audio platform integrating:
- **Active Sound Radar with Real-Time Audio Equalizer**: Captures ambient and escalated sounds with live dB SPL metering and dynamic visualizer bars.
- **Threat Evaluation Matrix**: Real-time 4-tier composite danger assessment (**SAFE**, **AWARE**, **CAUTION**, **DANGER**) synthesized from acoustic intensity, semantic threat severity, approach rate, and spatial context.
- **360° Spatial Audio Compass**: Generalized Cross-Correlation with Phase Transform (GCC-PHAT) time difference of arrival (TDOA) estimation resolving sound direction with relative heading indicators (e.g. `BEHIND YOU 195° SSW`) and distance estimation.
- **Prominent Critical Hazard Alerts**: Instant red card alerts for life-safety events (fire alarms, emergency sirens, car horns) with step-by-step Deaf Evacuation Action Guides.
- **Comprehensive Sound History**: Logged events grouped by timeline with category filter pills (`All`, `Critical`, `Caution`, `Notice`, `Info`) and on-device privacy guarantee.
- **System Settings & Preferences**: Sensitivity slider (`20 dB` to `85 dB`), haptic vibration tuning, alert library customization, theme switching (**Light Warm** vs. **Dark OLED**), accessibility high-contrast mode, and emergency SOS contacts.
- **Cancelable 10-Second SOS Emergency Response**: Automated countdown with visual strobe, vibration, and pre-formatted GPS dispatch template.

---

## 2. Project Directory Structure

```text
aura-integrated-first-pass/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── websocket/
│   │   │       ├── audio_stream.py      # WebSocket endpoint /ws/audio-stream
│   │   │       └── protocol.py          # Pydantic schemas for JSON protocol
│   │   ├── core/
│   │   │   ├── danger_service.py        # 4-factor composite danger engine & NIOSH dose
│   │   │   ├── gcc_phat.py              # Stereo TDOA cross-correlation & rear detection
│   │   │   └── sound_ontology.py        # 50+ class mapping, priorities & severities
│   │   ├── services/
│   │   │   ├── audio_preprocessor.py    # 80Hz filter, RMS gating & AGC
│   │   │   ├── pipeline_orchestrator.py # Dual-stage ingestion & branch routing
│   │   │   ├── whisper_service.py       # Whisper speech-to-text integration
│   │   │   └── yamnet_service.py        # Audio classification & DSP fallback
│   │   ├── config.py                    # Environment settings & thresholds
│   │   └── main.py                      # FastAPI app entrypoint & static file mount
│   └── requirements.txt                 # Backend Python dependencies
├── design-reference/                    # Google Stitch reference design exports
│   ├── home/screen.png                  # Stitch Screen 1 (Home Sound Radar)
│   ├── settings/screen.png              # Stitch Screen 2 (Settings & Preferences)
│   └── history/screen.png               # Stitch Screen 3 (Sound History)
├── frontend/
│   ├── index.html                       # Standalone mobile shell & viewport
│   └── src/
│       ├── css/
│       │   ├── theme.css                # Stitch design tokens, colors & typography
│       │   ├── home.css                 # Screen 1 radar, compass & alerts
│       │   ├── history.css              # Screen 3 timeline & acoustic summary
│       │   ├── settings.css             # Screen 2 configuration & toggles
│       │   └── modals.css               # SOS countdown, Action guide & simulator
│       └── js/
│           ├── app.js                   # Application bootstrap & event bus
│           ├── state.js                 # Reactive state manager with LocalStorage
│           ├── audio/
│           │   └── audio_capture.js     # Web Audio API 48 kHz stereo capture
│           ├── network/
│           │   └── websocket_client.js  # Reconnecting WebSocket client
│           └── components/
│               ├── home_view.js         # Screen 1 component
│               ├── history_view.js      # Screen 3 component
│               ├── settings_view.js     # Screen 2 component
│               └── modals.js            # SOS, Action Guide & simulator component
├── scripts/
│   ├── run_dev.py                       # Development server runner (PC + phone)
│   └── verify_e2e.py                    # End-to-end automated pipeline verification
└── tests/                               # Pytest test suite (13 automated tests)
```

---

## 3. Windows Setup & Startup Instructions (PowerShell)

### Prerequisites
- Python 3.10+ (Recommended: Python 3.11 or 3.12)
- Git (optional, for cloning)

### Step 1: Open PowerShell and Navigate to the Project
```powershell
cd "$HOME\Desktop\aura-integrated-first-pass"
```

### Step 2: Create and Activate Virtual Environment
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```
*(Note: If PowerShell displays an `ExecutionPolicy` error, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` and re-run the activate command).*

### Step 3: Install Dependencies
```powershell
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
```

### Step 4: Run the Development Server
```powershell
python scripts\run_dev.py
```

The terminal will display:
```text
============================================================
  SoundSense Standalone Assistive Mobile System
  FastAPI Backend + Minimalist Light-Theme Mobile UI
============================================================
  Local PC URL:   http://localhost:8000
  Phone (Wi-Fi):  http://192.168.x.x:8000
  WebSocket:      ws://192.168.x.x:8000/ws/audio-stream
============================================================
```

Open your browser to:
**`http://localhost:8000`**

---

## 4. macOS / Linux Startup Instructions

```bash
cd ~/Desktop/aura-integrated-first-pass
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
python3 scripts/run_dev.py
```

---

## 5. Verification & Testing

### Running Automated Test Suite
From the project root:
```bash
pytest tests/
```
Output:
```text
tests/test_danger_service.py ....                                        [ 30%]
tests/test_gcc_phat.py ....                                              [ 61%]
tests/test_websocket_protocol.py ..                                      [ 76%]
tests/test_yamnet_routing.py ...                                         [100%]
======================== 13 passed in 2.5s ========================
```

### Running End-to-End Pipeline Verification
```bash
python scripts/verify_e2e.py
```
This validates:
1. Health endpoint (`GET /health`)
2. Sound ontology registry (`GET /api/v1/sounds/categories`)
3. WebSocket audio streaming & dual-stage ingestion gate
4. GCC-PHAT directional localization (`Car horn` -> East, `Siren` -> West/Rear)
5. Danger scoring formula, cooldown, and automated SOS thresholding
6. Whisper speech transcription streaming

---

## 6. Accessing on a Mobile Phone (Wi-Fi Microphone Notes)

Browsers (Chrome, Safari) restrict microphone access (`getUserMedia`) to **Secure Contexts** (`https://` or `localhost`). When testing on a smartphone connected to your local Wi-Fi:

1. **Option A (Instant HTTPS Tunnel - Recommended)**:
   ```bash
   npx localtunnel --port 8000
   ```
   Open the generated `https://...loca.lt` URL on your phone.

2. **Option B (Android Chrome Insecure Origin Flag)**:
   - On Android Chrome, navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
   - Add your PC's IP: `http://192.168.x.x:8000`
   - Relaunch Chrome and open `http://192.168.x.x:8000`.

3. **Option C (Built-In Synthetic Simulator)**:
   - You can test all sound categories, angles, dB SPL levels, speech transcription, and rear-hemisphere sound without requiring an external microphone using the **floating developer simulator drawer** at the bottom of the screen!

---

## 7. Known Architectural Notes & Privacy Guarantees

- **100% On-Device Processing**: Audio analysis runs in ephemeral circular RAM buffers (250 ms chunks). Raw microphone buffers are never recorded to disk or uploaded to remote cloud servers.
- **YAMNet & DSP Fallback**: In production or edge environments without TensorFlow Hub / GPU availability, the backend automatically transitions to an on-device digital signal processing (DSP) acoustic signature classifier (zero external network requirement).
- **Rear Hemisphere Ambiguity Resolution**: Evaluates high-frequency spectral shadowing ratios ($\Gamma < 0.085$) to distinguish true rear acoustic arrivals from frontal broadside events.
