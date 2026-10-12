/**
 * Web Audio API Stereo Capture Service.
 * Implements dual-stage audio ingestion:
 * - Idle monitoring: evaluates frame RMS and updates live dB SPL metering.
 * - Buffers ~250 ms chunks (12,288 samples at 48 kHz) to prevent network saturation.
 * - Streams interleaved 16-bit PCM over WebSocket.
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
    this.channels = 2;
    this.targetSampleRate = 48000;
    
    // Chunk accumulator buffer (~250ms chunks)
    this.accumulatedLeft = [];
    this.accumulatedRight = [];
    this.samplesAccumulated = 0;
    this.chunkThreshold = 12288; // 256 ms at 48kHz
  }

  async start() {
    if (this.isCapturing) return;

    try {
      const constraints = {
        audio: {
          channelCount: { ideal: 2, min: 1 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      try {
        this.audioContext = new AudioCtx({ sampleRate: this.targetSampleRate });
      } catch (e) {
        this.audioContext = new AudioCtx();
      }

      // Resume context if suspended (common on mobile browsers)
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.channels = sourceNode.channelCount >= 2 ? 2 : 1;

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
      appState.set({ isListening: true });
      console.log(`[AudioCapture] Started capture at ${this.audioContext.sampleRate} Hz (${this.channels} channels)`);
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
    this.accumulatedLeft = [];
    this.accumulatedRight = [];
    this.samplesAccumulated = 0;
    console.log("[AudioCapture] Stopped audio capture");
  }

  _handleAudioProcess(e) {
    const inputBuffer = e.inputBuffer;
    const len = inputBuffer.length;
    const numChannels = inputBuffer.numberOfChannels;

    const left = inputBuffer.getChannelData(0);
    const right = numChannels >= 2 ? inputBuffer.getChannelData(1) : left;

    // 1. Compute Immediate Frame RMS for instant UI feedback
    let sumSquares = 0;
    for (let i = 0; i < len; i++) {
      sumSquares += (left[i] * left[i] + right[i] * right[i]) * 0.5;
    }
    const rms = Math.sqrt(sumSquares / len);
    const dbSpl = Math.max(30.0, Math.min(115.0, 100.0 + 20.0 * Math.log10(rms + 1e-9)));

    // Immediately reflect active voice and live dB SPL on top status pill
    const threshold = appState.get().settings.thresholdX || 0.015;
    appState.set({
      audioState: rms >= threshold ? "48kHz_active" : "16kHz_idle",
      rms: Math.round(rms * 1000) / 1000,
      dbSpl: Math.round(dbSpl)
    });

    // 2. Accumulate samples to build ~250ms chunks (avoids network packet saturation)
    for (let i = 0; i < len; i++) {
      this.accumulatedLeft.push(left[i]);
      this.accumulatedRight.push(right[i]);
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
    const int16Array = new Int16Array(totalSamples * 2);
    for (let i = 0; i < totalSamples; i++) {
      int16Array[i * 2] = Math.max(-32768, Math.min(32767, Math.floor(this.accumulatedLeft[i] * 32767)));
      int16Array[i * 2 + 1] = Math.max(-32768, Math.min(32767, Math.floor(this.accumulatedRight[i] * 32767)));
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

    // Stream ~250ms chunk over WebSocket using actual context sampleRate
    const actualFs = this.audioContext ? this.audioContext.sampleRate : this.targetSampleRate;
    this.wsClient.sendAudioChunk(b64Data, actualFs, this.channels, this.seq++);

    // Reset buffer
    this.accumulatedLeft = [];
    this.accumulatedRight = [];
    this.samplesAccumulated = 0;
  }
}
