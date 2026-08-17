"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FitZoom } from "@/components/auth/fit-zoom";
import { useShake } from "@/hooks/use-shake";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = React.useState<
    "loading" | "success" | "error" | "set-password"
  >("loading");

  // --- password form state ---
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const shake = useShake();

  const strength = React.useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]);

  // Step 1: validate the token and check if the user needs a password.
  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!token) {
        setState("error");
        return;
      }
      try {
        const res = await api.post<{ ok: boolean; requiresPassword?: boolean }>(
          "/api/v1/auth/verify-email",
          { token }
        );
        if (!active) return;
        setState(res.requiresPassword ? "set-password" : "success");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  // Step 2 (set-password): submit the chosen password.
  const handleSetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 8 || strength < 2) {
      shake.trigger();
      toast.error("Use at least 8 characters with a capital letter and a number");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<{
        token: string;
        user: { id: string; name: string; email: string; role: string };
        workspaceID: string;
      }>("/api/v1/auth/set-password", { token, password });

      // The session cookie is set by the backend — just hydrate client state.
      useAuthStore.setState({
        user: res.user,
        workspaceID: res.workspaceID,
        role: res.user.role,
        isAuthenticated: true,
      });
      toast.success("Password set — welcome to Mailgeko!");
      router.push("/dashboard");
    } catch (err) {
      shake.trigger();
      toast.error(
        err instanceof Error ? err.message : "Could not set your password"
      );
    } finally {
      setSaving(false);
    }
  };

  // --- loading ---
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

  // --- error ---
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

  // --- set password ---
  if (state === "set-password") {
    return (
      <>
        <title>Set your password · Mailgeko</title>
        <FitZoom className="flex flex-col gap-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Set your password
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Choose a password to secure your account.
            </p>
          </div>

          <form
            onSubmit={handleSetPassword}
            noValidate
            className={cn(
              "flex flex-col gap-4",
              shake.className
            )}
            onAnimationEnd={shake.onAnimationEnd}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <KeyRound className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="8+ characters"
                  className="pr-9 pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              <div className="mt-1 flex items-center gap-2">
                {[0, 1, 2, 3].map((bar) => (
                  <span
                    key={bar}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      bar < strength
                        ? strength <= 1
                          ? "bg-destructive"
                          : strength === 2
                            ? "bg-warning"
                            : "bg-success"
                        : "bg-muted"
                    }`}
                  />
                ))}
                <span className="text-muted-foreground w-20 text-right text-xs">
                  {strength === 0
                    ? "Too weak"
                    : strength <= 2
                      ? "Getting there"
                      : "Strong"}
                </span>
              </div>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={saving || strength < 2}
              className="mt-1 w-full"
            >
              {saving && <Loader2 className="animate-spin" />}
              Set password and continue
            </Button>
          </form>
        </FitZoom>
      </>
    );
  }

  // --- success (user already had a password) ---
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
