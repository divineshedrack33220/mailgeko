"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FitZoom } from "@/components/auth/fit-zoom";
import { useAuthStore } from "@/stores/auth-store";

function InviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = React.useState<"loading" | "needs-auth" | "error" | "success">(
    "loading"
  );
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!token) {
        setState("error");
        setError("This invitation link is missing its token. Ask the sender for a fresh link.");
        return;
      }
      await useAuthStore.getState().boot();
      if (!active) return;
      if (!useAuthStore.getState().isAuthenticated) {
        setState("needs-auth");
        return;
      }
      try {
        await useAuthStore.getState().acceptInvite(token);
        if (active) setState("success");
      } catch (err) {
        if (!active) return;
        setState("error");
        setError(err instanceof Error ? err.message : "Could not accept this invitation");
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const next = `/invite?token=${encodeURIComponent(token)}`;
  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  const registerHref = `/register?next=${encodeURIComponent(next)}`;

  if (state === "loading") {
    return (
      <FitZoom className="flex flex-col items-center gap-4 text-center">
        <span className="bg-muted flex size-14 items-center justify-center rounded-2xl">
          <Loader2 className="size-7 animate-spin" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Checking your invitation</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            One moment while we verify the link…
          </p>
        </div>
      </FitZoom>
    );
  }

  if (state === "needs-auth") {
    return (
      <FitZoom className="flex flex-col items-center gap-4 text-center">
        <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
          <LogIn className="size-7" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">You&apos;ve been invited</h1>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
            Sign in to accept the invitation. If you don&apos;t have an account yet,
            create one with the email address the invite was sent to.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button asChild className="mt-2">
            <Link href={loginHref}>Sign in to accept</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={registerHref}>
              <UserPlus /> Create an account
            </Link>
          </Button>
        </div>
      </FitZoom>
    );
  }

  if (state === "error") {
    return (
      <FitZoom className="flex flex-col items-center gap-4 text-center">
        <span className="bg-destructive/10 text-destructive flex size-14 items-center justify-center rounded-2xl">
          <AlertCircle className="size-7" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Invitation failed</h1>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">{error}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="mt-2">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild className="mt-2">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </FitZoom>
    );
  }

  return (
    <FitZoom className="flex flex-col items-center gap-4 text-center">
      <span className="bg-success/10 text-success flex size-14 items-center justify-center rounded-2xl">
        <CheckCircle2 className="size-7" />
      </span>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">You&apos;re in</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          You joined the workspace and your session is now pointed at it.
        </p>
      </div>
      <Button asChild className="mt-2">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </FitZoom>
  );
}

export default function InvitePage() {
  return (
    <>
      <title>Join your workspace · Mailgeko</title>
      <React.Suspense fallback={null}>
        <InviteForm />
      </React.Suspense>
    </>
  );
}
