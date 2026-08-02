"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, setToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

function OAuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const handledRef = React.useRef(false);

  React.useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const error = params.get("error");
    const token = params.get("token");

    if (error) {
      toast.error("Could not sign in with that provider. Please try again.");
      router.replace("/login");
      return;
    }

    if (!token) {
      toast.error("Sign-in response is invalid. Please try again.");
      router.replace("/login");
      return;
    }

    setToken(token);
    (async () => {
      try {
        const res = await api.get<{ user: import("@/stores/auth-store").AuthUser; workspaceID: string }>(
          "/api/v1/me"
        );
        useAuthStore.setState({ user: res.user, workspaceID: res.workspaceID, isAuthenticated: true });
        router.replace("/dashboard");
      } catch {
        toast.error("Could not complete sign-in. Please try again.");
        router.replace("/login");
      }
    })();
  }, [handledRef, params, router]);

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
