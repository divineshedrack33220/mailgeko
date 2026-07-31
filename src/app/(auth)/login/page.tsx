"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth-store";
import { FitZoom } from "@/components/auth/fit-zoom";
import { useShake } from "@/hooks/use-shake";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [step, setStep] = React.useState<"credentials" | "2fa">("credentials");
  const [twoFa, setTwoFa] = React.useState(["", "", "", "", "", ""]);
  const twoFaRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const shake = useShake();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      shake.trigger();
      toast.error("Check your email and password and try again");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("2fa");
      toast.success("Enter your two-factor code");
    }, 900);
  };

  const handleTwoFa = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (twoFa.some((digit) => !digit)) {
      shake.trigger();
      toast.error("Enter all 6 digits");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      login("grace@mailgeko.dev");
      router.push("/dashboard");
    }, 800);
  };

  return (
    <FitZoom className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {step === "credentials" ? "Welcome back" : "Two-factor authentication"}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {step === "credentials"
            ? "Sign in to your Mailgeko workspace."
            : "Enter the 6-digit code from your authenticator app."}
        </p>
      </div>

      {step === "credentials" ? (
        <>
          <form onSubmit={handleSubmit} noValidate className={cn("flex flex-col gap-4", shake.className)} onAnimationEnd={shake.onAnimationEnd}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Work email</Label>
              <div className="relative">
                <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  className="pl-9"
                  defaultValue="grace@mailgeko.dev"
                  autoComplete="email"
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-primary hover:underline text-xs font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pr-9 pl-9"
                  defaultValue="password123"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox defaultChecked />
                Remember me
              </label>
              <span className="text-muted-foreground text-xs">2FA enabled</span>
            </div>
            <Button type="submit" size="lg" disabled={loading} className="mt-1 w-full">
              {loading && <Loader2 className="animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background text-muted-foreground px-2 text-xs">
                or continue with
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" type="button" onClick={() => toast.success("Google sign in is coming soon")}>
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49.99.1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.21.7.82.58A12 12 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Google
            </Button>
            <Button variant="outline" type="button" onClick={() => toast.success("GitHub sign in is coming soon")}>
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.18-.02-2.14-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.07 11.07 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.66.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
              </svg>
              GitHub
            </Button>
          </div>

          <p className="text-muted-foreground text-center text-sm">
            New to Mailgeko?{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </>
      ) : (
        <form onSubmit={handleTwoFa} noValidate className={cn("flex flex-col gap-6", shake.className)} onAnimationEnd={shake.onAnimationEnd}>
          <div className="flex justify-center">
            <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
              <ShieldCheck className="size-7" />
            </span>
          </div>
          <div className="flex gap-2">
            {twoFa.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => {
                  twoFaRefs.current[index] = el;
                }}
                value={digit}
                inputMode="numeric"
                maxLength={1}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  const next = [...twoFa];
                  next[index] = value;
                  setTwoFa(next);
                  if (value && index < 5) twoFaRefs.current[index + 1]?.focus();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !twoFa[index] && index > 0) {
                    twoFaRefs.current[index - 1]?.focus();
                  }
                }}
                aria-label={`Digit ${index + 1}`}
                className="h-12 p-0 text-center text-lg font-semibold tabular-nums"
              />
            ))}
          </div>
          <Button type="submit" size="lg" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Verify & continue
          </Button>
          <button
            type="button"
            onClick={() => setStep("credentials")}
            className="text-muted-foreground hover:text-foreground cursor-pointer text-sm"
          >
            ← Back to sign in
          </button>
        </form>
      )}
    </FitZoom>
  );
}
