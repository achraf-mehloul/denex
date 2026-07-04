import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { listSessions, getSession, type SessionMeta, type Session } from "@/lib/db";
import { EmptyState } from "@/components/EmptyState";
import { EcgPlayback } from "@/components/EcgPlayback";
import { GitCompare, Database } from "lucide-react";
import { fmtDur } from "@/lib/format";

export const Route = createFileRoute("/_app/compare")({ component: ComparePage });

function ComparePage() {
  const [items, setItems] = useState<SessionMeta[]>([]);
  const [ids, setIds] = useState<[string | null, string | null]>([null, null]);
  const [sessions, setSessions] = useState<[Session | null, Session | null]>([null, null]);

  useEffect(() => { listSessions().then(setItems); }, []);

  useEffect(() => {
    (async () => {
      const a = ids[0] ? await getSession(ids[0]) : null;
      const b = ids[1] ? await getSession(ids[1]) : null;
      setSessions([a, b]);
    })();
  }, [ids]);

  const spanA = sessions[0]?.original.length ?? 0;
  const spanB = sessions[1]?.original.length ?? 0;
  const commonSpan = useMemo(() => Math.min(spanA || Infinity, spanB || Infinity) || 0, [spanA, spanB]);

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Analyse comparative</div>
        <h1 className="font-display text-2xl md:text-3xl mt-1">Comparer deux sessions</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Sélectionnez deux enregistrements pour les visualiser côte à côte, synchronisés sur la même fenêtre temporelle.</p>
      </div>

      {items.length < 2 ? (
        <EmptyState icon={Database} title="Enregistrements insuffisants" description="Il faut au moins deux sessions enregistrées pour comparer. Enregistrez plusieurs captures depuis le moniteur." ctaLabel="Retour au moniteur" ctaTo="/" />
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            {[0, 1].map((slot) => (
              <div key={slot} className="rounded-xl glass p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-2">Session {String.fromCharCode(65 + slot)}</div>
                <select
                  value={ids[slot] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    setIds((prev) => (slot === 0 ? [v, prev[1]] : [prev[0], v]));
                  }}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                >
                  <option value="">— Choisir —</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {new Date(it.startedAt).toLocaleString()} · {fmtDur(it.durationMs)} · {it.avgBpm || "—"} bpm
                    </option>
                  ))}
                </select>
                {sessions[slot] && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <Metric label="Durée" value={fmtDur(sessions[slot]!.durationMs)} />
                    <Metric label="BPM moy" value={String(sessions[slot]!.avgBpm)} />
                    <Metric label="Qualité" value={`${sessions[slot]!.signalQuality}%`} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {sessions[0] && sessions[1] && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-widest">
                <GitCompare className="h-3.5 w-3.5" /> Fenêtre commune · {commonSpan} échantillons
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <EcgPlayback label="Session A · brut" color="oklch(0.78 0.15 215)" buffer={sessions[0]!.original} start={0} span={commonSpan} height={160} />
                <EcgPlayback label="Session B · brut" color="oklch(0.70 0.20 35)" buffer={sessions[1]!.original} start={0} span={commonSpan} height={160} />
                <EcgPlayback label="Session A · filtré" color="oklch(0.78 0.18 155)" buffer={sessions[0]!.filtered} start={0} span={commonSpan} height={140} />
                <EcgPlayback label="Session B · filtré" color="oklch(0.78 0.18 155)" buffer={sessions[1]!.filtered} start={0} span={commonSpan} height={140} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/30 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="text-mono text-sm mt-0.5">{value}</div>
    </div>
  );
}
