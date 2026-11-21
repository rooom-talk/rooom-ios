// Build workspace only. Never edits Hosting, DB, credentials or Apple state.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const file=new URL('../capacitor.config.json',import.meta.url);
const config=JSON.parse(fs.readFileSync(file,'utf8'));
assert.equal(config.appId,'com.rooom.talk');
assert.equal(config.server.url,'https://rooom-talk.com/?rooom_native_generation=3');
assert.deepEqual(config.server.allowNavigation,['rooom-talk.com']);
config.server={...config.server,url:'https://rooom-test2.web.app/?rooom_native_generation=3',allowNavigation:['rooom-test2.web.app']};
config.ios={...(config.ios||{}),scrollEnabled:true};
config.plugins={...config.plugins,Keyboard:{resize:'none'}};
fs.writeFileSync(file,JSON.stringify(config,null,2)+'\n');
console.log('TEST2-only launch configuration staged; requires ROOOM_TEST2_RAIL compiler condition. No upload.');
