import JSZip from "jszip";
export function safeFilename(
  name: string,
  format: string,
  index = 0,
  pattern = "{name}_processed",
) {
  const stem =
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[^\p{L}\p{N}_-]+/gu, "_")
      .replace(/^[_\-.]+/, "")
      .slice(0, 90) || "image";
  const base =
    pattern
      .replaceAll("{name}", stem)
      .replaceAll("{index}", String(index + 1))
      .replace(/[^\p{L}\p{N}_-]+/gu, "_")
      .slice(0, 110) || stem;
  return `${base}.${format === "jpeg" ? "jpg" : format}`;
}
export function uniqueFilename(name: string, used: Set<string>) {
  let result = name,
    i = 2;
  while (used.has(result.toLowerCase()))
    result = name.replace(/(\.[^.]+)$/, `_${i++}$1`);
  used.add(result.toLowerCase());
  return result;
}
export async function createZip(
  items: { name: string; data: Blob | Uint8Array | ArrayBuffer }[],
) {
  const zip = new JSZip(),
    used = new Set<string>();
  for (const item of items)
    zip.file(
      uniqueFilename(item.name, used),
      item.data instanceof Blob ? await item.data.arrayBuffer() : item.data,
    );
  return zip.generateAsync({ type: "uint8array", compression: "STORE" });
}
