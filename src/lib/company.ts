import type { Director, DirectorId } from "./types";

export const COMPANY = {
  name: "Nébula Studio",
  description:
    "Agencia de desarrollo de software en Guadalajara, 14 personas. Hace apps web y móviles para PyMEs y startups de LATAM.",
  owner: "Aldo (dueño)",
  goal: "Crecer 30% este trimestre sin quemar al equipo y sin perder margen.",
};

export const DIRECTORS: Director[] = [
  {
    id: "ingenieria",
    code: "ING",
    name: "Atlas",
    title: "Directivo de Ingeniería",
    color: "#ECEAE4",
    tools: ["github.list_pull_requests", "github.list_commits", "github.list_issues"],
    mission: "Que el código salga a tiempo, revisado y sin deuda que explote después.",
    team: [
      { name: "Luis", role: "Tech lead", focus: "Arquitectura del proyecto FarmaYa" },
      { name: "Daniela", role: "Frontend", focus: "Dashboard de Logistix" },
      { name: "Marco", role: "Backend", focus: "API de pagos de FarmaYa" },
      { name: "Sofía", role: "QA", focus: "Pruebas de regresión" },
    ],
  },
  {
    id: "ventas",
    code: "VEN",
    name: "Vega",
    title: "Directiva de Ventas",
    color: "#ECEAE4",
    tools: ["crm.list_deals", "gmail.search_threads", "calendar.list_events"],
    mission: "Cerrar los tratos correctos, no cualquier trato.",
    team: [
      { name: "Andrea", role: "Ejecutiva de cuenta", focus: "Prospectos enterprise" },
      { name: "Jorge", role: "SDR", focus: "Prospección en LinkedIn" },
    ],
  },
  {
    id: "operaciones",
    code: "OPS",
    name: "Orión",
    title: "Directivo de Operaciones",
    color: "#ECEAE4",
    tools: ["linear.list_projects", "calendar.list_events", "slack.read_channel"],
    mission: "Que cada proyecto se entregue en fecha y el cliente lo sepa antes de preguntar.",
    team: [
      { name: "Paola", role: "Project manager", focus: "FarmaYa y Logistix" },
      { name: "Iván", role: "Project manager", focus: "Cuentas pequeñas" },
      { name: "Karla", role: "Soporte", focus: "Tickets de clientes en producción" },
    ],
  },
  {
    id: "finanzas",
    code: "FIN",
    name: "Fénix",
    title: "Directivo de Finanzas",
    color: "#ECEAE4",
    tools: ["contabilidad.cuentas_por_cobrar", "banco.flujo_de_caja", "sheets.read_budget"],
    mission: "Que el dinero entre a tiempo y cada proyecto deje margen.",
    team: [
      { name: "Gabriela", role: "Contadora", focus: "Cobranza y facturación" },
      { name: "Héctor", role: "Analista", focus: "Rentabilidad por proyecto" },
    ],
  },
  {
    id: "talento",
    code: "TAL",
    name: "Lyra",
    title: "Directiva de Talento",
    color: "#ECEAE4",
    tools: ["hr.workload", "hr.time_off", "slack.pulse_survey"],
    mission: "Que la gente crezca, esté bien y no se vaya.",
    team: [
      { name: "Mariana", role: "People partner", focus: "1:1s y clima laboral" },
      { name: "Tomás", role: "Reclutador", focus: "Vacante de backend senior" },
    ],
  },
];

export const DIRECTOR_BY_ID = Object.fromEntries(DIRECTORS.map((d) => [d.id, d])) as Record<
  DirectorId,
  Director
>;

export const CEO = {
  name: "Nexo",
  title: "Orquestador",
  color: "#ECEAE4",
};

export const OWNER = {
  name: "Aldo",
  title: "Dueño",
  color: "#FF5B1F",
};
