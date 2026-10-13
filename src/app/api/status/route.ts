import { hasLlm, llmConfig } from "@/lib/llm";

export const dynamic = "force-dynamic";

/** Qué puede hacer este servidor: la UI lo usa para no ofrecer "En vivo" si no hay LLM. */
export function GET() {
  const live = hasLlm();
  return Response.json({
    live,
    model: live ? llmConfig().model : null,
    githubRepo: process.env.GITHUB_REPO || null,
  });
}
