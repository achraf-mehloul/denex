import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Heart, Wifi, Battery, Timer, Cpu, Gauge, Signal, Circle, Square, Save, Bluetooth, AlertTriangle } from "lucide-react";
import { EcgWaveform } from "@/components/EcgWaveform";
import { StatTile } from "@/components/StatTile";
import { EmptyState } from "@/components/EmptyState";
import { ble } from "@/lib/bluetooth";
import { signal, SAMPLE_RATE } from "@/lib/signal";
import { saveSession } from "@/lib/db";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const u1 = ble.subscribe(() => setTick((t) => t + 1));
    const u2 = signal.subscribe(() => setTick((t) => t + 1));
    return () => { u1(); u2(); };
  }, []);
  // Lightweight clock so timers/quality reflect time even between BLE pings.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const connected = ble.state === "connected";
  const reconnecting = ble.state === "reconnecting" || ble.state === "connecting";
  const snap = signal.snapshot();
  const recordedSec = Math.floor(snap.recordedDurationMs / 1000);

  const sampleOriginal = () => signal.getSampleAt("original", -1);
  const sampleNoisy = () => signal.getSampleAt("noisy", -1);
  const sampleFiltered = () => signal.getSampleAt("filtered", -1);

  const onToggleRecord = async () => {
    if (!signal.recording) { signal.startRecording(); return; }
    const r = signal.stopRecording();
    if (r.original.length < SAMPLE_RATE) return; // ignore <1s
    await saveSession({
      id: crypto.randomUUID(),
      startedAt: r.startedAt,
      durationMs: r.durationMs,
      avgBpm: snap.bpm,
      signalQuality: snap.quality,
      sampleRate: SAMPLE_RATE,
      samples: r.original.length,
      deviceName: ble.device?.name,
      original: r.original,
      noisy: r.noisy,
      filtered: r.filtered,
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Live monitor</div>
          <h1 className="text-2xl md:text-3xl font-semibold mt-1">Real-time ECG Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass">
          <span className={`h-2 w-2 rounded-full pulse-dot ${connected ? "bg-[oklch(0.78_0.18_155)]" : reconnecting ? "bg-[oklch(0.78_0.16_70)]" : "bg-muted-foreground"}`} />
          <span className="text-xs text-mono uppercase tracking-widest">
            {connected ? "Streaming" : reconnecting ? "Reconnecting" : "Standby"}
          </span>
        </div>
      </div>

      {ble.state === "unsupported" && (
        <div className="rounded-xl glass p-4 flex items-start gap-3 border border-[oklch(0.65_0.22_25)]/40">
          <AlertTriangle className="h-5 w-5 text-[oklch(0.70_0.20_25)] mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Web Bluetooth unavailable</div>
            <div className="text-muted-foreground mt-1">Open Denex in a Chromium-based browser (Chrome, Edge, Opera) over HTTPS to pair a sensor.</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatTile label="BPM" value={connected && snap.bpm > 0 ? String(snap.bpm) : "—"} unit="bpm" icon={Heart} accent />
        <StatTile label="Signal" value={connected && snap.quality > 0 ? `${snap.quality}` : "—"} unit="%" icon={Signal} />
        <StatTile label="Latency" value={connected && snap.latencyMs > 0 ? `${snap.latencyMs}` : "—"} unit="ms" icon={Gauge} />
        <StatTile label="Recording" value={signal.recording ? fmtSec(recordedSec) : "—"} icon={Timer} />
        <StatTile label="Battery" value={connected && ble.battery > 0 ? `${ble.battery}` : "—"} unit="%" icon={Battery} />
        <StatTile label="Bluetooth" value={connected ? "Linked" : reconnecting ? "Retry" : "Idle"} icon={Wifi} />
        <StatTile label="DSP" value={signal.streaming ? "Live" : "Idle"} icon={Cpu} hint="Notch · HP · Smooth" />
        <StatTile label="Channels" value="3" unit="lead" icon={Activity} />
      </div>

      {!connected ? (
        <EmptyState
          icon={Bluetooth}
          title={reconnecting ? "Re-establishing link to sensor…" : "No sensor connected"}
          description="Pair a Bluetooth heart-rate sensor to begin streaming. Denex never fabricates data — the dashboard stays empty until the device sends a measurement."
          ctaLabel="Open Bluetooth Center"
          ctaTo="/bluetooth"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onToggleRecord}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ${signal.recording ? "bg-[oklch(0.65_0.22_25)] text-white" : "bg-primary text-primary-foreground hover:opacity-90"}`}
            >
              {signal.recording ? <Square className="h-4 w-4" /> : <Circle className="h-4 w-4 fill-current" />}
              {signal.recording ? `Stop & save (${fmtSec(recordedSec)})` : "Start recording"}
            </button>
            <Link to="/correction" className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary/40">
              <Save className="h-4 w-4" /> Tune filters
            </Link>
          </div>

          <div className="grid gap-4">
            <EcgWaveform label="Original ECG" color="oklch(0.78 0.15 215)" getSample={sampleOriginal} height={200} />
            <EcgWaveform label="Noisy capture" color="oklch(0.70 0.20 35)" getSample={sampleNoisy} height={170} />
            <EcgWaveform label="Filtered output" color="oklch(0.78 0.18 155)" getSample={sampleFiltered} height={170} />
          </div>
        </>
      )}
    </div>
  );
}

function fmtSec(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
