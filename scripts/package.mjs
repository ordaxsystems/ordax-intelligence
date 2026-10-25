// Deterministic, unsigned source-only handoff archive. Activation is exclusively OS-owned.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { createHash } from "node:crypto";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const pkg = JSON.parse(readFileSync("package.json","utf8"));
const files = [];
function visit(directory) {
 for (const item of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,"en"))) {
  const path=join(directory,item.name);
  if (item.isDirectory()) visit(path);
  else if(item.isFile() && path.endsWith(".mjs")) files.push(path.replaceAll("\\","/"));
 }
}
visit("src");
const members=files.map(path=>({path,body:readFileSync(path)}));
members.push({path:"package.json",body:readFileSync("package.json")});
const manifest={schema:"ordax.intelligence-artifact/1",kind:"unsigned-source-handoff",version:pkg.version,contracts:"OS-injected",engineIncluded:false,modelIncluded:false,activated:false,files:members.map(({path,body})=>({path,size:body.length,sha256:sha256(body)}))};
const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+"\n");
members.push({path:"manifest.json",body:manifestBytes});
function tarHeader(name,length){
  const buf=Buffer.alloc(512);
  const str=(offset,width,value)=>buf.write(value,offset,Math.min(width,Buffer.byteLength(value)),"ascii");
  const oct=(offset,width,n)=>str(offset,width,n.toString(8).padStart(width-1,"0")+"\0");
  if(Buffer.byteLength(name)>100)throw Error("tar member too long");
  str(0,100,name);oct(100,8,0o644);oct(108,8,0);oct(116,8,0);oct(124,12,length);oct(136,12,0);
  buf.fill(32,148,156);str(156,1,"0");str(257,6,"ustar\0");str(263,2,"00");
  const sum=buf.reduce((n,b)=>n+b,0);oct(148,8,sum);
  return buf;
}
const blocks=[];
for(const {path,body} of members){
  blocks.push(tarHeader(path,body.length),body,Buffer.alloc((512-body.length%512)%512));
}
blocks.push(Buffer.alloc(1024));
const artifact=Buffer.concat(blocks);
const receipt={schema:"ordax.intelligence-build-receipt/1",kind:"unsigned-source-handoff",archive:"ordax-intelligence-source-"+pkg.version+".tar",sha256:sha256(artifact),size:artifact.length,modelIncluded:false,engineIncluded:false,activationAuthorized:false};
mkdirSync("dist",{recursive:true});
const dest=join("dist",receipt.archive),receiptPath=join("dist","receipt.json");
if(process.argv.includes("--verify")){
  const old=readFileSync(dest);
  const prior=JSON.parse(readFileSync(receiptPath,"utf8"));
  if(!old.equals(artifact)||prior.sha256!==receipt.sha256||prior.size!==receipt.size){throw Error("Source artifact is not reproducible");}
  console.log("Verified identical bytes:",receipt.sha256);
}else{
  writeFileSync(dest,artifact);writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+"\n");
  console.log("Built unsigned source handoff:",receipt.sha256);
}
