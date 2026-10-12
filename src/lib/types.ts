export type DirectorId = "ingenieria" | "ventas" | "operaciones" | "finanzas" | "talento";
export type NodeId = DirectorId | "ceo" | "dueno";
export type NodeStatus = "idle" | "working" | "done" | "error";

export interface Worker {
  name: string;
  role: string;
  focus: string;
}

export interface Director {
  id: DirectorId;
  name: string;
  title: string;
  color: string;
  tools: string[];
  team: Worker[];
  mission: string;
}

export interface Guide {
  persona: string;
  pasos: string[];
}

export interface ProposedAction {
  tool: string;
  args: Record<string, unknown>;
  motivo: string;
}

export interface Report {
  directorId: DirectorId;
  resumen: string;
  guias: Guide[];
  alertas: string[];
  mensajes: { para: DirectorId; texto: string }[];
  escalar: string;
  acciones: ProposedAction[];
}

export type Verdict = "permitido" | "aprobacion" | "bloqueado" | "cuarentena" | "redactado";

export interface AirlockEntry {
  seq: number;
  node: NodeId;
  verdict: Verdict;
  layer: string;
  tool: string;
  reason: string;
  detail?: string;
  hash: string;
  prev: string;
  at: number;
}

export interface Decision {
  titulo: string;
  contexto: string;
  recomendacion: string;
  opciones: string[];
  urgencia: "alta" | "media" | "baja";
  areas: DirectorId[];
}

export interface Briefing {
  estado: string;
  salud: number;
  resumen: string;
  decisiones: Decision[];
}

export type CycleEvent =
  | { type: "start"; mode: "live" | "demo"; model: string; githubReal: boolean }
  | { type: "status"; node: NodeId; status: NodeStatus }
  | { type: "tool"; node: NodeId; tool: string; detail: string }
  | { type: "message"; from: NodeId; to: NodeId; text: string }
  | { type: "report"; report: Report }
  | { type: "briefing"; briefing: Briefing }
  | { type: "airlock"; entry: AirlockEntry }
  | { type: "error"; message: string }
  | { type: "done"; ms: number; tokens: number };
