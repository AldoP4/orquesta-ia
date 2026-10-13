"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AirlockEntry,
  Briefing,
  CycleEvent,
  DirectorId,
  JornadaMemoria,
  MemoryPayload,
  NodeId,
  NodeStatus,
  Report,
  Verdict,
} from "./types";

export interface FeedItem {
  id: number;
  kind: "tool" | "message" | "error" | "system" | "airlock";
  verdict?: Verdict;
  from: NodeId | null;
  to?: NodeId;
  text: string;
  detail?: string;
  at: number;
}

export interface Pulse {
  id: number;
  from: NodeId;
  to: NodeId;
  born: number;
}

const IDLE: Record<NodeId, NodeStatus> = {
  ingenieria: "idle",
  ventas: "idle",
  operaciones: "idle",
  finanzas: "idle",
  talento: "idle",
  ceo: "idle",
  dueno: "idle",
};

const DONE: Record<NodeId, NodeStatus> = Object.fromEntries(Object.keys(IDLE).map((k) => [k, "done"])) as Record<NodeId, NodeStatus>;

/** Cuántas jornadas recuerda la organización. */
const MEMORY_SIZE = 5;

interface State {
  running: boolean;
  mode: "live" | "demo" | null;
  model: string;
  githubReal: boolean;
  statuses: Record<NodeId, NodeStatus>;
  feed: FeedItem[];
  reports: Partial<Record<DirectorId, Report>>;
  briefing: Briefing | null;
  pulses: Pulse[];
  selected: NodeId | "airlock" | "memoria" | null;
  stats: { ms: number; tokens: number } | null;
  airlock: AirlockEntry[];
  /** 0 sin iniciar · 1 recolección · 2 análisis · 3 coordinación · 4 síntesis · 5 decisión */
  phase: number;
  approvals: Record<number, "aprobado" | "rechazado">;
  /** Último veredicto, para que la membrana 3D destelle. */
  flash: { verdict: Verdict; id: number } | null;
  /** Opción elegida por el dueño en cada decisión (índice → texto). */
  decisions: Record<number, string>;

  /* Memoria: sobrevive recargas porque vive en localStorage. */
  numero: number;
  jornadas: JornadaMemoria[];
  /** Pasos marcados como hechos por cada persona en la guía actual (persona → índices). */
  progress: Record<string, number[]>;
  /** Bloqueo que reportó cada persona en la jornada actual. */
  blockers: Record<string, string>;
  lastRunAt: number | null;

  resolveApproval: (seq: number, decision: "aprobado" | "rechazado") => void;
  decide: (index: number, option: string) => void;
  toggleStep: (persona: string, index: number) => void;
  reportBlocker: (persona: string, text: string) => void;
  clearMemory: () => void;
  select: (id: State["selected"]) => void;
  removePulse: (id: number) => void;
  run: (demo: boolean) => Promise<void>;
}

let seq = 0;

/** Arma lo que el servidor necesita recordar de las jornadas anteriores. */
function buildMemory(s: State): MemoryPayload {
  const progreso: MemoryPayload["progreso"] = [];
  for (const report of Object.values(s.reports)) {
    if (!report) continue;
    for (const g of report.guias) {
      const done = s.progress[g.persona] ?? [];
      progreso.push({
        persona: g.persona,
        director: report.directorId,
        hechos: g.pasos.filter((_, i) => done.includes(i)),
        pendientes: g.pasos.filter((_, i) => !done.includes(i)),
        ...(s.blockers[g.persona] ? { bloqueo: s.blockers[g.persona] } : {}),
      });
    }
  }
  return { numero: s.numero, jornadas: s.jornadas.slice(-MEMORY_SIZE), progreso };
}

export const useOrquesta = create<State>()(
  persist(
    (set, get) => {
      const push = (item: Omit<FeedItem, "id" | "at">) =>
        set((s) => ({ feed: [...s.feed.slice(-120), { ...item, id: ++seq, at: Date.now() }] }));

      /** Mensaje que nace en la UI (el dueño decide) y viaja por la torre como cualquier otro. */
      const send = (from: NodeId, to: NodeId, text: string) => {
        push({ kind: "message", from, to, text });
        set((st) => ({ pulses: [...st.pulses, { id: ++seq, from, to, born: performance.now() }] }));
      };

      const handle = (e: CycleEvent) => {
        switch (e.type) {
          case "start":
            set({ mode: e.mode, model: e.model, githubReal: e.githubReal, phase: 1, numero: e.numero });
            push({ kind: "system", from: null, text: `Jornada #${e.numero} · ${e.mode === "live" ? `en vivo con ${e.model}` : "modo demo"}` });
            break;
          case "status":
            set((s) => ({ statuses: { ...s.statuses, [e.node]: e.status } }));
            break;
          case "tool":
            if (e.node === "ceo" && e.tool !== "memoria.leer") set((st) => ({ phase: Math.max(st.phase, 4) }));
            push({ kind: "tool", from: e.node, text: e.tool, detail: e.detail });
            break;
          case "message":
            if (e.from !== "ceo" && e.to !== "ceo") set((st) => ({ phase: Math.max(st.phase, 3) }));
            push({ kind: "message", from: e.from, to: e.to, text: e.text });
            set((s) => ({ pulses: [...s.pulses, { id: ++seq, from: e.from, to: e.to, born: performance.now() }] }));
            break;
          case "report":
            set((s) => ({ reports: { ...s.reports, [e.report.directorId]: e.report }, phase: Math.max(s.phase, 2) }));
            break;
          case "briefing": {
            const s = get();
            const jornada: JornadaMemoria = {
              n: s.numero,
              at: Date.now(),
              salud: e.briefing.salud,
              estado: e.briefing.estado,
              decisiones: e.briefing.decisiones.map((d) => ({ titulo: d.titulo, areas: d.areas, elegida: null })),
            };
            set({ briefing: e.briefing, selected: "dueno", phase: 5, jornadas: [...s.jornadas, jornada].slice(-MEMORY_SIZE), lastRunAt: Date.now() });
            break;
          }
          case "airlock":
            set((st) => ({ airlock: [...st.airlock, e.entry], flash: { verdict: e.entry.verdict, id: ++seq } }));
            push({ kind: "airlock", from: e.entry.node, text: e.entry.tool, detail: e.entry.reason, verdict: e.entry.verdict });
            break;
          case "error":
            push({ kind: "error", from: null, text: e.message });
            break;
          case "done":
            set({ stats: { ms: e.ms, tokens: e.tokens } });
            break;
        }
      };

      return {
        running: false,
        mode: null,
        model: "",
        githubReal: false,
        statuses: IDLE,
        feed: [],
        reports: {},
        briefing: null,
        pulses: [],
        selected: null,
        stats: null,
        airlock: [],
        phase: 0,
        approvals: {},
        flash: null,
        decisions: {},
        numero: 1,
        jornadas: [],
        progress: {},
        blockers: {},
        lastRunAt: null,

        resolveApproval: (s, decision) => {
          const entry = get().airlock.find((e) => e.seq === s);
          set((st) => ({ approvals: { ...st.approvals, [s]: decision } }));
          if (entry) send("dueno", entry.node, `${decision === "aprobado" ? "Aprobado" : "Rechazado"}: ${entry.tool}`);
        },
        decide: (index, option) => {
          if (get().decisions[index]) return;
          set((st) => {
            const jornadas = [...st.jornadas];
            const last = jornadas[jornadas.length - 1];
            if (last && last.n === st.numero && last.decisiones[index]) {
              const decisiones = last.decisiones.map((d, i) => (i === index ? { ...d, elegida: option } : d));
              jornadas[jornadas.length - 1] = { ...last, decisiones };
            }
            return { decisions: { ...st.decisions, [index]: option }, jornadas };
          });
          send("dueno", "ceo", `Decisión D-${String(index + 1).padStart(2, "0")}: ${option}`);
        },
        toggleStep: (persona, index) =>
          set((st) => {
            const done = st.progress[persona] ?? [];
            const next = done.includes(index) ? done.filter((i) => i !== index) : [...done, index];
            return { progress: { ...st.progress, [persona]: next } };
          }),
        reportBlocker: (persona, text) =>
          set((st) => {
            const blockers = { ...st.blockers };
            if (text.trim()) blockers[persona] = text.trim().slice(0, 160);
            else delete blockers[persona];
            return { blockers };
          }),
        clearMemory: () =>
          set({
            numero: 1,
            jornadas: [],
            progress: {},
            blockers: {},
            reports: {},
            briefing: null,
            airlock: [],
            approvals: {},
            decisions: {},
            statuses: IDLE,
            phase: 0,
            lastRunAt: null,
            feed: [],
            stats: null,
          }),
        select: (id) => set({ selected: id }),
        removePulse: (id) => set((s) => ({ pulses: s.pulses.filter((p) => p.id !== id) })),

        run: async (demo) => {
          if (get().running) return;
          // La memoria se arma ANTES de limpiar: lo que pasó en la jornada anterior es lo que se recuerda.
          const s = get();
          const memoria = buildMemory({ ...s, numero: (s.jornadas[s.jornadas.length - 1]?.n ?? 0) + 1 });
          set({
            running: true,
            numero: memoria.numero,
            statuses: IDLE,
            feed: [],
            reports: {},
            briefing: null,
            stats: null,
            selected: null,
            pulses: [],
            airlock: [],
            approvals: {},
            decisions: {},
            flash: null,
            phase: 0,
            progress: {},
            blockers: {},
          });
          try {
            const res = await fetch("/api/cycle", { method: "POST", body: JSON.stringify({ demo, memoria }) });
            if (!res.body) throw new Error("Sin respuesta del servidor");
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) if (line.trim()) handle(JSON.parse(line));
            }
          } catch (err) {
            push({ kind: "error", from: null, text: (err as Error).message });
          } finally {
            set({ running: false });
          }
        },
      };
    },
    {
      name: "orquesta",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Se rehidrata a mano al montar la app para no romper la hidratación de React.
      skipHydration: true,
      partialize: (s) => ({
        mode: s.mode,
        model: s.model,
        githubReal: s.githubReal,
        reports: s.reports,
        briefing: s.briefing,
        airlock: s.airlock,
        approvals: s.approvals,
        decisions: s.decisions,
        stats: s.stats,
        numero: s.numero,
        jornadas: s.jornadas,
        progress: s.progress,
        blockers: s.blockers,
        lastRunAt: s.lastRunAt,
      }),
      // Si hay una jornada guardada, la torre arranca mostrándola como terminada.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const restored = { ...current, ...p };
        return p.briefing ? { ...restored, statuses: DONE, phase: 5 } : restored;
      },
    },
  ),
);

/** Rehidrata la memoria del navegador; se llama al montar cada pantalla, ya en el cliente. */
export function hydrateOrquesta() {
  try {
    void useOrquesta.persist.rehydrate();
  } catch {
    // Sin localStorage (modo privado estricto): la app funciona, solo que sin memoria.
  }
}
