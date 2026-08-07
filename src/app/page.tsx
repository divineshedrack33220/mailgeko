import { Archivo, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import type { Metadata } from "next";
import "./landing.css";
import { LandingPage } from "@/components/landing/landing-page";

const space = Space_Grotesk({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--lg-font-display",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--lg-font-body",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--lg-font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mailgeko — Send with precision. Deliver on purpose.",
  description:
    "Self-hostable, AI-powered email marketing. Campaigns, open/click tracking, and analytics — your data stays yours.",
};

export default function Home() {
  return (
    <LandingPage fonts={`${space.variable} ${archivo.variable} ${jetbrains.variable}`} />
  );
}
