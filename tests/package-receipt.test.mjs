import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/package.mjs", import.meta.url));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "ordax-source-package-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "test.0" }) + "\n");
  writeFileSync(join(root, "src", "example.mjs"), "export const example = true;\n");
  return root;
}

function run(root, ...args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
}

test("source handoff accepts only the byte-identical canonical provenance receipt", t => {
  const root = fixture(t);
  const build = run(root);
  assert.equal(build.status, 0, build.stderr);
  const receiptPath = join(root, "dist", "receipt.json");
  const original = readFileSync(receiptPath);
  assert.equal(run(root, "--verify").status, 0);

  for (const mutation of [
    value => { value.activationAuthorized = true; },
    value => { value.modelIncluded = true; },
    value => { value.engineIncluded = true; },
    value => { value.kind = "signed-source"; },
    value => { value.archive = "different.tar"; },
    value => { value.sha256 = "0".repeat(64); },
    value => { value.size += 1; },
    value => { value.unreviewedFlag = false; },
  ]) {
    const changed = JSON.parse(original.toString("utf8"));
    mutation(changed);
    writeFileSync(receiptPath, JSON.stringify(changed, null, 2) + "\n");
    const result = run(root, "--verify");
    assert.notEqual(result.status, 0, "Altered receipt must be rejected");
    assert.match(result.stderr, /provenance receipt is not reproducible/);
  }
  // Even rewriting the same JSON with a different byte representation is not
  // the canonical source-only handoff that the verifier originally produced.
  writeFileSync(receiptPath, JSON.stringify(JSON.parse(original.toString("utf8"))) + "\n");
  assert.notEqual(run(root, "--verify").status, 0);

  writeFileSync(receiptPath, original);
  assert.equal(run(root, "--verify").status, 0);
});

test("source handoff verification rejects tampered archive and modified inputs", t => {
  const root = fixture(t);
  assert.equal(run(root).status, 0);
  const archive = join(root, "dist", "ordax-intelligence-source-test.0.tar");
  const original = readFileSync(archive);
  const altered = Buffer.from(original);
  altered[0] ^= 1;
  writeFileSync(archive, altered);
  assert.notEqual(run(root, "--verify").status, 0);

  writeFileSync(archive, original);
  writeFileSync(join(root, "src", "example.mjs"), "export const example = false;\n");
  assert.notEqual(run(root, "--verify").status, 0);
});

test("source handoff refuses symlinks rather than silently omitting them", { skip: process.platform === "win32" }, t => {
  const root = fixture(t);
  symlinkSync("example.mjs", join(root, "src", "shadow.mjs"));
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source package refuses symbolic links/);
});
