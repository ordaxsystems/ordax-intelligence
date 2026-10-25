// Regression adapted from ordax-os/tests/test_local_ai_response_lifecycle.mjs @ c07ec6082dd4ea08bd5fa06c12ba812f74cbf12e
import assert from "node:assert/strict";
import test from "node:test";

import { createLocalAiRuntime } from "./runtime-adapter.mjs";

function cancellableResponse(status, onCancel) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("unused"));
    },
    cancel() {
      onCancel();
    },
  });
  return new Response(stream, { status });
}

test("Local AI health probe cancels an unused response body", async () => {
  let cancelled = 0;
  const runtime = createLocalAiRuntime({
    modelId: "ordax-small",
    fetchImpl: async (url) => {
      if (!url.endsWith("/health")) throw new Error("unexpected request");
      return cancellableResponse(200, () => { cancelled += 1; });
    },
  });

  const snapshot = await runtime.probe();
  assert.equal(snapshot.state, "ready");
  assert.equal(cancelled, 1);
});

test("Local AI cancels a non-OK completion body before health revalidation", async () => {
  let healthCalls = 0;
  let cancelled = 0;
  const runtime = createLocalAiRuntime({
    modelId: "ordax-small",
    fetchImpl: async (url) => {
      if (url.endsWith("/health")) {
        healthCalls += 1;
        return { ok: true };
      }
      if (url.endsWith("/v1/chat/completions")) {
        return cancellableResponse(500, () => { cancelled += 1; });
      }
      throw new Error("unexpected request");
    },
  });

  await runtime.probe();
  await assert.rejects(
    () => runtime.generate({ prompt: "teste" }),
    /HTTP 500/,
  );
  assert.equal(cancelled, 1);
  assert.equal(healthCalls, 2);
  assert.equal(runtime.getSnapshot().state, "ready");
});
