import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const files = [];
function visit(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (target.endsWith(".mjs")) files.push(target);
  }
}
visit("src");
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const executable = source.split("\n").filter(line => !line.trimStart().startsWith("// Source:")).join("\n");
  for (const forbidden of ["../../contracts/", "system/services/", "system/contracts/", "node:fs", "node:net", "node:child_process"]) {
    if (executable.includes(forbidden)) throw new Error(`Forbidden private import in ${file}: ${forbidden}`);
  }
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}
console.log(`Verified ${files.length} portable module(s)`);
