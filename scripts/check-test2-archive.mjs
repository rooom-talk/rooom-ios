import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import cp from 'node:child_process';import {fileURLToPath}from 'node:url';
export function verifyTest2Archive(config,info,binary,{version,build}){
 assert.equal(config.appId,'com.rooom.talk');assert.equal(config.server.url,'https://rooom-test2.web.app/?rooom_native_generation=3');assert.deepEqual(config.server.allowNavigation,['rooom-test2.web.app']);assert.equal(config.server.cleartext,false);assert.equal(config.ios.scrollEnabled,true);assert.equal(config.plugins.Keyboard.resize,'none');
 assert.equal(info.CFBundleIdentifier,'com.rooom.talk');assert.equal(info.CFBundleShortVersionString,version);assert.equal(String(info.CFBundleVersion),String(build));assert(Number(build)>100079);
 assert(binary.includes(Buffer.from('RoooMTest2Rail/1 Build/')),'TEST2 rail not present in archived binary');assert(binary.includes(Buffer.from('window.__rooomNativeAdPresentationVersion=1;')),'PR24 Web presentation capability missing in archived binary');
 assert(binary.includes(Buffer.from('window.__rooomNativeRailShadeVersion=1;')),'PR29 generic Web-owned RGBA shade capability missing in archived binary');
 return {appId:config.appId,url:config.server.url,version,build:String(build),test2DummyRailCompiled:true,webPresentationCapability:true,nativeRailShadeCapability:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=path.resolve(process.argv[2]);assert(app.endsWith('.app'));const config=JSON.parse(fs.readFileSync(path.join(app,'capacitor.config.json'))),info=JSON.parse(cp.execFileSync('/usr/bin/plutil',['-convert','json','-o','-',path.join(app,'Info.plist')],{encoding:'utf8'}));
 const result=verifyTest2Archive(config,info,fs.readFileSync(path.join(app,info.CFBundleExecutable)),{version:process.env.ROOOM_MARKETING_VERSION,build:process.env.ROOOM_TESTFLIGHT_BUILD_NUMBER});console.log('ARCHIVED TEST2 CONFIGURATION PASS '+JSON.stringify(result));
}
