import assert from 'node:assert/strict';
export const test2Version='1.6.2';
export function compareVersion(a,b){
 const parse=v=>{assert.match(v,/^\d+(\.\d+){0,2}$/,'Invalid Apple version');return v.split('.').map(Number);};
 const x=parse(a),y=parse(b);for(let i=0;i<3;i++){const d=(x[i]||0)-(y[i]||0);if(d)return Math.sign(d);}return 0;
}
export async function checkTest2Version(api){
 const candidate=test2Version;
 // Keep TEST2 above every registered iOS App Store version, including drafts.
 // An existing prerelease train is expected for a subsequent TestFlight build;
 // it is not a Store release. Build-number uniqueness is checked separately.
 let matchingTrains=0;
 for(const [relationship,field]of [['appStoreVersions','versionString'],['preReleaseVersions','version']]){
  let link=`/v1/apps/6800222762/${relationship}?${relationship==='appStoreVersions'?'filter[platform]=IOS&':''}limit=200`,pages=0;
  while(link){assert(++pages<=30,'Apple version pagination limit');const data=await api(link);
   assert(Array.isArray(data.data),'Missing Apple version records');
   for(const row of data.data){if(relationship==='preReleaseVersions'){assert.equal(typeof row.attributes?.platform,'string','Missing prerelease platform');if(row.attributes.platform!=='IOS')continue;}const value=row.attributes?.[field];assert.equal(typeof value,'string','Missing Apple version');
    if(relationship==='appStoreVersions')assert(compareVersion(candidate,value)>0,`STOP: TEST2 ${candidate} must exceed registered App Store version ${value}`);
    else if(compareVersion(candidate,value)===0){assert.equal(row.type,'preReleaseVersions','Unexpected candidate train record type');assert.equal(typeof row.id,'string','Missing candidate train ID');assert.match(row.id,/^[A-Za-z0-9-]{1,128}$/,'Invalid candidate train ID');assert(++matchingTrains<=1,'Ambiguous existing TEST2 prerelease train');}
   }
   link=data.links?.next||null;if(link?.startsWith('https:')){const u=new URL(link);assert.equal(u.origin,'https://api.appstoreconnect.apple.com');link=u.pathname+u.search;}
  }
 }
 return candidate;
}
