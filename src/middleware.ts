import { NextResponse, type NextRequest } from "next/server";

// Trusted proxy CIDRs whose forwarded-identity headers are honoured. This
// mirrors the backend default (loopback only) so the chain walk below cannot be
// tricked into accepting a spoofed "127.0.0.1" hop as the client. Deployments
// that front Next.js with a real proxy can supply its CIDRs via
// TRUSTED_PROXY_IPS; the secure loopback default always applies when unset.
const DEFAULT_TRUSTED_PROXIES = ["127.0.0.1/32", "::1/128"];

// TRUSTED_PROXY_IPS is not a NEXT_PUBLIC var, so it is never exposed to the
// browser. It is read at call time (not module scope) so bundlers can resolve
// it safely and an absent var degrades to the loopback default.
function trustedProxyCidrs(): string[] {
  const csv = process.env.TRUSTED_PROXY_IPS ?? "";
  const cidrs = csv.split(",").map((s) => s.trim()).filter(Boolean);
  return cidrs.length > 0 ? cidrs : DEFAULT_TRUSTED_PROXIES;
}

// Parses an IPv4/IPv6 address into a byte array (null when invalid). IPv4-mapped
// IPv6 (::ffff:a.b.c.d) normalizes to plain IPv4 so it matches IPv4 CIDRs.
function parseIp(input: string): number[] | null {
  const raw = input.trim().toLowerCase();
  const v4mapped = raw.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4mapped) {
    const octets = v4mapped.slice(1).map(Number);
    return octets.every((o) => o <= 255) ? octets : null;
  }
  const v4 = raw.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const octets = v4.slice(1).map(Number);
    return octets.every((o) => o <= 255) ? octets : null;
  }
  if (!raw.includes(":")) return null;

  const sections = raw.split("::");
  if (sections.length > 2) return null;
  const head = sections[0] === "" ? [] : sections[0].split(":");
  const tail = sections.length === 2 && sections[1] !== "" ? sections[1].split(":") : [];
  if ([...head, ...tail].some((p) => !/^[0-9a-f]{1,4}$/.test(p))) return null;
  const headWords = head.map((p) => parseInt(p, 16));
  const tailWords = tail.map((p) => parseInt(p, 16));

  let words: number[] | null;
  if (sections.length === 2) {
    const missing = 8 - headWords.length - tailWords.length;
    words = missing >= 1 ? [...headWords, ...new Array<number>(missing).fill(0), ...tailWords] : null;
  } else {
    words = headWords.length === 8 ? headWords : null;
  }
  if (!words) return null;

  const bytes: number[] = [];
  for (const w of words) bytes.push((w >> 8) & 0xff, w & 0xff);
  return bytes;
}

// Returns true when ip falls inside the CIDR "addr/prefix".
function cidrContains(cidr: string, ip: string): boolean {
  const [addr, prefixStr] = cidr.split("/");
  const prefix = prefixStr === undefined ? (addr.includes(":") ? 128 : 32) : Number(prefixStr);
  const a = parseIp(addr);
  const b = parseIp(ip);
  if (!a || !b || a.length !== b.length || !Number.isInteger(prefix)) return false;
  const bits = Math.max(0, Math.min(prefix, a.length * 8));
  const full = Math.floor(bits / 8);
  const rem = bits % 8;
  for (let i = 0; i < full; i++) if (a[i] !== b[i]) return false;
  if (rem > 0) {
    const mask = 0xff << (8 - rem);
    if ((a[full] & mask) !== (b[full] & mask)) return false;
  }
  return true;
}

function isTrustedProxy(ip: string, cidrs: string[]): boolean {
  return cidrs.some((c) => cidrContains(c, ip));
}

/**
 * Best-effort real client IP, mirroring the backend's trusted-proxy walk: the
 * X-Forwarded-For chain is inspected from the RIGHT (the hop appended by the
 * nearest proxy is authoritative), skipping hops inside the trusted CIDR set;
 * the first non-trusted hop is the client. Garbage hops are ignored and the
 * result must parse as an IP. x-real-ip is honoured as a fallback only when
 * well-formed.
 */
export function clientIp(
  request: Pick<Request, "headers">,
  cidrs: string[] = trustedProxyCidrs(),
): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    for (let i = hops.length - 1; i >= 0; i--) {
      const candidate = hops[i];
      if (!parseIp(candidate)) continue;
      if (isTrustedProxy(candidate, cidrs)) continue;
      return candidate;
    }
    // Every hop claimed a trusted proxy; best effort on the leftmost valid hop.
    for (const hop of hops) {
      if (parseIp(hop)) return hop;
    }
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real && parseIp(real)) return real;
  return "0.0.0.0";
}

// Middleware runs before the next.config rewrites, so the header set here is
// forwarded to the Go API on /api, /track, /webhooks and /ping. The backend
// only trusts x-mg-client-ip when the request arrives from a trusted proxy
// peer (loopback in the single-container deployment), and the middleware
// overwrites any value a client supplies, so it cannot be spoofed.
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mg-client-ip", clientIp(request));
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/api/:path*", "/track/:path*", "/webhooks/:path*", "/ping"],
};
