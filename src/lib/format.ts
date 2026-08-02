import { format, formatDistanceToNowStrict } from "date-fns";

export function formatNumber(value: number, compact = false): string {
  if (compact) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return format(d, "MMM d, yyyy");
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return format(d, "MMM d, yyyy h:mm a");
}

export function timeAgo(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function initials(first?: string, last?: string, fallback = "?"): string {
  if (!first && !last) return fallback;
  return `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}`;
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function greetingForTime(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good night";
}
