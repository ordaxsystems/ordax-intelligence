// Regression adapted from ordax-os/tests/test_local_ai_probe_races.mjs @ 33aa6a14e1ae968229972be849025a44e0cae8f3
import assert from "node:assert/strict";
import test from "node:test";

import { createLocalAiRuntime } from "./runtime-adapter.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

test("an older health probe cannot publish ready over an active generation", async () => {
  const staleProbeResponse = deferred();
  const completion = deferred();
  let healthCalls = 0;

  const runtime = createLocalAiRuntime({
    modelId: "ordax-small",
    fetchImpl: async (url) => {
      if (url.endsWith("/health")) {
        healthCalls += 1;
        if (healthCalls === 1) return { ok: true };
        if (healthCalls === 2) return staleProbeResponse.promise;
        throw new Error("unexpected health request");
      }
      if (url.endsWith("/v1/chat/completions")) {
        await completion.promise;
        return {
          ok: true,
          async json() {
            return { choices: [{ message: { content: "ok" } }] };
          },
        };
      }
      throw new Error("unexpected request");
    },
  });

  await runtime.probe();
  assert.equal(runtime.getSnapshot().state, "ready");

  const staleProbe = runtime.probe();
  await Promise.resolve();
  assert.equal(healthCalls, 2);

  const generation = runtime.generate({ prompt: "primeira" });
  await Promise.resolve();
  assert.equal(runtime.getSnapshot().state, "busy");

  staleProbeResponse.resolve({ ok: true });
  await staleProbe;
  assert.equal(runtime.getSnapshot().state, "busy");
  await assert.rejects(
    () => runtime.generate({ prompt: "não deve concorrer" }),
    /not ready/,
  );

  completion.resolve();
  await generation;
  assert.equal(runtime.getSnapshot().state, "ready");
});

test("only the newest concurrent probe may publish health state", async () => {
  const older = deferred();
  const newer = deferred();
  let healthCalls = 0;

  const runtime = createLocalAiRuntime({
    modelId: "ordax-small",
    fetchImpl: async (url) => {
      if (!url.endsWith("/health")) throw new Error("unexpected request");
      healthCalls += 1;
      if (healthCalls === 1) return { ok: true };
      if (healthCalls === 2) return older.promise;
      if (healthCalls === 3) return newer.promise;
      throw new Error("unexpected health request");
    },
  });

  await runtime.probe();
  assert.equal(runtime.getSnapshot().state, "ready");

  const olderProbe = runtime.probe();
  await Promise.resolve();
  const newerProbe = runtime.probe();
  await Promise.resolve();
  assert.equal(healthCalls, 3);

  newer.resolve({ ok: false });
  await newerProbe;
  assert.equal(runtime.getSnapshot().state, "error");

  older.resolve({ ok: true });
  await olderProbe;
  assert.equal(runtime.getSnapshot().state, "error");
});
