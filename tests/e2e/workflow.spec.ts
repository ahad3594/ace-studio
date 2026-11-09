import { test, expect } from "@playwright/test";
import sharp from "sharp";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
test("upload → interpret → process → compare → download actual JPEG and ZIP", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/studio");
  const input = await sharp({
    create: {
      width: 1200,
      height: 600,
      channels: 4,
      background: { r: 100, g: 60, b: 160, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  await page
    .locator("input[type=file]")
    .setInputFiles([
      { name: "photo.png", mimeType: "image/png", buffer: input },
    ]);
  await expect(
    page.getByRole("button", { name: "Preview photo.png" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Image processing instruction" })
    .fill(
      "Make this 500x500 without cropping, convert to JPG and keep it below 100KB.",
    );
  await page.getByRole("button", { name: "Analyze instruction" }).click();
  await expect(
    page.getByText("500 × 500 px", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Generate Image", exact: false })
    .click();
  await expect(page.getByText("Your image is ready.")).toBeVisible();
  const slider = page.getByRole("slider", {
    name: "Before and after comparison position",
  });
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue("51");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download processed image", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.jpg$/);
  const metadata = await sharp((await download.path())!).metadata();
  expect(metadata.width).toBe(500);
  expect(metadata.height).toBe(500);
  expect(metadata.format).toBe("jpeg");
  const zipPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download all", exact: false })
    .click();
  expect((await zipPromise).suggestedFilename()).toMatch(/\.zip$/);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("manual settings, light theme and passport clarification are functional", async ({
  page,
}) => {
  await page.goto("/studio");
  await page
    .getByRole("button", { name: "Toggle light and dark theme" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("textbox", { name: "Image processing instruction" })
    .fill("Make it suitable for a university application");
  await page.getByRole("button", { name: "Analyze instruction" }).click();
  await expect(page.getByText("A quick clarification")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate Image", exact: false }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Output width", exact: true })
    .fill("600");
  await expect(
    page.getByRole("spinbutton", { name: "Output width", exact: true }),
  ).toHaveValue("600");
  await page
    .getByRole("combobox", { name: "Dimension preset", exact: true })
    .selectOption("1080x1080");
  await expect(
    page.getByRole("spinbutton", { name: "Output width", exact: true }),
  ).toHaveValue("1080");
  await expect(
    page.getByRole("spinbutton", { name: "Output height", exact: true }),
  ).toHaveValue("1080");
});

test("batch jobs produce distinct names and actual processed files in ZIP", async ({
  page,
}) => {
  await page.goto("/batch");
  const input = await sharp({
    create: { width: 800, height: 400, channels: 3, background: "#4c6281" },
  })
    .png()
    .toBuffer();
  await page.locator("input[type=file]").setInputFiles([
    { name: "photo.png", mimeType: "image/png", buffer: input },
    { name: "photo.png", mimeType: "image/png", buffer: input },
  ]);
  await expect(
    page.getByRole("button", { name: "Preview photo.png" }),
  ).toHaveCount(2);
  await page
    .getByRole("textbox", { name: "Image processing instruction" })
    .fill(
      "Convert all images to JPG, resize to 500x500 without cropping, under 100KB",
    );
  await page.getByRole("button", { name: "Analyze instruction" }).click();
  await expect(
    page.getByText("500 × 500 px", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Generate 2 Images" }).click();
  await expect(page.getByText(/2 of 2 ready/)).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all as ZIP" }).click();
  const download = await pending,
    zip = await JSZip.loadAsync(await readFile((await download.path())!));
  expect(Object.keys(zip.files).sort()).toEqual([
    "photo_processed.jpg",
    "photo_processed_2.jpg",
  ]);
  for (const name of Object.keys(zip.files)) {
    const meta = await sharp(
      await zip.file(name)!.async("nodebuffer"),
    ).metadata();
    expect(meta.width).toBe(500);
    expect(meta.height).toBe(500);
    expect(meta.format).toBe("jpeg");
  }
});

test("browser fallback processes and downloads real images with the network offline", async ({
  page,
  context,
}) => {
  await page.goto("/studio");
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  const input = await sharp({
    create: { width: 800, height: 400, channels: 3, background: "#7f6281" },
  })
    .png()
    .toBuffer();
  await page
    .locator("input[type=file]")
    .setInputFiles([
      { name: "offline.png", mimeType: "image/png", buffer: input },
    ]);
  await expect(
    page.getByRole("button", { name: "Preview offline.png" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Image processing instruction" })
    .fill("Resize to 400x400, JPG, 100KB se kam kar do");
  await page.getByRole("button", { name: "Analyze instruction" }).click();
  await expect(
    page.getByText("400 × 400 px", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Generate Image", exact: false })
    .click();
  await expect(page.getByText("Your image is ready.")).toBeVisible();
  await expect(page.getByText(/Browser engine/)).toBeVisible();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download processed image", exact: true })
    .click();
  const download = await pending;
  const meta = await sharp((await download.path())!).metadata();
  expect(meta.width).toBe(400);
  expect(meta.height).toBe(400);
  expect(meta.format).toBe("jpeg");
  await context.setOffline(false);
});
