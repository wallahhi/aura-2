/**
 * Web Audio API Adaptive Capture Service.
 * Detects available hardware microphones and dynamically configures:
 * - 1-Mic System (Mono Omnidirectional)
 * - 2-Mic System (Dual-Channel Linear Array)
 * - 3-Mic System (Planar Smartwatch Array)
 * 
 * Streams interleaved 16-bit PCM over WebSocket and updates reactive app state.
 */

import { appState } from "../state.js";

export class AudioCaptureService {
  constructor(wsClient) {
    this.wsClient = wsClient;
    this.audioContext = null;
    this.mediaStream = null;
    this.processorNode = null;
    this.isCapturing = false;
    this.seq = 0;
    this.channels = 1;
    this.targetSampleRate = 48000;
    
    // Chunk accumulator buffers (~250ms chunks)
    this.accumulatedCh1 = [];
    this.accumulatedCh2 = [];
    this.accumulatedCh3 = [];
    this.samplesAccumulated = 0;
    this.chunkThreshold = 12288; // 256 ms at 48kHz
  }

  /**
   * Probes available audio input devices and capability metadata
   */
  async probeAudioHardware() {
    let availableMicsCount = 1;
    let deviceLabel = "Default Microphone";
    let maxChannelCount = 1;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === "audioinput");
        availableMicsCount = Math.max(1, audioInputs.length);
        if (audioInputs[0] && audioInputs[0].label) {
          deviceLabel = audioInputs[0].label;
        }
      }
    } catch (e) {
      console.warn("[AudioCapture] enumerateDevices failed:", e);
    }

    return {
      availableMicsCount,
      deviceLabel,
      maxChannelCount
    };
  }

  async start() {
    if (this.isCapturing) return;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (window.location.hostname === "0.0.0.0") {
          window.location.replace(window.location.href.replace("//0.0.0.0", "//localhost"));
          return false;
        }
        throw new Error(
          "Microphone access is restricted by modern browsers to Secure Contexts.\n\n" +
          "• If on this PC: Open http://localhost:8000 (do not use 0.0.0.0:8000).\n" +
          "• If on phone over Wi-Fi: Run 'npx localtunnel --port 8000' for instant HTTPS."
        );
      }

      const hardwareInfo = await this.probeAudioHardware();

      // Request maximum available channels (up to 3 for smartwatch/array, fallback to 2 or 1)
      const constraints = {
        audio: {
          channelCount: { ideal: 3, min: 1 },
          sampleRate: this.targetSampleRate,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          googEchoCancellation: false,
          googAutoGainControl: false,
          googNoiseSuppression: false,
          googHighpassFilter: false,
          googTypingNoiseDetection: false
        }
      };

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn("[AudioCapture] Ideal multi-channel constraints rejected, falling back to basic audio stream:", err);
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: { ideal: 2 },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
      }
      
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      try {
        this.audioContext = new AudioCtx({ sampleRate: this.targetSampleRate });
      } catch (e) {
        this.audioContext = new AudioCtx();
      }

      // Resume context if suspended
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      const track = this.mediaStream.getAudioTracks()[0];
      const trackSettings = track && track.getSettings ? track.getSettings() : {};
      const reportedChannels = trackSettings.channelCount || sourceNode.channelCount || 1;
      
      // Determine physical channel count: 1, 2, or 3
      this.channels = Math.min(3, Math.max(1, reportedChannels));
      console.log(`[AudioCapture] Connected audio stream. Track channels: ${reportedChannels}, Configured: ${this.channels} channels.`);

      const micMode = this.channels === 3 ? "3_mic_planar" : this.channels === 2 ? "2_mic_dual" : "1_mic_mono";
      const micModeLabel = this.channels === 3 ? "3 Mics (Planar Smartwatch Array)" : this.channels === 2 ? "2 Mics (Dual Stereo Array)" : "1 Mic (Mono Omnidirectional)";

      // Update reactive application state with mic hardware details
      appState.set({
        micCount: this.channels,
        micMode: micMode,
        micModeLabel: micModeLabel,
        availableMicsCount: hardwareInfo.availableMicsCount,
        micDeviceName: hardwareInfo.deviceLabel || (track && track.label) || "Built-in Microphone",
        isListening: true
      });

      // 4096 samples buffer (~85 ms at 48kHz)
      const bufferSize = 4096;
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, this.channels, this.channels);

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isCapturing) return;
        this._handleAudioProcess(e);
      };

      // Connect through a zero-gain node so ScriptProcessor runs without acoustic speaker feedback
      const muteGain = this.audioContext.createGain();
      muteGain.gain.value = 0.0;
      sourceNode.connect(this.processorNode);
      this.processorNode.connect(muteGain);
      muteGain.connect(this.audioContext.destination);

      this.isCapturing = true;
      console.log(`[AudioCapture] Ingestion started at ${this.audioContext.sampleRate} Hz (${this.channels} channels active).`);
      return true;
    } catch (err) {
      console.error("[AudioCapture] Could not start microphone:", err);
      alert(`Microphone access error: ${err.message}`);
      return false;
    }
  }

  stop() {
    if (!this.isCapturing) return;

    this.isCapturing = false;
    appState.set({ isListening: false, audioState: "16kHz_idle" });

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    this.accumulatedCh1 = [];
    this.accumulatedCh2 = [];
    this.accumulatedCh3 = [];
    this.samplesAccumulated = 0;
    console.log("[AudioCapture] Stopped audio capture");
  }

  _handleAudioProcess(e) {
    const inputBuffer = e.inputBuffer;
    const len = inputBuffer.length;
    const numChannels = inputBuffer.numberOfChannels;

    const ch1 = inputBuffer.getChannelData(0);
    const ch2 = numChannels >= 2 ? inputBuffer.getChannelData(1) : ch1;
    const ch3 = numChannels >= 3 ? inputBuffer.getChannelData(2) : ch1;

    // Detect if multi-channel hardware is delivering identical duplicated mono
    if (numChannels >= 2) {
      let maxDiff = 0;
      for (let i = 0; i < len; i += 8) {
        const d = Math.abs(ch1[i] - ch2[i]);
        if (d > maxDiff) maxDiff = d;
      }
      const curState = appState.get();
      if (maxDiff < 1e-4 && curState.micCount > 1) {
        // Identical channels = 1 physical mono mic present
        appState.set({
          micCount: 1,
          micMode: "1_mic_mono",
          micModeLabel: "1 Mic (Mono Omnidirectional Hardware)"
        });
      }
    }

    // 1. Compute Immediate Frame RMS for instant UI feedback
    let sumSquares = 0;
    for (let i = 0; i < len; i++) {
      const avgAmp = (ch1[i] + ch2[i] + ch3[i]) / 3.0;
      sumSquares += avgAmp * avgAmp;
    }
    const rms = Math.sqrt(sumSquares / len);
    const dbSpl = Math.max(30.0, Math.min(115.0, 100.0 + 20.0 * Math.log10(rms + 1e-9)));

    // Immediately reflect active voice and live dB SPL on status pill
    const threshold = appState.get().settings.thresholdX || 0.015;
    appState.set({
      audioState: rms >= threshold ? "48kHz_active" : "16kHz_idle",
      rms: Math.round(rms * 1000) / 1000,
      dbSpl: Math.round(dbSpl)
    });

    // 2. Accumulate samples to build ~250ms chunks (avoids network packet saturation)
    for (let i = 0; i < len; i++) {
      this.accumulatedCh1.push(ch1[i]);
      if (this.channels >= 2) this.accumulatedCh2.push(ch2[i]);
      if (this.channels >= 3) this.accumulatedCh3.push(ch3[i]);
    }
    this.samplesAccumulated += len;

    if (this.samplesAccumulated >= this.chunkThreshold) {
      this._flushChunk();
    }
  }

  _flushChunk() {
    const totalSamples = this.samplesAccumulated;
    if (totalSamples === 0) return;

    // Convert float32 [-1.0, 1.0] to interleaved 16-bit signed PCM
    let int16Array;
    if (this.channels === 3) {
      int16Array = new Int16Array(totalSamples * 3);
      for (let i = 0; i < totalSamples; i++) {
        int16Array[i * 3] = Math.max(-32768, Math.min(32767, Math.floor(this.accumulatedCh1[i] * 32767)));
        int16Array[i * 3 + 1] = Math.max(-32768, Math.min(32767, Math.floor(this.accumulatedCh2[i] * 32767)));
        int16Array[i * 3 + 2] = Math.max(-32768, Math.min(32767, Math.floor(this.accumulatedCh3[i] * 32767)));
      }
    } else if (this.channels === 2) {
      int16Array = new Int16Array(totalSamples * 2);
      for (let i = 0; i < totalSamples; i++) {
        int16Array[i * 2] = Math.max(-32768, Math.min(32767, Math.floor(this.accumulatedCh1[i] * 32767)));
        int16Array[i * 2 + 1] = Math.max(-32768, Math.min(32767, Math.floor(this.accumulatedCh2[i] * 32767)));
      }
    } else {
      int16Array = new Int16Array(totalSamples);
      for (let i = 0; i < totalSamples; i++) {
        int16Array[i] = Math.max(-32768, Math.min(32767, Math.floor(this.accumulatedCh1[i] * 32767)));
      }
    }

    // Convert Int16Array to Base64
    const uint8View = new Uint8Array(int16Array.buffer);
    let binaryStr = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8View.length; i += chunkSize) {
      const slice = uint8View.subarray(i, i + chunkSize);
      binaryStr += String.fromCharCode.apply(null, slice);
    }
    const b64Data = btoa(binaryStr);

    // Stream chunk over WebSocket with actual channels count
    const actualFs = this.audioContext ? this.audioContext.sampleRate : this.targetSampleRate;
    this.wsClient.sendAudioChunk(b64Data, actualFs, this.channels, this.seq++);

    // Reset buffer
    this.accumulatedCh1 = [];
    this.accumulatedCh2 = [];
    this.accumulatedCh3 = [];
    this.samplesAccumulated = 0;
  }
}
