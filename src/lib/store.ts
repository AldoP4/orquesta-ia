"use client";

import { create } from "zustand";
import type { AirlockEntry, Briefing, CycleEvent, DirectorId, NodeId, NodeStatus, Report, Verdict } from "./types";

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
  selected: NodeId | "airlock" | null;
  stats: { ms: number; tokens: number } | null;
  airlock: AirlockEntry[];
  approvals: Record<number, "aprobado" | "rechazado">;
  /** Último veredicto, para que la membrana 3D destelle. */
  flash: { verdict: Verdict; id: number } | null;
  resolveApproval: (seq: number, decision: "aprobado" | "rechazado") => void;
  select: (id: NodeId | "airlock" | null) => void;
  removePulse: (id: number) => void;
  run: (demo: boolean) => Promise<void>;
}

let seq = 0;

export const useOrquesta = create<State>((set, get) => {
  const push = (item: Omit<FeedItem, "id" | "at">) =>
    set((s) => ({ feed: [...s.feed.slice(-120), { ...item, id: ++seq, at: Date.now() }] }));

  const handle = (e: CycleEvent) => {
    switch (e.type) {
      case "start":
        set({ mode: e.mode, model: e.model, githubReal: e.githubReal });
        push({ kind: "system", from: null, text: e.mode === "live" ? `Jornada en vivo con ${e.model}` : "Jornada en modo demo" });
        break;
      case "status":
        set((s) => ({ statuses: { ...s.statuses, [e.node]: e.status } }));
        break;
      case "tool":
        push({ kind: "tool", from: e.node, text: e.tool, detail: e.detail });
        break;
      case "message":
        push({ kind: "message", from: e.from, to: e.to, text: e.text });
        set((s) => ({ pulses: [...s.pulses, { id: ++seq, from: e.from, to: e.to, born: performance.now() }] }));
        break;
      case "report":
        set((s) => ({ reports: { ...s.reports, [e.report.directorId]: e.report } }));
        break;
      case "briefing":
        set({ briefing: e.briefing, selected: "dueno" });
        break;
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
    approvals: {},
    flash: null,
    resolveApproval: (s, decision) => set((st) => ({ approvals: { ...st.approvals, [s]: decision } })),
    select: (id) => set({ selected: id }),
    removePulse: (id) => set((s) => ({ pulses: s.pulses.filter((p) => p.id !== id) })),
    run: async (demo) => {
      if (get().running) return;
      set({ running: true, statuses: IDLE, feed: [], reports: {}, briefing: null, stats: null, selected: null, pulses: [], airlock: [], approvals: {}, flash: null });
      try {
        const res = await fetch("/api/cycle", { method: "POST", body: JSON.stringify({ demo }) });
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
});
