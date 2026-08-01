import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  rewrites: async () => [
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
  ],
};

export default nextConfig;
