import type { NextConfig } from "next";

// C6: ALLOWED_ORIGINS must be set in production
const rawOrigins = process.env.ALLOWED_ORIGINS;
if (process.env.NODE_ENV === "production" && !rawOrigins) {
  throw new Error(
    "[STARTUP] ALLOWED_ORIGINS environment variable is not set. " +
    "Set it to a comma-separated list of allowed origins (e.g. https://yourdomain.com)."
  );
}

const allowedOrigins = (rawOrigins ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.1.11"],
  async headers() {
    return [
      {
        // M12: CORS — only allow configured origins on API routes
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: allowedOrigins[0], // primary origin; dynamic per-request needs middleware
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
