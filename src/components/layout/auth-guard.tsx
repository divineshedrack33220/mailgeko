"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const boot = useAuthStore((s) => s.boot);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      await boot();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [boot]);

  React.useEffect(() => {
    if (ready && !isAuthenticated) {
      router.replace("/login");
    }
  }, [ready, isAuthenticated, router]);

  if (!ready || !isAuthenticated) {
    return null;
  }
  return <>{children}</>;
}
