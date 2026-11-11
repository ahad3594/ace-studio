import { spawn } from "node:child_process";
const python = process.env.ACE_SETUP_PYTHON || (process.platform === "win32" ? "python" : "python3");
const child = spawn(python, ["scripts/setup-documents.py"], { stdio: "inherit" });
child.on("error", () => { console.error("Install Python 3.12+ to develop from source, or download a ready-made desktop installer."); process.exit(1); });
child.on("exit", code => process.exit(code ?? 1));
