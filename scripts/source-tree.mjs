// Shared, fail-closed source walker for CI checks and unsigned-source packaging.
// This is not the OS source lock or a second artifact authority.
import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function requireRegularPath(path, kind) {
  const info = lstatSync(path);
  if (info.isSymbolicLink() ||
      !(kind === "directory" ? info.isDirectory() : kind === "file" && info.isFile())) {
    throw new Error(`Non-regular ${kind} forbidden in source handoff: ${path}`);
  }
}

export function collectPortableSourceFiles(root = "src") {
  const files = [];
  function visit(directory) {
    // In particular, the root itself must never be a symlink. A recursive
    // readdirSync(root) would otherwise silently follow an external tree.
    requireRegularPath(directory, "directory");
    for (const item of readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      const path = join(directory, item.name);
      if (item.isSymbolicLink()) {
        throw new Error("Source package refuses symbolic links: " + path);
      }
      if (item.isDirectory()) visit(path);
      else if (item.isFile() && path.endsWith(".mjs")) {
        files.push(path.replaceAll("\\", "/"));
      }
    }
  }
  visit(root);
  if (files.length === 0) throw new Error("Portable source tree contains no modules");
  return files;
}
