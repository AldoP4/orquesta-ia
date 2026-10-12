import { createHash } from "node:crypto";
import type { AirlockEntry, DirectorId, NodeId, ProposedAction, Verdict } from "../types";
import { DOMINIOS_PERMITIDOS, LIMITES, POLICY } from "./policy";

/**
 * Airlock: la membrana entre los agentes y el mundo. Cinco capas:
 *
 *  1. Entrada      — los datos de las herramientas se escanean en busca de
 *                    prompt injection antes de llegar al LLM (cuarentena).
 *  2. Contrato     — deny-by-default: la herramienta debe existir, el directivo
 *                    debe ser su dueño y los argumentos deben tener el tipo
 *                    correcto; los argumentos que no estén declarados se quitan.
 *  3. Política     — según el riesgo: lectura/escritura pasan, crítica pide
 *                    aprobación humana, y las reglas de bloqueo ganan siempre.
 *  4. Límites      — acciones por directivo y tokens por jornada.
 *  5. Salida       — se redactan datos sensibles (correos externos, teléfonos,
 *                    tarjetas, RFC/CURP, API keys) antes de mostrarlos o pasarlos
 *                    a otro agente.
 *
 * Todo queda en una bitácora con hashes encadenados (como un mini-blockchain):
 * si alguien cambia una entrada vieja, la cadena deja de cuadrar.
 */

/* --------------------------------- Bitácora -------------------------------- */

export class AuditLog {
  private entries: AirlockEntry[] = [];
  private last = "0".repeat(64);

  record(e: { node: NodeId; verdict: Verdict; layer: string; tool: string; reason: string; detail?: string }): AirlockEntry {
    const seq = this.entries.length + 1;
    const at = Date.now();
    const prev = this.last;
    const hash = createHash("sha256")
      .update(JSON.stringify({ seq, at, prev, ...e }))
      .digest("hex");
    const entry: AirlockEntry = { seq, at, prev, hash, ...e };
    this.entries.push(entry);
    this.last = hash;
    return entry;
  }

  all() {
    return [...this.entries];
  }
}

/* ------------------------------ 1. Entrada -------------------------------- */

const INJECTION_PATTERNS: RegExp[] = [
  /ignora\s+(todas\s+)?(tus|las)\s+instrucciones/i,
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /olvida\s+(todo|tus\s+reglas)/i,
  /(system|sistema)\s*prompt/i,
  /a\s+partir\s+de\s+ahora\s+eres/i,
  /you\s+are\s+now\s+/i,
  /(exporta|env[ií]a|manda)\s+.{0,60}(lista|base|contactos|clientes).{0,60}@/i,
];

export const QUARANTINE_TEXT = "[contenido en cuarentena por Airlock]";

/** Recorre cualquier JSON y reemplaza los textos con prompt injection. */
export function quarantine(data: unknown): { clean: unknown; hits: string[] } {
  const hits: string[] = [];
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      if (INJECTION_PATTERNS.some((re) => re.test(v))) {
        hits.push(v.length > 110 ? v.slice(0, 110) + "…" : v);
        return QUARANTINE_TEXT;
      }
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return { clean: walk(data), hits };
}

/* ------------------------------- 5. Salida -------------------------------- */

const PII: { name: string; re: RegExp; keep?: (m: string) => boolean }[] = [
  { name: "API key", re: /\b(sk-[a-z0-9-]{16,}|gh[pousr]_[A-Za-z0-9]{20,})\b/gi },
  { name: "tarjeta", re: /\b(?:\d[ -]?){13,16}\b/g },
  { name: "CURP", re: /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/g },
  { name: "RFC", re: /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/g },
  { name: "teléfono", re: /(?:\+?52[ -]?)?\b\d{2,3}[ -]?\d{3,4}[ -]?\d{4}\b/g },
  {
    name: "correo externo",
    re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
    keep: (m) => DOMINIOS_PERMITIDOS.includes(m.split("@")[1].toLowerCase()),
  },
];

export function redact<T>(data: T): { clean: T; found: string[] } {
  const found = new Set<string>();
  const scrub = (s: string) => {
    let out = s;
    for (const p of PII) {
      out = out.replace(p.re, (m) => {
        if (p.keep?.(m)) return m;
        found.add(p.name);
        return `[${p.name} oculto]`;
      });
    }
    return out;
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return scrub(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return { clean: walk(data) as T, found: [...found] };
}

/* ---------------------- 2-4. Contrato, Política, Límites ------------------- */

export interface ActionVerdict {
  verdict: Exclude<Verdict, "cuarentena" | "redactado">;
  layer: "Contrato" | "Política" | "Límites";
  reason: string;
  args: Record<string, unknown>;
  stripped: string[];
}

export function evaluateAction(director: DirectorId, action: ProposedAction, countSoFar: number): ActionVerdict {
  const policy = POLICY[action.tool];
  const args = action.args && typeof action.args === "object" ? action.args : {};

  // 2. Contrato
  if (!policy) {
    return { verdict: "bloqueado", layer: "Contrato", reason: "Herramienta no declarada en la política (deny-by-default)", args: {}, stripped: [] };
  }
  if (policy.owners !== "todos" && !policy.owners.includes(director)) {
    return { verdict: "bloqueado", layer: "Contrato", reason: `Esta área no tiene permiso para usar ${action.tool}`, args: {}, stripped: [] };
  }
  const stripped = Object.keys(args).filter((k) => !(k in policy.args));
  const clean: Record<string, unknown> = {};
  for (const [k, type] of Object.entries(policy.args)) {
    let v = args[k];
    if (type === "number" && typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) v = Number(v);
    if (typeof v !== type) {
      return { verdict: "bloqueado", layer: "Contrato", reason: `Argumento "${k}" falta o no es ${type}`, args: clean, stripped };
    }
    clean[k] = v;
  }

  // 4. Límites
  if (countSoFar >= LIMITES.accionesPorDirectivo) {
    return { verdict: "bloqueado", layer: "Límites", reason: `Máximo ${LIMITES.accionesPorDirectivo} acciones por directivo en una jornada`, args: clean, stripped };
  }

  // 3. Política
  const blocked = policy.bloquearSi?.(clean);
  if (blocked) return { verdict: "bloqueado", layer: "Política", reason: blocked, args: clean, stripped };
  if (policy.risk === "critica") {
    return { verdict: "aprobacion", layer: "Política", reason: `${policy.descripcion}: acción crítica, requiere aprobación del dueño`, args: clean, stripped };
  }
  return {
    verdict: "permitido",
    layer: "Política",
    reason: `${policy.descripcion} (${policy.risk})`,
    args: clean,
    stripped,
  };
}

export function describeArgs(args: Record<string, unknown>) {
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`)
    .join(" · ");
}
