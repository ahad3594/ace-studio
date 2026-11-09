import { cp, access } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import nextEnv from "@next/env";
// Load the project-root .env.local before the standalone server changes cwd.
nextEnv.loadEnvConfig(process.cwd(), false);
const server = resolve(".next/standalone/server.js");
try {
  await access(server);
} catch {
  console.error("Production build missing. Run npm run build first.");
  process.exit(1);
}
await cp("public", ".next/standalone/public", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
process.env.HOSTNAME =
  process.env.ACE_HOST || process.env.PIXELFORGE_HOST || "127.0.0.1";
process.env.ACE_PYTHON ||= resolve(".venv/bin/python");
process.env.ACE_WORKER ||= resolve("worker/documents.py");
process.env.ACE_TESSDATA ||= resolve("data/tessdata");
const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: process.env,
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 0));
