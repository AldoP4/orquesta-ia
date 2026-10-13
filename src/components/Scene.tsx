"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges, Grid, Html, Line, OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CEO, DIRECTORS, OWNER } from "@/lib/company";
import { useOrquesta, type Pulse } from "@/lib/store";
import type { Director, NodeId, NodeStatus } from "@/lib/types";

/* --------------------------------- Paleta --------------------------------- */

const C = {
  bg: "#0b0b0a",
  body: "#1f1f1d",
  body2: "#2a2a27",
  line: "#3a3935",
  dim: "#5d5c57",
  ink: "#ecebe6",
  accent: "#ff5b1f",
};

/* -------------------------------- Geometría -------------------------------- */

const RING = 8.5;
const POS: Record<NodeId, THREE.Vector3> = {
  ceo: new THREE.Vector3(0, 6.5, 0),
  dueno: new THREE.Vector3(0, 11.2, 0),
  ...(Object.fromEntries(
    DIRECTORS.map((d, i) => {
      const a = (i / DIRECTORS.length) * Math.PI * 2 - Math.PI / 2;
      return [d.id, new THREE.Vector3(Math.cos(a) * RING, 1.2, Math.sin(a) * RING)];
    }),
  ) as Record<string, THREE.Vector3>),
} as Record<NodeId, THREE.Vector3>;

function curveBetween(from: NodeId, to: NodeId) {
  const a = POS[from];
  const b = POS[to];
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const isRing = from !== "ceo" && from !== "dueno" && to !== "ceo" && to !== "dueno";
  if (isRing) mid.multiplyScalar(0.35).setY(Math.max(a.y, b.y) + 2.5);
  else mid.y += a.distanceTo(b) * 0.18;
  return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
}

const circlePoints = (r: number, n = 128, y = 0) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  });

/* ---------------------------------- Piso ---------------------------------- */

/** Piso tipo radar: anillos de medición, marcas de escala y un barrido lento. */
function Floor() {
  const sweep = useRef<THREE.Mesh>(null);
  const running = useOrquesta((s) => s.running);
  const ticks = useMemo(() => {
    const pts: number[] = [];
    const n = 120;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const long = i % 10 === 0;
      const r1 = 13.2;
      const r2 = long ? 13.9 : 13.5;
      pts.push(Math.cos(a) * r1, 0, Math.sin(a) * r1, Math.cos(a) * r2, 0, Math.sin(a) * r2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  useFrame((_, dt) => {
    if (sweep.current) sweep.current.rotation.z -= dt * (running ? 0.9 : 0.25);
  });

  return (
    <group position-y={-1.24}>
      <Grid
        args={[80, 80]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#181816"
        sectionSize={4}
        sectionThickness={0.8}
        sectionColor="#24231f"
        fadeDistance={42}
        fadeStrength={1.6}
        infiniteGrid
      />
      {[3, 6, RING, 11].map((r) => (
        <Line key={r} points={circlePoints(r, 160, 0.01)} color={r === RING ? C.dim : C.line} lineWidth={r === RING ? 1 : 0.6} />
      ))}
      <lineSegments geometry={ticks} position-y={0.01}>
        <lineBasicMaterial color={C.dim} />
      </lineSegments>
      <mesh ref={sweep} rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[0.4, 13.2, 64, 1, 0, 0.55]} />
        <meshBasicMaterial color={C.accent} transparent opacity={running ? 0.045 : 0.018} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* --------------------------------- Enlaces -------------------------------- */

function Links() {
  const links = useMemo(() => {
    const list: { key: string; points: THREE.Vector3[]; dashed: boolean; opacity: number }[] = [];
    for (const d of DIRECTORS) list.push({ key: `ceo-${d.id}`, points: curveBetween("ceo", d.id).getPoints(40), dashed: false, opacity: 0.55 });
    DIRECTORS.forEach((d, i) => {
      const next = DIRECTORS[(i + 1) % DIRECTORS.length];
      list.push({ key: `${d.id}-${next.id}`, points: curveBetween(d.id, next.id).getPoints(40), dashed: true, opacity: 0.35 });
    });
    list.push({ key: "ceo-dueno", points: curveBetween("ceo", "dueno").getPoints(20), dashed: false, opacity: 0.8 });
    return list;
  }, []);
  return (
    <>
      {links.map((l) => (
        <Line key={l.key} points={l.points} color={C.line} lineWidth={1} transparent opacity={l.opacity} dashed={l.dashed} dashSize={0.25} gapSize={0.2} />
      ))}
    </>
  );
}

/* --------------------------------- Pulsos --------------------------------- */

const PULSE_MS = 1700;
const TAIL = 12;

/** Cometa: cabeza blanca y estela naranja que siguen la misma curva. */
function PulseOrb({ pulse }: { pulse: Pulse }) {
  const parts = useRef<(THREE.Mesh | null)[]>([]);
  const removePulse = useOrquesta((s) => s.removePulse);
  const curve = useMemo(() => curveBetween(pulse.from, pulse.to), [pulse.from, pulse.to]);
  const start = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const now = clock.elapsedTime * 1000;
    if (start.current === null) start.current = now;
    const t = Math.min(1, (now - start.current) / PULSE_MS);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    parts.current.forEach((m, i) => {
      if (!m) return;
      const ti = eased - i * 0.016;
      m.visible = ti >= 0;
      if (ti >= 0) m.position.copy(curve.getPoint(ti));
    });
    if (t >= 1) removePulse(pulse.id);
  });

  return (
    <>
      {Array.from({ length: TAIL }, (_, i) => (
        <mesh key={i} ref={(m) => void (parts.current[i] = m)} visible={false} scale={1 - i / TAIL}>
          <boxGeometry args={i === 0 ? [0.2, 0.2, 0.2] : [0.11, 0.11, 0.11]} />
          <meshBasicMaterial color={i === 0 ? "#ffffff" : C.accent} toneMapped={false} transparent opacity={1 - i / TAIL} />
        </mesh>
      ))}
    </>
  );
}

function Pulses() {
  const pulses = useOrquesta((s) => s.pulses);
  return (
    <>
      {pulses.map((p) => (
        <PulseOrb key={p.id} pulse={p} />
      ))}
    </>
  );
}

/* -------------------------------- Etiquetas -------------------------------- */

const Z_RANGE: [number, number] = [10, 0];
// Contenedor fijo para las etiquetas: evita que drei recree su raíz React al conectar eventos.
const labelPortal = { current: null as HTMLElement | null };

const STATUS_TEXT: Record<NodeStatus, string> = { idle: "en espera", working: "activo", done: "listo", error: "error" };

function Label({ id, code, name, status, offset }: { id: NodeId; code: string; name: string; status: NodeStatus; offset: number }) {
  const select = useOrquesta((s) => s.select);
  const selected = useOrquesta((s) => s.selected === id);
  return (
    <group position-y={offset}>
      <Html center distanceFactor={19} zIndexRange={Z_RANGE} portal={labelPortal as React.RefObject<HTMLElement>}>
        <button onClick={() => select(id)} className={`unit-tag ${status} ${selected ? "sel" : ""}`}>
          <span className="ut-code">{code}</span>
          <span className="ut-body">
            <span className="ut-name">{name}</span>
            <span className="ut-status">{STATUS_TEXT[status]}</span>
          </span>
        </button>
      </Html>
    </group>
  );
}

const hover = {
  onPointerOver: () => (document.body.style.cursor = "pointer"),
  onPointerOut: () => (document.body.style.cursor = ""),
};

/* -------------------------------- Unidades -------------------------------- */

function Workers({ director, lit }: { director: Director; lit: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.2;
  });
  return (
    <group ref={group} position={[0, -1.05, 0]}>
      {director.team.map((w, i) => {
        const a = (i / director.team.length) * Math.PI * 2;
        const p: [number, number, number] = [Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9];
        return (
          <group key={w.name}>
            <Line points={[[0, 0, 0], p]} color={lit ? C.dim : C.line} lineWidth={0.6} transparent opacity={lit ? 0.9 : 0.5} />
            <mesh position={p}>
              <boxGeometry args={[0.17, 0.17, 0.17]} />
              <meshStandardMaterial color={lit ? C.ink : C.body2} emissive={lit ? C.ink : "#000"} emissiveIntensity={lit ? 0.6 : 0} roughness={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function DirectorNode({ director }: { director: Director }) {
  const status = useOrquesta((s) => s.statuses[director.id]);
  const hasReport = useOrquesta((s) => Boolean(s.reports[director.id]));
  const selected = useOrquesta((s) => s.selected === director.id);
  const select = useOrquesta((s) => s.select);
  const body = useRef<THREE.Group>(null);
  const core = useRef<THREE.MeshStandardMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const pos = POS[director.id];
  const working = status === "working";

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (body.current) {
      body.current.rotation.y += dt * (working ? 1.6 : 0.25);
      body.current.position.y = Math.sin(t * 1.1 + pos.x) * 0.08;
    }
    if (core.current) core.current.emissiveIntensity = working ? 2.2 + Math.sin(t * 9) * 1.2 : status === "done" ? 0.9 : 0.15;
    if (ring.current) {
      const s = working ? 1 + ((t * 0.8) % 1) * 0.7 : 1;
      ring.current.scale.setScalar(s);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = working ? 0.8 * (1 - ((t * 0.8) % 1)) : selected ? 0.9 : 0.35;
    }
  });

  const edge = working ? C.accent : selected || status === "done" ? C.ink : C.dim;
  const coreColor = working ? C.accent : C.ink;

  return (
    <group position={pos}>
      <group
        ref={body}
        onClick={(e) => {
          e.stopPropagation();
          select(director.id);
        }}
        {...hover}
      >
        <mesh>
          <boxGeometry args={[1.05, 1.05, 1.05]} />
          <meshStandardMaterial color={C.body} metalness={0.4} roughness={0.55} transparent opacity={0.92} />
          <Edges color={edge} threshold={15} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.36, 0.36, 0.36]} />
          <meshStandardMaterial ref={core} color={coreColor} emissive={coreColor} emissiveIntensity={0.15} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, -1.02, 0]}>
        <ringGeometry args={[1.12, 1.17, 6]} />
        <meshBasicMaterial color={working ? C.accent : selected ? C.ink : C.dim} transparent opacity={0.35} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -1.15, 0]}>
        <cylinderGeometry args={[1.4, 1.4, 0.06, 6]} />
        <meshStandardMaterial color="#141413" metalness={0.6} roughness={0.5} />
      </mesh>
      <Workers director={director} lit={hasReport} />
      <Label id={director.id} code={director.code} name={director.name} status={status} offset={1.55} />
    </group>
  );
}

function CeoNode() {
  const status = useOrquesta((s) => s.statuses.ceo);
  const select = useOrquesta((s) => s.select);
  const shell = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const rings = useRef<THREE.Group>(null);
  const working = status === "working";

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const speed = working ? 1.6 : 0.35;
    if (shell.current) {
      shell.current.rotation.y += dt * speed * 0.5;
      shell.current.rotation.x += dt * speed * 0.2;
    }
    if (core.current) core.current.scale.setScalar(1 + Math.sin(t * (working ? 6 : 1.5)) * 0.05);
    rings.current?.children.forEach((r, i) => {
      r.rotation.z += dt * speed * (i % 2 ? -0.6 : 0.45);
    });
  });

  return (
    <group position={POS.ceo}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          select("ceo");
        }}
        {...hover}
      >
        <mesh ref={core}>
          <icosahedronGeometry args={[0.62, 0]} />
          <meshStandardMaterial color={C.ink} emissive={C.ink} emissiveIntensity={working ? 1.4 : 0.7} flatShading toneMapped={false} />
        </mesh>
        <mesh ref={shell}>
          <icosahedronGeometry args={[1.45, 1]} />
          <meshBasicMaterial color={C.ink} wireframe transparent opacity={0.22} />
        </mesh>
      </group>
      <group ref={rings}>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[2.2, 0.012, 6, 160]} />
          <meshBasicMaterial color={C.dim} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.55, 0.03, 6, 120, Math.PI * 0.42]} />
          <meshBasicMaterial color={C.accent} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2.4, 0.3, 0]}>
          <torusGeometry args={[2.9, 0.01, 6, 160]} />
          <meshBasicMaterial color={C.line} />
        </mesh>
      </group>
      <Label id="ceo" code="ORQ" name={CEO.name} status={status} offset={3.3} />
    </group>
  );
}

function OwnerNode() {
  const status = useOrquesta((s) => s.statuses.dueno);
  const select = useOrquesta((s) => s.select);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.5;
      ref.current.position.y = Math.sin(clock.elapsedTime) * 0.1;
    }
  });
  return (
    <group position={POS.dueno}>
      <group
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          select("dueno");
        }}
        {...hover}
      >
        <mesh rotation={[Math.PI / 4, 0, Math.PI / 4]}>
          <boxGeometry args={[0.62, 0.62, 0.62]} />
          <meshStandardMaterial color={OWNER.color} emissive={OWNER.color} emissiveIntensity={status === "done" ? 1.8 : 0.7} roughness={0.4} toneMapped={false} />
        </mesh>
      </group>
      <Label id="dueno" code="OWN" name={OWNER.name} status={status === "done" ? "done" : "idle"} offset={1.15} />
    </group>
  );
}

/* ------------------------------ Membrana Airlock --------------------------- */

const MEMBRANE_Y = 3.9;
const MEMBRANE_R = 4.4;

/** Escudo hexagonal por donde pasa todo lo que los agentes hacen hacia el mundo. */
function AirlockMembrane() {
  const flash = useOrquesta((s) => s.flash);
  const select = useOrquesta((s) => s.select);
  const group = useRef<THREE.Group>(null);
  const band = useRef<THREE.MeshBasicMaterial>(null);
  const cage = useRef<THREE.MeshBasicMaterial>(null);
  const flashAt = useRef(-10);
  const lastId = useRef<number | null>(null);
  const base = useMemo(() => new THREE.Color(C.dim), []);
  const hot = useMemo(() => new THREE.Color(C.accent), []);
  const ok = useMemo(() => new THREE.Color(C.ink), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (flash && flash.id !== lastId.current) {
      lastId.current = flash.id;
      flashAt.current = t;
    }
    const k = Math.max(0, 1 - (t - flashAt.current) / 1.1);
    const target = flash && ["aprobacion", "bloqueado", "cuarentena"].includes(flash.verdict) ? hot : ok;
    color.copy(base).lerp(target, k);
    if (group.current) group.current.rotation.y += dt * 0.08;
    if (band.current) {
      band.current.color.copy(color);
      band.current.opacity = 0.03 + k * 0.16;
    }
    if (cage.current) {
      cage.current.color.copy(color);
      cage.current.opacity = 0.35 + k * 0.6;
    }
  });

  return (
    <group position-y={MEMBRANE_Y}>
      <group ref={group}>
        <mesh>
          <cylinderGeometry args={[MEMBRANE_R, MEMBRANE_R, 0.7, 6, 1, true]} />
          <meshBasicMaterial ref={band} transparent opacity={0.04} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[MEMBRANE_R + 0.01, MEMBRANE_R + 0.01, 0.7, 6, 2, true]} />
          <meshBasicMaterial ref={cage} wireframe transparent opacity={0.4} toneMapped={false} />
        </mesh>
      </group>
      <group position={[MEMBRANE_R + 0.3, 0.75, 0]}>
        <Html center distanceFactor={19} zIndexRange={Z_RANGE} portal={labelPortal as React.RefObject<HTMLElement>}>
          <button className="airlock-tag" onClick={() => select("airlock")}>
            AIRLOCK
          </button>
        </Html>
      </group>
    </group>
  );
}

/* --------------------------------- Escena --------------------------------- */

/** En pantallas angostas aleja la cámara para que quepa toda la torre. */
function CameraFit() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    const distance = aspect < 0.8 ? 40 : aspect < 1.1 ? 33 : 29;
    camera.position.setLength(distance);
  }, [camera, size.width, size.height]);
  return null;
}

function Controls() {
  const running = useOrquesta((s) => s.running);
  const selected = useOrquesta((s) => s.selected);
  return (
    <OrbitControls
      target={[0, 4.2, 0]}
      enablePan={false}
      minDistance={14}
      maxDistance={46}
      maxPolarAngle={Math.PI * 0.52}
      autoRotate={!selected || running}
      autoRotateSpeed={running ? 0.6 : 0.25}
      enableDamping
    />
  );
}

export default function Scene() {
  const select = useOrquesta((s) => s.select);
  // Al salir de la consola (p. ej. a /equipo) el canvas se destruye: si el portal
  // siguiera apuntando a su contenedor viejo, al volver drei recrearía cada etiqueta a mitad del render.
  useEffect(
    () => () => {
      labelPortal.current = null;
    },
    [],
  );
  return (
    <Canvas
      camera={{ position: [0, 11, 27], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => select(null)}
      onCreated={({ gl }) => {
        labelPortal.current = gl.domElement.parentElement;
      }}
    >
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 24, 52]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[-8, 16, 10]} intensity={1.1} color="#fffaf2" />
      <directionalLight position={[10, 4, -12]} intensity={0.35} color="#ffd9c4" />

      <Floor />
      <Links />
      {DIRECTORS.map((d) => (
        <DirectorNode key={d.id} director={d} />
      ))}
      <CeoNode />
      <OwnerNode />
      <AirlockMembrane />
      <Pulses />

      <CameraFit />
      <Controls />
      <EffectComposer>
        <Bloom luminanceThreshold={0.62} luminanceSmoothing={0.15} intensity={0.55} mipmapBlur />
        <Vignette eskil={false} offset={0.25} darkness={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
