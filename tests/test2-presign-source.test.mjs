import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {verifySource} from '../scripts/test2-diagnostic-source.mjs';
const sha='a'.repeat(40),baseline='63a399108b884bdf74c1e3464418e41546fca844',repo='rooom-talk/rooom-ios',base='release/ios-review-candidate-20261011',candidate='codex/test2-apple-cms-policy-20261122';
const env={APPROVED_SHA:sha,GITHUB_SHA:sha,GITHUB_REPOSITORY:repo,GITHUB_REF:'refs/heads/'+candidate,CANDIDATE_PULL_REQUEST:'34'};
const definitions=[['test2-presign-check.yml',['presign-gate','profile-runtime (macos-15)','profile-runtime (macos-26)']],['ads-source-check.yml',['source-policy']],['ads-native-compile.yml',['sdk-native-compile']],['test2-rail-compile.yml',['build','rail-shade-probe']]];
function fixture(fault=''){
 const reads=[];let baseReads=0;
 return {reads,async get(path){reads.push(path);
  if(path==='branches/'+base){baseReads++;return {commit:{sha:fault==='base'||fault==='baseMoved'&&baseReads>1?'b'.repeat(40):baseline}};}
  if(path==='branches/'+candidate)return {commit:{sha:fault==='candidateMoved'?'b'.repeat(40):sha}};
  if(path==='pulls/34')return {state:fault==='closed'?'closed':'open',merged:fault==='merged',base:{ref:fault==='baseRef'?'main':base,sha:fault==='prBase'?'b'.repeat(40):baseline,repo:{full_name:fault==='baseRepo'?'other/repo':repo}},head:{ref:fault==='headRef'?'other':candidate,sha:fault==='headSha'?'b'.repeat(40):sha,repo:{full_name:fault==='headRepo'?'other/repo':repo}}};
  if(path==='actions/runs?head_sha='+sha+'&event=pull_request&per_page=100'){
   const runs=definitions.map(([file],i)=>({id:i+1,path:'.github/workflows/'+file,event:'pull_request',head_sha:fault==='runSha'?'b'.repeat(40):sha,head_repository:{full_name:fault==='runRepo'?'other/repo':repo},head_branch:fault==='runBranch'?'other':candidate,pull_requests:[{number:fault==='runPR'?35:34}],status:fault==='pending'?'in_progress':'completed',conclusion:fault==='failed'?'failure':'success'}));
   if(fault==='missingRun')runs.shift();
   if(fault==='latestFailed'||fault==='latestSkipped')runs.push({...runs[0],id:99,conclusion:fault==='latestFailed'?'failure':'skipped'});
   runs.push({...runs[0],id:1000,event:'workflow_dispatch',conclusion:'success'});
   return {total_count:fault==='pages'?101:runs.length,workflow_runs:runs};
  }
  const match=/^actions\/runs\/([1-4])\/jobs\?filter=latest&per_page=100$/.exec(path);
  if(match){const id=Number(match[1]);let jobs=definitions[id-1][1].map(name=>({name,run_id:fault==='jobRun'?99:id,status:'completed',conclusion:fault==='jobFailed'?'failure':fault==='jobSkipped'?'skipped':'success'}));
   if(fault==='missingJob')jobs.shift();if(fault==='duplicateJob')jobs.push({...jobs[0]});
   return {total_count:fault==='jobPages'?101:jobs.length,jobs};
  }
  throw Error('Unexpected GET');
 }};
}
test('exact candidate/canonical pass; newer diagnostic cannot replace PR verification',async()=>{
 const f=fixture();await verifySource(env,sha,f.get);assert.equal(f.reads.length,9);assert(!f.reads.some(p=>p.includes('1000/jobs')));
 const reads=[];await verifySource({...env,APPROVED_SHA:baseline,GITHUB_SHA:baseline,GITHUB_REF:'refs/heads/'+base,CANDIDATE_PULL_REQUEST:''},baseline,async p=>{reads.push(p);return {commit:{sha:baseline}}});assert.deepEqual(reads,['branches/'+base]);
 const sw=fs.readFileSync('.github/workflows/test2-presign-check.yml','utf8').split('  real-cms-diagnostic:')[1];assert(sw.indexOf('test "$GITHUB_SHA" = "$APPROVED_SHA"')<sw.indexOf('uses: actions/checkout'));assert.match(sw,/actions: read/);
 assert.match(fs.readFileSync('scripts/test2-diagnostic-source.mjs','utf8'),/method:'GET',redirect:'error'/);
});
test('latest PR failures/skips and wrong source/job bindings fail before secrets',async()=>{
 for(const fault of ['base','baseMoved','candidateMoved','closed','merged','baseRef','prBase','baseRepo','headRef','headSha','headRepo','pages','missingRun','runSha','runRepo','runBranch','runPR','pending','failed','latestFailed','latestSkipped','jobRun','jobFailed','jobSkipped','missingJob','duplicateJob','jobPages']){const f=fixture(fault);await assert.rejects(verifySource(env,sha,f.get),fault);}
 for(const extra of [{APPROVED_SHA:'HEAD'},{GITHUB_SHA:'b'.repeat(40)},{GITHUB_REPOSITORY:'other/repo'},{GITHUB_REF:'refs/heads/main'},{CANDIDATE_PULL_REQUEST:'34;echo unsafe'}]){const f=fixture();await assert.rejects(verifySource({...env,...extra},sha,f.get));}
 const f=fixture();await assert.rejects(verifySource(env,'b'.repeat(40),f.get));assert.equal(f.reads.length,0);
 await assert.rejects(verifySource({...env,GITHUB_REF:'refs/heads/'+base},sha,async()=>({commit:{sha}})));
});
