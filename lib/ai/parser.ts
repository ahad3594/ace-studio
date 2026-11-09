import { defaultPlan } from "../plan.ts";
import type { Plan } from "../plan.ts";
export interface Interpretation {
  plan: Plan;
  questions: string[];
  message: string;
}
export function parsePrompt(
  prompt: string,
  current: Plan = defaultPlan,
): Interpretation {
  const p = { ...current },
    questions: string[] = [];
  const s = prompt
    .toLowerCase()
    .replace(/[۰-۹٠-٩]/g, (c) =>
      String(
        "۰۱۲۳۴۵۶۷۸۹".includes(c)
          ? "۰۱۲۳۴۵۶۷۸۹".indexOf(c)
          : "٠١٢٣٤٥٦٧٨٩".indexOf(c),
      ),
    )
    .replace(/×/g, "x");
  let understood = false;
  if (
    current.targetFileSizeKB &&
    /(?:use|as|instead|choose).*maximum|maximum.*instead/.test(s)
  ) {
    p.sizeMode = "maximum";
    understood = true;
  }
  if (
    /passport|university|application|پاسپورٹ|درخواست|bewerbung|universität/.test(
      s,
    ) &&
    !/\d/.test(s)
  ) {
    return {
      plan: p,
      questions: [
        "What official width, height, format, and maximum file size does the application require?",
      ],
      message:
        "Please provide the official specifications so I can prepare an accurate image.",
    };
  }
  if (
    /remove.*background|background.*remove|پس منظر.*ہٹا|hintergrund.*entfern/.test(
      s,
    )
  ) {
    return {
      plan: p,
      questions: [
        "Background removal is not available. I can resize, compress, convert, and set padding or transparency backgrounds. What would you like to do?",
      ],
      message:
        "This editor preserves your image rather than generating or removing content.",
    };
  }
  const units = (u?: string): Plan["unit"] =>
    u === "inch" || u === "inches" || u === "zoll"
      ? "in"
      : (u as Plan["unit"]) || "px";
  const pair = s.match(
    /(\d+(?:\.\d+)?)\s*(px|pixels?|mm|cm|inches|inch|in|zoll)?\s*(?:x|by|بائی|mal)\s*(\d+(?:\.\d+)?)\s*(px|pixels?|mm|cm|inches|inch|in|zoll)?/,
  );
  if (pair) {
    p.width = +pair[1];
    p.height = +pair[3];
    p.unit = units(pair[4] || pair[2]);
    if (/^pixel/.test(pair[4] || pair[2] || "")) p.unit = "px";
    p.scalePercent = null;
    p.aspectRatio = null;
    understood = true;
  } else {
    const w = s.match(
      /(?:width|chaurai|chorai|breite|چوڑائی)\s*(?:of|is|ko|auf|:|=)?\s*(\d+)/,
    );
    const h = s.match(
      /(?:height|unchai|lambai|höhe|اونچائی|لمبائی)\s*(?:of|is|ko|auf|:|=)?\s*(\d+)/,
    );
    if (w || h) {
      p.width = w ? +w[1] : null;
      p.height = h ? +h[1] : null;
      p.scalePercent = null;
      p.unit = "px";
      p.aspectRatio = null;
      understood = true;
    }
  }
  const dpi =
    s.match(/(\d+)\s*(?:dpi|ppi)/) ||
    s.match(/(?:dpi|ppi)\s*(?:of|:|=)?\s*(\d+)/);
  if (dpi) {
    p.dpi = +dpi[1];
    understood = true;
  }
  const percentage = s.match(
    /(?:scale|resize|verkleinern|skalier\w*)[^\d]{0,15}(\d+(?:\.\d+)?)\s*%/,
  );
  if (percentage) {
    p.scalePercent = +percentage[1];
    p.width = null;
    p.height = null;
    p.aspectRatio = null;
    understood = true;
  }
  const sizes = [
    ...s.matchAll(/(\d+(?:\.\d+)?)\s*(kb|kib|mb|mib|کلو\s*بائٹ|میگا\s*بائٹ)/g),
  ];
  if (sizes.length) {
    const m = sizes.at(-1)!;
    p.targetFileSizeKB = +m[1] * (/mb|mib|میگا/.test(m[2]) ? 1024 : 1);
    p.compression = true;
    p.sizeMode = /exact(?:ly)?|بالکل|exakt|genau/.test(s) ? "exact" : "maximum";
    understood = true;
    const distinct = new Set(
      sizes.map((m) => +m[1] * (/mb|mib|میگا/.test(m[2]) ? 1024 : 1)),
    );
    if (
      distinct.size > 1 &&
      !/from|سے.*(?:تک|کم)|se.*(?:kam|neeche)|von/.test(s)
    )
      questions.push(
        "Which maximum file size should I use? Your message includes more than one size.",
      );
    if (p.sizeMode === "exact")
      questions.push(
        "Exact byte sizes cannot be guaranteed. Can I use this as a maximum size instead?",
      );
  }
  const formats = [...s.matchAll(/\b(jpe?g|png|webp|avif)\b/g)];
  if (formats.length) {
    const f = formats.at(-1)![1];
    p.format = f === "jpg" ? "jpeg" : (f as Plan["format"]);
    understood = true;
    if (
      formats.length > 1 &&
      /\b(?:and|aur|und)\b/.test(s) &&
      !/\b(?:from|se|von)\b/.test(s)
    )
      questions.push("Which single output format should I use for this batch?");
  }
  const noCrop =
    /no\s*crop|without\s*crop|don't\s*crop|do not crop|crop\s*(?:nahi|na|mat)|baghair.*crop|بغیر.*کاٹ|کاٹنا نہیں|ohne.*(?:zuschneid|beschnitt)|nicht.*zuschneid/.test(
      s,
    );
  const crop =
    /\bcrop\b|\bcover\b|zuschneiden|beschnitt|کاٹ/.test(s) && !noCrop;
  if (noCrop) {
    p.resizeMode = "contain";
    p.preserveAspectRatio = true;
    understood = true;
  } else if (crop) {
    p.resizeMode = "cover";
    p.preserveAspectRatio = true;
    understood = true;
  } else if (pair) {
    p.resizeMode = "contain";
    p.preserveAspectRatio = true;
  }
  if (/stretch|verzerren|کھینچ/.test(s)) {
    p.resizeMode = "fill";
    p.preserveAspectRatio = false;
    understood = true;
  }
  const ratio = s.match(/\b(\d{1,3}):(\d{1,3})\b/);
  if (ratio || /square|quadratisch|مربع/.test(s)) {
    p.aspectRatio = ratio ? `${ratio[1]}:${ratio[2]}` : "1:1";
    p.width = null;
    p.height = null;
    p.scalePercent = null;
    understood = true;
  }
  const color = s.match(/#[0-9a-f]{6}\b/);
  if (color || /white|saf[ae][ei]d|سفید|weiß|weiss/.test(s)) {
    p.background = color ? color[0].toUpperCase() : "#FFFFFF";
    if (/background|پس منظر|hintergrund/.test(s))
      p.preserveTransparency = false;
    understood = true;
  }
  if (/black\s*background|background\s*black|schwarz|سیاہ/.test(s)) {
    p.background = "#000000";
    understood = true;
  }
  if (/transparent|transparen[tz]|شفاف/.test(s)) {
    p.preserveTransparency = true;
    understood = true;
  }
  if (
    /compress|optimi[sz]e|smaller|kam\s*kar|کم|komprimier|verkleiner/.test(s)
  ) {
    p.compression = true;
    understood = true;
  }
  if (
    /maximum quality|best quality|high quality|optimize quality|höchste qualität/.test(
      s,
    )
  ) {
    p.quality = 95;
    p.qualityPreference = "high";
    understood = true;
  }
  if (/balanced|ausgewogen/.test(s)) {
    p.quality = 80;
    p.qualityPreference = "balanced";
    understood = true;
  }
  if (/maximum compression|smallest/.test(s)) {
    p.quality = 60;
    p.qualityPreference = "small";
    understood = true;
  }
  const q = s.match(/(?:quality|qualität)\s*(?:of|:|=)?\s*(\d{1,3})\s*%?/);
  if (q) {
    p.quality = +q[1];
    p.minQuality = Math.min(p.minQuality, p.quality);
    p.qualityPreference = "custom";
    understood = true;
  }
  if (
    /do not.*(?:reduce|change).*quality|without.*(?:reducing|changing).*quality|quality.*(?:nahi|mat)|qualität.*nicht/.test(
      s,
    )
  )
    p.minQuality = p.quality;
  if (
    /allow.*(?:smaller dimensions|dimension reduction)|dimensions.*(?:reduce|kam).*allowed/.test(
      s,
    )
  ) {
    p.allowDimensionReduction = true;
    understood = true;
  }
  if (
    /do not.*(?:reduce|change).*dimension|keep.*dimension|dimension.*(?:nahi|mat)/.test(
      s,
    )
  )
    p.allowDimensionReduction = false;
  if (/allow.*upscal|upscal.*allow/.test(s)) {
    p.allowUpscaling = true;
    understood = true;
  }
  if (/no.*upscal|without.*upscal|do not.*upscal/.test(s)) {
    p.allowUpscaling = false;
    understood = true;
  }
  if ((p.width || p.height) && p.unit !== "px" && !p.dpi)
    questions.push("What DPI should I use for these physical dimensions?");
  if (!understood)
    questions.push(
      "Please specify dimensions, a maximum file size, a format, or an aspect ratio—for example, “600x600 JPG under 100KB”.",
    );
  if (
    /same size|same dimensions|ek.*size|gleiche größe/.test(s) &&
    !pair &&
    !sizes.length
  )
    questions.push("What width and height should all images use?");
  return {
    plan: p,
    questions: [...new Set(questions)].slice(0, 3),
    message: questions.length
      ? "I need a little more information before changing your images."
      : "Your plan is ready. Review the settings, then generate your images.",
  };
}
