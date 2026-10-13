import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = Archivo({ variable: "--font-sans", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

const description =
  "Directivos de IA que guían a tu equipo, se coordinan entre ellos y le suben al dueño solo las decisiones que importan. Con Airlock, una capa de seguridad de 5 capas.";

export const metadata: Metadata = {
  metadataBase: new URL("https://orquesta-aldo.vercel.app"),
  title: "Orquesta · Consola de mando",
  description,
  openGraph: {
    title: "Orquesta · Directivos de IA",
    description,
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Consola de mando de Orquesta con la torre 3D" }],
    locale: "es_MX",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Orquesta · Directivos de IA", description, images: ["/og.jpg"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
