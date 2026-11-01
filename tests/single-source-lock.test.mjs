import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, unlinkSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const checker = fileURLToPath(new URL("../scripts/check-boundaries.mjs", import.meta.url));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "ordax-single-lock-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src", "portable.mjs"), "export const portable = true;\n");
  return root;
}

function check(root) {
  return spawnSync(process.execPath, [checker], { cwd: root, encoding: "utf8" });
}

function put(root, path) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, "{}\n");
  return full;
}

test("source boundary accepts a single external OS authority, not an in-repo lock", t => {
  const root = fixture(t);
  // The upstream OS checkout and output metadata are explicitly not competing
  // source owners; they must not make a correct Intelligence checkout fail.
  put(root, "_upstream/ordax-os/docs/contracts/intelligence-source.json");
  put(root, "_upstream/ordax-os/system/services/local-ai/source-lock.json");
  put(root, "dist/runtime/metadata/source-lock.json");
  const result = check(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Verified 1 portable module/);
});

test("source boundary refuses any first-party duplicate lock", t => {
  const root = fixture(t);
  for (const path of [
    "docs/source-lock.json",
    "src/local-ai/source-lock.json",
    "tools/inference-builder/source-lock.json",
    "scripts/source-lock.json",
    "source-lock.json",
  ]) {
    const file = put(root, path);
    const result = check(root);
    assert.notEqual(result.status, 0, path + " must fail closed");
    assert.match(result.stderr, /Secondary source lock forbidden/);
    unlinkSync(file);
  }
  assert.equal(check(root).status, 0);
});


test("source boundary rejects symlinked source root and nested directories", { skip: process.platform === "win32" }, t => {
  const root = fixture(t);
  const external = join(root, "external");
  mkdirSync(external);
  writeFileSync(join(external, "injected.mjs"), "import 'node:fs';\n");

  const nested = join(root, "src", "nested");
  symlinkSync("../external", nested, "dir");
  let result = check(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source package refuses symbolic links/);
  unlinkSync(nested);

  rmSync(join(root, "src"), { recursive: true });
  symlinkSync("external", join(root, "src"), "dir");
  result = check(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Non-regular directory forbidden.*src/);
});

test("source boundary rejects an empty or missing source tree", t => {
  const root = fixture(t);
  unlinkSync(join(root, "src", "portable.mjs"));
  assert.match(check(root).stderr, /Portable source tree contains no modules/);
  rmSync(join(root, "src"), { recursive: true });
  const result = check(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ENOENT/);
});
