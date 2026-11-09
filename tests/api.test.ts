import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { POST as processRoute } from "../app/api/process/route.ts";
import { POST as aiRoute } from "../app/api/ai/route.ts";
import { defaultPlan } from "../lib/plan.ts";
test("processing HTTP handler returns actual downloadable bytes and measured headers", async () => {
  const input = await sharp({
    create: { width: 700, height: 350, channels: 3, background: "#8491bb" },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append(
    "image",
    new File([input], "../../test.png", { type: "image/png" }),
  );
  form.append(
    "plan",
    JSON.stringify({
      ...defaultPlan,
      width: 500,
      height: 500,
      format: "jpeg",
      targetFileSizeKB: 100,
    }),
  );
  const response = await processRoute(
    new Request("http://localhost/api/process", { method: "POST", body: form }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/jpeg");
  assert.match(response.headers.get("Content-Disposition")!, /attachment/);
  const output = Buffer.from(await response.arrayBuffer()),
    meta = await sharp(output).metadata(),
    result = JSON.parse(
      decodeURIComponent(response.headers.get("X-Image-Result")!),
    );
  assert.equal(meta.width, 500);
  assert.equal(meta.height, 500);
  assert.equal(output.length, result.bytes);
  assert.ok(output.length <= 102400);
});
test("invalid settings and spoofed file uploads are rejected by HTTP handler", async () => {
  const form = new FormData();
  form.append(
    "image",
    new File(["<svg/>"], "fake.jpg", { type: "image/jpeg" }),
  );
  form.append("plan", JSON.stringify(defaultPlan));
  const response = await processRoute(
    new Request("http://localhost/api/process", { method: "POST", body: form }),
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Unsupported/);
});
test("AI failure and malformed structured provider output fall back honestly to local parsing", async () => {
  const key = process.env.GEMINI_API_KEY,
    fetcher = globalThis.fetch;
  process.env.GEMINI_API_KEY = "test-placeholder-not-a-real-key";
  try {
    for (const mode of ["failure", "malformed"]) {
      globalThis.fetch = async () =>
        mode === "failure"
          ? new Response("unavailable", { status: 503 })
          : Response.json({
              candidates: [
                {
                  content: {
                    parts: [{ text: '{"shell":"untrusted command"}' }],
                  },
                },
              ],
            });
      const response = await aiRoute(
        new Request("http://localhost/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Meri image 50KB se kam kar do",
            currentPlan: defaultPlan,
          }),
        }),
      );
      const data = await response.json();
      assert.equal(response.status, 200);
      assert.equal(data.mode, "offline");
      assert.equal(data.fallback, true);
      assert.equal(data.plan.targetFileSizeKB, 50);
      assert.equal(data.plan.width, null);
    }
  } finally {
    globalThis.fetch = fetcher;
    if (key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = key;
  }
});
test("a missing DPI can be clarified on the following conversational turn", async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const request = (prompt: string, currentPlan = defaultPlan) =>
      new Request("http://localhost/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, currentPlan }),
      });
    const first = await (await aiRoute(request("Resize to 35x45mm"))).json();
    assert.equal(first.plan.unit, "mm");
    assert.ok(first.questions.length);
    const second = await (
      await aiRoute(request("Use 300 DPI", first.plan))
    ).json();
    assert.equal(second.plan.width, 35);
    assert.equal(second.plan.dpi, 300);
    assert.equal(second.questions.length, 0);
  } finally {
    if (oldKey !== undefined) process.env.GEMINI_API_KEY = oldKey;
  }
});


test("image AI carries conversation and dimensions into a validated semantic plan", async()=>{
 const key=process.env.GEMINI_API_KEY, fetcher=globalThis.fetch;process.env.GEMINI_API_KEY="test-key-only";let sent:any;
 globalThis.fetch=async(_url,init)=>{sent=JSON.parse(String(init?.body));return Response.json({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify({plan:{...defaultPlan,width:400,height:300,allowUpscaling:true,allowDimensionReduction:true},questions:[],message:"I will halve the original dimensions and allow further reduction."})}]}}]});};
 try{const res=await aiRoute(new Request("http://localhost/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:"Use half the original dimensions; smaller still is okay if needed",currentPlan:defaultPlan,messages:[{role:"user",text:"You may enlarge if necessary"}],imageMetadata:[{width:800,height:600,bytes:10000,format:"png"}]})}));
 const answer=await res.json();assert.equal(answer.mode,"ai");assert.equal(answer.plan.width,400);assert.equal(answer.plan.allowDimensionReduction,true);assert.equal(answer.plan.allowUpscaling,true);const input=JSON.parse(sent.contents[0].parts[0].text);assert.equal(input.imageMetadata[0].width,800);assert.equal(input.recentConversation[0].text,"You may enlarge if necessary");assert.ok(!JSON.stringify(input).includes("base64"));
 }finally{globalThis.fetch=fetcher;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
});
