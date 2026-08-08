"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";
import { canManage } from "@/lib/permissions";

/**
 * Redirects read-only viewers away from pages that create or edit content.
 * The server independently enforces these routes.
 */
export function RequireManage({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);

  useEffect(() => {
    if (role && !canManage(role)) {
      router.replace("/dashboard");
    }
  }, [role, router]);

  if (role && !canManage(role)) {
    return null;
  }

  return <>{children}</>;
}
