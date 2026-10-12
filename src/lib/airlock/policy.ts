import type { DirectorId } from "../types";

/**
 * Política declarativa de Airlock. Deny-by-default: cualquier herramienta que
 * no esté aquí, o que pida un directivo que no es su dueño, se bloquea.
 *
 *   lectura   → se permite sola
 *   escritura → se permite sola, queda en bitácora
 *   critica   → necesita aprobación humana (o se bloquea si una regla lo dice)
 */
export type Risk = "lectura" | "escritura" | "critica";
type ArgType = "string" | "number";

export interface ToolPolicy {
  risk: Risk;
  owners: DirectorId[] | "todos";
  args: Record<string, ArgType>;
  descripcion: string;
  /** Regla extra: devuelve un motivo para bloquear, o null. */
  bloquearSi?: (args: Record<string, unknown>) => string | null;
}

/** Dominios con los que la empresa sí puede compartir información. */
export const DOMINIOS_PERMITIDOS = [
  "nebula.studio",
  "farmaya.mx",
  "logistix.com",
  "grupoaltamar.com",
  "vitta.mx",
  "cafeorigen.mx",
];

const dominioExterno = (correo: unknown) => {
  const valor = String(correo ?? "").trim();
  const dominio = valor.split("@")[1]?.toLowerCase() ?? "";
  if (!dominio) return `"${valor.slice(0, 40)}" no es un correo de un dominio permitido`;
  return DOMINIOS_PERMITIDOS.includes(dominio) ? null : `El dominio "${dominio}" no está en la lista de dominios permitidos`;
};

export const LIMITES = {
  accionesPorDirectivo: 3,
  tokensPorJornada: 60_000,
};

export const POLICY: Record<string, ToolPolicy> = {
  // ---------- Lectura ----------
  "github.list_pull_requests": { risk: "lectura", owners: ["ingenieria"], args: {}, descripcion: "Leer PRs abiertos" },
  "github.list_commits": { risk: "lectura", owners: ["ingenieria"], args: {}, descripcion: "Leer commits" },
  "github.list_issues": { risk: "lectura", owners: ["ingenieria"], args: {}, descripcion: "Leer issues" },
  "crm.list_deals": { risk: "lectura", owners: ["ventas"], args: {}, descripcion: "Leer oportunidades" },
  "gmail.search_threads": { risk: "lectura", owners: ["ventas"], args: {}, descripcion: "Leer correos" },
  "calendar.list_events": { risk: "lectura", owners: "todos", args: {}, descripcion: "Leer agenda" },
  "linear.list_projects": { risk: "lectura", owners: ["operaciones"], args: {}, descripcion: "Leer proyectos" },
  "slack.read_channel": { risk: "lectura", owners: "todos", args: {}, descripcion: "Leer canal" },
  "contabilidad.cuentas_por_cobrar": { risk: "lectura", owners: ["finanzas"], args: {}, descripcion: "Leer cobranza" },
  "banco.flujo_de_caja": { risk: "lectura", owners: ["finanzas"], args: {}, descripcion: "Leer flujo de caja" },
  "sheets.read_budget": { risk: "lectura", owners: ["finanzas"], args: {}, descripcion: "Leer presupuesto" },
  "hr.workload": { risk: "lectura", owners: ["talento"], args: {}, descripcion: "Leer carga de trabajo" },
  "hr.time_off": { risk: "lectura", owners: ["talento"], args: {}, descripcion: "Leer vacaciones" },
  "slack.pulse_survey": { risk: "lectura", owners: ["talento"], args: {}, descripcion: "Leer encuesta de clima" },

  // ---------- Escritura (internas, reversibles) ----------
  "slack.send_message": {
    risk: "escritura",
    owners: "todos",
    args: { canal: "string", texto: "string" },
    descripcion: "Mandar mensaje interno de Slack",
  },
  "calendar.create_event": {
    risk: "escritura",
    owners: "todos",
    args: { titulo: "string", con: "string", cuando: "string" },
    descripcion: "Agendar reunión interna",
  },
  "github.comment_pr": {
    risk: "escritura",
    owners: ["ingenieria"],
    args: { pr: "string", texto: "string" },
    descripcion: "Comentar en un PR",
  },

  // ---------- Críticas (salen de la empresa o mueven dinero/datos) ----------
  "gmail.send_email": {
    risk: "critica",
    owners: ["ventas", "finanzas", "operaciones"],
    args: { para: "string", asunto: "string", cuerpo: "string" },
    descripcion: "Enviar correo a un externo",
    bloquearSi: (a) => dominioExterno(a.para),
  },
  "crm.export_contacts": {
    risk: "critica",
    owners: ["ventas"],
    args: { destino: "string" },
    descripcion: "Exportar contactos de clientes",
    bloquearSi: (a) => dominioExterno(a.destino),
  },
  "banco.transferir": {
    risk: "critica",
    owners: ["finanzas"],
    args: { monto: "number", destino: "string" },
    descripcion: "Transferir dinero",
    bloquearSi: () => "Los agentes nunca mueven dinero: solo una persona puede hacer transferencias",
  },
  "hr.update_salary": {
    risk: "critica",
    owners: ["talento"],
    args: { persona: "string", nuevo_sueldo: "number" },
    descripcion: "Cambiar un sueldo",
  },
};

/** Herramientas de acción (no lectura) que un directivo puede proponer. */
export function actionToolsFor(id: DirectorId) {
  return Object.entries(POLICY)
    .filter(([, p]) => p.risk !== "lectura" && (p.owners === "todos" || p.owners.includes(id)))
    .map(([name, p]) => ({ name, ...p }));
}
