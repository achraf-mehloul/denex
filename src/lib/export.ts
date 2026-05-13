// CSV / JSON exporters for live and stored ECG streams.

import type { Session } from "./db";

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ExportPayload = {
  id: string;
  label: string;
  startedAt: number;
  durationMs: number;
  sampleRate: number;
  avgBpm?: number;
  deviceName?: string;
  original: Float32Array;
  noisy: Float32Array;
  filtered: Float32Array;
};

export function exportCsv(p: ExportPayload, opts: { decimals?: number } = {}) {
  const dec = opts.decimals ?? 5;
  const rows: string[] = ["index,time_s,original_mV,noisy_mV,filtered_mV"];
  const n = Math.min(p.original.length, p.noisy.length, p.filtered.length);
  for (let i = 0; i < n; i++) {
    const t = (i / p.sampleRate).toFixed(4);
    rows.push(`${i},${t},${p.original[i].toFixed(dec)},${p.noisy[i].toFixed(dec)},${p.filtered[i].toFixed(dec)}`);
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  download(`${safeName(p.label)}.csv`, blob);
}

export function exportJson(p: ExportPayload) {
  const payload = {
    format: "denex.session.v1",
    id: p.id,
    label: p.label,
    deviceName: p.deviceName ?? null,
    startedAt: new Date(p.startedAt).toISOString(),
    durationMs: p.durationMs,
    sampleRate: p.sampleRate,
    avgBpm: p.avgBpm ?? null,
    samples: p.original.length,
    channels: {
      original: Array.from(p.original).map((v) => +v.toFixed(5)),
      noisy: Array.from(p.noisy).map((v) => +v.toFixed(5)),
      filtered: Array.from(p.filtered).map((v) => +v.toFixed(5)),
    },
  };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  download(`${safeName(p.label)}.json`, blob);
}

export function fromSession(s: Session): ExportPayload {
  return {
    id: s.id,
    label: `denex-session-${new Date(s.startedAt).toISOString().replace(/[:.]/g, "-")}`,
    startedAt: s.startedAt,
    durationMs: s.durationMs,
    sampleRate: s.sampleRate,
    avgBpm: s.avgBpm,
    deviceName: s.deviceName,
    original: s.original,
    noisy: s.noisy,
    filtered: s.filtered,
  };
}

function safeName(s: string) {
  return s.replace(/[^a-z0-9_\-.]/gi, "_");
}
