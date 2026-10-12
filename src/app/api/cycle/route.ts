import { ceoInput, CEO_SYSTEM, directorInput, directorPrompt, normalizeBriefing, normalizeReport } from "@/lib/agents";
import { AuditLog, describeArgs, evaluateAction, quarantine, redact } from "@/lib/airlock";
import { LIMITES } from "@/lib/airlock/policy";
import { DIRECTORS } from "@/lib/company";
import { snapshotFor } from "@/lib/connectors";
import { DEMO_BRIEFING, DEMO_REPORTS } from "@/lib/demo";
import { chatJson, hasLlm, llmConfig } from "@/lib/llm";
import type { Briefing, CycleEvent, Director, Report } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (min: number, max: number) => min + Math.random() * (max - min);

export async function POST(req: Request) {
  const { demo: forceDemo } = await req.json().catch(() => ({ demo: false }));
  const live = hasLlm() && !forceDemo;
  const started = Date.now();
  let tokens = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (e: CycleEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const audit = new AuditLog();
      const airlockNotes: string[] = [];
      const guard = (e: Parameters<AuditLog["record"]>[0]) => emit({ type: "airlock", entry: audit.record(e) });

      const runDirector = async (d: Director, index: number): Promise<Report> => {
        await sleep(index * 450);
        emit({ type: "status", node: d.id, status: "working" });
        emit({ type: "message", from: "ceo", to: d.id, text: "Inicia la jornada: revisa tu área." });

        const snap = await snapshotFor(d.id);
        for (const call of snap.calls) {
          await sleep(jitter(250, 600));
          emit({ type: "tool", node: d.id, tool: call.tool, detail: call.detail });
        }

        // Airlock · capa 1 (Entrada): cuarentena de prompt injection en los datos.
        const q = quarantine(snap.data);
        for (const hit of q.hits) {
          await sleep(250);
          guard({ node: d.id, verdict: "cuarentena", layer: "Entrada", tool: "datos de herramientas", reason: "Intento de prompt injection retirado antes de llegar al modelo", detail: hit });
        }
        // Airlock · capa 5 también en la entrada: minimizamos lo que ve el proveedor del LLM.
        const inRedact = redact(q.clean);
        if (inRedact.found.length) {
          guard({ node: d.id, verdict: "redactado", layer: "Salida", tool: "datos de herramientas", reason: `Datos sensibles ocultos antes de enviarlos al modelo: ${inRedact.found.join(", ")}` });
        }

        let report: Report;
        // Airlock · capa 4 (Límites): presupuesto de tokens por jornada.
        const overBudget = tokens >= LIMITES.tokensPorJornada;
        if (live && overBudget) {
          guard({ node: d.id, verdict: "bloqueado", layer: "Límites", tool: "llm.chat", reason: `Presupuesto de ${LIMITES.tokensPorJornada.toLocaleString()} tokens agotado` });
        }
        if (live && !overBudget) {
          try {
            const res = await chatJson<Partial<Report>>(directorPrompt(d), directorInput(d, inRedact.clean));
            tokens += res.tokens;
            report = normalizeReport(d.id, res.data);
          } catch (err) {
            emit({ type: "error", message: `${d.name}: ${(err as Error).message}. Uso respaldo.` });
            report = DEMO_REPORTS[d.id];
          }
        } else {
          await sleep(jitter(1400, 3200));
          report = DEMO_REPORTS[d.id];
        }

        // Las acciones se evalúan con sus argumentos originales; la UI solo ve la versión redactada.
        const rawActions = report.acciones;

        // Airlock · capa 5 (Salida): nada sensible sale del modelo hacia la UI u otros agentes.
        const outRedact = redact(report);
        report = outRedact.clean;
        if (outRedact.found.length) {
          guard({ node: d.id, verdict: "redactado", layer: "Salida", tool: "respuesta del modelo", reason: `Ocultado en la respuesta: ${outRedact.found.join(", ")}` });
        }

        emit({ type: "report", report });

        // Airlock · capas 2-4 (Contrato, Política, Límites) para cada acción propuesta.
        let count = 0;
        for (const action of rawActions) {
          await sleep(jitter(350, 700));
          const v = evaluateAction(d.id, action, count);
          v.args = redact(v.args).clean;
          if (v.verdict !== "bloqueado") count++;
          const ghost = v.stripped.length ? ` · argumentos no declarados eliminados: ${v.stripped.join(", ")}` : "";
          guard({ node: d.id, verdict: v.verdict, layer: v.layer, tool: action.tool, reason: v.reason + ghost, detail: describeArgs(v.args) || action.motivo });
          const label = v.verdict === "permitido" ? "ejecutada" : v.verdict === "aprobacion" ? "en espera de aprobación" : "bloqueada";
          airlockNotes.push(`${d.name} propuso ${action.tool} (${action.motivo}) → ${label}: ${v.reason}`);
        }
        for (const m of report.mensajes) {
          await sleep(jitter(400, 900));
          emit({ type: "message", from: d.id, to: m.para, text: m.texto });
        }
        await sleep(300);
        emit({ type: "message", from: d.id, to: "ceo", text: report.escalar || "Reporte enviado, sin escalaciones." });
        emit({ type: "status", node: d.id, status: "done" });
        return report;
      };

      try {
        emit({
          type: "start",
          mode: live ? "live" : "demo",
          model: live ? llmConfig().model : "demo",
          githubReal: Boolean(process.env.GITHUB_REPO),
        });
        emit({ type: "status", node: "ceo", status: "working" });

        const reports = await Promise.all(DIRECTORS.map(runDirector));

        await sleep(500);
        emit({ type: "tool", node: "ceo", tool: "orquestador.sintetizar", detail: `${reports.length} reportes, cruzando áreas` });

        let briefing: Briefing;
        if (live) {
          try {
            const res = await chatJson<Partial<Briefing>>(CEO_SYSTEM, ceoInput(reports, airlockNotes));
            tokens += res.tokens;
            briefing = normalizeBriefing(res.data);
          } catch (err) {
            emit({ type: "error", message: `Nexo: ${(err as Error).message}. Uso respaldo.` });
            briefing = DEMO_BRIEFING;
          }
        } else {
          await sleep(2200);
          briefing = DEMO_BRIEFING;
        }

        emit({ type: "status", node: "ceo", status: "done" });
        emit({ type: "message", from: "ceo", to: "dueno", text: briefing.estado });
        await sleep(900);
        emit({ type: "briefing", briefing });
        emit({ type: "status", node: "dueno", status: "done" });
        emit({ type: "done", ms: Date.now() - started, tokens });
      } catch (err) {
        emit({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
