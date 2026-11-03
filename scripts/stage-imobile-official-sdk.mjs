#!/usr/bin/env node
// Stage the OFFICIAL i-mobile 2.3.4 SDK into an ephemeral GitHub Actions Mac
// build. Pin the commit and exact binary bytes against TN's uploaded SDK.
// This never signs, uploads, releases, or checks vendor binaries into Git.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {patchProject} from './prepare-ios-imobile-sdk.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const officialCommit='736b6edc9ab6e1ada1b0dc557531370cf5923dc8';
const expected={
  'Info.plist':'de0ba5a3d57c88ad82a9558d99b5533c4b6cb79c272b9a6d79166dd20deb7b14',
  'ios-arm64/libImobileSdkAds.a':'516404fd03e9ba8db367d2abc03f66427435f2c217244025bf14ce73804b5086',
  'ios-arm64_x86_64-simulator/libImobileSdkAds.a':'a4ba153f3fa52b15948d174c6fe2add24e705d9a3fc9a508fe38cb4daf3adc73',
  'ios-arm64/Headers/ImobileSdkAds.h':'11c44e38a5145a4085644061d9bc7ed5b6b84506774c7a6d71fd9098246d99ea',
  'ios-arm64_x86_64-simulator/Headers/ImobileSdkAds.h':'11c44e38a5145a4085644061d9bc7ed5b6b84506774c7a6d71fd9098246d99ea'
};
const bridgingHeader=[
  '//',
  "//  Use this file to import your target's public headers that you would like to expose to Swift.",
  '//',
  '',
  '//  for i-mobile SDK',
  '#import <Foundation/Foundation.h>',
  '#import <UIKit/UIKit.h>',
  '#import "ImobileSdkAds.h"',
  ''
].join('\n');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const verified=file=>{
  const actual=sha(file);
  assert.equal(actual,expected[path.relative(vendorFramework,file).split(path.sep).join('/')],
    'SDK is not identical to the operator-supplied audited 2.3.4: '+file);
};
const vendorDir=process.argv[2] ? path.resolve(process.argv[2]) : '';
const vendorFramework=path.join(vendorDir,'ImobileSdkAds.xcframework');
const destFramework=path.join(root,'ios/App/App/Vendor/ImobileSdkAds.xcframework');
const destHeader=path.join(root,'ios/App/App/ImobileSdkAds-Bridging-Header.h');
const pbxPath=path.join(root,'ios/App/App.xcodeproj/project.pbxproj');
const appSrc=path.join(root,'ios/App/App/RooomImobileBanner.swift');
const sceneSrc=path.join(root,'ios/App/App/SceneDelegate.swift');

function main(){
  assert.equal(process.platform,'darwin','Official iOS native build requires the GitHub macOS runner');
  assert.equal(process.argv.length,3,'Usage: node scripts/stage-imobile-official-sdk.mjs /path/to/official-v2.3.4-repo');
  assert.ok(fs.existsSync(vendorFramework),'Official i-mobile xcframework source is missing');
  const commit=execFileSync('git',['-C',vendorDir,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  assert.equal(commit,officialCommit,'Official SDK Git commit changed; fail closed');
  for(const rel of Object.keys(expected))verified(path.join(vendorFramework,rel));

  assert.ok(fs.readFileSync(sceneSrc,'utf8').includes('#if ROOOM_IMOBILE_ADS'),'Native keyboard/advertising owner is missing');
  assert.ok(fs.readFileSync(appSrc,'utf8').includes('RooomMonetization'),'Native SDK coordinator is missing');
  const original=fs.readFileSync(pbxPath,'utf8');
  const patched=patchProject(original); // Fail before touching files if Xcode project drifted.
  if(fs.existsSync(destFramework)){
    for(const rel of Object.keys(expected))verified(path.join(destFramework,rel));
  }
  if(fs.existsSync(destHeader)){
    assert.equal(fs.readFileSync(destHeader,'utf8'),bridgingHeader,'Unexpected existing Swift bridging header');
  }
  const newlyStaged=!fs.existsSync(destFramework);
  const newHeader=!fs.existsSync(destHeader);
  try{
    if(newlyStaged){
      fs.mkdirSync(path.dirname(destFramework),{recursive:true});
      fs.cpSync(vendorFramework,destFramework,{recursive:true,errorOnExist:true,force:false});
    }
    if(newHeader)fs.writeFileSync(destHeader,bridgingHeader,{flag:'wx'});
    if(original!==patched)fs.writeFileSync(pbxPath,patched);
    // Re-check the bytes AFTER copy. GitHub checkout never stores these binaries.
    for(const rel of Object.keys(expected))verified(path.join(destFramework,rel));
    assert.equal(fs.readFileSync(pbxPath,'utf8'),patched);
    console.log('Verified official i-mobile iOS SDK 2.3.4 staged (binary SHA-256 matches supplied SDK).');
    console.log('Native bridge/project patched; no signing, no TestFlight upload, no public release.');
  }catch(error){
    if(newlyStaged)fs.rmSync(destFramework,{recursive:true,force:true});
    if(newHeader)fs.rmSync(destHeader,{force:true});
    if(fs.readFileSync(pbxPath,'utf8')!==original)fs.writeFileSync(pbxPath,original);
    throw error;
  }
}
main();
