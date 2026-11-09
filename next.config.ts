import type { NextConfig } from "next";
const config: NextConfig = {
  experimental: { useTypeScriptCli: false, cpus: 1, workerThreads: true },
  turbopack:{root:process.cwd()},
  outputFileTracingRoot:process.cwd(),
  output: "standalone",
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: { "/*": ["./worker/**/*", "./data/**/*"] },
  outputFileTracingExcludes:{'/*':['./.venv/**/*','./.desktop-build/**/*','./desktop-dist/**/*','./.git/**/*','./.env*']},
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
