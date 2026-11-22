// TEST2 only. No app signing/upload command exists in this validator.
import fs from 'node:fs';import path from 'node:path';import cp from 'node:child_process';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function verifyStage(env=process.env){
 const stop=()=>{throw Error('TEST2 PRESIGN STOP: staged identity binding');};
 if(env.TARGET_ENV!=='test2'||env.ROOOM_TEST2_PRESIGN_OK!=='1'||env.ROOOM_MARKETING_VERSION!=='1.6.2'||!/^\d+$/.test(env.ROOOM_TESTFLIGHT_BUILD_NUMBER||'')||Number(env.ROOOM_TESTFLIGHT_BUILD_NUMBER)<=100079)stop();
 if(env.ROOOM_INTERNAL_ONLY!=='<key>testFlightInternalTestingOnly</key><true/>'||env.ROOOM_BUILD_CONDITIONS!=='$(inherited) ROOOM_IMOBILE_ADS ROOOM_TEST2_RAIL'||!Number.isSafeInteger(Number(env.ROOOM_TESTFLIGHT_BUILD_NUMBER)))stop();
 if(!/^[A-F0-9]{40}$/.test(env.ROOOM_TEST2_IDENTITY_SHA1||'')||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(env.ROOOM_TEST2_PROFILE_UUID||'')||!/^\d+$/.test(env.ROOOM_TEST2_SIGNING_EXPIRES||'')||!Number.isSafeInteger(Number(env.ROOOM_TEST2_SIGNING_EXPIRES))||Number(env.ROOOM_TEST2_SIGNING_EXPIRES)*1000<=Date.now())stop();
 if(!env.RUNNER_TEMP||!env.ROOOM_TEST2_SIGNING_DIR)stop();
 const parent=fs.realpathSync(env.RUNNER_TEMP),dir=fs.realpathSync(env.ROOOM_TEST2_SIGNING_DIR),ds=fs.lstatSync(dir);
 if(!ds.isDirectory()||(ds.mode&0o077)!==0||(process.getuid&&ds.uid!==process.getuid()))stop();
 if(path.dirname(dir)!==parent||!/^rooom-test2-presign-[A-F0-9-]{36}$/i.test(path.basename(dir))||fs.lstatSync(env.ROOOM_TEST2_SIGNING_DIR).isSymbolicLink())stop();
 for(const [name,key]of [['identity.p12','ROOOM_TEST2_P12_SHA256'],['profile.mobileprovision','ROOOM_TEST2_PROFILE_SHA256']]){
  const file=path.join(dir,name),st=fs.lstatSync(file);
  if((process.getuid&&st.uid!==process.getuid())||st.isSymbolicLink()||!st.isFile()||st.size===0||st.size>4194304||(st.mode&0o077)!==0||!/^([a-f0-9]{64})$/.test(env[key]||''))stop();
  if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==env[key])stop();
 }
 return true;
}
export function safeFailure(stderr){
 const stages='bounds|create|decoder|update|finalize|count_api|count_one|signature_api|signature_valid|trust_present|trust_evaluate|cert_api|cert_present|cert_parse|name_match|digital_signature|non_ca|not_submission|content_api|content_present|content_nonempty|plist_parse|inner_present|der_parse';
 const match=new RegExp('^TEST2 PRESIGN STOP: ((?:input|der|certificate|identity|trust|cms|profile|entitlement|context|staging)|cms_(?:outer|inner)_(?:'+stages+'))\\n?$').exec(stderr||'');
 return 'TEST2 PRESIGN STOP: '+(match?match[1]:'validation unavailable');
}
export function main(args=process.argv.slice(2),env=process.env){
 if(args.length===1&&args[0]==='--verify-stage'){verifyStage(env);console.log('TEST2 PRESIGN STAGE PASS');return;}
 const diagnosticOnly=args.length===1&&args[0]==='--diagnose-only';
 if((args.length&&!diagnosticOnly)||env.TARGET_ENV!=='test2'||process.platform!=='darwin'||!env.RUNNER_TEMP)throw Error('TEST2 PRESIGN STOP: context');
 const binary=path.join(env.RUNNER_TEMP,'rooom-test2-presign-'+crypto.randomUUID());
 try{
  const build=cp.spawnSync('xcrun',['swiftc','-parse-as-library','scripts/test2-presign.swift','-o',binary,'-framework','Security','-framework','CryptoKit'],{cwd:root,encoding:'utf8',timeout:120000});
  if(build.status!==0)throw Error('TEST2 PRESIGN STOP: validator compilation');
  const result=cp.spawnSync(binary,diagnosticOnly?['--diagnose-only']:[],{cwd:root,env,encoding:'utf8',timeout:180000});
  if(result.status!==0)throw Error(safeFailure(result.stderr));
  if(diagnosticOnly){console.log('TEST2 DIAGNOSTIC PASS: validation only; no staging/signing/upload.');return;}
  const rows=fs.readFileSync(env.GITHUB_ENV,'utf8').split(/\r?\n/);
  for(const name of ['ROOOM_TEST2_IDENTITY_SHA1','ROOOM_TEST2_PROFILE_UUID','ROOOM_TEST2_SIGNING_DIR']){
   const row=rows.filter(r=>r.startsWith(name+'=')).at(-1);if(!row)throw Error('TEST2 PRESIGN STOP: staging');
   const value=row.slice(name.length+1);console.log('::add-mask::'+value.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));
  }
  console.log('TEST2 PRESIGN PASS: all checks passed before identity installation; no app signing.');
 }finally{if(fs.existsSync(binary))fs.unlinkSync(binary);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(error){console.error(/^TEST2 PRESIGN STOP: [a-z_ ]+$/.test(error.message)?error.message:'TEST2 PRESIGN STOP: validation unavailable');process.exitCode=1;}}
