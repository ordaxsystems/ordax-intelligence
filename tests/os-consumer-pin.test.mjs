import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assertOsSourceLock, gitBlobSha, SOURCE_PATHS, verifyOsConsumerPin } from "../scripts/verify-os-consumer-pin.mjs";

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

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}
function commit(root, message) {
  git(root, "add", ".");
  git(root, "-c", "user.email=ci@ordax.invalid", "-c", "user.name=OrdaX CI",
    "commit", "-q", "-m", message);
}
function committedPair(t) {
  const temporary = mkdtempSync(join(tmpdir(), "ordax-pin-proof-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const sourceRoot = join(temporary, "intelligence");
  const osRoot = join(temporary, "os");
  mkdirSync(sourceRoot);
  mkdirSync(osRoot);
  git(sourceRoot, "init", "-q");
  git(osRoot, "init", "-q");
  const blobs = {};
  for (const name of SOURCE_PATHS) {
    const bytes = Buffer.from("pinned portable source: " + name + "\n");
    const file = join(sourceRoot, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
    blobs[name] = gitBlobSha(bytes);
  }
  commit(sourceRoot, "immutable portable source");
  const lock = fixture();
  lock.source_commit = git(sourceRoot, "rev-parse", "HEAD");
  lock.source_paths = blobs;
  const lockFile = join(osRoot, "docs", "contracts", "intelligence-source.json");
  mkdirSync(dirname(lockFile), { recursive: true });
  writeFileSync(lockFile, JSON.stringify(lock) + "\n");
  commit(osRoot, "pin immutable Intelligence source");
  return { sourceRoot, osRoot, lock, lockFile };
}

test("OS consumer pin validates immutable ancestor while Intelligence HEAD evolves independently", t => {
  const { sourceRoot, osRoot, lock } = committedPair(t);
  const original = verifyOsConsumerPin({ sourceRoot, osRoot });
  assert.equal(original.sourceCommit, lock.source_commit);
  assert.equal(original.verifiedFiles, SOURCE_PATHS.length);
  assert.equal(original.activationAuthorized, false);

  // A new portable change is not an OS activation or a mutation of the
  // historical Git blob that the OS continues to consume.
  const changed = join(sourceRoot, SOURCE_PATHS[4]);
  writeFileSync(changed, "new candidate implementation from Intelligence HEAD\n");
  commit(sourceRoot, "evolve portable code independently of OS lock");
  assert.notEqual(git(sourceRoot, "rev-parse", "HEAD"), lock.source_commit);
  assert.equal(verifyOsConsumerPin({ sourceRoot, osRoot }).sourceCommit,
    lock.source_commit);
});

test("OS consumer pin fails closed on a committed mismatch in the pinned Git tree", t => {
  const { sourceRoot, osRoot, lock, lockFile } = committedPair(t);
  const bad = structuredClone(lock);
  bad.source_paths[SOURCE_PATHS[0]] = "f".repeat(40);
  writeFileSync(lockFile, JSON.stringify(bad) + "\n");
  commit(osRoot, "introduce invalid OS pin");
  assert.throws(() => verifyOsConsumerPin({ sourceRoot, osRoot }),
    /OS-pinned commit tree disagrees with its blob contract/);
});

test("OS consumer pin refuses uncommitted changes to the OS authority", t => {
  const { sourceRoot, osRoot, lockFile } = committedPair(t);
  const lock = JSON.parse(readFileSync(lockFile, "utf8"));
  writeFileSync(lockFile, JSON.stringify({ ...lock, status: "canonical" }) + "\n");
  assert.throws(() => verifyOsConsumerPin({ sourceRoot, osRoot }),
    /OS source lock has uncommitted modifications/);
});

test("OS consumer pin rejects a symlink even when its Git blob is pinned", { skip: process.platform === "win32" }, t => {
  const { sourceRoot, osRoot, lock, lockFile } = committedPair(t);
  const file = join(sourceRoot, SOURCE_PATHS[0]);
  unlinkSync(file);
  symlinkSync("contract-bindings.mjs", file);
  commit(sourceRoot, "replace source with symlink");
  const bad = structuredClone(lock);
  bad.source_commit = git(sourceRoot, "rev-parse", "HEAD");
  bad.source_paths[SOURCE_PATHS[0]] = gitBlobSha(Buffer.from("contract-bindings.mjs"));
  writeFileSync(lockFile, JSON.stringify(bad) + "\n");
  commit(osRoot, "pin unsafe source mode for regression");
  assert.throws(() => verifyOsConsumerPin({ sourceRoot, osRoot }),
    /OS-pinned source is not a regular Git file/);
});
