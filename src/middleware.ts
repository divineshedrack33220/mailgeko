import { NextResponse, type NextRequest } from "next/server";

// Resolves the best-effort real client IP from the rightmost X-Forwarded-For
// hop (the one appended by the nearest trusted proxy / CDN — a client cannot
// forge it, since proxies append rather than overwrite), falling back to
// x-real-ip.
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last;
  }
  return request.headers.get("x-real-ip") ?? "0.0.0.0";
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
