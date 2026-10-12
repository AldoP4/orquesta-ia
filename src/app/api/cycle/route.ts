import { ceoInput, CEO_SYSTEM, directorInput, directorPrompt, normalizeBriefing, normalizeReport } from "@/lib/agents";
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

      const runDirector = async (d: Director, index: number): Promise<Report> => {
        await sleep(index * 450);
        emit({ type: "status", node: d.id, status: "working" });
        emit({ type: "message", from: "ceo", to: d.id, text: "Inicia la jornada: revisa tu área." });

        const snap = await snapshotFor(d.id);
        for (const call of snap.calls) {
          await sleep(jitter(250, 600));
          emit({ type: "tool", node: d.id, tool: call.tool, detail: call.detail });
        }

        let report: Report;
        if (live) {
          try {
            const res = await chatJson<Partial<Report>>(directorPrompt(d), directorInput(d, snap.data));
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

        emit({ type: "report", report });
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
            const res = await chatJson<Partial<Briefing>>(CEO_SYSTEM, ceoInput(reports));
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
