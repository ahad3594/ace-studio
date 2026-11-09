import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { processImage } from "../lib/image/processor.ts";
import { inspectImage } from "../lib/image/metadata.ts";
import { defaultPlan } from "../lib/plan.ts";
const solid = (
  width: number,
  height: number,
  background: string | { r: number; g: number; b: number; alpha: number },
) =>
  sharp({ create: { width, height, channels: 4, background } })
    .png()
    .toBuffer();
function noisy(width: number, height: number) {
  const raw = Buffer.alloc(width * height * 3);
  let seed = 42;
  for (let i = 0; i < raw.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    raw[i] = seed >>> 24;
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 98 })
    .toBuffer();
}
test("real PNG 4000x3000 becomes an actual 800x600 JPEG", async () => {
  const input = await solid(4000, 3000, "#34b39d");
  const r = await processImage(input, {
    ...defaultPlan,
    width: 800,
    height: 600,
    format: "jpeg",
  });
  const m = await sharp(r.data).metadata();
  assert.equal(m.format, "jpeg");
  assert.equal(m.width, 800);
  assert.equal(m.height, 600);
  assert.equal(r.bytes, r.data.length);
});
test("contain padding preserves the full source and produces an exact square", async () => {
  const input = await solid(2000, 1000, "#ff0000");
  const r = await processImage(input, {
    ...defaultPlan,
    width: 500,
    height: 500,
    format: "png",
  });
  assert.equal(r.width, 500);
  assert.equal(r.height, 500);
  const { data, info } = await sharp(r.data)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixel = (x: number, y: number) =>
    Array.from(
      data.subarray(
        (y * info.width + x) * info.channels,
        (y * info.width + x) * info.channels + 3,
      ),
    );
  assert.deepEqual(pixel(250, 0), [255, 255, 255]);
  assert.deepEqual(pixel(250, 250), [255, 0, 0]);
  assert.deepEqual(pixel(250, 499), [255, 255, 255]);
});
test("transparent PNG composites on white in JPEG and preserves alpha in PNG", async () => {
  const input = await solid(80, 80, { r: 0, g: 0, b: 0, alpha: 0 });
  const jpg = await processImage(input, { ...defaultPlan, format: "jpeg" }),
    png = await processImage(input, { ...defaultPlan, format: "png" });
  const color = await sharp(jpg.data).raw().toBuffer();
  assert.ok(color[0] >= 254 && color[1] >= 254 && color[2] >= 254);
  assert.equal((await sharp(png.data).metadata()).hasAlpha, true);
});
test("bounded measured compression reaches a feasible target and respects mandatory dimensions", async () => {
  const input = await noisy(600, 600);
  const r = await processImage(input, {
    ...defaultPlan,
    targetFileSizeKB: 100,
    compression: true,
    format: "jpeg",
    minQuality: 5,
  });
  assert.ok(r.bytes <= 100 * 1024);
  assert.equal(r.targetMet, true);
  assert.equal(r.width, 600);
  assert.equal(r.height, 600);
  assert.equal(r.data.length, r.bytes);
});
test("impossible size and PNG lossless constraints never falsely claim success", async () => {
  const input = await noisy(400, 400);
  for (const format of ["jpeg", "png"] as const) {
    const r = await processImage(input, {
      ...defaultPlan,
      format,
      targetFileSizeKB: 1,
      minQuality: 88,
    });
    assert.equal(r.targetMet, false);
    assert.ok(r.bytes > 1024);
    assert.equal(r.width, 400);
    assert.ok(r.warnings.length);
  }
  await assert.rejects(
    () =>
      processImage(input, {
        ...defaultPlan,
        targetFileSizeKB: 25,
        sizeMode: "exact",
      }),
    /Exact byte/,
  );
});
test("cover crops, inside preserves ratio, width-only resizes proportionally, stretch is explicit", async () => {
  const input = await solid(600, 300, "#ff8040");
  const crop = await processImage(input, {
    ...defaultPlan,
    width: 200,
    height: 200,
    resizeMode: "cover",
  });
  assert.equal(crop.width, 200);
  assert.equal(crop.height, 200);
  const inside = await processImage(input, {
    ...defaultPlan,
    width: 200,
    height: 200,
    resizeMode: "inside",
  });
  assert.equal(inside.width, 200);
  assert.equal(inside.height, 100);
  const width = await processImage(input, { ...defaultPlan, width: 300 });
  assert.equal(width.height, 150);
  const stretch = await processImage(input, {
    ...defaultPlan,
    width: 200,
    height: 200,
    resizeMode: "fill",
    preserveAspectRatio: false,
  });
  assert.equal(stretch.height, 200);
});
test("no upscaling keeps image pixels small but pads the exact canvas", async () => {
  const input = await solid(50, 50, "#ff0000");
  const r = await processImage(input, {
    ...defaultPlan,
    width: 200,
    height: 200,
    format: "png",
  });
  assert.equal(r.width, 200);
  const { data, info } = await sharp(r.data)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(data[(100 * 200 + 20) * info.channels + 1], 255);
  assert.equal(data[(100 * 200 + 100) * info.channels + 1], 0);
});
test("physical dimensions produce 413x531 with real 300 DPI metadata", async () => {
  const input = await solid(1000, 1000, "#556677");
  const r = await processImage(input, {
    ...defaultPlan,
    width: 35,
    height: 45,
    unit: "mm",
    dpi: 300,
    format: "jpeg",
  });
  const m = await sharp(r.data).metadata();
  assert.equal(m.width, 413);
  assert.equal(m.height, 531);
  assert.equal(m.density, 300);
});
test("EXIF orientation is applied before reporting dimensions and resizing", async () => {
  const input = await sharp({
    create: { width: 300, height: 150, channels: 3, background: "#f58" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  assert.equal((await inspectImage(input)).width, 150);
  const r = await processImage(input, {
    ...defaultPlan,
    width: 75,
    format: "jpeg",
  });
  assert.equal(r.width, 75);
  assert.equal(r.height, 150);
  assert.equal((await sharp(r.data).metadata()).orientation, undefined);
});
test("JPEG/WebP/AVIF/PNG signatures and metadata match requested outputs", async () => {
  const input = await solid(100, 80, "#386");
  for (const format of ["jpeg", "png", "webp", "avif"] as const) {
    const r = await processImage(input, { ...defaultPlan, format });
    const m = await sharp(r.data).metadata();
    assert.equal(m.format, format === "avif" ? "heif" : format);
    assert.equal(r.format, format);
  }
});
test("invalid files, SVG, truncated images and excessive output dimensions are rejected", async () => {
  await assert.rejects(
    () => inspectImage(Buffer.from('<svg width="10" height="10"/>')),
    /Unsupported/,
  );
  await assert.rejects(
    () => inspectImage(Buffer.from([255, 216, 255, 0])),
    /Cannot decode/,
  );
  const input = await solid(100, 100, "#123");
  await assert.rejects(
    () => processImage(input, { ...defaultPlan, width: 12000, height: 12000 }),
    /pixel limit/,
  );
});
test("source metadata is stripped even when DPI is added, and retained only on request", async () => {
  const input = await sharp({
    create: { width: 200, height: 200, channels: 3, background: "#123" },
  })
    .withExif({ IFD0: { Artist: "Private Test Author" } })
    .jpeg()
    .toBuffer();
  const clean = await processImage(input, {
    ...defaultPlan,
    width: 100,
    height: 100,
    dpi: 300,
    format: "jpeg",
  });
  assert.equal((await sharp(clean.data).metadata()).density, 300);
  assert.equal(clean.data.includes(Buffer.from("Private Test Author")), false);
  const retained = await processImage(input, {
    ...defaultPlan,
    width: 100,
    height: 100,
    retainMetadata: true,
    format: "jpeg",
  });
  assert.equal(
    retained.data.includes(Buffer.from("Private Test Author")),
    true,
  );
});
test("input pixel bombs are rejected before a full decode", async () => {
  const input = await solid(10, 10, "#123");
  input.writeUInt32BE(100000, 16);
  input.writeUInt32BE(100000, 20);
  await assert.rejects(() => inspectImage(input), /Cannot decode/);
});
test("dimension reduction is used only with explicit permission", async () => {
  const input = await noisy(500, 500);
  const p = {
    ...defaultPlan,
    format: "jpeg" as const,
    targetFileSizeKB: 5,
    minQuality: 70,
  };
  const fixed = await processImage(input, p);
  assert.equal(fixed.width, 500);
  assert.equal(fixed.targetMet, false);
  const reduced = await processImage(input, {
    ...p,
    allowDimensionReduction: true,
  });
  assert.ok(reduced.width < 500);
  assert.equal(reduced.targetMet, true);
  assert.ok(reduced.bytes <= 5 * 1024);
});
