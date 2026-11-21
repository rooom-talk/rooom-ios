import assert from 'node:assert/strict';
// Apple GETs only, exact application/build/version. No tester email or key is emitted.
export async function readTest2BuildStatus(api,{version,build}){
 assert.match(version,/^\d+\.\d+\.\d+$/);assert.match(String(build),/^\d+$/);assert(Number(build)>100077);
 const data=await api('/v1/builds?filter[app]=6800222762&filter[version]='+encodeURIComponent(build)+'&include=preReleaseVersion,buildBetaDetail&limit=200');
 assert(Array.isArray(data.data),'Missing Apple builds');assert(data.data.length<=1,'Ambiguous Apple build');
 if(!data.data.length)return {version,build:String(build),found:false,processingState:'NOT_YET_VISIBLE',complete:false};
 const b=data.data[0];assert.equal(b.attributes.version,String(build));
 const id=encodeURIComponent(b.id),included=data.included||[];
 const pre=included.find(x=>x.type==='preReleaseVersions'&&x.id===b.relationships?.preReleaseVersion?.data?.id)??(await api('/v1/builds/'+id+'/preReleaseVersion')).data;
 assert.equal(pre.attributes.version,version,'Apple marketing version differs');assert.equal(pre.attributes.platform,'IOS');
 const processingState=b.attributes.processingState;assert(['PROCESSING','VALID','FAILED','INVALID'].includes(processingState),'Unexpected Apple processing state');
 if(processingState!=='VALID')return {version,build:String(build),found:true,processingState,expired:!!b.attributes.expired,complete:['FAILED','INVALID'].includes(processingState)};
 const detail=included.find(x=>x.type==='buildBetaDetails'&&x.id===b.relationships?.buildBetaDetail?.data?.id)??(await api('/v1/builds/'+id+'/buildBetaDetail')).data;
 const groups=await api('/v1/builds/'+id+'/betaGroups?limit=200');assert(Array.isArray(groups.data));
 assert(!groups.links?.next,'Internal group listing needs pagination review');
 const internalGroups=groups.data.filter(g=>g.attributes?.isInternalGroup===true);
 const state=detail.attributes.internalBuildState;
 return {version,build:String(build),found:true,processingState,expired:!!b.attributes.expired,buildAudienceType:b.attributes.buildAudienceType??null,internalBuildState:state,internalGroupCount:internalGroups.length,availableToInternalTesters:state==='IN_BETA_TESTING'&&!b.attributes.expired,readyForInternalTesting:['IN_BETA_TESTING','READY_FOR_BETA_TESTING'].includes(state)&&!b.attributes.expired,complete:state!=='PROCESSING'};
}
