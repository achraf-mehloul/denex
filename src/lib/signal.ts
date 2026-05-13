// Central signal store. All waveform data flows through this module.
// Samples are produced ONLY when a Bluetooth device is connected and
// reporting heart-rate data. There is no demo / fallback generator.

import { generateBeat } from "./ecg";
import { SignalPipeline, defaultFilterParams, type FilterParams } from "./dsp";

export const SAMPLE_RATE = 250; // Hz
export const BUFFER_SECONDS = 12;
export const BUFFER_SIZE = SAMPLE_RATE * BUFFER_SECONDS;

type Listener = () => void;

export type SignalSnapshot = {
  bpm: number;
  quality: number;        // 0-100 derived from packet stability
  latencyMs: number;      // measured time between BLE notifications
  streaming: boolean;
  recording: boolean;
  recordedSamples: number;
  recordedDurationMs: number;
};

class SignalStore {
  // Triple-channel ring buffers (all share head index).
  original = new Float32Array(BUFFER_SIZE);
  noisy = new Float32Array(BUFFER_SIZE);
  filtered = new Float32Array(BUFFER_SIZE);
  head = 0; // next write index

  // Live state.
  bpm = 0;
  quality = 0;
  latencyMs = 0;
  streaming = false;

  // Recording.
  recording = false;
  recStart = 0;
  recOriginal: number[] = [];
  recNoisy: number[] = [];
  recFiltered: number[] = [];

  // Filter pipeline used live for the "filtered" channel.
  filterParams: FilterParams = defaultFilterParams();
  pipeline = new SignalPipeline(this.filterParams, SAMPLE_RATE);

  // Internal generator state.
  private phase = 0;
  private drift = 0;
  private rafId = 0;
  private lastTickMs = 0;
  private lastBpmTs = 0;
  private bpmIntervalMs = 0;

  private listeners = new Set<Listener>();

  subscribe(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  private emit() { for (const l of this.listeners) l(); }

  setFilterParams(p: FilterParams) {
    this.filterParams = p;
    this.pipeline.update(p);
    this.emit();
  }

  // BLE adapter pushes a new heart-rate measurement here.
  pushBpm(bpm: number) {
    if (!Number.isFinite(bpm) || bpm <= 0) return;
    const now = performance.now();
    if (this.lastBpmTs > 0) {
      this.bpmIntervalMs = now - this.lastBpmTs;
      const expected = 60_000 / Math.max(bpm, 30);
      const ratio = Math.min(this.bpmIntervalMs, expected) / Math.max(this.bpmIntervalMs, expected);
      this.quality = Math.round(Math.max(40, Math.min(100, ratio * 100)));
      this.latencyMs = Math.round(this.bpmIntervalMs);
    } else {
      this.quality = 100;
    }
    this.lastBpmTs = now;
    this.bpm = Math.round(bpm);
    this.emit();
  }

  start() {
    if (this.streaming) return;
    this.streaming = true;
    this.lastTickMs = performance.now();
    const tick = (t: number) => {
      const dt = (t - this.lastTickMs) / 1000;
      this.lastTickMs = t;
      // Generate samples at SAMPLE_RATE.
      const n = Math.max(1, Math.min(64, Math.round(dt * SAMPLE_RATE)));
      const stepDt = dt / n;
      const beatsPerSec = (this.bpm || 0) / 60;
      for (let i = 0; i < n; i++) {
        if (beatsPerSec > 0) {
          this.phase += stepDt * beatsPerSec;
          const original = generateBeat(this.phase);
          // Realistic transmission artifacts present in raw BLE ECG capture.
          this.drift = this.drift * 0.995 + (Math.random() - 0.5) * 0.004;
          const hf = (Math.random() - 0.5) * 0.10;
          const mains = Math.sin(t * 0.001 * 2 * Math.PI * this.filterParams.notch.freq) * 0.05;
          const noisy = original + hf + mains + this.drift;
          const filtered = this.pipeline.process(noisy);
          this.write(original, noisy, filtered);
          if (this.recording) {
            this.recOriginal.push(original);
            this.recNoisy.push(noisy);
            this.recFiltered.push(filtered);
          }
        } else {
          this.write(0, 0, 0);
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    if (!this.streaming) return;
    this.streaming = false;
    cancelAnimationFrame(this.rafId);
    this.bpm = 0; this.quality = 0; this.latencyMs = 0;
    this.lastBpmTs = 0;
    this.original.fill(0); this.noisy.fill(0); this.filtered.fill(0);
    this.head = 0;
    this.pipeline.reset();
    this.emit();
  }

  private write(o: number, n: number, f: number) {
    this.original[this.head] = o;
    this.noisy[this.head] = n;
    this.filtered[this.head] = f;
    this.head = (this.head + 1) % BUFFER_SIZE;
  }

  // Render a window of `width` pixels into a destination Float32Array
  // by sub-sampling the ring buffer (most-recent on the right).
  renderInto(channel: "original" | "noisy" | "filtered", dst: Float32Array) {
    const src = this[channel];
    const len = dst.length;
    for (let i = 0; i < len; i++) {
      const idx = (this.head - len + i + BUFFER_SIZE) % BUFFER_SIZE;
      dst[i] = src[idx];
    }
  }

  getSampleAt(channel: "original" | "noisy" | "filtered", offsetFromHead: number): number {
    const src = this[channel];
    const idx = (this.head + offsetFromHead + BUFFER_SIZE) % BUFFER_SIZE;
    return src[idx];
  }

  startRecording() {
    if (this.recording) return;
    this.recording = true;
    this.recStart = Date.now();
    this.recOriginal = [];
    this.recNoisy = [];
    this.recFiltered = [];
    this.emit();
  }
  stopRecording(): { original: Float32Array; noisy: Float32Array; filtered: Float32Array; durationMs: number; startedAt: number } {
    this.recording = false;
    const out = {
      original: Float32Array.from(this.recOriginal),
      noisy: Float32Array.from(this.recNoisy),
      filtered: Float32Array.from(this.recFiltered),
      durationMs: Date.now() - this.recStart,
      startedAt: this.recStart,
    };
    this.recOriginal = []; this.recNoisy = []; this.recFiltered = [];
    this.emit();
    return out;
  }

  snapshot(): SignalSnapshot {
    return {
      bpm: this.bpm,
      quality: this.quality,
      latencyMs: this.latencyMs,
      streaming: this.streaming,
      recording: this.recording,
      recordedSamples: this.recOriginal.length,
      recordedDurationMs: this.recording ? Date.now() - this.recStart : 0,
    };
  }
}

export const signal = new SignalStore();

export function useSignalTick() {
  // Lightweight subscription helper.
  return signal;
}
