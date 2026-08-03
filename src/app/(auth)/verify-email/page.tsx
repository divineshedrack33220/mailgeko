"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FitZoom } from "@/components/auth/fit-zoom";
import { api } from "@/lib/api";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = React.useState<"loading" | "success" | "error">(
    "loading"
  );

  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!token) {
        setState("error");
        return;
      }
      try {
        await api.post("/api/v1/auth/verify-email", { token });
        if (active) setState("success");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  if (state === "loading") {
    return (
      <FitZoom className="flex flex-col items-center gap-4 text-center">
        <span className="bg-muted flex size-14 items-center justify-center rounded-2xl">
          <Loader2 className="size-7 animate-spin" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Verifying your email
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            One moment while we confirm your address…
          </p>
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
          <h1 className="text-xl font-semibold tracking-tight">
            Verification link invalid
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            This link is missing, expired, or already used. Sign in to request a
            new verification email.
          </p>
        </div>
        <Button asChild className="mt-2">
          <Link href="/login">Sign in</Link>
        </Button>
      </FitZoom>
    );
  }

  return (
    <FitZoom className="flex flex-col items-center gap-4 text-center">
      <span className="bg-success/10 text-success flex size-14 items-center justify-center rounded-2xl">
        <CheckCircle2 className="size-7" />
      </span>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Email verified
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Your email address is confirmed. You can now sign in.
        </p>
      </div>
      <Button asChild className="mt-2">
        <Link href="/login">Continue to sign in</Link>
      </Button>
    </FitZoom>
  );
}

export default function VerifyEmailPage() {
  return (
    <>
      <title>Verify your email · Mailgeko</title>
      <React.Suspense fallback={null}>
        <VerifyEmailForm />
      </React.Suspense>
    </>
  );
}
