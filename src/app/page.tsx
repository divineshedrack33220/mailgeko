import { Archivo, Bebas_Neue, JetBrains_Mono, Oswald } from "next/font/google";
import type { Metadata } from "next";
import "./landing.css";
import { LandingPage } from "@/components/landing/landing-page";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--lg-font-display",
  display: "swap",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--lg-font-heading",
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
    "The privacy-first, AI-powered email marketing platform. Campaigns, automations, and analytics — without selling your data.",
};

export default function Home() {
  return (
    <LandingPage fonts={`${bebas.variable} ${oswald.variable} ${archivo.variable} ${jetbrains.variable}`} />
  );
}
