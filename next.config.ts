import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["mjml"],
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
  },
  headers: async () => {
    const headers: { key: string; value: string }[] = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV === "production") {
      headers.push(
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https:",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data: https://fonts.gstatic.com",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
          ].join("; "),
        },
      );
    }
    return [{ source: "/:path*", headers }];
  },
  rewrites: async () => ({
    afterFiles: [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8080/api/:path*",
      },
      {
        source: "/webhooks/:path*",
        destination: "http://127.0.0.1:8080/webhooks/:path*",
      },
      {
        source: "/track/:path*",
        destination: "http://127.0.0.1:8080/track/:path*",
      },
      {
        source: "/ping",
        destination: "http://127.0.0.1:8080/ping",
      },
      {
        source: "/readyz",
        destination: "http://127.0.0.1:8080/readyz",
      },
    ],
  }),
};

export default nextConfig;
