import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function checkConfig(c){
 assert.equal(c.appId,'com.rooom.talk');
 assert.equal(c.server?.url,'https://rooom-test2.web.app/?rooom_native_generation=3');
 assert.deepEqual(c.server.allowNavigation,['rooom-test2.web.app']);
 assert.equal(c.ios?.scrollEnabled,true);assert.equal(c.plugins?.Keyboard?.resize,'none');
}
export function checkBundle(app,readPlist,readStrings){
 checkConfig(JSON.parse(fs.readFileSync(path.join(app,'capacitor.config.json'))));
 assert.equal(readPlist(path.join(app,'Info.plist'),'CFBundleIdentifier'),'com.rooom.talk');
 assert.equal(readPlist(path.join(app,'Info.plist'),'CFBundleShortVersionString'),'1.6.1');
 const exe=readPlist(path.join(app,'Info.plist'),'CFBundleExecutable');assert.match(exe,/^[A-Za-z0-9_-]+$/);
 assert(readStrings(path.join(app,exe)).includes('ROOOM_TEST2_COMPILED_DUMMY_ONLY_V1'),'TEST2 executable marker missing');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,target]=process.argv.slice(2);
 if(mode==='config')checkConfig(JSON.parse(fs.readFileSync(target)));
 else if(mode==='bundle')checkBundle(target,(file,key)=>execFileSync('/usr/libexec/PlistBuddy',['-c','Print :'+key,file],{encoding:'utf8'}).trim(),exe=>execFileSync('/usr/bin/strings',[exe],{encoding:'utf8',maxBuffer:16e6}));
 else throw Error('Expected config or bundle');
 console.log('TEST2 '+mode+' guard PASS: expected host and dummy-only configuration');
}
