import { test } from "node:test";
import assert from "node:assert/strict";
import { planSchema, interpretationSchema } from "../lib/schema.ts";
import { defaultPlan } from "../lib/plan.ts";
test("schema rejects unknown model instructions and invalid numeric settings", () => {
  assert.equal(planSchema.safeParse(defaultPlan).success, true);
  for (const patch of [
    { width: -1 },
    { width: 999999 },
    { format: "svg" },
    { background: "url(/etc/passwd)" },
    { quality: 101 },
    { execute: "rm -rf" },
    { aspectRatio: "0:0" },
    { minQuality: 99 },
    { width: 35, unit: "mm", dpi: null },
  ])
    assert.equal(
      planSchema.safeParse({ ...defaultPlan, ...patch }).success,
      false,
    );
});
test("structured AI output must have only a plan, message and bounded questions", () => {
  assert.equal(
    interpretationSchema.safeParse({
      plan: defaultPlan,
      message: "Ready",
      questions: [],
    }).success,
    true,
  );
  assert.equal(
    interpretationSchema.safeParse({
      plan: defaultPlan,
      message: "Ready",
      questions: [],
      shell: "echo",
    }).success,
    false,
  );
  assert.equal(
    interpretationSchema.safeParse({
      plan: defaultPlan,
      message: "Ready",
      questions: ["a", "b", "c", "d"],
    }).success,
    false,
  );
});
