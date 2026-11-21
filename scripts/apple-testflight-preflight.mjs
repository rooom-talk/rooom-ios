import assert from 'node:assert/strict';
import {sign} from 'node:crypto';
import fs from 'node:fs';
const env=process.env;
import {checkTest2Version,test2Version} from './testflight-version-policy.mjs';
const key=(env.APP_STORE_CONNECT_PRIVATE_KEY||'').replace(/\\n/g,'\n');
assert.ok(key.includes('BEGIN PRIVATE KEY'),'STOP: App Store Connect private key unavailable');
assert.ok(env.APP_STORE_CONNECT_KEY_ID && env.APP_STORE_CONNECT_ISSUER_ID,'STOP: App Store Connect key metadata unavailable');
const base64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const issued=Math.floor(Date.now()/1000);
const input=base64({alg:'ES256',kid:env.APP_STORE_CONNECT_KEY_ID,typ:'JWT'})+'.'+base64({iss:env.APP_STORE_CONNECT_ISSUER_ID,iat:issued,exp:issued+900,aud:'appstoreconnect-v1'});
const signature=sign('sha256',Buffer.from(input),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
const token=input+'.'+signature;
async function api(path){
  const res=await fetch('https://api.appstoreconnect.apple.com'+path,{headers:{Authorization:'Bearer '+token}});
  if(!res.ok){const error=Error('STOP: Apple build lookup HTTP '+res.status);error.status=res.status;throw error;}
  return res.json();
}
// App Store ID published by Apple for RoooM Talk, not an ad provider ID.
// Read the exact app, then fail closed unless the response identifies our bundle.
// An empty filtered /v1/apps result previously stopped this workflow unnecessarily.
const expectedAppId='6800222762';
const expectedBundleId='com.rooom.talk';
const app=await api('/v1/apps/'+expectedAppId);
assert.equal(String(app.data?.id),expectedAppId,'STOP: unexpected Apple App Store app ID');
assert.equal(app.data?.attributes?.bundleId,expectedBundleId,
  'STOP: Apple app does not match RoooM bundle ID');
const appId=expectedAppId;
if(process.argv.includes('--apply-test2-export')){
 assert.equal(env.TARGET_ENV,'test2');assert.equal(env.ROOOM_TESTFLIGHT_BUILD_NUMBER,'100079');
 const {applyApprovedDeclaration,declarationApproval}=await import('./test2-export-declaration.mjs');
 assert.equal(env.ROOOM_TEST2_EXPORT_APPROVAL,declarationApproval);
 const patch=async(id,body)=>{
  assert.match(id,/^[A-Za-z0-9-]{1,128}$/);assert.deepEqual(body,{data:{type:'builds',id,attributes:{usesNonExemptEncryption:false}}});
  const res=await fetch('https://api.appstoreconnect.apple.com/v1/builds/'+encodeURIComponent(id),{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok){const error=Error('Apple exact TEST2 declaration PATCH HTTP '+res.status);error.status=res.status;throw error;}
 };
 const operation=await applyApprovedDeclaration(api,patch,{environment:env.TARGET_ENV,build:env.ROOOM_TESTFLIGHT_BUILD_NUMBER,approval:env.ROOOM_TEST2_EXPORT_APPROVAL,mode:'apply'});
 console.log('APPLE APPROVED TEST2 DECLARATION '+JSON.stringify(operation));
 const {readTest2BuildStatus}=await import('./testflight-status-policy.mjs');let status;
 for(let attempt=0;attempt<12;attempt++){
  status=await readTest2BuildStatus(api,{version:test2Version,build:'100079'});console.log('APPLE TEST2 STATUS '+JSON.stringify(status));
  if(env.ROOOM_APPLE_STATUS_REPORT)fs.writeFileSync(env.ROOOM_APPLE_STATUS_REPORT,JSON.stringify({...status,declarationOperation:operation},null,2)+'\n');
  if(status.availableToInternalTesters||!['PROCESSING','MISSING_EXPORT_COMPLIANCE','READY_FOR_BETA_TESTING'].includes(status.internalBuildState))break;
  if(attempt<11)await new Promise(resolve=>setTimeout(resolve,10000));
 }
 process.exit(0);
}
if(process.argv.includes('--status-only')||process.argv.includes('--status-wait')){
 assert.equal(env.TARGET_ENV,'test2','Status mode is TEST2 only');
 const {readTest2BuildStatus}=await import('./testflight-status-policy.mjs');
 const wait=process.argv.includes('--status-wait');let result;
 for(let attempt=0;attempt<(wait?24:1);attempt++){
  result=await readTest2BuildStatus(api,{version:env.ROOOM_MARKETING_VERSION||test2Version,build:env.ROOOM_TESTFLIGHT_BUILD_NUMBER});
  console.log('APPLE TEST2 STATUS '+JSON.stringify(result));
  if(env.ROOOM_APPLE_STATUS_REPORT)fs.writeFileSync(env.ROOOM_APPLE_STATUS_REPORT,JSON.stringify(result,null,2)+'\n');
  if(result.complete||!wait)break;await new Promise(resolve=>setTimeout(resolve,20000));
 }
 assert(!['FAILED','INVALID'].includes(result.processingState),'Apple processing rejected uploaded build');
 process.exit(0);
}
if(env.TARGET_ENV==='test2'){const version=await checkTest2Version(api);if(env.GITHUB_ENV)fs.appendFileSync(env.GITHUB_ENV,'ROOOM_MARKETING_VERSION='+version+'\n');console.log('TEST2 fresh marketing version eligibility PASS: '+version);}
if(process.argv.includes('--version-only')){assert.equal(env.TARGET_ENV,'test2');process.exit(0);}
let link='/v1/apps/'+encodeURIComponent(appId)+'/builds?limit=200';
let max=0, pages=0;
while(link){
  assert.ok(++pages<=30,'STOP: Apple build listing exceeds 30 pages; manual reconciliation needed');
  const data=await api(link.startsWith('https:') ? new URL(link).pathname+new URL(link).search : link);
  for(const b of data.data||[]){const v=Number(b.attributes?.version);if(Number.isSafeInteger(v))max=Math.max(max,v);}
  link=data.links?.next||null;
}
const proposed=100000+Number(env.GITHUB_RUN_NUMBER);
assert.ok(Number.isSafeInteger(proposed)&&proposed>max,'STOP: computed build number '+proposed+' is not greater than Apple latest '+max);
fs.appendFileSync(env.GITHUB_ENV,'ROOOM_TESTFLIGHT_BUILD_NUMBER='+proposed+'\n');
console.log('Apple build version preflight PASS: previous maximum '+max+', candidate '+proposed);
