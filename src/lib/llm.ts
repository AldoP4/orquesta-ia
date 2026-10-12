/**
 * Cliente mínimo compatible con la API de OpenAI. Funciona igual con
 * OpenRouter (nube) que con Ollama / LM Studio (local): solo cambia LLM_BASE_URL.
 */
export const llmConfig = () => ({
  baseUrl: (process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, ""),
  apiKey: process.env.LLM_API_KEY || "",
  model: process.env.LLM_MODEL || "qwen/qwen3.7-flash",
});

export const hasLlm = () => Boolean(llmConfig().apiKey);

export interface LlmResult<T> {
  data: T;
  tokens: number;
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("El modelo no devolvió JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function chatJson<T>(system: string, user: string): Promise<LlmResult<T>> {
  const { baseUrl, apiKey, model } = llmConfig();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/orquesta-ia",
      "X-Title": "Orquesta IA",
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      response_format: { type: "json_object" },
      // Modelos con "thinking": en OpenRouter lo apagamos para ahorrar tokens y latencia.
      ...(baseUrl.includes("openrouter.ai") ? { reasoning: { enabled: false } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const text: string = json.choices?.[0]?.message?.content ?? "";
  return { data: extractJson(text) as T, tokens: json.usage?.total_tokens ?? 0 };
}
