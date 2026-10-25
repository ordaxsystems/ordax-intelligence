import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const files = [];
function visit(directory) { for (const ent of readdirSync(directory, { withFileTypes:true })) {
  const name=join(directory, ent.name);
  if(ent.isDirectory()) visit(name);
  else if(name.endsWith(".mjs")) files.push(name);
}}
visit("src");
for(const file of files) {
  const text=readFileSync(file,"utf8");
  if (/from\\s*['"](?:\\.\\.\\/){2}|system\\/(?:contracts|services)|from\\s*['"](?:node:)?(?:child_process|fs)/.test(text)) {
    throw new Error(`Forbidden OS-private or privileged import in ${file}`);
  }
  execFileSync(process.execPath,["--check",file],{stdio:"inherit"});
}
console.log(`Verified ${files.length} portable module(s)`);
