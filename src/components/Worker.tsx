"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COMPANY, DIRECTORS, DIRECTOR_BY_ID, OWNER } from "@/lib/company";
import { hydrateOrquesta, useOrquesta } from "@/lib/store";
import type { DirectorId } from "@/lib/types";

/**
 * "Mi jornada": lo que ve cada persona del equipo. Es la otra mitad de la idea:
 * el dueño decide arriba y aquí cada quien recibe sus pasos de hoy, los marca
 * y avisa si algo lo bloquea. Todo eso lo leen los directivos en la siguiente jornada.
 */

const PREFIX = "Pendiente de ayer: ";
const pad = (n: number) => String(n).padStart(2, "0");

interface Person {
  name: string;
  role: string;
  focus: string;
  director: DirectorId;
}

const PEOPLE: Person[] = DIRECTORS.flatMap((d) => d.team.map((w) => ({ ...w, director: d.id })));

function useGuide(person: Person) {
  const report = useOrquesta((s) => s.reports[person.director]);
  return report?.guias.find((g) => g.persona === person.name) ?? null;
}

/* --------------------------------- Lista ----------------------------------- */

function PeopleList({ current, onPick }: { current: string; onPick: (name: string) => void }) {
  const reports = useOrquesta((s) => s.reports);
  const progress = useOrquesta((s) => s.progress);
  const blockers = useOrquesta((s) => s.blockers);
  return (
    <aside className="pane pane-left w-people">
      {DIRECTORS.map((d) => (
        <div key={d.id}>
          <div className="section">
            <span>
              {d.code} · {d.name}
            </span>
            <span className="section-right">{d.team.length}</span>
          </div>
          {d.team.map((w) => {
            const guide = reports[d.id]?.guias.find((g) => g.persona === w.name);
            const total = guide?.pasos.length ?? 0;
            const done = progress[w.name]?.length ?? 0;
            return (
              <button key={w.name} className={`roster-row ${current === w.name ? "sel" : ""}`} onClick={() => onPick(w.name)}>
                <span className="r-name">{w.name}</span>
                <span className="r-role">{w.role}</span>
                <span className="w-mini">
                  {blockers[w.name] && <span className="tag tone-warn">bloqueo</span>}
                  {total > 0 ? (
                    <span className="mono-dim">
                      {done}/{total}
                    </span>
                  ) : (
                    <span className="dim mono-dim">—</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

/* --------------------------------- Pasos ----------------------------------- */

function Steps({ person }: { person: Person }) {
  const guide = useGuide(person);
  const done = useOrquesta((s) => s.progress[person.name]) ?? [];
  const toggle = useOrquesta((s) => s.toggleStep);
  if (!guide) return null;
  const total = guide.pasos.length;
  return (
    <>
      <div className="w-progress">
        <div className="meter-bar wide">
          {guide.pasos.map((_, i) => (
            <i key={i} className={i < done.length ? "on" : ""} />
          ))}
        </div>
        <span className="mono-dim">
          {done.length} de {total} pasos
          {done.length === total && total > 0 ? " · día completo" : ""}
        </span>
      </div>
      <ol className="w-steps">
        {guide.pasos.map((p, i) => {
          const isDone = done.includes(i);
          const carried = p.startsWith(PREFIX);
          return (
            <li key={i}>
              <button className={`w-step ${isDone ? "done" : ""}`} onClick={() => toggle(person.name, i)} aria-pressed={isDone}>
                <span className="w-check" aria-hidden>
                  {isDone ? "✓" : ""}
                </span>
                <span className="w-n">{pad(i + 1)}</span>
                <span className="w-text">
                  {carried && <span className="tag tone-warn">De ayer</span>} {carried ? p.slice(PREFIX.length) : p}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Blocker({ person }: { person: Person }) {
  const current = useOrquesta((s) => s.blockers[person.name]);
  const report = useOrquesta((s) => s.reportBlocker);
  const director = DIRECTOR_BY_ID[person.director];
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    setEditing(false);
    setText("");
  }, [person.name]);

  if (current && !editing) {
    return (
      <div className="w-blocker sent">
        <div>
          <span className="tag tone-warn">Avisado a {director.name}</span>
          <p>{current}</p>
        </div>
        <div className="btnrow">
          <button
            className="btn"
            onClick={() => {
              setText(current);
              setEditing(true);
            }}
          >
            Editar
          </button>
          <button className="btn" onClick={() => report(person.name, "")}>
            Ya se resolvió
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="w-blocker"
      onSubmit={(e) => {
        e.preventDefault();
        report(person.name, text);
        setEditing(false);
      }}
    >
      <label htmlFor="blocker">¿Algo te bloquea? {director.name} lo verá en la próxima jornada.</label>
      <div className="w-blocker-row">
        <input
          id="blocker"
          value={text}
          maxLength={160}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej. No tengo acceso a los logs de pagos de producción"
        />
        <button className="btn primary" type="submit" disabled={!text.trim()}>
          Avisar
        </button>
      </div>
    </form>
  );
}

function OwnerDecisions({ person }: { person: Person }) {
  const briefing = useOrquesta((s) => s.briefing);
  const decisions = useOrquesta((s) => s.decisions);
  const mine = (briefing?.decisiones ?? []).map((d, i) => ({ ...d, i })).filter((d) => d.areas.includes(person.director));
  if (!mine.length) return null;
  return (
    <>
      <div className="section">
        <span>Decisiones de {OWNER.name} que te afectan</span>
      </div>
      {mine.map((d) => (
        <div key={d.i} className={`w-decision ${decisions[d.i] ? "chosen" : ""}`}>
          <b>{d.titulo}</b>
          <span>{decisions[d.i] ? `${OWNER.name} decidió: ${decisions[d.i]}` : `Pendiente de que ${OWNER.name} decida`}</span>
        </div>
      ))}
    </>
  );
}

/* -------------------------------- Pantalla --------------------------------- */

function MainCard({ person }: { person: Person }) {
  const guide = useGuide(person);
  const report = useOrquesta((s) => s.reports[person.director]);
  const director = DIRECTOR_BY_ID[person.director];
  return (
    <section className="w-main pane-scroll" key={person.name}>
      <div className="v-kicker">
        <span className="code">{director.code}</span> {director.name} te guía hoy
      </div>
      <h1 className="v-title w-hello">Buenos días, {person.name}.</h1>
      <p className="v-lede">
        {person.role} · {person.focus}
      </p>

      {!guide ? (
        <div className="w-empty">
          <p>Todavía no hay guía para hoy. Aparece aquí cuando {OWNER.name} inicia la jornada en la consola.</p>
          <Link className="btn primary" href="/">
            Ir a la consola
          </Link>
        </div>
      ) : (
        <>
          <div className="section">
            <span>Tus pasos de hoy</span>
          </div>
          <Steps person={person} />
          <Blocker person={person} />
          {report && (
            <>
              <div className="section">
                <span>Por qué importa hoy</span>
              </div>
              <p className="prose">{report.resumen}</p>
              {report.alertas.length > 0 && (
                <ul className="alerts">
                  {report.alertas.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          <OwnerDecisions person={person} />
        </>
      )}
    </section>
  );
}

function TeamPanel({ person }: { person: Person }) {
  const director = DIRECTOR_BY_ID[person.director];
  const reports = useOrquesta((s) => s.reports);
  const progress = useOrquesta((s) => s.progress);
  return (
    <aside className="pane pane-right">
      <div className="pane-scroll">
        <div className="v-kicker">
          <span className="code">{director.code}</span> Tu directivo
        </div>
        <h2 className="v-title">{director.name}</h2>
        <p className="v-lede">{director.mission}</p>
        <div className="section">
          <span>Tu equipo hoy</span>
        </div>
        <table className="tbl">
          <tbody>
            {director.team.map((w) => {
              const total = reports[director.id]?.guias.find((g) => g.persona === w.name)?.pasos.length ?? 0;
              const done = progress[w.name]?.length ?? 0;
              return (
                <tr key={w.name}>
                  <td className="strong">
                    {w.name}
                    {w.name === person.name ? " (tú)" : ""}
                  </td>
                  <td className="dim">{w.role}</td>
                  <td>
                    <div className="w-minibar">
                      {Array.from({ length: total }, (_, i) => (
                        <i key={i} className={i < done ? "on" : ""} />
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="section">
          <span>Cómo funciona</span>
        </div>
        <p className="small">
          Marca cada paso cuando lo termines y avisa si algo te bloquea. Tu avance se guarda en este navegador y {director.name} lo usa para armar tu guía
          de mañana: lo pendiente se arrastra y los bloqueos se atienden primero.
        </p>
      </div>
    </aside>
  );
}

export default function Worker() {
  const reports = useOrquesta((s) => s.reports);
  const numero = useOrquesta((s) => s.numero);
  const lastRunAt = useOrquesta((s) => s.lastRunAt);
  const [current, setCurrent] = useState(PEOPLE[2].name);

  useEffect(() => {
    hydrateOrquesta();
  }, []);

  // Al llegar, abre a alguien que sí tenga guía.
  const firstWithGuide = useMemo(
    () => PEOPLE.find((p) => reports[p.director]?.guias.some((g) => g.persona === p.name))?.name,
    [reports],
  );
  useEffect(() => {
    if (firstWithGuide && !reports[PEOPLE.find((p) => p.name === current)!.director]) setCurrent(firstWithGuide);
  }, [firstWithGuide, reports, current]);

  const person = PEOPLE.find((p) => p.name === current) ?? PEOPLE[0];

  return (
    <div className="wshell">
      <header className="titlebar">
        <div className="tb-left">
          <div className="mark" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <span className="wordmark">Orquesta</span>
          <span className="tb-sep" />
          <nav className="appnav" aria-label="Pantallas">
            <Link href="/">Consola</Link>
            <Link href="/equipo" className="on">
              Equipo
            </Link>
          </nav>
          <span className="tb-meta">{COMPANY.name}</span>
        </div>
        <div className="tb-right">
          <label className="w-picker">
            <span className="mono-dim">Ver como</span>
            <select value={person.name} onChange={(e) => setCurrent(e.target.value)}>
              {PEOPLE.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} · {DIRECTOR_BY_ID[p.director].code}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <PeopleList current={person.name} onPick={setCurrent} />
      <MainCard person={person} />
      <TeamPanel person={person} />
      <footer className="statusbar">
        <span className="sb-state">
          <i />
          Mi jornada
        </span>
        <span>
          <em>Jornada</em> {lastRunAt ? `#${numero}` : "—"}
        </span>
        <span>
          <em>Actualizada</em>{" "}
          {lastRunAt ? new Date(lastRunAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "—"}
        </span>
        <span className="sb-grow" />
        <span>
          <em>Memoria</em> local en este navegador
        </span>
      </footer>
    </div>
  );
}
