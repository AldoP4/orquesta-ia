import type { Metadata } from "next";
import Worker from "@/components/Worker";

export const metadata: Metadata = {
  title: "Mi jornada · Orquesta",
  description: "Lo que ve cada persona del equipo: sus pasos de hoy, por qué importan y cómo avisar si algo la bloquea.",
};

export default function EquipoPage() {
  return <Worker />;
}
