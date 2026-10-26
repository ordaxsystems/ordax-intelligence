// A real Fetch consumer must not require cooperation from an adapter that
// ignores AbortSignal while opening headers or streaming buffered JSON.
import assert from "node:assert/strict";
import test from "node:test";
import { createLocalAiRuntime } from "./runtime-adapter.mjs";

const never = () => new Promise(() => {});

function timeoutRace(promise, label) {
  // Finite regression watchdog, independent of the runtime under test.
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(
      () => reject(new Error("regression: " + label + " did not settle")), 1500,
    )),
  ]);
}

test("model discovery never hangs if HTTP adapter ignores signal before headers", { timeout: 2500 }, async () => {
  const runtime = createLocalAiRuntime({
    modelId: null,
    probeTimeoutMs: 100,
    fetchImpl: () => never(),
  });
  try {
    const snapshot = await timeoutRace(runtime.probe(), "probe");
    assert.equal(snapshot.state, "unavailable");
    assert.equal(snapshot.modelId, null);
    assert.equal(snapshot.offline, true);
  } finally {
    runtime.dispose();
  }
});

test("buffered JSON read never hangs if reader ignores abort and cancel never resolves", { timeout: 2500 }, async () => {
  let cancelCalls = 0;
  let healthCalls = 0;
  let releaseCalls = 0;
  const runtime = createLocalAiRuntime({
    modelId: "fixture-model",
    inferenceTimeoutMs: 100,
    fetchImpl: async (url) => {
      if (url.endsWith("/health")) {
        healthCalls += 1;
        return { ok: true };
      }
      return {
        ok: true,
        headers: { get: () => null },
        body: {
          getReader() {
            return {
              read: () => never(),
              cancel() { cancelCalls += 1; return never(); },
              releaseLock() { releaseCalls += 1; },
            };
          },
        },
      };
    },
  });
  try {
    await runtime.probe();
    assert.equal(runtime.getSnapshot().state, "ready");
    await assert.rejects(
      () => timeoutRace(runtime.generate({ prompt: "noncooperative reader" }), "buffered body"),
      /timed out after 100ms/,
    );
    assert.ok(cancelCalls >= 1, "the transport must attempt cancellation without awaiting it");
    assert.equal(runtime.getSnapshot().state, "ready");
    assert.ok(healthCalls >= 2, "post-failure revalidation remains usable");
    assert.ok(releaseCalls >= 0);
  } finally {
    runtime.dispose();
  }
});

test("legacy json-only test adapter cannot bypass inference deadline", { timeout: 2500 }, async () => {
  const runtime = createLocalAiRuntime({
    modelId: "fixture-model",
    inferenceTimeoutMs: 100,
    fetchImpl: async (url) => url.endsWith("/health")
      ? { ok: true }
      : { ok: true, json: () => never() },
  });
  try {
    await runtime.probe();
    await assert.rejects(
      () => timeoutRace(runtime.generate({ prompt: "hanging test-double json" }), "json fallback"),
      /timed out after 100ms/,
    );
    assert.equal(runtime.getSnapshot().state, "ready");
  } finally {
    runtime.dispose();
  }
});

test("dispose releases pending inference even when headers never settle", { timeout: 2500 }, async () => {
  let inferenceStarted;
  const started = new Promise(resolve => { inferenceStarted = resolve; });
  const runtime = createLocalAiRuntime({
    modelId: "fixture-model",
    fetchImpl: async (url) => {
      if (url.endsWith("/health")) return { ok: true };
      inferenceStarted();
      return never();
    },
  });
  await runtime.probe();
  const active = runtime.generate({ prompt: "never returning headers" });
  await started;
  runtime.dispose();
  await assert.rejects(() => timeoutRace(active, "dispose"), /disposed/);
});

test("caller cancellation releases a noncooperative buffered body without approving text", { timeout: 2500 }, async () => {
  const controller = new AbortController();
  const runtime = createLocalAiRuntime({
    modelId: "fixture-model",
    fetchImpl: async (url) => url.endsWith("/health") ? { ok: true } : {
      ok: true,
      headers: { get: () => null },
      body: { getReader() { return { read: never, cancel: never, releaseLock() {} }; } },
    },
  });
  try {
    await runtime.probe();
    const active = runtime.generate({ prompt: "cancel request" }, { signal: controller.signal });
    // Allow the buffered body reader to start; cancel must win regardless.
    await Promise.resolve();
    controller.abort();
    await assert.rejects(() => timeoutRace(active, "caller cancellation"), /cancelled/);
  } finally {
    runtime.dispose();
  }
});
