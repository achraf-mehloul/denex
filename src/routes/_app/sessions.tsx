import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Download, Trash2, Play, FileJson, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
import { listSessions, deleteSession, getSession, type SessionMeta } from "@/lib/db";
import { exportCsv, exportJson, fromSession } from "@/lib/export";
import { EmptyState } from "@/components/EmptyState";
import { fmtDur } from "@/lib/format";

export const Route = createFileRoute("/_app/sessions")({ component: SessionsPage });

const PAGE_SIZE = 12;

function SessionsPage() {
  const [items, setItems] = useState<SessionMeta[]>([]);
  const [page, setPage] = useState(0);
  const refresh = () => listSessions().then(setItems).catch(() => setItems([]));
  useEffect(() => { refresh(); }, []);

  const remove = async (id: string) => { await deleteSession(id); refresh(); };
  const doExport = async (id: string, fmt: "csv" | "json") => {
    const s = await getSession(id);
    if (!s) return;
    const payload = fromSession(s);
    if (fmt === "csv") exportCsv(payload); else exportJson(payload);
  };

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Archive</div>
        <h1 className="font-display text-2xl md:text-3xl mt-1">Sessions</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Enregistrements stockés localement (IndexedDB). Relisez, exportez en CSV/JSON ou comparez-les.</p>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Database} title="Aucun enregistrement" description="Appairez un capteur puis lancez un enregistrement depuis le moniteur. Les captures apparaîtront ici." ctaLabel="Appairer un appareil" ctaTo="/bluetooth" />
      ) : (
        <>
          <div className="rounded-2xl glass overflow-hidden">
            <div className="hidden md:grid grid-cols-12 px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-border/60">
              <div className="col-span-3">Démarré</div>
              <div className="col-span-2">Appareil</div>
              <div className="col-span-1">Durée</div>
              <div className="col-span-1">Avg BPM</div>
              <div className="col-span-2">Qualité</div>
              <div className="col-span-1">Éch.</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            <AnimatePresence initial={false}>
              {pageItems.map((s) => (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="grid grid-cols-2 md:grid-cols-12 gap-2 px-4 md:px-5 py-3 text-sm border-b border-border/40 last:border-0 hover:bg-secondary/20 items-center"
                >
                  <div className="col-span-2 md:col-span-3 text-mono text-xs truncate">{new Date(s.startedAt).toLocaleString()}</div>
                  <div className="col-span-1 md:col-span-2 truncate text-xs">{s.deviceName ?? "—"}</div>
                  <div className="col-span-1 md:col-span-1 text-mono text-xs">{fmtDur(s.durationMs)}</div>
                  <div className="hidden md:block col-span-1 text-mono text-xs">{s.avgBpm || "—"}</div>
                  <div className="hidden md:flex col-span-2 items-center gap-2">
                    <div className="h-1 w-20 rounded bg-background overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${s.signalQuality}%` }} />
                    </div>
                    <span className="text-xs text-mono text-muted-foreground">{s.signalQuality}%</span>
                  </div>
                  <div className="hidden md:block col-span-1 text-mono text-xs text-muted-foreground">{s.samples.toLocaleString()}</div>
                  <div className="col-span-2 md:col-span-2 flex items-center justify-end gap-1">
                    <Link to="/replay" search={{ id: s.id }} className="p-2 rounded hover:bg-secondary/60" title="Relire"><Play className="h-3.5 w-3.5" /></Link>
                    <button onClick={() => doExport(s.id, "csv")} className="p-2 rounded hover:bg-secondary/60" title="CSV"><FileSpreadsheet className="h-3.5 w-3.5" /></button>
                    <button onClick={() => doExport(s.id, "json")} className="p-2 rounded hover:bg-secondary/60" title="JSON"><FileJson className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(s.id)} className="p-2 rounded hover:bg-secondary/60 text-[oklch(0.70_0.20_25)]" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-border disabled:opacity-30 hover:bg-secondary/40">
                <ChevronLeft className="h-3.5 w-3.5" /> Précédent
              </button>
              <div className="text-mono text-muted-foreground">Page {page + 1} / {totalPages} · {items.length} sessions</div>
              <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-border disabled:opacity-30 hover:bg-secondary/40">
                Suivant <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Download className="h-3.5 w-3.5" /> CSV : <code className="text-mono">index,time_s,original_mV,noisy_mV,filtered_mV</code>
          </div>
        </>
      )}
    </div>
  );
}
