"use client";

import { useEffect, useRef } from "react";
import { CEO, COMPANY, DIRECTORS, DIRECTOR_BY_ID, OWNER } from "@/lib/company";
import { useOrquesta, type FeedItem } from "@/lib/store";
import type { Briefing, DirectorId, NodeId } from "@/lib/types";

const NODE_META: Record<NodeId, { name: string; color: string }> = {
  ceo: { name: CEO.name, color: "#93c5fd" },
  dueno: { name: OWNER.name, color: OWNER.color },
  ...(Object.fromEntries(DIRECTORS.map((d) => [d.id, { name: d.name, color: d.color }])) as Record<
    DirectorId,
    { name: string; color: string }
  >),
};

/* --------------------------------- Top bar -------------------------------- */

function TopBar() {
  const { running, run, mode, model, statuses } = useOrquesta();
  const done = Object.values(statuses).filter((s) => s === "done").length;
  return (
    <header className="topbar glass">
      <div className="brand">
        <div className="brand-mark" />
        <div>
          <div className="brand-name">ORQUESTA</div>
          <div className="brand-sub">Directivos de IA que guían a tu equipo</div>
        </div>
      </div>
      <div className="company">
        <span className="company-name">{COMPANY.name}</span>
        <span className="company-meta">14 personas · 5 directivos IA · 1 orquestador</span>
      </div>
      <div className="actions">
        {mode && (
          <span className={`chip ${mode === "live" ? "chip-live" : ""}`}>
            <i />
            {mode === "live" ? model : "demo"}
          </span>
        )}
        {running && <span className="progress-text">{done}/7 nodos</span>}
        <button className="btn-ghost" disabled={running} onClick={() => run(true)}>
          Demo
        </button>
        <button className="btn-primary" disabled={running} onClick={() => run(false)}>
          {running ? <span className="spinner" /> : <span className="play">▶</span>}
          {running ? "Jornada en curso" : "Iniciar jornada"}
        </button>
      </div>
    </header>
  );
}

/* ---------------------------------- Feed ---------------------------------- */

function Who({ id }: { id: NodeId | null | undefined }) {
  if (!id) return null;
  const m = NODE_META[id];
  return (
    <span className="who" style={{ color: m.color }}>
      {m.name}
    </span>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  if (item.kind === "system") return <div className="feed-system">{item.text}</div>;
  if (item.kind === "error") return <div className="feed-error">⚠ {item.text}</div>;
  if (item.kind === "tool")
    return (
      <div className="feed-row">
        <span className="dot" style={{ background: NODE_META[item.from!].color }} />
        <div>
          <Who id={item.from} /> <span className="mono tool">{item.text}</span>
          <div className="feed-detail">{item.detail}</div>
        </div>
      </div>
    );
  return (
    <div className="feed-row feed-msg">
      <span className="dot" style={{ background: NODE_META[item.from!].color }} />
      <div>
        <Who id={item.from} /> <span className="arrow">→</span> <Who id={item.to} />
        <div className="feed-text">{item.text}</div>
      </div>
    </div>
  );
}

function Feed() {
  const feed = useOrquesta((s) => s.feed);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [feed.length]);
  return (
    <aside className="panel panel-left glass">
      <div className="panel-head">
        <span className="live-dot" />
        Canal de directivos
      </div>
      <div className="feed" ref={ref}>
        {feed.length === 0 ? (
          <p className="empty">
            Aquí verás en tiempo real qué herramientas consulta cada directivo y qué se dicen entre ellos.
          </p>
        ) : (
          feed.map((item) => <FeedRow key={item.id} item={item} />)
        )}
      </div>
    </aside>
  );
}

/* --------------------------------- Details -------------------------------- */

function DirectorDetail({ id }: { id: DirectorId }) {
  const d = DIRECTOR_BY_ID[id];
  const report = useOrquesta((s) => s.reports[id]);
  const status = useOrquesta((s) => s.statuses[id]);
  return (
    <div className="detail" style={{ ["--c" as string]: d.color }}>
      <div className="detail-kicker">{d.title}</div>
      <h2 className="detail-title">{d.name}</h2>
      <p className="detail-mission">{d.mission}</p>
      <div className="chips">
        {d.tools.map((t) => (
          <span key={t} className="tool-chip mono">
            {t}
          </span>
        ))}
      </div>

      {!report ? (
        <div className="waiting">
          {status === "working" ? "Analizando su área…" : "Inicia la jornada para ver su reporte."}
          <div className="team-list">
            {d.team.map((w) => (
              <div key={w.name} className="team-row">
                <b>{w.name}</b> · {w.role}
                <span>{w.focus}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <p className="summary">{report.resumen}</p>
          {report.alertas.length > 0 && (
            <div className="alerts">
              {report.alertas.map((a) => (
                <div key={a} className="alert">
                  {a}
                </div>
              ))}
            </div>
          )}
          <div className="section-label">Guía de hoy para su equipo</div>
          {report.guias.map((g) => (
            <div key={g.persona} className="guide">
              <div className="guide-name">{g.persona}</div>
              <ol>
                {g.pasos.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            </div>
          ))}
          {report.escalar && (
            <div className="escalate">
              <span>Escala al orquestador</span>
              {report.escalar}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CeoDetail() {
  const reports = useOrquesta((s) => s.reports);
  const briefing = useOrquesta((s) => s.briefing);
  return (
    <div className="detail" style={{ ["--c" as string]: "#93c5fd" }}>
      <div className="detail-kicker">{CEO.title}</div>
      <h2 className="detail-title">{CEO.name}</h2>
      <p className="detail-mission">
        Recibe a los 5 directivos, conecta lo que ninguno ve solo y le sube al dueño solo lo que importa.
      </p>
      <div className="section-label">Escalaciones recibidas</div>
      {DIRECTORS.map((d) => (
        <div key={d.id} className="escalation-row" style={{ ["--c" as string]: d.color }}>
          <b>{d.name}</b>
          <span>{reports[d.id] ? reports[d.id]!.escalar || "Sin escalaciones" : "pendiente…"}</span>
        </div>
      ))}
      {briefing && <p className="summary">{briefing.estado}</p>}
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const color = value >= 75 ? "#34d399" : value >= 50 ? "#facc15" : "#f87171";
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" className="gauge">
      <circle cx="42" cy="42" r={r} stroke="rgba(148,163,184,.15)" strokeWidth="7" fill="none" />
      <circle
        cx="42"
        cy="42"
        r={r}
        stroke={color}
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / 100)}
        transform="rotate(-90 42 42)"
        style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dashoffset 1.2s ease" }}
      />
      <text x="42" y="47" textAnchor="middle" className="gauge-text">
        {value}
      </text>
    </svg>
  );
}

function OwnerInbox({ briefing }: { briefing: Briefing | null }) {
  const running = useOrquesta((s) => s.running);
  return (
    <div className="detail" style={{ ["--c" as string]: OWNER.color }}>
      <div className="detail-kicker">Bandeja del dueño</div>
      <h2 className="detail-title">Buenos días, {OWNER.name}</h2>
      {!briefing ? (
        <p className="detail-mission">
          {running
            ? "Tus directivos están trabajando. Nexo te subirá solo las decisiones que importan."
            : "Presiona «Iniciar jornada»: 5 directivos de IA revisan su área, guían a su gente, se coordinan entre ellos y Nexo te entrega máximo 3 decisiones."}
        </p>
      ) : (
        <>
          <div className="health">
            <Gauge value={briefing.salud} />
            <div>
              <div className="health-label">Salud de la empresa</div>
              <div className="health-state">{briefing.estado}</div>
            </div>
          </div>
          <p className="summary">{briefing.resumen}</p>
          <div className="section-label">Decisiones que necesitan tu firma</div>
          {briefing.decisiones.map((dec, i) => (
            <div key={i} className={`decision u-${dec.urgencia}`}>
              <div className="decision-head">
                <span className="urgency">{dec.urgencia}</span>
                <div className="area-dots">
                  {dec.areas.map((a) => (
                    <span key={a} title={DIRECTOR_BY_ID[a].title} style={{ background: DIRECTOR_BY_ID[a].color }} />
                  ))}
                </div>
              </div>
              <div className="decision-title">{dec.titulo}</div>
              <p className="decision-context">{dec.contexto}</p>
              <div className="recommendation">
                <span>Recomendación de Nexo</span>
                {dec.recomendacion}
              </div>
              <div className="options">
                {dec.opciones.map((o, j) => (
                  <button key={o} className={j === 0 ? "opt opt-main" : "opt"}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function DetailPanel() {
  const selected = useOrquesta((s) => s.selected);
  const briefing = useOrquesta((s) => s.briefing);
  const select = useOrquesta((s) => s.select);
  let body;
  if (selected === "ceo") body = <CeoDetail />;
  else if (selected && selected !== "dueno") body = <DirectorDetail id={selected} />;
  else body = <OwnerInbox briefing={briefing} />;
  return (
    <aside className="panel panel-right glass">
      {selected && (
        <button className="close" onClick={() => select(null)} aria-label="Cerrar">
          ×
        </button>
      )}
      <div className="panel-scroll">{body}</div>
    </aside>
  );
}

/* --------------------------------- Footer --------------------------------- */

function Footer() {
  const stats = useOrquesta((s) => s.stats);
  const mode = useOrquesta((s) => s.mode);
  const select = useOrquesta((s) => s.select);
  return (
    <footer className="footer">
      <div className="legend glass">
        {DIRECTORS.map((d) => (
          <button key={d.id} onClick={() => select(d.id)} style={{ ["--c" as string]: d.color }}>
            <i />
            {d.name}
          </button>
        ))}
      </div>
      {stats && (
        <div className="stats glass mono">
          {(stats.ms / 1000).toFixed(1)}s · {mode === "live" ? `${stats.tokens.toLocaleString()} tokens` : "sin costo (demo)"}
        </div>
      )}
    </footer>
  );
}

export default function Hud() {
  return (
    <div className="hud">
      <TopBar />
      <Feed />
      <DetailPanel />
      <Footer />
    </div>
  );
}
