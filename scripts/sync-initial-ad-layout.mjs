// Generate/check the fresh-install seed from the Web owner, without any build.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [webRoot,mode='--check']=process.argv.slice(2);
assert.ok(webRoot&&['--check','--write'].includes(mode),'Provide Web checkout and --check or --write');
assert.match(execFileSync('git',['-C',webRoot,'remote','get-url','origin'],{encoding:'utf8'}).trim(),/^https:\/\/github\.com\/rooom-talk\/rooom-app.git$/);
const {monetizationConfig}=await import(pathToFileURL(path.resolve(webRoot,'src/features/ads/monetization-config.mjs')));
const text=JSON.stringify(monetizationConfig,null,2)+'\n';
const file=path.join(root,'public/rooom-initial-ad-layout.json');
if(mode==='--write')fs.writeFileSync(file,text);
else assert.equal(fs.readFileSync(file,'utf8'),text,'Initial geometry seed differs from the Web owner');
console.log('Initial layout snapshot matches Web configuration. No build, SDK request or deployment.');
