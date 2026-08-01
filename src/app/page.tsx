import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mailgeko",
};

export default function Home() {
  redirect("/dashboard");
}
