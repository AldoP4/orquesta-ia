"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, Html, Line, OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { CEO, DIRECTORS, OWNER } from "@/lib/company";
import { useOrquesta, type Pulse } from "@/lib/store";
import type { Director, NodeId, NodeStatus } from "@/lib/types";

const RING = 8.5;
const POS: Record<NodeId, THREE.Vector3> = {
  ceo: new THREE.Vector3(0, 6.5, 0),
  dueno: new THREE.Vector3(0, 11.5, 0),
  ...(Object.fromEntries(
    DIRECTORS.map((d, i) => {
      const a = (i / DIRECTORS.length) * Math.PI * 2 - Math.PI / 2;
      return [d.id, new THREE.Vector3(Math.cos(a) * RING, 1.2, Math.sin(a) * RING)];
    }),
  ) as Record<string, THREE.Vector3>),
} as Record<NodeId, THREE.Vector3>;

const COLOR: Record<NodeId, string> = {
  ceo: CEO.color,
  dueno: OWNER.color,
  ...(Object.fromEntries(DIRECTORS.map((d) => [d.id, d.color])) as Record<string, string>),
} as Record<NodeId, string>;

function curveBetween(from: NodeId, to: NodeId) {
  const a = POS[from];
  const b = POS[to];
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const isRing = from !== "ceo" && from !== "dueno" && to !== "ceo" && to !== "dueno";
  if (isRing) mid.multiplyScalar(0.35).setY(Math.max(a.y, b.y) + 2.5);
  else mid.y += a.distanceTo(b) * 0.18;
  return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
}

/* ---------------------------------- Links --------------------------------- */

function Links() {
  const links = useMemo(() => {
    const list: { key: string; points: THREE.Vector3[]; color: string; opacity: number }[] = [];
    for (const d of DIRECTORS) {
      list.push({ key: `ceo-${d.id}`, points: curveBetween("ceo", d.id).getPoints(40), color: d.color, opacity: 0.35 });
    }
    DIRECTORS.forEach((d, i) => {
      const next = DIRECTORS[(i + 1) % DIRECTORS.length];
      list.push({ key: `${d.id}-${next.id}`, points: curveBetween(d.id, next.id).getPoints(40), color: "#64748b", opacity: 0.18 });
    });
    list.push({ key: "ceo-dueno", points: curveBetween("ceo", "dueno").getPoints(20), color: OWNER.color, opacity: 0.5 });
    return list;
  }, []);
  return (
    <>
      {links.map((l) => (
        <Line key={l.key} points={l.points} color={l.color} lineWidth={1} transparent opacity={l.opacity} dashed={false} />
      ))}
    </>
  );
}

/* --------------------------------- Pulses --------------------------------- */

const PULSE_MS = 1700;
const TAIL = 12;

/** Un "cometa": cabeza brillante + cola de esferas que siguen la misma curva. */
function PulseOrb({ pulse }: { pulse: Pulse }) {
  const parts = useRef<(THREE.Mesh | null)[]>([]);
  const removePulse = useOrquesta((s) => s.removePulse);
  const curve = useMemo(() => curveBetween(pulse.from, pulse.to), [pulse.from, pulse.to]);
  const color = COLOR[pulse.from];
  const start = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const now = clock.elapsedTime * 1000;
    if (start.current === null) start.current = now;
    const t = Math.min(1, (now - start.current) / PULSE_MS);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    parts.current.forEach((m, i) => {
      if (!m) return;
      const ti = eased - i * 0.018;
      m.visible = ti >= 0;
      if (ti >= 0) m.position.copy(curve.getPoint(ti));
    });
    if (t >= 1) removePulse(pulse.id);
  });

  return (
    <>
      {Array.from({ length: TAIL }, (_, i) => (
        <mesh key={i} ref={(m) => void (parts.current[i] = m)} visible={false} scale={1 - i / TAIL}>
          <sphereGeometry args={[i === 0 ? 0.2 : 0.13, 12, 12]} />
          <meshBasicMaterial color={i === 0 ? "#ffffff" : color} toneMapped={false} transparent opacity={1 - i / TAIL} />
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

/* --------------------------------- Labels --------------------------------- */

const Z_RANGE: [number, number] = [10, 0];
// Contenedor fijo para las etiquetas: evita que drei recree su raíz React al conectar eventos.
const labelPortal = { current: null as HTMLElement | null };

const STATUS_TEXT: Record<NodeStatus, string> = {
  idle: "en espera",
  working: "analizando",
  done: "listo",
  error: "error",
};

function Label({ id, name, title, color, status, offset }: { id: NodeId; name: string; title: string; color: string; status: NodeStatus; offset: number }) {
  const select = useOrquesta((s) => s.select);
  const selected = useOrquesta((s) => s.selected === id);
  return (
    <group position-y={offset}>
      <Html center distanceFactor={14} zIndexRange={Z_RANGE} portal={labelPortal as React.RefObject<HTMLElement>}>
        <button
          onClick={() => select(id)}
          className={`node-label ${selected ? "is-selected" : ""}`}
          style={{ ["--c" as string]: color }}
        >
          <span className="node-name">{name}</span>
          <span className="node-title">{title}</span>
          <span className={`node-status s-${status}`}>
            <i />
            {STATUS_TEXT[status]}
          </span>
        </button>
      </Html>
    </group>
  );
}

/* -------------------------------- Directors -------------------------------- */

function Workers({ director, lit }: { director: Director; lit: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.25;
  });
  return (
    <group ref={group} position={[0, -1.6, 0]}>
      {director.team.map((w, i) => {
        const a = (i / director.team.length) * Math.PI * 2;
        const p: [number, number, number] = [Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9];
        return (
          <group key={w.name}>
            <Line points={[[0, 1.6, 0], p]} color={director.color} lineWidth={0.6} transparent opacity={lit ? 0.6 : 0.15} />
            <mesh position={p}>
              <sphereGeometry args={[0.17, 20, 20]} />
              <meshStandardMaterial
                color={director.color}
                emissive={director.color}
                emissiveIntensity={lit ? 2.4 : 0.35}
                toneMapped={false}
              />
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
  const crystal = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.Mesh>(null);
  const pos = POS[director.id];

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const working = status === "working";
    if (crystal.current) {
      crystal.current.rotation.y += dt * (working ? 2.6 : 0.5);
      crystal.current.position.y = Math.sin(t * 1.3 + pos.x) * 0.18;
    }
    if (mat.current) {
      const base = status === "idle" ? 0.7 : status === "done" ? 2.2 : 1.6;
      mat.current.emissiveIntensity = working ? base + Math.sin(t * 8) * 1.1 : base;
    }
    if (halo.current) {
      const s = working ? 1 + ((t * 0.9) % 1) * 0.9 : 1;
      halo.current.scale.setScalar(s);
      (halo.current.material as THREE.MeshBasicMaterial).opacity = working ? 0.7 * (1 - ((t * 0.9) % 1)) : selected ? 0.8 : 0.3;
    }
  });

  return (
    <group position={pos}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          select(director.id);
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <mesh ref={crystal}>
          <octahedronGeometry args={[0.85, 0]} />
          <meshStandardMaterial
            ref={mat}
            color={director.color}
            emissive={director.color}
            emissiveIntensity={0.7}
            metalness={0.3}
            roughness={0.15}
            flatShading
            toneMapped={false}
          />
        </mesh>
      </group>
      <mesh ref={halo} rotation-x={-Math.PI / 2} position={[0, -0.95, 0]}>
        <ringGeometry args={[1.15, 1.25, 64]} />
        <meshBasicMaterial color={selected ? "#ffffff" : director.color} transparent opacity={0.3} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -1.15, 0]}>
        <cylinderGeometry args={[1.35, 1.5, 0.18, 6]} />
        <meshStandardMaterial color="#0b1222" metalness={0.8} roughness={0.35} />
      </mesh>
      <pointLight color={director.color} intensity={status === "idle" ? 4 : 12} distance={6} />
      <Workers director={director} lit={hasReport} />
      <Label id={director.id} name={director.name} title={director.title.replace("Directivo de ", "").replace("Directiva de ", "")} color={director.color} status={status} offset={1.9} />
    </group>
  );
}

/* ------------------------------ Orchestrator ------------------------------ */

function CeoNode() {
  const status = useOrquesta((s) => s.statuses.ceo);
  const select = useOrquesta((s) => s.select);
  const core = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const rings = useRef<THREE.Group>(null);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const speed = status === "working" ? 1.8 : 0.5;
    if (shell.current) {
      shell.current.rotation.y += dt * speed * 0.6;
      shell.current.rotation.x += dt * speed * 0.3;
    }
    if (core.current) core.current.scale.setScalar(1 + Math.sin(t * (status === "working" ? 6 : 2)) * 0.08);
    if (rings.current) {
      rings.current.children.forEach((r, i) => {
        r.rotation.x += dt * speed * (0.4 + i * 0.25);
        r.rotation.y += dt * speed * (0.3 - i * 0.12);
      });
    }
  });

  return (
    <group position={POS.ceo}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          select("ceo");
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <mesh ref={core}>
          <sphereGeometry args={[0.7, 32, 32]} />
          <meshStandardMaterial color="#e0f2fe" emissive="#bae6fd" emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
        <mesh ref={shell}>
          <icosahedronGeometry args={[1.5, 1]} />
          <meshStandardMaterial color="#93c5fd" emissive="#60a5fa" emissiveIntensity={0.9} wireframe toneMapped={false} />
        </mesh>
      </group>
      <group ref={rings}>
        {[2.2, 2.6, 3.0].map((r, i) => (
          <mesh key={r} rotation={[Math.PI / 2 + i * 0.5, i * 0.7, 0]}>
            <torusGeometry args={[r, 0.025, 8, 128]} />
            <meshBasicMaterial color={["#38bdf8", "#a78bfa", "#f472b6"][i]} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <pointLight color="#93c5fd" intensity={30} distance={14} />
      <Label id="ceo" name={CEO.name} title={CEO.title} color="#93c5fd" status={status} offset={3.6} />
    </group>
  );
}

function OwnerNode() {
  const status = useOrquesta((s) => s.statuses.dueno);
  const select = useOrquesta((s) => s.select);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.6;
      ref.current.position.y = Math.sin(clock.elapsedTime) * 0.15;
    }
  });
  return (
    <group position={POS.dueno}>
      <mesh
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          select("dueno");
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <dodecahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial
          color={OWNER.color}
          emissive={OWNER.color}
          emissiveIntensity={status === "done" ? 3 : 1.2}
          metalness={0.6}
          roughness={0.2}
          flatShading
          toneMapped={false}
        />
      </mesh>
      <pointLight color={OWNER.color} intensity={10} distance={6} />
      <Label id="dueno" name={OWNER.name} title={OWNER.title} color={OWNER.color} status={status === "done" ? "done" : "idle"} offset={1.3} />
    </group>
  );
}

/* ---------------------------------- Scene --------------------------------- */

function Controls() {
  const running = useOrquesta((s) => s.running);
  const selected = useOrquesta((s) => s.selected);
  return (
    <OrbitControls
      target={[0, 4.5, 0]}
      enablePan={false}
      minDistance={14}
      maxDistance={40}
      maxPolarAngle={Math.PI * 0.52}
      autoRotate={!selected || running}
      autoRotateSpeed={running ? 0.8 : 0.35}
      enableDamping
    />
  );
}

export default function Scene() {
  const select = useOrquesta((s) => s.select);
  return (
    <Canvas
      camera={{ position: [0, 12, 29], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => select(null)}
      onCreated={({ gl }) => {
        labelPortal.current = gl.domElement.parentElement;
      }}
    >
      <color attach="background" args={["#04060c"]} />
      <fog attach="fog" args={["#04060c", 22, 55]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[10, 20, 10]} intensity={0.4} />

      <Stars radius={90} depth={40} count={3500} factor={3} saturation={0} fade speed={0.6} />
      <Sparkles count={120} scale={[26, 14, 26]} position={[0, 5, 0]} size={2} speed={0.25} color="#7dd3fc" opacity={0.5} />
      <Grid
        position={[0, -1.25, 0]}
        args={[80, 80]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#0f2a44"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#1d4ed8"
        fadeDistance={45}
        fadeStrength={1.4}
        infiniteGrid
      />

      <Links />
      {DIRECTORS.map((d) => (
        <DirectorNode key={d.id} director={d} />
      ))}
      <CeoNode />
      <OwnerNode />
      <Pulses />

      <Controls />
      <EffectComposer>
        <Bloom luminanceThreshold={0.25} luminanceSmoothing={0.2} intensity={1.3} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}
