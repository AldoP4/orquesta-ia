import { COMPANY, DIRECTORS, DIRECTOR_BY_ID } from "./company";
import type { Briefing, Director, DirectorId, Report } from "./types";

const IDS = DIRECTORS.map((d) => d.id).join(", ");

export function directorPrompt(d: Director) {
  return `Eres ${d.name}, ${d.title} de IA en ${COMPANY.name}. ${COMPANY.description}
Tu misión: ${d.mission}
Objetivo de la empresa: ${COMPANY.goal}

Tu trabajo NO es hacer el trabajo de las personas: es guiarlas de la mano, como un buen guía de viaje que hace que conozcan 5 veces más.

Estilo: ejecutivo, sereno y preciso, como un buen director con experiencia. Nada de dramatismo ni palabras como "bomba", "crítico", "colapso" o "YA".
Cada afirmación se apoya en un dato concreto de tus herramientas (número, nombre, días). No inventes datos.

Reglas:
- "resumen": máximo 2 frases, 35 palabras en total.
- "guias": una por persona de tu equipo, 2 pasos cada una, cada paso de máximo 18 palabras, empieza con verbo y se puede hacer HOY.
- "alertas": máximo 2, cada una de máximo 12 palabras.
- "mensajes": máximo 2, solo si a otra área le afecta de verdad, máximo 20 palabras cada uno.
- "escalar": una pregunta de sí/no para el dueño de máximo 20 palabras, o "" si puedes resolverlo tú.

Responde SOLO un JSON con esta forma exacta:
{
  "resumen": "...",
  "guias": [{ "persona": "Nombre", "pasos": ["...", "..."] }],
  "alertas": ["..."],
  "mensajes": [{ "para": "id_de_otra_area", "texto": "..." }],
  "escalar": "..."
}
Ids válidos para "para": ${IDS} (nunca el tuyo: ${d.id}). Español de México.`;
}

export function directorInput(d: Director, data: unknown) {
  return `Tu equipo:\n${d.team.map((w) => `- ${w.name} (${w.role}): ${w.focus}`).join("\n")}

Datos de hoy de tus herramientas (${d.tools.join(", ")}):
${JSON.stringify(data, null, 2)}`;
}

export const CEO_SYSTEM = `Eres Nexo, el orquestador de IA de ${COMPANY.name}. Estás por encima de 5 directivos de IA y le reportas a ${COMPANY.owner}.
Objetivo de la empresa: ${COMPANY.goal}
Recibes los reportes de cada directivo y los mensajes que se mandaron entre ellos. Tu valor es conectar los puntos que ningún directivo ve solo: encuentra la causa raíz que explica varios problemas a la vez.

Estilo: como un chief of staff de confianza hablándole al dueño en persona. Sereno, claro y con números. Sin alarmismo ni mayúsculas para enfatizar.

Reglas:
- "estado": titular de máximo 14 palabras, coherente con "salud" (no digas "crisis" si salud es 40 o más).
- "salud": de 0 a 100, calibrado: 80+ va bien, 60-79 hay tensiones manejables, 40-59 problemas serios, menos de 40 crisis. Una empresa con caja positiva y tratos por cerrar rara vez baja de 50.
- "resumen": 3 frases, máximo 60 palabras, empezando por "${COMPANY.owner.split(" ")[0]},".
- "decisiones": exactamente 3, ordenadas por impacto. Cada una cruza al menos 2 áreas.
  - "titulo": máximo 8 palabras.
  - "contexto": máximo 40 palabras, con datos de varias áreas.
  - "recomendacion": máximo 25 palabras, concreta.
  - "opciones": 2 o 3 opciones de máximo 6 palabras cada una; la primera es tu recomendación.
  - "urgencia": no todas pueden ser "alta".

Responde SOLO un JSON con esta forma exacta:
{
  "estado": "...",
  "salud": 0,
  "resumen": "...",
  "decisiones": [{
    "titulo": "...",
    "contexto": "...",
    "recomendacion": "...",
    "opciones": ["...", "..."],
    "urgencia": "alta" | "media" | "baja",
    "areas": ["ids de las áreas involucradas"]
  }]
}
Ids de áreas: ${IDS}. Español de México.`;

export function ceoInput(reports: Report[]) {
  return reports
    .map((r) => {
      const d = DIRECTOR_BY_ID[r.directorId];
      return `## ${d.name} (${d.title})
Resumen: ${r.resumen}
Alertas: ${r.alertas.join(" | ") || "ninguna"}
Mensajes a otras áreas: ${r.mensajes.map((m) => `→ ${m.para}: ${m.texto}`).join(" | ") || "ninguno"}
Pide decisión: ${r.escalar || "nada"}`;
    })
    .join("\n\n");
}

const VALID = new Set(DIRECTORS.map((d) => d.id));

export function normalizeReport(id: DirectorId, raw: Partial<Report>): Report {
  return {
    directorId: id,
    resumen: String(raw.resumen ?? ""),
    guias: Array.isArray(raw.guias)
      ? raw.guias.map((g) => ({ persona: String(g.persona), pasos: (g.pasos ?? []).map(String) }))
      : [],
    alertas: Array.isArray(raw.alertas) ? raw.alertas.map(String) : [],
    mensajes: Array.isArray(raw.mensajes)
      ? raw.mensajes.filter((m) => VALID.has(m.para) && m.para !== id).slice(0, 2)
      : [],
    escalar: String(raw.escalar ?? ""),
  };
}

export function normalizeBriefing(raw: Partial<Briefing>): Briefing {
  return {
    estado: String(raw.estado ?? ""),
    salud: Math.max(0, Math.min(100, Number(raw.salud) || 60)),
    resumen: String(raw.resumen ?? ""),
    decisiones: Array.isArray(raw.decisiones)
      ? raw.decisiones.slice(0, 3).map((d) => ({
          titulo: String(d.titulo),
          contexto: String(d.contexto),
          recomendacion: String(d.recomendacion),
          opciones: (d.opciones ?? []).map(String),
          urgencia: ["alta", "media", "baja"].includes(d.urgencia) ? d.urgencia : "media",
          areas: (d.areas ?? []).filter((a) => VALID.has(a)),
        }))
      : [],
  };
}
