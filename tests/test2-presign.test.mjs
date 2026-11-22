import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import cp from 'node:child_process';
import {verifyStage,main} from '../scripts/test2-presign.mjs';
const workflow=fs.readFileSync('.github/workflows/main.yml','utf8').replaceAll('\r\n','\n');
const swift=fs.readFileSync('scripts/test2-presign.swift','utf8');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function step(name){const start=workflow.indexOf('      - name: '+name+'\n');assert(start>=0,name);const next=workflow.indexOf('\n      - name:',start+1);return workflow.slice(start,next<0?undefined:next);}
test('TEST2-only gate follows Apple live preflight and precedes identity installation/archive',()=>{
 const names=['Verify new TestFlight build number against App Store Connect','Verify TEST2 signing materials before any signing','Install only the prevalidated TEST2 signing identity','Create archive','Verify archived TEST2 endpoint, version and PR24 presentation mode','Create ExportOptions.plist','Export IPA','Upload TestFlight processing candidate to App Store Connect (NOT app review)'];
 const indexes=names.map(n=>workflow.indexOf('      - name: '+n+'\n'));assert(indexes.every(n=>n>=0));assert(indexes.every((n,i)=>i===0||n>indexes[i-1]));
 const gate=step(names[1]);assert.match(gate,/if: inputs.target_environment == 'test2'/);assert.match(gate,/run: node scripts\/test2-presign.mjs/);assert(!/continue-on-error|always\(\)/.test(gate));
 assert.match(step('Install Apple certificate and provisioning profile'),/if: inputs.target_environment != 'test2'/);
});
test('production identity installation body is unchanged from the canonical baseline',()=>{
 const body=step('Install Apple certificate and provisioning profile').replace("        if: inputs.target_environment != 'test2'\n",'')+'\n\n';
 // The old step ends in one blank line; normalize only boundary newlines.
 assert.equal(hash(body.trimEnd()),'7941f51e92a2ec3683f63200c217ffc1a61f3a74f36eec93bd215b19f96fb0ea');
});
test('TEST2 pins manual signing identity/profile and rechecks stage before every signing/export boundary',()=>{
 const install=step('Install only the prevalidated TEST2 signing identity');assert.match(install,/--verify-stage/);assert.match(install,/identity\.p12/);assert(!install.includes('CERTIFICATE_BASE64'));
 const archive=step('Create archive');assert.match(archive,/if \[ "\$\{\{ inputs.target_environment \}\}" = 'test2' \]/);assert.match(archive,/--verify-stage \|\| exit 1/);assert.match(archive,/CODE_SIGN_STYLE=Manual/);assert.match(archive,/CODE_SIGN_IDENTITY=\$ROOOM_TEST2_IDENTITY_SHA1/);assert.match(archive,/test "\$PROFILE_UUID" = "\$ROOOM_TEST2_PROFILE_UUID"/);
 assert.match(step('Create ExportOptions.plist'),/--verify-stage \|\| exit 1/);assert.match(step('Create ExportOptions.plist'),/<key>signingCertificate<\/key>/);assert.match(step('Export IPA'),/--verify-stage \|\| exit 1/);
 assert.match(workflow,/<key>testFlightInternalTestingOnly<\/key><true\/>/);
});
test('release remains manual-only and no App Store/external distribution action is added',()=>{
 assert.match(workflow,/on:\n  workflow_dispatch:/);assert(!/^  (push|pull_request|schedule):/m.test(workflow));assert.equal((workflow.match(/--upload-app/g)||[]).length,1);assert(!/submitForReview|releaseVersion|betaReviewSubmissions/.test(workflow));
 const ci=fs.readFileSync('.github/workflows/test2-presign-check.yml','utf8');assert(!ci.split('  real-cms-diagnostic:')[0].includes('secrets.'));assert(!ci.includes('security import'));assert(!ci.includes('codesign '));
});
test('production CLI has no synthetic root, time, revocation or test bypass inputs',()=>{
 const prod=swift.slice(swift.indexOf('func runGate('));assert.match(prod,/let now = Date\(\)/);assert.match(prod,/loadAppleRoots\(root.appendingPathComponent/);assert(!prod.includes('revocation: false'));assert(!prod.includes('ROOOM_PRESIGN_TESTS')||prod.includes('#if !ROOOM_PRESIGN_TESTS'));
 assert.match(swift,/kSecImportToMemoryOnly as String: true/);assert(!swift.includes('SecKeyCreateSignature'));assert.match(swift,/kSecRevocationRequirePositiveResponse/);assert.match(swift,/SecTrustSetAnchorCertificatesOnly\(trust, true\)/);assert.match(swift,/innerEntitlement\["get-task-allow"\]/);
});
test('pinned Apple roots are exactly the reviewed official public certificate bytes',()=>{
 const expected={'AppleIncRootCertificate.cer':'b0b1730ecbc7ff4505142c49f1295e6eda6bcaed7e2c68c5be91b5a11001f024','AppleRootCA-G2.cer':'c2b9b042dd57830e7d117dac55ac8ae19407d38e41d88f3215bc3a890444a050','AppleRootCA-G3.cer':'63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179'};
 for(const [name,digest]of Object.entries(expected))assert.equal(hash(fs.readFileSync('scripts/presign-apple-roots/'+name)),digest);
});
test('wrong contexts, missing markers and unsupported arguments never start validator/signing',()=>{
 assert.throws(()=>verifyStage({}));assert.throws(()=>verifyStage({TARGET_ENV:'production'}));assert.throws(()=>main(['--force'],{}));assert.throws(()=>main([],{TARGET_ENV:'production'}));
 const r=cp.spawnSync(process.execPath,['scripts/test2-presign.mjs','--verify-stage'],{encoding:'utf8',env:{PATH:process.env.PATH,TARGET_ENV:'test2',CERTIFICATE_PASSWORD:'DO-NOT-LOG-SECRET',RUNNER_TEMP:'missing-private-path'}});assert.equal(r.status,1);assert.match(r.stderr,/^TEST2 PRESIGN STOP:/);assert(!r.stderr.includes('DO-NOT-LOG-SECRET'));assert(!r.stderr.includes('missing-private-path'));
});
test('staged bytes, permissions, expiry, identity and paths fail closed',{skip:process.platform!=='darwin'},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'presign-stage-test-')),dir=path.join(temp,'rooom-test2-presign-12345678-1234-1234-1234-123456789012');fs.mkdirSync(dir,{mode:0o700});
 const env={ROOOM_INTERNAL_ONLY:'<key>testFlightInternalTestingOnly</key><true/>',ROOOM_BUILD_CONDITIONS:'$(inherited) ROOOM_IMOBILE_ADS ROOOM_TEST2_RAIL',TARGET_ENV:'test2',ROOOM_TEST2_PRESIGN_OK:'1',ROOOM_MARKETING_VERSION:'1.6.2',ROOOM_TESTFLIGHT_BUILD_NUMBER:'100080',RUNNER_TEMP:temp,ROOOM_TEST2_SIGNING_DIR:dir,ROOOM_TEST2_IDENTITY_SHA1:'A'.repeat(40),ROOOM_TEST2_PROFILE_UUID:'12345678-1234-1234-1234-123456789012',ROOOM_TEST2_SIGNING_EXPIRES:String(Math.floor(Date.now()/1000)+60)};
 const entries=[['identity.p12','ROOOM_TEST2_P12_SHA256'],['profile.mobileprovision','ROOOM_TEST2_PROFILE_SHA256']];for(const [file,key]of entries){fs.writeFileSync(path.join(dir,file),'synthetic-only',{mode:0o600});env[key]=hash('synthetic-only');}
 try{
  assert.equal(verifyStage(env),true);
  for(const extra of [{ROOOM_INTERNAL_ONLY:''},{ROOOM_BUILD_CONDITIONS:''},{ROOOM_TEST2_SIGNING_EXPIRES:'9'.repeat(100)},{ROOOM_TEST2_PRESIGN_OK:''},{ROOOM_TEST2_SIGNING_EXPIRES:'1'},{ROOOM_TEST2_IDENTITY_SHA1:'bad'},{ROOOM_TESTFLIGHT_BUILD_NUMBER:'100079'},{ROOOM_TEST2_PROFILE_SHA256:'0'.repeat(64)},{TARGET_ENV:'production'},{ROOOM_MARKETING_VERSION:'1.6'}])assert.throws(()=>verifyStage({...env,...extra}));
  fs.chmodSync(dir,0o755);assert.throws(()=>verifyStage(env));fs.chmodSync(dir,0o700);
  fs.chmodSync(path.join(dir,'identity.p12'),0o644);assert.throws(()=>verifyStage(env));fs.chmodSync(path.join(dir,'identity.p12'),0o600);
  fs.writeFileSync(path.join(dir,'identity.p12'),'changed');assert.throws(()=>verifyStage(env));fs.writeFileSync(path.join(dir,'identity.p12'),'synthetic-only');
  fs.unlinkSync(path.join(dir,'profile.mobileprovision'));assert.throws(()=>verifyStage(env));fs.symlinkSync(path.join(dir,'identity.p12'),path.join(dir,'profile.mobileprovision'));assert.throws(()=>verifyStage(env));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
