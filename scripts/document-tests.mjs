import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const executable =
  process.env.ACE_PYTHON ||
  (existsSync(".venv/bin/python") ? resolve(".venv/bin/python") : "python3");
const child = spawn(
  executable,
  [
    "-m",
    "unittest",
    "discover",
    "-s",
    "tests",
    "-p",
    "test_documents.py",
    "-v",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1" },
  },
);
child.on("error", (e) => {
  console.error(e.message);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
