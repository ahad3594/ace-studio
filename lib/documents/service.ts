import { spawn } from "node:child_process";
import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
  stat,
  mkdir,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, basename, sep } from "node:path";
import JSZip from "jszip";
import { documentRequestSchema } from "./schema.ts";
import { boundedBody, HttpError } from "../server.ts";
export const docLimits = {
  files: 20,
  perFile: 25 * 1024 * 1024,
  total: 80 * 1024 * 1024,
  pages: 200,
  output: 100 * 1024 * 1024,
};
export function pythonExecutable() {
  return process.env.ACE_PYTHON || 'python3';
}
function workerPath() {
  return (
    process.env.ACE_WORKER || join(process.cwd(), "worker", "documents.py")
  );
}
export interface WorkerResult {
  files?: { path: string; name: string; mime: string; bytes: number }[];
  warnings?: string[];
  stats?: Record<string, unknown>;
  [key: string]: unknown;
}
const running = globalThis as typeof globalThis & { aceDocJobs?: number };
export async function withJob<T>(
  fn: (dir: string) => Promise<T>,
  limited = true,
) {
  if (limited && (running.aceDocJobs ?? 0) >= 1)
    throw new HttpError(
      "The document engine is busy. Please retry in a moment.",
      429,
    );
  if (limited) running.aceDocJobs = (running.aceDocJobs ?? 0) + 1;
  const dir = await mkdtemp(join(tmpdir(), "ace-doc-"));
  try {
    return await fn(dir);
  } finally {
    if (limited)
      running.aceDocJobs = Math.max(0, (running.aceDocJobs ?? 1) - 1);
    await rm(dir, { recursive: true, force: true });
  }
}
export async function runWorker(
  dir: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<WorkerResult> {
  await writeFile(join(dir, "job.json"), JSON.stringify(payload), {
    mode: 0o600,
  });
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    PATH: process.env.PATH,
    LANG: "C.UTF-8",
    TMPDIR: dir,
    TEMP: dir,
    OPENBLAS_NUM_THREADS: "1",
    OMP_NUM_THREADS: "1",
    PYTHONDONTWRITEBYTECODE: "1",
    ACE_MAX_PAGES: String(docLimits.pages),
    ACE_TESSDATA:
      process.env.ACE_TESSDATA || join(process.cwd(), "data/tessdata"),
    ACE_SOFFICE: process.env.ACE_SOFFICE,
    ACE_GS: process.env.ACE_GS,
    ACE_SRGB_PROFILE: process.env.ACE_SRGB_PROFILE,
  };
  return new Promise((resolvePromise, reject) => {
    const child = spawn(/*turbopackIgnore: true*/
      pythonExecutable(),
      [workerPath(), join(dir, "job.json")],
      {
        env,
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      },
    );
    let stdout = "",
      stderr = "",
      settled = false;
    const kill = () => {
      try {
        if (child.pid && process.platform !== "win32")
          process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {}
    };
    const finish = (error?: Error, data?: WorkerResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolvePromise(data!);
    };
    const abort = () => {
      kill();
      finish(new Error("The document request was cancelled."));
    };
    const timer = setTimeout(() => {
      kill();
      finish(
        new Error(
          "This document took too long. Try fewer pages or a smaller file.",
        ),
      );
    }, 180000);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 20_000_000) {
        kill();
        finish(new Error("Document response exceeded the safety limit."));
      }
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 4000) stderr += chunk;
    });
    child.on("error", () =>
      finish(
        new Error(
          "Document engine is unavailable. Install the Python requirements or use the ACE Studio desktop package.",
        ),
      ),
    );
    child.on("close", (code) => {
      if (settled) return;
      try {
        const result = JSON.parse(stdout.trim());
        if (result.error) finish(new Error(result.error));
        else if (code !== 0)
          finish(
            new Error("The document engine could not complete this operation."),
          );
        else finish(undefined, result);
      } catch {
        finish(
          new Error(
            "Document engine returned an invalid response. Check the local runtime installation.",
          ),
        );
      }
    });
  });
}
export async function readDocumentForm(request: Request) {
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("multipart/form-data;"))
    throw new HttpError("Expected uploaded files.");
  const bytes = await boundedBody(request, docLimits.total + 300000);
  const form = await new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": type },
  }).formData();
  const files = form.getAll("files");
  if (files.some((f) => !(f instanceof File)))
    throw new HttpError("Invalid file upload.");
  if (files.length > docLimits.files)
    throw new HttpError(`Choose up to ${docLimits.files} files.`);
  if (files.some((f) => (f as File).size > docLimits.perFile))
    throw new HttpError("Each document must be under 25 MB.", 413);
  if (files.reduce((n, f) => n + (f as File).size, 0) > docLimits.total)
    throw new HttpError("The batch exceeds 80 MB.", 413);
  return { form, files: files as File[] };
}
export async function writeInputs(dir: string, files: File[]) {
  const inputs = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i],
      data = Buffer.from(await file.arrayBuffer());
    const extension = (
      file.name.match(/\.([a-zA-Z0-9]{1,8})$/)?.[1] || "bin"
    ).toLowerCase();
    const name = `input-${i}.${extension}`;
    await writeFile(join(dir, name), data, { mode: 0o600 });
    inputs.push({
      path: name,
      name: basename(file.name).slice(0, 140),
      extension,
    });
  }
  return inputs;
}
export async function outputResponse(dir: string, result: WorkerResult) {
  const outputs = result.files;
  if (!outputs?.length) throw new Error("No output was generated.");
  let total = 0;
  const items = [];
  for (const item of outputs) {
    const path = resolve(dir, item.path);
    if (!path.startsWith(resolve(dir) + sep))
      throw new Error("Invalid engine output path.");
    const info = await stat(path);
    total += info.size;
    if (total > docLimits.output)
      throw new Error(
        "The output is too large. Process fewer pages at a time.",
      );
    items.push({ ...item, data: await readFile(path), bytes: info.size });
  }
  const meta = {
    warnings: (result.warnings ?? []).slice(0, 5),
    stats: result.stats ?? {},
    fileCount: items.length,
    files: items
      .slice(0, 8)
      .map(({ name, mime, bytes }) => ({
        name: name.slice(0, 80),
        mime,
        bytes,
      })),
  };
  let data: Buffer, name: string, mime: string;
  if (items.length === 1) {
    data = items[0].data;
    name = items[0].name;
    mime = items[0].mime;
  } else {
    const zip = new JSZip(),
      used = new Set<string>();
    for (const item of items) {
      let name = item.name.replace(/[/\\]/g, "_");
      let i = 2;
      while (used.has(name.toLowerCase()))
        name = item.name.replace(/(\.[^.]+)$/, `_${i++}$1`);
      used.add(name.toLowerCase());
      zip.file(name, item.data);
    }
    data = await zip.generateAsync({
      type: "nodebuffer",
      compression: "STORE",
    });
    name = "ACE-Studio-results.zip";
    mime = "application/zip";
  }
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(data.length),
      "Content-Disposition": `attachment; filename="ACE-result.${name.split(".").pop()}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-ACE-Result": encodeURIComponent(JSON.stringify(meta)),
      "X-ACE-Filename": encodeURIComponent(name),
      "Cache-Control": "no-store",
    },
  });
}
export { documentRequestSchema };
