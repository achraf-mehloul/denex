import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Activity, Bluetooth, Database, Settings, Play, Sparkles, GitCompare, LineChart, MoreHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ble } from "@/lib/bluetooth";
import { StatusBar } from "./StatusBar";

const primary = [
  { to: "/", label: "Moniteur", icon: Activity },
  { to: "/sessions", label: "Sessions", icon: Database },
  { to: "/analytics", label: "Analyse", icon: LineChart },
  { to: "/settings", label: "Réglages", icon: Settings },
] as const;

const secondary = [
  { to: "/bluetooth", label: "Bluetooth", icon: Bluetooth },
  { to: "/replay", label: "Relecture", icon: Play },
  { to: "/compare", label: "Comparer", icon: GitCompare },
  { to: "/correction", label: "Correction", icon: Sparkles },
] as const;

const desktopNav = [...primary.slice(0, 1), ...secondary.slice(0, 1), ...primary.slice(1, 2), ...secondary.slice(1), ...primary.slice(2)];

export function AppShell() {
  const loc = useLocation();
  const [, setTick] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const unsub = ble.subscribe(() => setTick((t) => t + 1));
    return () => { unsub(); };
  }, []);

  useEffect(() => { setMoreOpen(false); }, [loc.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <StatusBar />
      <div className="flex-1 flex min-w-0">
        <aside className="hidden md:flex w-60 lg:w-64 shrink-0 flex-col border-r border-border/60 glass">
          <Link to="/" className="px-5 py-4 flex items-center gap-3 border-b border-border/60 hover:opacity-90">
            <motion.div
              layoutId="denoiz-logo"
              className="h-10 w-10 rounded-lg overflow-hidden ring-1 ring-primary/40 glow-primary shrink-0"
            >
              <img src="/denoiz-logo.jpg" alt="Denoiz" className="h-full w-full object-cover" />
            </motion.div>
            <div className="min-w-0">
              <div className="font-display text-lg tracking-tight">Denoiz</div>
              <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Clean Signal · Safe Life</div>
            </div>
          </Link>
          <nav className="p-3 flex-1 space-y-0.5 overflow-y-auto">
            {desktopNav.map((n) => {
              const active = loc.pathname === n.to;
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"}`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-md bg-primary/10 border border-primary/20"
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    />
                  )}
                  <Icon className="h-4 w-4 relative z-10" />
                  <span className="relative z-10">{n.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
            <Outlet />
          </main>

          {/* Mobile smart bottom-nav: 4 primary + More sheet */}
          <nav
            className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/60 glass"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex">
              {primary.map((n) => {
                const active = loc.pathname === n.to;
                const Icon = n.icon;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] uppercase tracking-[0.15em] transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                  >
                    <div className="relative">
                      {active && (
                        <motion.span
                          layoutId="mobile-nav-active"
                          className="absolute inset-[-6px] rounded-full bg-primary/15"
                          transition={{ type: "spring", stiffness: 350, damping: 28 }}
                        />
                      )}
                      <Icon className="h-5 w-5 relative z-10" />
                    </div>
                    <span>{n.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={() => setMoreOpen(true)}
                className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
              >
                <MoreHorizontal className="h-5 w-5" />
                <span>Plus</span>
              </button>
            </div>
          </nav>

          <AnimatePresence>
            {moreOpen && (
              <>
                <motion.div
                  key="backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setMoreOpen(false)}
                  className="md:hidden fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
                />
                <motion.div
                  key="sheet"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 340, damping: 34 }}
                  className="md:hidden fixed bottom-0 inset-x-0 z-50 glass border-t border-border/60 rounded-t-3xl px-5 pt-3"
                  style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
                >
                  <div className="mx-auto h-1 w-10 rounded-full bg-border/70 mb-4" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Plus d'outils</div>
                    <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-full hover:bg-secondary/40">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {secondary.map((n) => {
                      const Icon = n.icon;
                      const active = loc.pathname === n.to;
                      return (
                        <Link
                          key={n.to}
                          to={n.to}
                          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 hover:bg-secondary/40"}`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-sm">{n.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
