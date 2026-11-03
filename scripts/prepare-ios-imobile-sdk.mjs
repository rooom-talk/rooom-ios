#!/usr/bin/env node
// Local Mac-only staging step: install the exact user-supplied i-mobile iOS SDK
// AFTER "npx cap sync ios" and BEFORE xcodebuild. Does not sign or upload.
// No network access, no App Store actions, no third-party binaries in Git.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const EXPECTED_ZIP_SHA='a42e20c2c2fc87c9346f85c5bf8643c650b0b9e06ab8d44ec57b7e857f9ad0be';
const SDK_DIR='imobile_for_SP_app_iOS_SDK_2.3.4';
const PBX=path.join(ROOT,'ios/App/App.xcodeproj/project.pbxproj');
const BANNER=path.join(ROOT,'ios/App/App/RooomImobileBanner.swift');
const SCENE=path.join(ROOT,'ios/App/App/SceneDelegate.swift');
const VENDOR=path.join(ROOT,'ios/App/App/Vendor/ImobileSdkAds.xcframework');
const BRIDGE=path.join(ROOT,'ios/App/App/ImobileSdkAds-Bridging-Header.h');

const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function once(source,from,to){
 assert.equal(source.split(from).length-1,1,'Expected exactly one Xcode project marker: '+from.slice(0,95));
 return source.replace(from,to);
}
function patchProject(source) {
 if(source.includes('ImobileSdkAds.xcframework in Frameworks')){
  assert.ok(source.includes('ROOOM_IMOBILE_ADS')&&source.includes('SWIFT_OBJC_BRIDGING_HEADER'),'Incomplete existing i-mobile Xcode integration');
  return source;
 }
 assert.ok(source.includes('MARKETING_VERSION = 1.5;'),'Not the verified iOS 1.5 review project');
 assert.ok(source.includes('PRODUCT_BUNDLE_IDENTIFIER = com.rooom.talk;'),'Wrong app ID');
 assert.ok(source.includes('RooomImobileBanner.swift in Sources'),'Missing staged native Swift source');
 assert.ok(!source.includes('SWIFT_OBJC_BRIDGING_HEADER ='),'Existing bridging header needs review');
 assert.ok(!source.includes('OTHER_LDFLAGS ='),'Existing linker configuration needs review');

 let p=source;
 const FILE='A4DBA0042F11000000000004';
 const BUILD='A4DBA0032F11000000000003';
 p=once(p,
  '\t\tA4DBA0012F11000000000001 /* RooomImobileBanner.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4DBA0022F11000000000002 /* RooomImobileBanner.swift */; };',
  '\t\tA4DBA0012F11000000000001 /* RooomImobileBanner.swift in Sources */ = {isa = PBXBuildFile; fileRef = A4DBA0022F11000000000002 /* RooomImobileBanner.swift */; };\n'+
  '\t\t'+BUILD+' /* ImobileSdkAds.xcframework in Frameworks */ = {isa = PBXBuildFile; fileRef = '+FILE+' /* ImobileSdkAds.xcframework */; };');
 p=once(p,
  '\t\tA4DBA0022F11000000000002 /* RooomImobileBanner.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RooomImobileBanner.swift; sourceTree = "<group>"; };',
  '\t\tA4DBA0022F11000000000002 /* RooomImobileBanner.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RooomImobileBanner.swift; sourceTree = "<group>"; };\n'+
  '\t\t'+FILE+' /* ImobileSdkAds.xcframework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.xcframework; path = Vendor/ImobileSdkAds.xcframework; sourceTree = "<group>"; };');
 p=once(p,
  '\t\t\t\tA4DBA0022F11000000000002 /* RooomImobileBanner.swift */,\n',
  '\t\t\t\tA4DBA0022F11000000000002 /* RooomImobileBanner.swift */,\n\t\t\t\t'+FILE+' /* ImobileSdkAds.xcframework */,\n');
 p=once(p,
  '\t\t\t\t4D22ABE92AF431CB00220026 /* CapApp-SPM in Frameworks */,\n',
  '\t\t\t\t4D22ABE92AF431CB00220026 /* CapApp-SPM in Frameworks */,\n\t\t\t\t'+BUILD+' /* ImobileSdkAds.xcframework in Frameworks */,\n');

 const settings=[
  'SWIFT_OBJC_BRIDGING_HEADER = App/ImobileSdkAds-Bridging-Header.h;',
  'HEADER_SEARCH_PATHS = ("$(inherited)", "$(PROJECT_DIR)/App/Vendor/ImobileSdkAds.xcframework/ios-arm64/Headers", "$(PROJECT_DIR)/App/Vendor/ImobileSdkAds.xcframework/ios-arm64_x86_64-simulator/Headers");',
  'OTHER_LDFLAGS = ("$(inherited)", "-ObjC", "-framework", "AdSupport", "-framework", "SystemConfiguration", "-framework", "CoreLocation", "-framework", "StoreKit", "-framework", "WebKit");'
 ];
 assert.equal(p.split('\t\t\t\tMARKETING_VERSION = 1.5;').length-1,2,'Expected two iOS 1.5 target configurations');
 p=p.replaceAll('\t\t\t\tMARKETING_VERSION = 1.5;','\t\t\t\tMARKETING_VERSION = 1.5;\n\t\t\t\t'+settings.join('\n\t\t\t\t'));
 p=once(p,
  '\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;\n\t\t\t\tSWIFT_VERSION = 5.0;',
  '\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG ROOOM_IMOBILE_ADS";\n\t\t\t\tSWIFT_VERSION = 5.0;');
 p=once(p,
  '\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = "";\n\t\t\t\tSWIFT_VERSION = 5.0;',
  '\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = "ROOOM_IMOBILE_ADS";\n\t\t\t\tSWIFT_VERSION = 5.0;');
 assert.equal(p.split('ImobileSdkAds.xcframework in Frameworks').length-1,2);
 assert.equal(p.split('SWIFT_OBJC_BRIDGING_HEADER').length-1,2);
 assert.equal(p.split('ROOOM_IMOBILE_ADS').length-1,2);
 return p;
}
function main(){
 const zip=process.argv[2];
 if(!zip||process.argv.length!==3){
  console.error('Usage: node scripts/prepare-ios-imobile-sdk.mjs /path/to/imobile_for_SP_app_iOS_SDK_2.3.4.zip');
  process.exitCode=2;return;
 }
 assert.equal(process.platform,'darwin','Mac/Xcode required. Do not attempt an iOS build on Windows');
 assert.ok(fs.existsSync(zip),'SDK ZIP not found');
 assert.equal(sha(zip),EXPECTED_ZIP_SHA,'SDK ZIP differs from uploaded, audited v2.3.4');
 assert.ok(fs.existsSync(BANNER)&&fs.existsSync(SCENE),'iOS 1.5 ad source not installed');
 const scene=fs.readFileSync(SCENE,'utf8');
 assert.ok(scene.includes('RooomKeyboardContainerViewController')&&scene.includes('#if ROOOM_IMOBILE_ADS'),'Known keyboard/advertising owner missing');
 const original=fs.readFileSync(PBX,'utf8');
 const patched=patchProject(original);

 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rooom-imobile-sdk-'));
 try{
  execFileSync('unzip',['-q',path.resolve(zip),'-d',tmp],{stdio:'pipe'});
  const src=path.join(tmp,SDK_DIR,'lib','ImobileSdkAds.xcframework');
  const header=path.join(tmp,SDK_DIR,'Swift','ImobileSdkAds-Bridging-Header.h');
  for(const p of [path.join(src,'Info.plist'),path.join(src,'ios-arm64','libImobileSdkAds.a'),
    path.join(src,'ios-arm64_x86_64-simulator','libImobileSdkAds.a'),
    path.join(src,'ios-arm64','Headers','ImobileSdkAds.h'),header])
    assert.ok(fs.statSync(p).size>30,'Missing/incomplete SDK file: '+p);
  const needed=fs.readFileSync(path.join(src,'ios-arm64','Headers','ImobileSdkAds.h'),'utf8');
  assert.ok(needed.includes('registerWithPublisherID')&&needed.includes('showBySpotID'),'Vendor SDK unexpected API');
  if(fs.existsSync(VENDOR)){
   assert.equal(sha(path.join(VENDOR,'ios-arm64','libImobileSdkAds.a')),
     sha(path.join(src,'ios-arm64','libImobileSdkAds.a')),'Different installed SDK; refuse overwrite');
  }else{
   fs.mkdirSync(path.dirname(VENDOR),{recursive:true});
   fs.cpSync(src,VENDOR,{recursive:true,errorOnExist:true,force:false});
  }
  if(fs.existsSync(BRIDGE))assert.equal(fs.readFileSync(BRIDGE,'utf8'),fs.readFileSync(header,'utf8'),'Existing bridging header differs');
  else fs.copyFileSync(header,BRIDGE,fs.constants.COPYFILE_EXCL);
  if(original!==patched)fs.writeFileSync(PBX,patched);
  console.log('RoooM iOS i-mobile SDK 2.3.4 staged on Mac only.');
  console.log('No signing, no Firebase deployment, no App Store upload.');
  console.log('NEXT: run xcodebuild in an isolated ad-enabled test candidate and verify keyboard + push.');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
main();
export {patchProject};
