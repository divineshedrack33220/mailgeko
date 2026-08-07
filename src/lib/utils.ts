import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// safeNextPath validates a post-login redirect target. Only same-origin,
// relative paths are allowed so an attacker-supplied "next" can never turn
// into an open redirect.
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  if (/^\/[^/]*:/.test(next)) return null;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const url = new URL(next, base);
    if (url.origin !== base) return null;
  } catch {
    return null;
  }
  return next;
}
