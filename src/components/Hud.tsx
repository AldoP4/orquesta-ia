"use client";

import { useEffect, useRef, useState } from "react";
import { CEO, COMPANY, DIRECTORS, DIRECTOR_BY_ID, OWNER } from "@/lib/company";
import { useOrquesta, type FeedItem } from "@/lib/store";
import type { AirlockEntry, Briefing, DirectorId, NodeId, NodeStatus, Verdict } from "@/lib/types";

/* --------------------------------- Catálogo -------------------------------- */

const UNIT: Record<NodeId, { code: string; name: string; role: string }> = {
  dueno: { code: "OWN", name: OWNER.name, role: "Dueño" },
  ceo: { code: "ORQ", name: CEO.name, role: "Orquestador" },
  ...(Object.fromEntries(
    DIRECTORS.map((d) => [d.id, { code: d.code, name: d.name, role: d.title.replace(/^Directiv[oa] de /, "") }]),
  ) as Record<DirectorId, { code: string; name: string; role: string }>),
};

const VERDICT: Record<Verdict, { label: string; tone: "ok" | "warn" | "stop" | "muted" }> = {
  permitido: { label: "Permitido", tone: "ok" },
  aprobacion: { label: "Aprobación", tone: "warn" },
  bloqueado: { label: "Bloqueado", tone: "stop" },
  cuarentena: { label: "Cuarentena", tone: "stop" },
  redactado: { label: "Redactado", tone: "muted" },
};

const LAYERS = [
  { name: "Entrada", desc: "Escanea los datos de las herramientas y pone en cuarentena los intentos de prompt injection antes de que lleguen al modelo." },
  { name: "Contrato", desc: "Deny-by-default. La herramienta debe existir, el área debe ser su dueña y los argumentos deben tener el tipo correcto." },
  { name: "Política", desc: "Lectura y escritura interna pasan. Lo crítico espera al dueño. Dinero y datos hacia dominios no permitidos se bloquean." },
  { name: "Límites", desc: "Máximo de acciones por directivo y presupuesto de tokens por jornada." },
  { name: "Salida", desc: "Oculta correos externos, teléfonos, tarjetas, RFC/CURP y API keys antes de la UI, otros agentes o el LLM." },
];

const PHASES = ["Recolección", "Análisis", "Coordinación", "Síntesis", "Decisión"];

const STATUS: Record<NodeStatus, string> = { idle: "En espera", working: "Activo", done: "Listo", error: "Error" };

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const time = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/* -------------------------------- Primitivas ------------------------------- */

function Code({ id }: { id: NodeId | null | undefined }) {
  if (!id) return null;
  return <span className="code">{UNIT[id].code}</span>;
}

function Tag({ v }: { v: Verdict }) {
  return <span className={`tag tone-${VERDICT[v].tone}`}>{VERDICT[v].label}</span>;
}

function Dot({ status }: { status: NodeStatus }) {
  return <i className={`dot st-${status}`} />;
}

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="section">
      <span>{children}</span>
      {right && <span className="section-right">{right}</span>}
    </div>
  );
}

/* --------------------------------- Titlebar -------------------------------- */

function Titlebar() {
  const { running, run, mode } = useOrquesta();
  const [demo, setDemo] = useState(false);
  return (
    <header className="titlebar">
      <div className="tb-left">
        <div className="mark" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <span className="wordmark">Orquesta</span>
        <span className="tb-sep" />
        <span className="tb-meta">
          {COMPANY.name} <em>/</em> Consola de mando
        </span>
      </div>
      <div className="tb-right">
        <div className="segmented" role="radiogroup" aria-label="Modo">
          <button role="radio" aria-checked={!demo} className={!demo ? "on" : ""} onClick={() => setDemo(false)} disabled={running}>
            En vivo
          </button>
          <button role="radio" aria-checked={demo} className={demo ? "on" : ""} onClick={() => setDemo(true)} disabled={running}>
            Demo
          </button>
        </div>
        <button className="run" disabled={running} onClick={() => run(demo)}>
          <span className="run-icon">{running ? <span className="spin" /> : "▶"}</span>
          <span>{running ? "Jornada en curso" : "Iniciar jornada"}</span>
          <kbd>↵</kbd>
        </button>
        {mode && <span className={`mode-flag ${mode}`}>{mode === "live" ? "LIVE" : "DEMO"}</span>}
      </div>
    </header>
  );
}

/* ------------------------------ Panel izquierdo ---------------------------- */

function Roster() {
  const statuses = useOrquesta((s) => s.statuses);
  const selected = useOrquesta((s) => s.selected);
  const select = useOrquesta((s) => s.select);
  const order: NodeId[] = ["dueno", "ceo", ...DIRECTORS.map((d) => d.id)];
  return (
    <div className="roster">
      {order.map((id, i) => (
        <button key={id} className={`roster-row ${selected === id ? "sel" : ""}`} onClick={() => select(id)}>
          <span className="idx">{pad(i)}</span>
          <Code id={id} />
          <span className="r-name">{UNIT[id].name}</span>
          <span className="r-role">{UNIT[id].role}</span>
          <span className={`r-status st-${statuses[id]}`}>
            <Dot status={statuses[id]} />
            {STATUS[statuses[id]]}
          </span>
        </button>
      ))}
    </div>
  );
}

function LogRow({ item }: { item: FeedItem }) {
  const t = <span className="ts">{time(item.at)}</span>;
  if (item.kind === "system")
    return (
      <div className="log sys">
        {t}
        <span>{item.text}</span>
      </div>
    );
  if (item.kind === "error")
    return (
      <div className="log err">
        {t}
        <span>{item.text}</span>
      </div>
    );
  if (item.kind === "airlock")
    return (
      <div className={`log al tone-${VERDICT[item.verdict!].tone}`}>
        {t}
        <div>
          <div className="log-head">
            <span className="al-mark">AL</span>
            <Tag v={item.verdict!} />
            <Code id={item.from} />
            <span className="mono-dim">{item.text}</span>
          </div>
          <div className="log-body">{item.detail}</div>
        </div>
      </div>
    );
  if (item.kind === "tool")
    return (
      <div className="log tool">
        {t}
        <div>
          <div className="log-head">
            <Code id={item.from} />
            <span className="mono-dim">{item.text}</span>
          </div>
          <div className="log-body dim">{item.detail}</div>
        </div>
      </div>
    );
  return (
    <div className="log msg">
      {t}
      <div>
        <div className="log-head">
          <Code id={item.from} />
          <span className="arrow">→</span>
          <Code id={item.to} />
        </div>
        <div className="log-body">{item.text}</div>
      </div>
    </div>
  );
}

function Log() {
  const feed = useOrquesta((s) => s.feed);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [feed.length]);
  return (
    <div className="logwrap" ref={ref}>
      {feed.length === 0 ? (
        <p className="empty">
          Sin eventos. Inicia una jornada para ver qué consulta cada unidad, qué se dicen entre ellas y qué deja pasar Airlock.
        </p>
      ) : (
        feed.map((item) => <LogRow key={item.id} item={item} />)
      )}
    </div>
  );
}

function LeftPanel() {
  const count = useOrquesta((s) => s.feed.length);
  return (
    <aside className="pane pane-left">
      <SectionLabel right="7">Unidades</SectionLabel>
      <Roster />
      <SectionLabel right={pad(count, 3)}>Registro</SectionLabel>
      <Log />
    </aside>
  );
}

/* ------------------------------ Escenario (stage) --------------------------- */

function Stage() {
  const phase = useOrquesta((s) => s.phase);
  const running = useOrquesta((s) => s.running);
  return (
    <section className="stage-frame" aria-label="Vista 3D">
      <div className="corner tl">
        <span>VISTA</span> Torre de mando
      </div>
      <div className="corner tr">Arrastra para orbitar · Rueda para acercar</div>
      <span className="crop c1" />
      <span className="crop c2" />
      <span className="crop c3" />
      <span className="crop c4" />
      <div className="timeline">
        {PHASES.map((p, i) => {
          const n = i + 1;
          const state = phase > n || (phase === n && !running) ? "done" : phase === n ? "now" : "todo";
          return (
            <div key={p} className={`ph ${state}`}>
              <span className="ph-n">{pad(n)}</span>
              <span className="ph-l">{p}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------------------------- Inspector ------------------------------- */

function DirectorView({ id }: { id: DirectorId }) {
  const d = DIRECTOR_BY_ID[id];
  const report = useOrquesta((s) => s.reports[id]);
  const status = useOrquesta((s) => s.statuses[id]);
  return (
    <div className="view">
      <div className="v-kicker">
        <Code id={id} /> {d.title}
      </div>
      <h2 className="v-title">{d.name}</h2>
      <p className="v-lede">{d.mission}</p>

      <SectionLabel>Herramientas</SectionLabel>
      <div className="toolset">
        {d.tools.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>

      {!report ? (
        <>
          <SectionLabel right={status === "working" ? "analizando" : undefined}>Equipo</SectionLabel>
          <table className="tbl">
            <tbody>
              {d.team.map((w) => (
                <tr key={w.name}>
                  <td className="strong">{w.name}</td>
                  <td>{w.role}</td>
                  <td className="dim">{w.focus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <SectionLabel>Estado</SectionLabel>
          <p className="prose">{report.resumen}</p>
          {report.alertas.length > 0 && (
            <ul className="alerts">
              {report.alertas.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <SectionLabel right={`${report.guias.length} personas`}>Guía del día</SectionLabel>
          {report.guias.map((g) => (
            <div key={g.persona} className="guide">
              <div className="g-name">{g.persona}</div>
              <ol>
                {g.pasos.map((p, i) => (
                  <li key={i}>
                    <span>{pad(i + 1)}</span>
                    {p}
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {report.escalar && (
            <>
              <SectionLabel>Escala al orquestador</SectionLabel>
              <p className="callout">{report.escalar}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

function CeoView() {
  const reports = useOrquesta((s) => s.reports);
  const briefing = useOrquesta((s) => s.briefing);
  return (
    <div className="view">
      <div className="v-kicker">
        <Code id="ceo" /> Orquestador
      </div>
      <h2 className="v-title">{CEO.name}</h2>
      <p className="v-lede">Recibe a las 5 unidades, conecta lo que ninguna ve sola y le sube al dueño solo lo que importa.</p>
      <SectionLabel>Escalaciones recibidas</SectionLabel>
      <table className="tbl">
        <tbody>
          {DIRECTORS.map((d) => (
            <tr key={d.id}>
              <td>
                <Code id={d.id} />
              </td>
              <td className={reports[d.id] ? "" : "dim"}>
                {reports[d.id] ? reports[d.id]!.escalar || "Sin escalaciones" : "Pendiente"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {briefing && (
        <>
          <SectionLabel>Titular</SectionLabel>
          <p className="prose">{briefing.estado}</p>
        </>
      )}
    </div>
  );
}

function Meter({ value }: { value: number }) {
  const ticks = 40;
  const lit = Math.round((value / 100) * ticks);
  return (
    <div className="meter" aria-label={`Salud ${value} de 100`}>
      <div className="meter-num">
        {value}
        <span>/100</span>
      </div>
      <div className="meter-bar">
        {Array.from({ length: ticks }, (_, i) => (
          <i key={i} className={i < lit ? "on" : ""} />
        ))}
      </div>
      <div className="meter-scale">
        <span>Crisis</span>
        <span>Serio</span>
        <span>Tensión</span>
        <span>Sano</span>
      </div>
    </div>
  );
}

function Approvals({ items }: { items: AirlockEntry[] }) {
  const approvals = useOrquesta((s) => s.approvals);
  const resolve = useOrquesta((s) => s.resolveApproval);
  if (!items.length) return null;
  return (
    <>
      <SectionLabel right={`${items.filter((e) => !approvals[e.seq]).length} pendientes`}>Airlock · Aprobaciones</SectionLabel>
      {items.map((e) => {
        const state = approvals[e.seq];
        return (
          <div key={e.seq} className={`approval ${state ?? ""}`}>
            <div className="log-head">
              <Code id={e.node} />
              <span className="mono-dim">{e.tool}</span>
            </div>
            {e.detail && <p className="small">{e.detail}</p>}
            {state ? (
              <div className="resolved">{state === "aprobado" ? "Aprobado · se ejecuta" : "Rechazado"}</div>
            ) : (
              <div className="btnrow">
                <button className="btn primary" onClick={() => resolve(e.seq, "aprobado")}>
                  Aprobar
                </button>
                <button className="btn" onClick={() => resolve(e.seq, "rechazado")}>
                  Rechazar
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function OwnerView({ briefing }: { briefing: Briefing | null }) {
  const running = useOrquesta((s) => s.running);
  const pending = useOrquesta((s) => s.airlock).filter((e) => e.verdict === "aprobacion");
  return (
    <div className="view">
      <div className="v-kicker">
        <Code id="dueno" /> Bandeja del dueño
      </div>
      <h2 className="v-title">Buenos días, {OWNER.name}.</h2>
      {!briefing ? (
        <p className="v-lede">
          {running
            ? "Las unidades están trabajando. Nexo te subirá solo las decisiones que importan."
            : "Cinco directivos de IA revisan su área, guían a su gente y se coordinan. Nexo te entrega máximo tres decisiones."}
        </p>
      ) : (
        <>
          <Meter value={briefing.salud} />
          <p className="headline">{briefing.estado}</p>
          <p className="prose">{briefing.resumen}</p>
          <SectionLabel right={`${briefing.decisiones.length}`}>Decisiones</SectionLabel>
          {briefing.decisiones.map((dec, i) => (
            <article key={i} className={`decision u-${dec.urgencia}`}>
              <header>
                <span className="d-n">D-{pad(i + 1)}</span>
                <span className={`urg u-${dec.urgencia}`}>{dec.urgencia}</span>
                <span className="d-areas">
                  {dec.areas.map((a) => (
                    <Code key={a} id={a} />
                  ))}
                </span>
              </header>
              <h3>{dec.titulo}</h3>
              <p className="small">{dec.contexto}</p>
              <div className="reco">
                <span>Recomendación</span>
                {dec.recomendacion}
              </div>
              <div className="btnrow">
                {dec.opciones.map((o, j) => (
                  <button key={o} className={j === 0 ? "btn primary" : "btn"}>
                    {o}
                  </button>
                ))}
              </div>
            </article>
          ))}
          <Approvals items={pending} />
        </>
      )}
    </div>
  );
}

function AirlockView() {
  const entries = useOrquesta((s) => s.airlock);
  const counts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.verdict] = (acc[e.verdict] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div className="view">
      <div className="v-kicker">
        <span className="code">AL</span> Capa de seguridad
      </div>
      <h2 className="v-title">Airlock</h2>
      <p className="v-lede">
        La membrana entre los agentes y el mundo. Cada lectura y cada acción pasa por cinco capas y queda en una bitácora con hashes encadenados.
      </p>
      <div className="counters">
        {(Object.keys(VERDICT) as Verdict[]).map((v) => (
          <div key={v} className={`tone-${VERDICT[v].tone}`}>
            <b>{pad(counts[v] ?? 0)}</b>
            <span>{VERDICT[v].label}</span>
          </div>
        ))}
      </div>
      <SectionLabel>Capas</SectionLabel>
      <ol className="layers">
        {LAYERS.map((l, i) => (
          <li key={l.name}>
            <span className="l-n">L{i + 1}</span>
            <div>
              <b>{l.name}</b>
              <p>{l.desc}</p>
            </div>
          </li>
        ))}
      </ol>
      <SectionLabel right={entries.length ? `${entries.length} entradas` : undefined}>Bitácora</SectionLabel>
      {entries.length === 0 ? (
        <p className="empty">Sin entradas todavía.</p>
      ) : (
        <div className="audit">
          {entries.map((e) => (
            <div key={e.seq} className={`audit-row tone-${VERDICT[e.verdict].tone}`}>
              <div className="log-head">
                <span className="ts">#{pad(e.seq, 3)}</span>
                <Tag v={e.verdict} />
                <Code id={e.node} />
                <span className="layer-name">{e.layer}</span>
              </div>
              <div className="mono-dim">{e.tool}</div>
              <div className="log-body">{e.reason}</div>
              {e.detail && <div className="log-body dim">{e.detail}</div>}
              <div className="hash" title={`hash ${e.hash}\nprev ${e.prev}`}>
                {e.prev.slice(0, 10)} <em>→</em> {e.hash.slice(0, 10)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Inspector() {
  const selected = useOrquesta((s) => s.selected);
  const select = useOrquesta((s) => s.select);
  const briefing = useOrquesta((s) => s.briefing);
  const airlockCount = useOrquesta((s) => s.airlock.length);
  const unitId = selected && selected !== "dueno" && selected !== "airlock" ? selected : null;
  const tab = selected === "airlock" ? "airlock" : unitId ? "unit" : "owner";

  let body;
  if (tab === "airlock") body = <AirlockView />;
  else if (unitId === "ceo") body = <CeoView />;
  else if (unitId) body = <DirectorView id={unitId} />;
  else body = <OwnerView briefing={briefing} />;

  return (
    <aside className="pane pane-right">
      <nav className="tabs">
        <button className={tab === "owner" ? "on" : ""} onClick={() => select("dueno")}>
          Dueño
        </button>
        <button className={tab === "airlock" ? "on" : ""} onClick={() => select("airlock")}>
          Airlock {airlockCount > 0 && <span className="badge">{airlockCount}</span>}
        </button>
        <button className={tab === "unit" ? "on" : ""} disabled={!unitId}>
          {unitId ? UNIT[unitId].name : "Unidad"}
        </button>
      </nav>
      <div className="pane-scroll" key={`${tab}-${unitId ?? ""}`}>
        {body}
      </div>
    </aside>
  );
}

/* --------------------------------- Statusbar -------------------------------- */

function Clock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{now ? time(now) : "--:--:--"}</span>;
}

function Statusbar() {
  const { running, mode, model, stats, airlock, githubReal } = useOrquesta();
  const stopped = airlock.filter((e) => e.verdict === "bloqueado" || e.verdict === "cuarentena").length;
  const pending = airlock.filter((e) => e.verdict === "aprobacion").length;
  return (
    <footer className="statusbar">
      <span className={`sb-state ${running ? "busy" : ""}`}>
        <i />
        {running ? "Procesando" : "Listo"}
      </span>
      <span>
        <em>Modelo</em> {mode === "live" ? model : mode === "demo" ? "demo" : "—"}
      </span>
      <span>
        <em>Tokens</em> {stats && mode === "live" ? stats.tokens.toLocaleString("es-MX") : "—"}
      </span>
      <span>
        <em>Duración</em> {stats ? `${(stats.ms / 1000).toFixed(1)} s` : "—"}
      </span>
      <span>
        <em>Airlock</em> {airlock.length} rev · <b className={stopped ? "hot" : ""}>{stopped} frenadas</b> · {pending} pend.
      </span>
      <span className="sb-grow" />
      {githubReal && (
        <span>
          <em>GitHub</em> conectado
        </span>
      )}
      <Clock />
    </footer>
  );
}

/* ------------------------------------ App ----------------------------------- */

export default function Hud() {
  const select = useOrquesta((s) => s.select);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      // Enter equivale a pulsar el botón, así respeta el modo elegido (En vivo / Demo).
      if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) document.querySelector<HTMLButtonElement>(".run")?.click();
      else if (e.key === "Escape") select(null);
      else if (e.key.toLowerCase() === "a") select("airlock");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  return (
    <div className="shell">
      <Titlebar />
      <LeftPanel />
      <Stage />
      <Inspector />
      <Statusbar />
    </div>
  );
}
