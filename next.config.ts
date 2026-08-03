import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["mjml"],
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
    ],
  }),
};

export default nextConfig;
