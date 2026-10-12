# Orquesta · Directivos de IA

> Otras plataformas reemplazan a las personas con agentes. Orquesta hace que tu equipo humano rinda 5 veces más.

Un viaje con guía no es lo mismo que uno sin guía: con alguien que te lleva de la mano conoces 5 o 6 veces más lugares. Orquesta aplica esa idea a una empresa: **directivos de IA** que revisan su área, guían paso a paso a cada persona de su equipo, se coordinan entre ellos y le suben al dueño **solo las decisiones que importan**.

Todo se ve en vivo en una torre de mando 3D.

## Cómo funciona

```
                 Ricardo (dueño)
                       ▲  máximo 3 decisiones
                 Nexo (orquestador)
          ▲        ▲        ▲        ▲        ▲
       Atlas     Vega     Orión    Fénix     Lyra
     Ingeniería Ventas  Operaciones Finanzas Talento
          │        │        │        │        │
     guía diaria para cada persona de su equipo
```

1. **Cada directivo consulta sus herramientas** (con forma de MCP: `github.list_pull_requests`, `crm.list_deals`, `banco.flujo_de_caja`…).
2. **Genera una guía del día** para cada persona: 2 o 3 pasos concretos, con nombres y datos.
3. **Se comunica con otras áreas** cuando detecta algo que les afecta (por ejemplo, Ventas avisa a Ingeniería que un trato nuevo necesita gente).
4. **Nexo (el orquestador)** cruza los 5 reportes, encuentra lo que ningún directivo ve por separado y entrega al dueño máximo 3 decisiones, cada una con contexto, recomendación y opciones.

Los datos de la empresa ficticia (*Nébula Studio*) están diseñados con tensiones reales entre áreas, para que los agentes tengan algo que descubrir.

## Stack

- **Next.js 15** + TypeScript
- **React Three Fiber**, drei y postprocessing (bloom) para la escena 3D
- **Zustand** para el estado y **NDJSON streaming** para ver los eventos en tiempo real
- **Cualquier LLM compatible con OpenAI**: OpenRouter en la nube u Ollama / LM Studio en local
- **GitHub REST API** con datos reales de Ingeniería (opcional)

## Correrlo

```bash
npm install
cp .env.example .env.local   # pon tu API key
npm run dev
```

- **Iniciar jornada** usa el LLM configurado. Por defecto es `qwen/qwen3.7-flash` en OpenRouter, que cuesta alrededor de US$0.001 por jornada.
- **Demo** corre con respuestas pregrabadas, sin API key.

### Modelo local (gratis)

```bash
ollama pull qwen3:8b
```

```env
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=qwen3:8b
```

### Datos reales de GitHub

```env
GITHUB_REPO=tu-usuario/tu-repo
```

Atlas (Ingeniería) leerá los PRs, commits e issues reales de ese repo.

## Roadmap

- [ ] Conectar servidores MCP reales (Slack, Google Calendar, Notion, Linear)
- [ ] Que el dueño apruebe decisiones y que se propaguen hacia abajo
- [ ] Una vista por trabajador: "tu guía de hoy"
- [ ] Memoria entre jornadas: cada directivo recuerda lo que pidió ayer
- [ ] Jornadas programadas (cron) y notificaciones

---

Construido con [Claude Code](https://claude.com/claude-code).
