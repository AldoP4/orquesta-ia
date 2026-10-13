import type { AirlockEntry } from "../types";

/**
 * Serialización canónica de una entrada de la bitácora. El servidor la usa para
 * calcular cada hash y el navegador para verificar la cadena: si cualquiera de
 * los dos cambia un campo, el orden o el formato, la verificación falla.
 */
export function canonical(e: Omit<AirlockEntry, "hash">): string {
  return JSON.stringify({
    seq: e.seq,
    at: e.at,
    prev: e.prev,
    node: e.node,
    verdict: e.verdict,
    layer: e.layer,
    tool: e.tool,
    reason: e.reason,
    detail: e.detail ?? null,
  });
}

export const GENESIS = "0".repeat(64);

export interface ChainCheck {
  ok: boolean;
  checked: number;
  /** Primera entrada que no cuadra, si alguna. */
  brokenAt?: number;
}

/** Recalcula toda la cadena con Web Crypto (sirve en el navegador y en Node 20+). */
export async function verifyChain(entries: AirlockEntry[]): Promise<ChainCheck> {
  let prev = GENESIS;
  for (const e of entries) {
    if (e.prev !== prev) return { ok: false, checked: e.seq - 1, brokenAt: e.seq };
    const bytes = new TextEncoder().encode(canonical(e));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    if (hex !== e.hash) return { ok: false, checked: e.seq - 1, brokenAt: e.seq };
    prev = e.hash;
  }
  return { ok: true, checked: entries.length };
}
