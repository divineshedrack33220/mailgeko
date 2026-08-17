"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

function OAuthCallbackContent() {
  const router = useRouter();
  const handledRef = React.useRef(false);

  React.useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");

    if (error) {
      toast.error("Could not sign in with that provider. Please try again.");
      router.replace("/login");
      return;
    }

    // The session cookie was set by the backend before the redirect. Just
    // fetch the current user to hydrate the client state.
    (async () => {
      try {
        const res = await api.get<{
          user: import("@/stores/auth-store").AuthUser;
          workspaceID: string;
          role?: string;
        }>("/api/v1/me");
        useAuthStore.setState({
          user: res.user,
          workspaceID: res.workspaceID,
          role: res.role ?? null,
          isAuthenticated: true,
        });
        router.replace("/dashboard");
      } catch {
        toast.error("Could not complete sign-in. Please try again.");
        router.replace("/login");
      }
    })();
  }, [handledRef, router]);

  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center gap-3">
      <Loader2 className="text-primary size-6 animate-spin" />
      <p className="text-muted-foreground text-sm">Completing sign-in…</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex min-h-dvh flex-col items-center justify-center gap-3">
          <Loader2 className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">Completing sign-in…</p>
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
