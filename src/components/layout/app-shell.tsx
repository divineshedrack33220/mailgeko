"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { EmailVerificationBanner } from "@/components/layout/email-verification-banner";
import { CommandMenu } from "@/components/layout/command-menu";
import { AiPanel } from "@/components/layout/ai-panel";
import { SupportFab } from "@/components/layout/support-fab";
import { GekoLoader } from "@/components/shared/geko-loader";
import { cn } from "@/lib/utils";

const taglines = [
  "Warming up the inboxes…",
  "Summoning Geko…",
  "Polishing pixels…",
  "Brewing conversion magic…",
  "Sneaking past the spam folder…",
  "Aligning your sign-ups…",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <AppSidebar />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <Topbar />
        <EmailVerificationBanner />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8">
          {children}
        </main>
        <footer className="border-t px-4 py-4 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between text-xs text-muted-foreground">
            <span>
              © {new Date().getFullYear()} Mailgeko — your email, your data, your
              rules.
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="bg-success size-1.5 rounded-full" />
              All systems operational
            </span>
          </div>
        </footer>
      </div>

      <RouteLoader />
      <CommandMenu />
      <AiPanel />
      <SupportFab />
    </div>
  );
}

function RouteLoader() {
  const pathname = usePathname();
  const [phase, setPhase] = React.useState<"hidden" | "shown" | "leaving">("hidden");
  const [tagline, setTagline] = React.useState(taglines[0]);
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setTagline(taglines[Math.floor(Math.random() * taglines.length)]);
    setPhase("shown");
    const leaveTimer = setTimeout(() => setPhase("leaving"), 420);
    const hideTimer = setTimeout(() => setPhase("hidden"), 680);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(hideTimer);
    };
  }, [pathname]);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 z-[100] transition-opacity duration-200 ease-out",
        phase === "leaving" ? "opacity-0" : "opacity-100"
      )}
    >
      <GekoLoader className="h-full w-full" label={tagline} />
    </div>
  );
}
