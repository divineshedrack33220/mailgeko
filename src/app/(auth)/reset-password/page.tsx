"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FitZoom } from "@/components/auth/fit-zoom";
import { useShake } from "@/hooks/use-shake";
import { cn } from "@/lib/utils";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const shake = useShake();

  const strength = React.useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 8 || strength < 2) {
      shake.trigger();
      toast.error("Use at least 8 characters with a capital letter and a number");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      toast.success("Password updated — sign in with your new password");
      router.push("/login");
    }, 900);
  };

  return (
    <>
      <title>Reset password · Mailgeko</title>
      <FitZoom className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Make sure it&apos;s different from your previous passwords.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className={cn("flex flex-col gap-4", shake.className)} onAnimationEnd={shake.onAnimationEnd}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="8+ characters"
              className="pr-9 pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          </div>
        </div>
        <Button type="submit" size="lg" disabled={loading || strength < 2} className="mt-1 w-full">
          {loading && <Loader2 className="animate-spin" />}
          Update password
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </FitZoom>
    </>
  );
}
