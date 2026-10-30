#!/usr/bin/env node
// CI-only consumer contract gate: the OS owns the sole source lock.
// No package manifest, validation contract or source lock is copied here.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve, join, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

export const SOURCE_PATHS = Object.freeze([
  "src/index.mjs",
  "src/contract-bindings.mjs",
  "src/intelligence/runtime.mjs",
  "src/intelligence/model-router.mjs",
  "src/local-ai/runtime.mjs",
  "src/local-ai/completion-stream.mjs",
  "src/local-ai/model-compatibility.mjs",
  "tools/inference-builder/build.py",
]);
const EXPECTED_PORTS = Object.freeze([
  "ordax.intelligence/1",
  "ordax.model-router/1",
  "ordax.local-ai/1",
]);
const SHA40 = /^[0-9a-f]{40}$/;
const LOCK_RELPATH = "docs/contracts/intelligence-source.json";
const DEFAULT_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_OS = join(DEFAULT_ROOT, "_upstream/ordax-os");

export function gitBlobSha(bytes) {
  const payload = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return createHash("sha1")
    .update(Buffer.from(`blob ${payload.byteLength}\0`, "utf8"))
    .update(payload)
    .digest("hex");
}

export function assertOsSourceLock(lock) {
  assert.ok(lock && typeof lock === "object" && !Array.isArray(lock),
    "OS source lock must be an object");
  assert.equal(lock.$schema, "prototype-ordax.intelligence-source/1");
  assert.equal(lock.source_repository, "ordaxsystems/ordax-intelligence");
  assert.match(lock.source_commit, SHA40);
  assert.ok(["integration-candidate", "canonical"].includes(lock.status),
    "Unrecognized OS source lock status");
  assert.equal(lock.materialization_target, "system/intelligence-source/src");
  assert.deepEqual(lock.public_ports, [...EXPECTED_PORTS],
    "Public ports changed without a coordinated contract revision");
  assert.equal(lock.source_only, true);
  assert.equal(lock.change_live_os, false);
  assert.equal(lock.model_bytes_included, false);
  assert.equal(lock.engine_bytes_included, false);
  // This source-only gate must never be interpreted as release authorization.
  assert.equal(lock.activation_authorized, false);
  assert.equal(lock.builder_activation_authorized, false);
  assert.equal(lock.builder_source_pinned, true);
  assert.equal(lock.cutover_complete, false);
  assert.ok(lock.source_paths && typeof lock.source_paths === "object"
    && !Array.isArray(lock.source_paths));
  assert.deepEqual(Object.keys(lock.source_paths).sort(), [...SOURCE_PATHS].sort(),
    "OS pinned source graph does not match the portable Intelligence source graph");
  for (const path of SOURCE_PATHS) assert.match(lock.source_paths[path], SHA40,
    `Missing exact Git blob hash for ${path}`);
  return lock;
}

function git(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function regularFileUnder(root, name) {
  assert.ok(!isAbsolute(name) && !name.split("/").includes(".."), "Unsafe relative path");
  const path = resolve(root, name);
  assert.ok(relative(root, path) && !relative(root, path).startsWith(".."),
    "Source escapes repository root");
  const parts = name.split("/");
  let target = root;
  for (const part of parts) {
    target = join(target, part);
    const info = lstatSync(target);
    assert.ok(!info.isSymbolicLink(), `Symlink forbidden in source: ${name}`);
    if (target === path) assert.ok(info.isFile(), `Source is not a file: ${name}`);
    else assert.ok(info.isDirectory(), `Source parent is not a directory: ${name}`);
  }
  return path;
}

export function verifyOsConsumerPin({ sourceRoot = DEFAULT_ROOT, osRoot = DEFAULT_OS } = {}) {
  sourceRoot = realpathSync(sourceRoot);
  osRoot = realpathSync(osRoot);
  assert.equal(git(sourceRoot, ["rev-parse", "--show-toplevel"]), sourceRoot,
    "Intelligence source root must be an exact Git checkout");
  assert.equal(git(osRoot, ["rev-parse", "--show-toplevel"]), osRoot,
    "OS contract source root must be an exact Git checkout");
  const lockFile = regularFileUnder(osRoot, LOCK_RELPATH);
  const bytes = readFileSync(lockFile);
  const committed = execFileSync("git",
    ["-C", osRoot, "show", `HEAD:${LOCK_RELPATH}`]);
  assert.ok(bytes.equals(committed), "OS source lock has uncommitted modifications");
  const lock = assertOsSourceLock(JSON.parse(bytes.toString("utf8")));

  // Verify the immutable tree the OS actually consumes. Comparing HEAD
  // working files against an earlier OS pin would incorrectly prohibit
  // independent Intelligence development before an OS lock promotion.
  // The current branch has its own CI and package/boundary tests.
  git(sourceRoot, ["cat-file", "-e", `${lock.source_commit}^{commit}`]);
  git(sourceRoot, ["merge-base", "--is-ancestor", lock.source_commit, "HEAD"]);

  for (const name of SOURCE_PATHS) {
    // Require a regular Git blob in the pinned commit (not a submodule or
    // symlink). -z also avoids trusting Git's quoted path presentation.
    const entry = execFileSync("git",
      ["-C", sourceRoot, "ls-tree", "-z", lock.source_commit, "--", name],
      { maxBuffer: 1024 * 1024 }).toString("utf8");
    const match = /^(100644|100755) blob ([0-9a-f]{40})\\t([^\\0]+)\\0$/.exec(entry);
    assert.ok(match && match[3] === name,
      `OS-pinned source is not a regular Git file: ${name}`);
    assert.equal(match[2], lock.source_paths[name],
      `OS-pinned commit tree disagrees with its blob contract: ${name}`);
    const payload = execFileSync("git",
      ["-C", sourceRoot, "cat-file", "blob", match[2]],
      { maxBuffer: 16 * 1024 * 1024 });
    assert.equal(gitBlobSha(payload), lock.source_paths[name],
      `OS-pinned source bytes differ from its blob contract: ${name}`);
  }
  return Object.freeze({
    sourceCommit: lock.source_commit,
    osCommit: git(osRoot, ["rev-parse", "HEAD"]),
    verifiedFiles: SOURCE_PATHS.length,
    status: lock.status,
    activationAuthorized: false,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const evidence = verifyOsConsumerPin();
    console.log("ORDAX_INTELLIGENCE_CONSUMER_PIN=PASS", JSON.stringify(evidence));
  } catch (error) {
    console.error("ORDAX_INTELLIGENCE_CONSUMER_PIN=FAIL", error.message);
    process.exitCode = 1;
  }
}
