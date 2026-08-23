"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth-store";
import { FitZoom } from "@/components/auth/fit-zoom";
import { useShake } from "@/hooks/use-shake";
import { cn, safeNextPath } from "@/lib/utils";
import { oauthUrl } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [loading, setLoading] = React.useState(false);
  const [registered, setRegistered] = React.useState(false);
  const shake = useShake();

  const destination = () => {
    const next =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next")
        : null;
    return safeNextPath(next) ?? "/dashboard";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "");
    const firstName = String(data.get("first-name") ?? "");
    const lastName = String(data.get("last-name") ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      shake.trigger();
      toast.error("Enter a valid work email");
      return;
    }
    setLoading(true);
    try {
      const hasPassword = await register(`${firstName} ${lastName}`.trim(), email);
      if (hasPassword) {
        toast.success("Account created — check your inbox to verify your email");
        router.push(destination());
      } else {
        setRegistered(true);
      }
    } catch (err) {
      shake.trigger();
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <>
        <title>Check your inbox · Mailgeko</title>
        <FitZoom className="flex flex-col items-center gap-4 text-center">
          <span className="bg-success/10 text-success flex size-14 items-center justify-center rounded-2xl">
            <CheckCircle2 className="size-7" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Check your inbox
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              We sent you a link to verify your email and set up your password.
              Click it to get started.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-2">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </FitZoom>
      </>
    );
  }

  return (
    <>
      <title>Create your account · Mailgeko</title>
      <FitZoom className="flex flex-col gap-8">
      <div className="pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Start sending smarter emails in under a minute.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className={cn("flex flex-col gap-4", shake.className)} onAnimationEnd={shake.onAnimationEnd}>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="first-name">First name</Label>
            <div className="relative">
              <User className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input id="first-name" name="first-name" placeholder="Grace" className="pl-9" required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="last-name">Last name</Label>
            <Input id="last-name" name="last-name" placeholder="Lee" required />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Work email</Label>
          <div className="relative">
            <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              className="pl-9"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
          {loading && <Loader2 className="animate-spin" />}
          Create account
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          We&apos;ll email you a link to verify your email and set your password.
        </p>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background text-muted-foreground px-2 text-xs">or</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" type="button" onClick={() => window.location.assign(oauthUrl("google"))}>
          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49.99.1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.21.7.82.58A12 12 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          Google
        </Button>
        <Button variant="outline" type="button" onClick={() => toast.info("GitHub sign-in is coming soon.")}>
          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.18-.02-2.14-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.07 11.07 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.66.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
          </svg>
          GitHub
        </Button>
      </div>

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </FitZoom>
    </>
  );
}
