import type { Metadata } from "next";
import { inter, outfit } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "M7Arena — Plataforma de Campeonatos e Torneios de League of Legends",
  description:
    "Dispute torneios de League of Legends, suba no ranking, forme seu time e ganhe recompensas na maior plataforma e-sports do Brasil.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${outfit.variable}`}>
      <body className="bg-background text-on-background font-body antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
