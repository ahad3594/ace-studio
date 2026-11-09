import { test } from "node:test";
import assert from "node:assert/strict";
import { boundedBody, guard, acquire } from "../lib/server.ts";
test("bounded streaming rejects oversized requests and cross-origin requests", async () => {
  await assert.rejects(
    () =>
      boundedBody(
        new Request("http://localhost/api", {
          method: "POST",
          body: "1234567",
        }),
        5,
      ),
    /upload limit/,
  );
  assert.throws(
    () =>
      guard(
        new Request("http://localhost/api", {
          headers: { origin: "https://evil.example" },
        }),
        "ai",
      ),
    /Cross-origin/,
  );
});
test("concurrency limit rejects excess work and releases permits", () => {
  const a = acquire(),
    b = acquire();
  assert.throws(() => acquire(), /busy/);
  a();
  const c = acquire();
  c();
  b();
});
test("origin validation uses the browser-facing Host when the standalone bind address differs", () => {
  assert.doesNotThrow(() =>
    guard(
      new Request("http://0.0.0.0:3000/api/metadata", {
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      }),
      "metadata",
    ),
  );
  assert.throws(
    () =>
      guard(
        new Request("http://0.0.0.0:3000/api/metadata", {
          headers: {
            host: "127.0.0.1:3000",
            origin: "http://attacker.example",
          },
        }),
        "metadata",
      ),
    /Cross-origin/,
  );
});
