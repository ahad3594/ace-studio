import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import sharp from "sharp";
import { createZip, safeFilename, uniqueFilename } from "../lib/batch.ts";
import { processImage } from "../lib/image/processor.ts";
import { defaultPlan } from "../lib/plan.ts";
test("collision-safe filenames cannot escape directories", () => {
  const used = new Set<string>();
  const a = safeFilename("../../evil photo.png", "jpeg");
  assert.ok(!a.includes("/"));
  assert.equal(a, "evil_photo_processed.jpg");
  assert.equal(uniqueFilename("photo.jpg", used), "photo.jpg");
  assert.equal(uniqueFilename("photo.jpg", used), "photo_2.jpg");
  assert.equal(uniqueFilename("PHOTO.jpg", used), "PHOTO_3.jpg");
});
test("10 genuinely processed square images are present in downloadable ZIP bytes", async () => {
  const input = await sharp({
    create: { width: 600, height: 300, channels: 3, background: "#6c5ca4" },
  })
    .png()
    .toBuffer();
  const items = [];
  for (let i = 0; i < 10; i++) {
    const r = await processImage(input, {
      ...defaultPlan,
      width: 500,
      height: 500,
      format: "jpeg",
    });
    items.push({ name: "photo.jpg", data: new Uint8Array(r.data) });
  }
  const bytes = await createZip(items);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const zip = await JSZip.loadAsync(bytes);
  assert.equal(Object.keys(zip.files).length, 10);
  for (const name of Object.keys(zip.files)) {
    const m = await sharp(await zip.file(name)!.async("nodebuffer")).metadata();
    assert.equal(m.width, 500);
    assert.equal(m.height, 500);
    assert.equal(m.format, "jpeg");
  }
});
