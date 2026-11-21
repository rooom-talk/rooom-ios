import assert from 'node:assert/strict';
export const declarationApproval='TN_REUSE_100077_FOR_100079';
const app='6800222762';
const lookup=build=>'/v1/builds?filter[app]='+app+'&filter[version]='+build+'&include=preReleaseVersion,buildBetaDetail,app&limit=200';
function validate(response,build,version){
 assert(Array.isArray(response.data)&&response.data.length===1,'Expected one exact Apple build');const b=response.data[0];assert.equal(b.type,'builds');assert.match(b.id,/^[A-Za-z0-9-]{1,128}$/);assert.equal(b.attributes.version,build);assert.equal(b.relationships?.app?.data?.id,app,'Wrong app');
 const included=response.included||[],pre=included.find(x=>x.type==='preReleaseVersions'&&x.id===b.relationships?.preReleaseVersion?.data?.id);assert.equal(pre?.attributes.version,version);assert.equal(pre?.attributes.platform,'IOS');return b;
}
function current(response){const b=validate(response,'100079','1.6.2');assert.equal(b.attributes.processingState,'VALID');assert.equal(b.attributes.expired,false);assert.equal(b.attributes.buildAudienceType,'INTERNAL_ONLY');return b;}
function state(response,b){const d=(response.included||[]).find(x=>x.type==='buildBetaDetails'&&x.id===b.relationships?.buildBetaDetail?.data?.id);assert.equal(typeof d?.attributes.internalBuildState,'string');return d.attributes.internalBuildState;}
export async function applyApprovedDeclaration(api,patch,{environment,build,approval,mode='check'}){
 assert.equal(environment,'test2');assert.equal(String(build),'100079');assert.equal(approval,declarationApproval,'TN approval required');assert(['check','apply'].includes(mode));
 const oldResponse=await api(lookup('100077')),old=validate(oldResponse,'100077','1.6.1');assert.equal(old.attributes.usesNonExemptEncryption,false,'Previous declaration changed or unavailable');
 let response=await api(lookup('100079')),b=current(response);const existing=b.attributes.usesNonExemptEncryption??null;assert(existing===null||existing===false,'Do not overwrite an existing different declaration');
 const result={appId:app,version:'1.6.2',build:'100079',previousBuild:'100077',approvedValue:false,before:existing,mode,patchAttempts:0,patches:0};
 if(existing===null)assert.equal(state(response,b),'MISSING_EXPORT_COMPLIANCE','Unexpected current beta state');
 if(mode==='check'||existing===false)return {...result,alreadyApplied:existing===false};
 assert.equal(state(response,b),'MISSING_EXPORT_COMPLIANCE','Unexpected current beta state');
 // Re-read immediately before the only permitted mutation and reject a
 // different answer observed there. Never act on another binary/application.
 response=await api(lookup('100079'));const fresh=current(response);assert.equal(fresh.id,b.id);
 if(fresh.attributes.usesNonExemptEncryption===false)return {...result,alreadyApplied:true};
 assert.equal(fresh.attributes.usesNonExemptEncryption??null,null);assert.equal(state(response,fresh),'MISSING_EXPORT_COMPLIANCE');
 const body={data:{type:'builds',id:b.id,attributes:{usesNonExemptEncryption:false}}};
 result.patchAttempts=1;let failure;try{await patch(b.id,body);result.patches=1;}catch(error){failure=error;}
 const verified=current(await api(lookup('100079')));assert.equal(verified.id,b.id);
 if(verified.attributes.usesNonExemptEncryption!==false){if(failure)throw failure;throw Error('Declaration readback did not match approved value');}
 return {...result,after:false,verified:true,...(failure?{responseUncertainButReadbackMatches:true}:{})};
}
