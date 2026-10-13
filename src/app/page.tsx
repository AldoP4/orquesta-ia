"use client";

import dynamic from "next/dynamic";
import Hud from "@/components/Hud";

const Scene = dynamic(() => import("@/components/Scene"), {
  ssr: false,
  loading: () => (
    <div className="scene-loading">
      <span className="spin" /> Cargando vista 3D
    </div>
  ),
});

export default function Home() {
  return (
    <main className="app">
      <div className="stage">
        <Scene />
      </div>
      <Hud />
    </main>
  );
}
