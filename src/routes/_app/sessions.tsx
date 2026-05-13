import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Database, Download, Trash2, Play, FileJson, FileSpreadsheet, Bluetooth } from "lucide-react";
import { listSessions, deleteSession, getSession, type SessionMeta } from "@/lib/db";
import { exportCsv, exportJson, fromSession } from "@/lib/export";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_app/sessions")({
  component: SessionsPage,
});

function SessionsPage() {
  const [items, setItems] = useState<SessionMeta[]>([]);
  const refresh = () => listSessions().then(setItems).catch(() => setItems([]));
  useEffect(() => { refresh(); }, []);

  const remove = async (id: string) => { await deleteSession(id); refresh(); };

  const doExport = async (id: string, fmt: "csv" | "json") => {
    const s = await getSession(id);
    if (!s) return;
    const payload = fromSession(s);
    if (fmt === "csv") exportCsv(payload); else exportJson(payload);
  };

  const fmtDur = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60); const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Archive</div>
          <h1 className="text-2xl md:text-3xl font-semibold mt-1">Sessions</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Recorded sessions are stored locally in IndexedDB. Replay or export them as CSV / JSON for offline analysis.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No recordings yet"
          description="Connect a sensor on the Bluetooth Center, then press Start recording on the dashboard. Stored sessions appear here."
          ctaLabel="Pair a device"
          ctaTo="/bluetooth"
        />
      ) : (
        <div className="rounded-xl glass overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-border/60">
            <div className="col-span-3">Started</div>
            <div className="col-span-2">Device</div>
            <div className="col-span-1">Duration</div>
            <div className="col-span-1">Avg BPM</div>
            <div className="col-span-2">Quality</div>
            <div className="col-span-1">Samples</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {items.map((s) => (
            <div key={s.id} className="grid grid-cols-12 items-center gap-2 px-5 py-3 text-sm border-b border-border/40 last:border-0 hover:bg-secondary/20">
              <div className="col-span-3 text-mono truncate">{new Date(s.startedAt).toLocaleString()}</div>
              <div className="col-span-2 truncate">{s.deviceName ?? "—"}</div>
              <div className="col-span-1 text-mono">{fmtDur(s.durationMs)}</div>
              <div className="col-span-1 text-mono">{s.avgBpm || "—"}</div>
              <div className="col-span-2">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-20 rounded bg-background overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${s.signalQuality}%` }} />
                  </div>
                  <span className="text-xs text-mono text-muted-foreground">{s.signalQuality}%</span>
                </div>
              </div>
              <div className="col-span-1 text-mono text-xs text-muted-foreground">{s.samples.toLocaleString()}</div>
              <div className="col-span-2 flex items-center justify-end gap-1.5">
                <Link to="/replay" search={{ id: s.id }} className="p-2 rounded hover:bg-secondary/60" title="Replay"><Play className="h-3.5 w-3.5" /></Link>
                <button onClick={() => doExport(s.id, "csv")} className="p-2 rounded hover:bg-secondary/60" title="Export CSV"><FileSpreadsheet className="h-3.5 w-3.5" /></button>
                <button onClick={() => doExport(s.id, "json")} className="p-2 rounded hover:bg-secondary/60" title="Export JSON"><FileJson className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(s.id)} className="p-2 rounded hover:bg-secondary/60 text-[oklch(0.70_0.20_25)]" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Download className="h-3.5 w-3.5" /> CSV format: <code className="text-mono">index,time_s,original_mV,noisy_mV,filtered_mV</code>
          <Bluetooth className="h-3.5 w-3.5 ml-4" /> Recordings only contain real sensor data captured while connected.
        </div>
      )}
    </div>
  );
}
