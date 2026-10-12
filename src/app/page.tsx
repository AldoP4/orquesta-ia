"use client";

import dynamic from "next/dynamic";
import Hud from "@/components/Hud";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

export default function Home() {
  return (
    <main className="stage">
      <Scene />
      <Hud />
    </main>
  );
}
