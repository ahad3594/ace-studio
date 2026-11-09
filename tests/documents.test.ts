import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {resolve} from 'node:path';
process.env.ACE_PYTHON ||= resolve('.venv/bin/python');
import JSZip from "jszip";
import sharp from "sharp";
import { POST as documentRoute } from "../app/api/documents/process/route.ts";
import { POST as inspectRoute } from "../app/api/documents/inspect/route.ts";
import { defaultDocumentOptions } from "../lib/documents/schema.ts";
import {
  localToolRoute,
  routerRequestSchema,
  routeWithAI,
} from "../lib/ai/tool-router.ts";
import { withJob, runWorker } from "../lib/documents/service.ts";
import {
  GET as providerGet,
  POST as providerPost,
} from "../app/api/config/provider/route.ts";
function formRequest(
  tool: string,
  files: { name: string; data: Uint8Array; type: string }[],
  options = {},
) {
  const form = new FormData();
  for (const file of files)
    form.append(
      "files",
      new File([new Uint8Array(file.data)], file.name, { type: file.type }),
    );
  form.append(
    "settings",
    JSON.stringify({
      tool,
      options: { ...defaultDocumentOptions, ...options },
    }),
  );
  return new Request("http://localhost/api/documents/process", {
    method: "POST",
    body: form,
  });
}
test("document API returns a genuine two-page PDF from two PNGs", async () => {
  const image = await sharp({
    create: { width: 500, height: 250, channels: 3, background: "#71629c" },
  })
    .png()
    .toBuffer();
  const response = await documentRoute(
    formRequest("images-to-pdf", [
      { name: "first.png", data: image, type: "image/png" },
      { name: "second.png", data: image, type: "image/png" },
    ]),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  const data = await response.arrayBuffer();
  assert.ok(Buffer.from(data).subarray(0, 5).equals(Buffer.from("%PDF-")));
  const form = new FormData();
  form.append(
    "files",
    new File([data], "output.pdf", { type: "application/pdf" }),
  );
  const result = await inspectRoute(
    new Request("http://localhost/api/documents/inspect", {
      method: "POST",
      body: form,
    }),
  );
  const info = await result.json();
  assert.equal(info.documents[0].pages, 2);
  assert.match(info.documents[0].previews[0].image, /^data:image\/png;base64/);
});
test("PDF-to-Word API produces editable DOCX XML with real extracted content", async () => {
  const sample = await readFile("public/sample-document.pdf");
  const response = await documentRoute(
    formRequest(
      "pdf-to-word",
      [{ name: "sample.pdf", data: sample, type: "application/pdf" }],
      { pages: "1" },
    ),
  );
  assert.equal(response.status, 200);
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.match(xml, /ACE Studio/);
});
test("local tool routing supports varied phrasing and never invents output bytes", () => {
  for (const [prompt, expected] of [
    ["Please turn my PDF into something I can edit in Word", "pdf-to-word"],
    ["Meri PDF ka size kam kar do", "compress-pdf"],
    ["Bitte die PDFs zusammenfügen", "merge-pdf"],
    ["Make a searchable document with OCR", "ocr-pdf"],
  ]) {
    const result = localToolRoute(routerRequestSchema.parse({ prompt }));
    assert.equal(result.tool, expected);
    assert.equal(result.mode, "local");
    assert.ok(!("bytes" in result));
  }
});
test("malformed or failed Gemini routing is labeled as a local fallback", async () => {
  const saved = process.env.GEMINI_API_KEY,
    fetcher = globalThis.fetch;
  process.env.GEMINI_API_KEY = "test-placeholder-only";
  globalThis.fetch = async () =>
    Response.json({
      candidates: [{ content: { parts: [{ text: '{"execute":"bad"}' }] } }],
    });
  try {
    const result = await routeWithAI(
      routerRequestSchema.parse({ prompt: "Merge the PDFs" }),
    );
    assert.equal(result.mode, "local");
    assert.equal(result.tool, "merge-pdf");
    assert.equal('fallback' in result&&result.fallback, true);
  } finally {
    globalThis.fetch = fetcher;
    if (saved === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = saved;
  }
});
test("desktop key setup requires its private session and never returns the saved secret", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ace-provider-test-"));
  const previous = {
    dir: process.env.ACE_CONFIG_DIR,
    desktop: process.env.ACE_DESKTOP,
    token: process.env.ACE_DESKTOP_TOKEN,
    key: process.env.GEMINI_API_KEY,
  };
  process.env.ACE_CONFIG_DIR = dir;
  process.env.ACE_DESKTOP = "true";
  process.env.ACE_DESKTOP_TOKEN = "test-desktop-token";
  delete process.env.GEMINI_API_KEY;
  const body = JSON.stringify({
    key: "test-key-not-a-real-credential",
    model: "gemini-2.5-flash",
  });
  try {
    const denied = await providerPost(
      new Request("http://localhost/api/config/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
    );
    assert.equal(denied.status, 403);
    const accepted = await providerPost(
      new Request("http://localhost/api/config/provider", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "ace-desktop=test-desktop-token",
        },
        body,
      }),
    );
    assert.equal(accepted.status, 200);
    const info = await providerGet(
      new Request("http://localhost/api/config/provider", {
        headers: { Cookie: "ace-desktop=test-desktop-token" },
      }),
    );
    const text = await info.text();
    assert.ok(!text.includes("test-key-not-a-real-credential"));
    assert.equal(JSON.parse(text).configured, true);
    assert.equal((await stat(join(dir, "provider.json"))).mode & 0o777, 0o600);
    const modelChanged = await providerPost(
      new Request("http://localhost/api/config/provider", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "ace-desktop=test-desktop-token",
        },
        body: JSON.stringify({ model: "gemini-2.5-pro" }),
      }),
    );
    assert.equal(modelChanged.status, 200);
    const updated = JSON.parse(await readFile(join(dir, "provider.json"), "utf8"));
    assert.equal(updated.model, "gemini-2.5-pro");
    assert.equal(updated.key, "test-key-not-a-real-credential");
  } finally {
    for (const [name, value] of Object.entries({
      ACE_CONFIG_DIR: previous.dir,
      ACE_DESKTOP: previous.desktop,
      ACE_DESKTOP_TOKEN: previous.token,
      GEMINI_API_KEY: previous.key,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
test("worker path validation rejects traversal and private jobs are cleaned up", async () => {
  let saved = "";
  await assert.rejects(
    () =>
      withJob(async (dir) => {
        saved = dir;
        await runWorker(dir, {
          action: "inspect",
          inputs: [{ path: "../../etc/passwd", name: "file.pdf" }],
          options: {},
        });
      }),
    /Invalid private job input/,
  );
  await assert.rejects(() => stat(saved));
});


test("conversational routing sends metadata and history while shielding private fields", async()=>{
 const previous=process.env.GEMINI_API_KEY, original=globalThis.fetch;process.env.GEMINI_API_KEY="placeholder-for-test";
 const options={...defaultDocumentOptions,password:"private-input",newPassword:"private-output",text:"private-watermark",search:"private-search",html:"private-html",values:{private:"private-value"},fields:[{name:"private-field",type:"text" as const,page:1,rect:{x:10,y:10,width:20,height:10},value:"private-field-value"}]};
 let sent:any;globalThis.fetch=async(_url,init)=>{sent=JSON.parse(String(init?.body));return Response.json({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify({tool:"extract-pages",options:{...defaultDocumentOptions,pages:"7",allowAI:true},questions:[],message:"I will keep the last page."})}]}}]});};
 try{const result=await routeWithAI(routerRequestSchema.parse({prompt:"Just keep the last page this time",currentTool:"extract-pages",currentOptions:options,messages:[{role:"user",text:"Keep only page 2"}],fileInfo:[{kind:"pdf",pages:7}]}));
 assert.equal(result.mode,"gemini");assert.equal(result.options.pages,"7");assert.equal(result.options.allowAI,false);assert.equal(result.options.password,"private-input");assert.equal(result.options.text,"private-watermark");
 const payload=JSON.parse(sent.contents[0].parts[0].text);assert.equal(payload.fileInfo[0].pages,7);assert.equal(payload.messages[0].text,"Keep only page 2");for(const secret of ["private-input","private-output","private-watermark","private-search","private-html","private-value","private-field"])assert.ok(!JSON.stringify(sent).includes(secret));
 }finally{globalThis.fetch=original;if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;}
});
