"use client";

import * as React from "react";
import { Loader2, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export function EmailVerificationBanner() {
  const user = useAuthStore((s) => s.user);
  const [dismissed, setDismissed] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  if (!user || user.emailVerified || dismissed) return null;

  const resend = async () => {
    setSending(true);
    try {
      await api.post("/api/v1/auth/resend-verification");
      toast.success("Verification email sent — check your inbox");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send the verification email"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-warning/10 text-warning-foreground flex items-center gap-3 border-b px-4 py-2.5 text-sm lg:px-8">
      <ShieldAlert className="text-warning size-4 shrink-0" />
      <p className="min-w-0 flex-1 truncate">
        Your email isn&apos;t verified yet. Check your inbox for the link we
        sent, or request a new one.
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={resend}
        disabled={sending}
        className="shrink-0"
      >
        {sending && <Loader2 className="animate-spin" />}
        Resend verification
      </Button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
