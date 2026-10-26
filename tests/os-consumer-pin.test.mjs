import assert from "node:assert/strict";
import test from "node:test";
import { assertOsSourceLock, gitBlobSha, SOURCE_PATHS } from "../scripts/verify-os-consumer-pin.mjs";

function fixture() {
  return {
    $schema: "prototype-ordax.intelligence-source/1",
    status: "integration-candidate",
    source_repository: "ordaxsystems/ordax-intelligence",
    source_commit: "a".repeat(40),
    source_paths: Object.fromEntries(SOURCE_PATHS.map(path => [path, "b".repeat(40)])),
    materialization_target: "system/intelligence-source/src",
    public_ports: ["ordax.intelligence/1", "ordax.model-router/1", "ordax.local-ai/1"],
    source_only: true, change_live_os: false,
    activation_authorized: false, model_bytes_included: false,
    engine_bytes_included: false, builder_source_pinned: true,
    builder_activation_authorized: false, cutover_complete: false,
  };
}

test("OS canonical source lock shape and public ports are accepted without duplicating validators", () => {
  const lock = fixture();
  assert.equal(assertOsSourceLock(lock), lock);
  assert.equal(SOURCE_PATHS.length, 8);
});

test("the Git blob digest uses Git header, including binary-safe byte length", () => {
  assert.equal(gitBlobSha(Buffer.from("hello\n")), "ce013625030ba8dba906f756967f9e9ca394464a");
  assert.notEqual(gitBlobSha(Buffer.from("hello")), gitBlobSha(Buffer.from("hello\n")));
  assert.notEqual(gitBlobSha(Buffer.from("á", "utf8")), gitBlobSha(Buffer.from("a", "utf8")));
});

test("the lock rejects source graph omissions, additions and hash drift", () => {
  for (const change of [
    lock => { delete lock.source_paths[SOURCE_PATHS[0]]; },
    lock => { lock.source_paths["src/mirror.mjs"] = "d".repeat(40); },
    lock => { lock.source_paths[SOURCE_PATHS[0]] = "mutable"; },
    lock => { lock.source_commit = "HEAD"; },
    lock => { lock.materialization_target = "system/services/intelligence"; },
  ]) {
    const lock = fixture();
    change(lock);
    assert.throws(() => assertOsSourceLock(lock));
  }
});

test("no contract change or activation can silently pass a source-only CI gate", () => {
  for (const change of [
    lock => { lock.public_ports[0] = "ordax.intelligence/2"; },
    lock => { lock.public_ports.push("ordax.new-provider/1"); },
    lock => { lock.status = "unreviewed"; },
    lock => { lock.activation_authorized = true; },
    lock => { lock.builder_activation_authorized = true; },
    lock => { lock.cutover_complete = true; },
    lock => { lock.model_bytes_included = true; },
    lock => { lock.source_only = false; },
    lock => { lock.change_live_os = true; },
  ]) {
    const lock = fixture();
    change(lock);
    assert.throws(() => assertOsSourceLock(lock));
  }
});
