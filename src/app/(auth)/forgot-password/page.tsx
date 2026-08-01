"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FitZoom } from "@/components/auth/fit-zoom";
import { useShake } from "@/hooks/use-shake";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const shake = useShake();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      shake.trigger();
      toast.error("Enter a valid email to receive the reset link");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSent(true);
      toast.success("Reset link sent — check your inbox");
    }, 900);
  };

  if (sent) {
    return (
      <>
        <title>Check your inbox · Mailgeko</title>
        <FitZoom className="flex flex-col items-center gap-4 text-center">
        <span className="bg-success/10 text-success flex size-14 items-center justify-center rounded-2xl">
          <Mail className="size-7" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            We sent a password reset link to your email. It expires in 30
            minutes.
          </p>
        </div>
        <Button variant="outline" asChild className="mt-2">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </FitZoom>
      </>
    );
  }

  return (
    <>
      <title>Reset your password · Mailgeko</title>
      <FitZoom className="flex flex-col gap-8">
      <div className="text-center">
        <span className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-2xl">
          <KeyRound className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Reset your password
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

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
              required
            />
          </div>
        </div>
        <Button type="submit" size="lg" disabled={loading} className="mt-1 w-full">
          {loading && <Loader2 className="animate-spin" />}
          Send reset link
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        Remembered it?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </FitZoom>
    </>
  );
}
