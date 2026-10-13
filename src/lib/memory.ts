import { DIRECTORS } from "./company";
import type { Briefing, DirectorId, MemoryPayload, Report } from "./types";

/**
 * Memoria entre jornadas. El navegador la guarda y la manda en cada jornada,
 * así que aquí se trata como dato NO confiable: se valida la forma, se recortan
 * tamaños y después pasa por Airlock (cuarentena y redacción) en la ruta.
 */

const IDS = new Set<string>(DIRECTORS.map((d) => d.id));
const str = (v: unknown, max = 200) => String(v ?? "").slice(0, max);
const list = <T>(v: unknown, max: number, map: (x: Record<string, unknown>) => T | null): T[] =>
  Array.isArray(v) ? v.slice(0, max).flatMap((x) => (x && typeof x === "object" ? [map(x as Record<string, unknown>)].filter((y): y is T => y !== null) : [])) : [];

export const EMPTY_MEMORY: MemoryPayload = { numero: 1, jornadas: [], progreso: [] };

export function sanitizeMemory(raw: unknown): MemoryPayload {
  if (!raw || typeof raw !== "object") return EMPTY_MEMORY;
  const r = raw as Record<string, unknown>;
  const numero = Math.max(1, Math.min(9999, Math.floor(Number(r.numero)) || 1));
  const jornadas = list(r.jornadas, 5, (j) => ({
    n: Math.floor(Number(j.n)) || 0,
    at: Number(j.at) || 0,
    salud: Math.max(0, Math.min(100, Number(j.salud) || 0)),
    estado: str(j.estado, 160),
    decisiones: list(j.decisiones, 3, (d) => ({
      titulo: str(d.titulo, 120),
      areas: (Array.isArray(d.areas) ? d.areas : []).filter((a): a is DirectorId => IDS.has(String(a))),
      elegida: d.elegida ? str(d.elegida, 120) : null,
    })),
  }));
  const progreso = list(r.progreso, 20, (p) => {
    const director = String(p.director);
    if (!IDS.has(director)) return null;
    const steps = (v: unknown) => (Array.isArray(v) ? v.slice(0, 4).map((x) => str(x, 160)) : []);
    return {
      persona: str(p.persona, 40),
      director: director as DirectorId,
      hechos: steps(p.hechos),
      pendientes: steps(p.pendientes),
      ...(p.bloqueo ? { bloqueo: str(p.bloqueo, 160) } : {}),
    };
  });
  return { numero, jornadas, progreso };
}

export function memoryStats(m: MemoryPayload) {
  const decididas = m.jornadas.flatMap((j) => j.decisiones).filter((d) => d.elegida).length;
  const pendientes = m.progreso.reduce((n, p) => n + p.pendientes.length, 0);
  const bloqueos = m.progreso.filter((p) => p.bloqueo).length;
  return { decididas, pendientes, bloqueos };
}

/** Lo que un directivo necesita recordar: decisiones del dueño sobre su área y cómo le fue a su gente. */
export function directorMemory(id: DirectorId, m: MemoryPayload): string {
  if (!m.jornadas.length && !m.progreso.length) return "";
  const lines: string[] = [`Esta es la jornada #${m.numero}.`];
  const decisiones = m.jornadas.flatMap((j) => j.decisiones.filter((d) => d.areas.includes(id) && d.elegida).map((d) => `#${j.n}: "${d.titulo}" → el dueño eligió "${d.elegida}"`));
  if (decisiones.length) lines.push("Decisiones del dueño que afectan tu área (respétalas):", ...decisiones.map((d) => `- ${d}`));
  const equipo = m.progreso.filter((p) => p.director === id);
  if (equipo.length) {
    lines.push("Cómo le fue a tu equipo con la guía anterior:");
    for (const p of equipo) {
      lines.push(`- ${p.persona}: hizo ${p.hechos.length}, quedaron pendientes ${p.pendientes.length}${p.pendientes.length ? ` (${p.pendientes.join(" | ")})` : ""}${p.bloqueo ? `. Reportó bloqueo: "${p.bloqueo}"` : ""}`);
    }
    lines.push("Retoma lo pendiente si sigue vigente y atiende primero los bloqueos.");
  }
  return lines.join("\n");
}

/** Lo que el orquestador necesita recordar: tendencia de salud y lo que el dueño ya decidió. */
export function ceoMemory(m: MemoryPayload): string {
  if (!m.jornadas.length) return "";
  const { pendientes, bloqueos } = memoryStats(m);
  return [
    `Esta es la jornada #${m.numero}. Historial reciente:`,
    ...m.jornadas.map((j) => {
      const d = j.decisiones.map((x) => `"${x.titulo}" → ${x.elegida ? `eligió "${x.elegida}"` : "sin decidir"}`).join("; ");
      return `- #${j.n} · salud ${j.salud} · ${j.estado}${d ? ` · ${d}` : ""}`;
    }),
    `Del equipo: ${pendientes} pasos quedaron pendientes y ${bloqueos} personas reportaron bloqueos.`,
    "No repitas decisiones que el dueño ya tomó: da seguimiento a su resultado. Si algo quedó sin decidir, puedes insistir.",
  ].join("\n");
}

/**
 * En modo demo las respuestas están pregrabadas, así que la memoria se aplica
 * de forma determinista: lo pendiente pasa al día siguiente y los bloqueos se vuelven alertas.
 */
export function carryOverDemo(report: Report, m: MemoryPayload): Report {
  const equipo = m.progreso.filter((p) => p.director === report.directorId);
  if (!equipo.length) return report;
  const PREFIX = "Pendiente de ayer: ";
  const strip = (p: string) => (p.startsWith(PREFIX) ? p.slice(PREFIX.length) : p);
  const guias = report.guias.map((g) => {
    const prev = equipo.find((p) => p.persona === g.persona);
    if (!prev) return g;
    // La guía pregrabada se repite cada día: se quita lo ya hecho y lo pendiente sube primero, sin duplicarse.
    const hechos = prev.hechos.map(strip);
    const pendientes = prev.pendientes.map(strip);
    const nuevos = g.pasos.filter((p) => !hechos.includes(p) && !pendientes.includes(p));
    const pasos = [...pendientes.map((p) => PREFIX + p), ...nuevos].slice(0, 3);
    return { ...g, pasos: pasos.length ? pasos : g.pasos };
  });
  const alertas = [...equipo.filter((p) => p.bloqueo).map((p) => `${p.persona} reportó bloqueo: ${p.bloqueo}`), ...report.alertas].slice(0, 3);
  return { ...report, guias, alertas };
}

export function carryOverDemoBriefing(b: Briefing, m: MemoryPayload): Briefing {
  const last = m.jornadas[m.jornadas.length - 1];
  const elegida = last?.decisiones.find((d) => d.elegida);
  if (!elegida) return b;
  const { bloqueos } = memoryStats(m);
  const seguimiento = `Seguimiento de la jornada #${last.n}: elegiste «${elegida.elegida}» y ya está en marcha.${bloqueos ? ` ${bloqueos} ${bloqueos === 1 ? "persona reportó" : "personas reportaron"} bloqueos.` : ""}`;
  return {
    ...b,
    resumen: `${seguimiento} ${b.resumen}`,
    decisiones: b.decisiones.filter((d) => !last.decisiones.some((x) => x.elegida && x.titulo === d.titulo)),
  };
}
