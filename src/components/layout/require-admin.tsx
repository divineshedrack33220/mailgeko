"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";
import { isAdminRole } from "@/lib/permissions";

/**
 * Redirects non-admin (viewer/manager) users away from owner/admin-only
 * pages. The server independently enforces these routes.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);

  useEffect(() => {
    if (role && !isAdminRole(role)) {
      router.replace("/settings");
    }
  }, [role, router]);

  if (role && !isAdminRole(role)) {
    return null;
  }

  return <>{children}</>;
}
