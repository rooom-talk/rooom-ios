import test from 'node:test';import assert from 'node:assert/strict';
import {checkTest2Version,compareVersion}from '../scripts/testflight-version-policy.mjs';
const api=(store=['1.6'],pre=[])=>async p=>{if(p.includes('preReleaseVersions'))assert(!p.includes('filter[platform]'));return {data:(p.includes('appStoreVersions')?store:pre).map(v=>({attributes:{version:v,versionString:v,platform:'IOS'}}))};};
test('fresh TEST2 1.6.2 follows closed production 1.6',async()=>assert.equal(await checkTest2Version(api()),'1.6.2'));
test('reject same/higher store versions including draft without guessing',async()=>{for(const v of ['1.6.2','1.7','2.0'])await assert.rejects(checkTest2Version(api([v])));});
test('reject existing candidate train',async()=>assert.rejects(checkTest2Version(api(['1.6'],['1.6.2']))));
test('fail closed on Apple errors and malformed data',async()=>{await assert.rejects(checkTest2Version(async()=>{throw Error('403')}));await assert.rejects(checkTest2Version(async()=>({})));});
test('semantic versions and pagination',async()=>{assert.equal(compareVersion('1.6','1.6.0'),0);assert.equal(compareVersion('1.6.20','1.6.2'),1);let n=0;await assert.rejects(checkTest2Version(async()=>++n===1?{data:[],links:{next:'/next'}}:{data:[{attributes:{versionString:'1.7'}}]}));});
test('prerelease platform is required; other platforms do not collide',async()=>{assert.equal(await checkTest2Version(async p=>({data:p.includes('preRelease')?[{attributes:{platform:'TV_OS',version:'1.6.2'}}]:[]})),'1.6.2');await assert.rejects(checkTest2Version(async p=>({data:p.includes('preRelease')?[{attributes:{version:'1.6.2'}}]:[]})));});
