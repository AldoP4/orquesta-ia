"use client";

import dynamic from "next/dynamic";
import Hud from "@/components/Hud";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

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
