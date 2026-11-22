import fs from 'node:fs';import cp from 'node:child_process';import crypto from 'node:crypto';import path from 'node:path';import {fileURLToPath} from 'node:url';
export function seal(data,key){const k=crypto.randomBytes(32),iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',k,iv);const encrypted=Buffer.concat([c.update(data),c.final()]);const wrapped=crypto.publicEncrypt({key,oaepHash:'sha256',padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},k);k.fill(0);return {version:1,wrapped:wrapped.toString('base64'),iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64'),encrypted:encrypted.toString('base64')};}
function main(){
 if(process.argv.length!==2||process.platform!=='darwin'||process.env.TARGET_ENV!=='test2'||!process.env.RUNNER_TEMP)throw Error();
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),binary=path.join(process.env.RUNNER_TEMP,'cms-inspection-'+crypto.randomUUID());
 try{
  const build=cp.spawnSync('xcrun',['swiftc','-parse-as-library','-D','ROOOM_PRESIGN_TESTS','-D','ROOOM_CMS_INSPECTION','scripts/test2-presign.swift','scripts/cms-signer-inspection.swift','-o',binary,'-framework','Security','-framework','CryptoKit'],{cwd:root,encoding:'utf8',timeout:120000});if(build.status!==0)throw Error();
  const result=cp.spawnSync(binary,[],{cwd:root,env:process.env,timeout:180000,maxBuffer:524288});if(result.status!==0||!result.stdout?.length||result.stdout.length>262144)throw Error();
  const sealed=seal(result.stdout,fs.readFileSync(path.join(root,'scripts/cms-evidence-recipient.pem')));result.stdout.fill(0);
  console.log('CMS ENCRYPTED EVIDENCE '+Buffer.from(JSON.stringify(sealed)).toString('base64'));
  console.log('CMS INSPECTION COMPLETE: encrypted certificate evidence only; no validation approval, signing or upload.');
 }finally{if(fs.existsSync(binary))fs.unlinkSync(binary);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch{console.error('CMS INSPECTION STOP');process.exitCode=1;}}

