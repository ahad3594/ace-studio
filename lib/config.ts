function integer(name: string, fallback: number, max: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}
export const limits = {
  maxImages: integer("MAX_IMAGES", 20, 100),
  maxBytes: integer("MAX_FILE_MB", 20, 100) * 1024 * 1024,
  inputPixels: integer("MAX_INPUT_PIXELS", 40_000_000, 100_000_000),
  outputPixels: integer("MAX_OUTPUT_PIXELS", 24_000_000, 100_000_000),
  concurrency: integer("PROCESS_CONCURRENCY", 2, 4),
  aiRate: integer("AI_REQUESTS_PER_MINUTE", 20, 1000),
  processRate: integer("PROCESS_REQUESTS_PER_MINUTE", 60, 1000),
};
