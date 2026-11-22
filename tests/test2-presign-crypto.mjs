// Synthetic CA/key/CMS fixtures only. No app signing, secrets or upload.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import cp from 'node:child_process';import assert from 'node:assert/strict';
assert.equal(process.platform,'darwin','Native Security.framework validation must run on macOS');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rooom-presign-fixtures-'));fs.chmodSync(tmp,0o700);
function run(cmd,args,options={}){const r=cp.spawnSync(cmd,args,{cwd:tmp,encoding:'utf8',timeout:120000,...options});assert.equal(r.status,0,`${cmd}: ${r.error?.code||''}\n${r.stdout||''}\n${r.stderr||''}`);return r.stdout;}
const root=process.cwd();
try{
 fs.writeFileSync(path.join(tmp,'leaf.cnf'),'[leaf]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=critical,codeSigning\n1.2.840.113635.100.6.1.4=critical,ASN1:NULL\n');
 fs.writeFileSync(path.join(tmp,'cms.cnf'),'[leaf]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\n');
 run('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.pem','-subj','/CN=RoooM SYNTHETIC test CA','-days','2','-sha256','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign']);
 for(const [name,subject,config]of [['identity','/CN=Apple Distribution: SYNTHETIC/OU=ABC123DE45','leaf.cnf'],['signer','/CN=Apple iPhone OS Provisioning Profile Signing','cms.cnf']]){
  run('openssl',['req','-new','-newkey','rsa:2048','-nodes','-keyout',name+'.key','-out',name+'.csr','-subj',subject]);
  run('openssl',['x509','-req','-in',name+'.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-out',name+'.pem','-days','1','-sha256','-extfile',config,'-extensions','leaf']);
 }
 run('openssl',['x509','-in','signer.pem','-outform','DER','-out','signer.der']);
 run('openssl',['x509','-in','ca.pem','-outform','DER','-out','ca.der']);
 const password={...process.env,FIXTURE_P12_PASSWORD:'fixture-only-password'};
 const exportArgs=['pkcs12','-export','-in','identity.pem','-certfile','ca.pem','-out','identity.p12','-passout','env:FIXTURE_P12_PASSWORD','-keypbe','PBE-SHA1-3DES','-certpbe','PBE-SHA1-3DES','-macalg','sha1'];
 run('openssl',[...exportArgs,'-inkey','identity.key'],{env:password});
 run('openssl',['pkcs12','-export','-nokeys','-in','identity.pem','-out','cert-only.p12','-passout','env:FIXTURE_P12_PASSWORD','-certpbe','PBE-SHA1-3DES','-macalg','sha1'],{env:password});
 fs.writeFileSync(path.join(tmp,'payload.plist'),'<?xml version="1.0"?><plist version="1.0"><dict><key>Synthetic</key><true/></dict></plist>');
 for(const [file,name]of [['profile.cms','signer'],['wrong-signer.cms','identity']])run('openssl',['cms','-sign','-binary','-nodetach','-in','payload.plist','-signer',name+'.pem','-inkey',name+'.key','-certfile','ca.pem','-outform','DER','-out',file,'-md','sha256']);
 const before=run('/usr/bin/security',['find-identity','-p','codesigning']);
 const testBinary=path.join(tmp,'tests');
 console.log(run('xcrun',['swiftc','-parse-as-library','-D','ROOOM_PRESIGN_TESTS',path.join(root,'scripts/test2-presign.swift'),path.join(root,'tests/test2-presign-main.swift'),'-o',testBinary,'-framework','Security','-framework','CryptoKit']));
 console.log(run(testBinary,[tmp],{cwd:root}));
 assert.equal(run('/usr/bin/security',['find-identity','-v','-p','codesigning']),before,'Memory-only import added a keychain identity');
 const gateBinary=path.join(tmp,'production-gate');
 run('xcrun',['swiftc','-parse-as-library',path.join(root,'scripts/test2-presign.swift'),'-o',gateBinary,'-framework','Security','-framework','CryptoKit']);
 const envFile=path.join(tmp,'github-env');fs.writeFileSync(envFile,'');
 const env={PATH:process.env.PATH,HOME:process.env.HOME,RUNNER_TEMP:tmp,GITHUB_ENV:envFile,TARGET_ENV:'test2',ROOOM_INTERNAL_ONLY:'<key>testFlightInternalTestingOnly</key><true/>',ROOOM_BUILD_CONDITIONS:'$(inherited) ROOOM_IMOBILE_ADS ROOOM_TEST2_RAIL',ROOOM_MARKETING_VERSION:'1.6.2',ROOOM_TESTFLIGHT_BUILD_NUMBER:'100080',APPLE_TEAM_ID:'ABC123DE45',CERTIFICATE_PASSWORD:'fixture-only-password',CERTIFICATE_BASE64:fs.readFileSync(path.join(tmp,'identity.p12')).toString('base64'),PROVISIONING_PROFILE_BASE64:fs.readFileSync(path.join(tmp,'profile.cms')).toString('base64')};
 const attempt=cp.spawnSync(gateBinary,[],{cwd:root,env,encoding:'utf8',timeout:30000});assert.equal(attempt.status,1);assert.match(attempt.stderr,/^TEST2 PRESIGN STOP: trust\s*$/);assert.equal(attempt.stdout,'');assert(!JSON.stringify(attempt).includes('fixture-only-password'));assert.equal(fs.readFileSync(envFile,'utf8'),'');
 assert(!fs.readdirSync(tmp).some(n=>n.startsWith('rooom-test2-presign-')),'Failed gate staged a signing identity');
 console.log('Native CMS/P12/trust and production CLI fail-closed checks PASS; no keychain identity added; no app signing/upload.');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
