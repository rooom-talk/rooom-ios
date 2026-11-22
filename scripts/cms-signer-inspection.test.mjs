import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import cp from 'node:child_process';import os from 'node:os';import path from 'node:path';import {seal} from './cms-signer-inspection.mjs';
test('committed inspection recipient is RSA3072 public key only',()=>{const text=fs.readFileSync('scripts/cms-evidence-recipient.pem','utf8');assert(!text.includes('PRIVATE'));const key=crypto.createPublicKey(text);assert.equal(key.asymmetricKeyType,'rsa');assert.equal(key.asymmetricKeyDetails.modulusLength,3072);});
test('encrypted evidence roundtrip, tampering rejected, nothing decryptable from public key',()=>{
 const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:3072});const plaintext=Buffer.from('private synthetic certificate evidence');const e=seal(plaintext,publicKey);
 assert(!JSON.stringify(e).includes(plaintext.toString()));const key=crypto.privateDecrypt({key:privateKey,oaepHash:'sha256'},Buffer.from(e.wrapped,'base64'));
 const decrypt=tag=>{const d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(e.iv,'base64'));d.setAuthTag(tag);return Buffer.concat([d.update(Buffer.from(e.encrypted,'base64')),d.final()]);};assert.deepEqual(decrypt(Buffer.from(e.tag,'base64')),plaintext);const tag=Buffer.from(e.tag,'base64');tag[0]^=1;assert.throws(()=>decrypt(tag));
 assert.throws(()=>crypto.privateDecrypt({key:publicKey,oaepHash:'sha256'},Buffer.from(e.wrapped,'base64')));
});
test('inspection has no P12, signing, approval markers or plaintext forwarding',()=>{
 const sw=fs.readFileSync('scripts/cms-signer-inspection.swift','utf8'),js=fs.readFileSync('scripts/cms-signer-inspection.mjs','utf8');
 assert(!/CERTIFICATE_PASSWORD|CERTIFICATE_BASE64|runGate|ROOOM_TEST2_PRESIGN_OK|GITHUB_ENV/.test(sw));assert.match(sw,/verifiedCMS\(profile/);assert.match(sw,/try evaluate\(trust/);assert.match(js,/seal\(result.stdout/);assert(!/console.log\(result|console.error\(result/.test(js));
 const y=fs.readFileSync('.github/workflows/test2-presign-check.yml','utf8').split('  cms-certificate-inspection:')[1];assert.equal((y.match(/secrets\./g)||[]).length,1);assert(!/DIAGNOSE_REAL_CMS_ONLY|xcodebuild|security import|upload-app/.test(y));
});
test('native inspector compiles with shared unchanged checks and rejects absent credentials without output',{skip:process.platform!=='darwin'},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cms-inspection-test-')),bin=path.join(dir,'inspect');try{
 const c=cp.spawnSync('xcrun',['swiftc','-parse-as-library','-D','ROOOM_PRESIGN_TESTS','-D','ROOOM_CMS_INSPECTION','scripts/test2-presign.swift','scripts/cms-signer-inspection.swift','-o',bin,'-framework','Security','-framework','CryptoKit'],{encoding:'utf8',timeout:120000});assert.equal(c.status,0,c.stderr);
 const r=cp.spawnSync(bin,[],{env:{PATH:process.env.PATH},encoding:'utf8'});assert.equal(r.status,1);assert.equal(r.stdout,'');assert.equal(r.stderr,'CMS INSPECTION STOP\n');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

