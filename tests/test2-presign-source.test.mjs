import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {verifySource} from '../scripts/test2-diagnostic-source.mjs';
const sha='a'.repeat(40),baseline='63a399108b884bdf74c1e3464418e41546fca844',repo='rooom-talk/rooom-ios',base='release/ios-review-candidate-20261011',candidate='codex/test2-apple-cms-policy-20261122';
const env={APPROVED_SHA:sha,GITHUB_SHA:sha,GITHUB_REPOSITORY:repo,GITHUB_REF:'refs/heads/'+candidate,CANDIDATE_PULL_REQUEST:'34'};
function fixture(fault=''){
 const reads=[];let baseReads=0;
 return {reads,async get(path){reads.push(path);
  if(path==='branches/'+base){baseReads++;return {commit:{sha:fault==='base'||fault==='baseMoved'&&baseReads>1?'b'.repeat(40):baseline}};}
  if(path==='branches/'+candidate)return {commit:{sha:fault==='candidateMoved'?'b'.repeat(40):sha}};
  if(path==='pulls/34')return {state:fault==='closed'?'closed':'open',merged:fault==='merged',base:{ref:fault==='baseRef'?'main':base,sha:fault==='prBase'?'b'.repeat(40):baseline,repo:{full_name:fault==='baseRepo'?'other/repo':repo}},head:{ref:fault==='headRef'?'other':candidate,sha:fault==='headSha'?'b'.repeat(40):sha,repo:{full_name:fault==='headRepo'?'other/repo':repo}}};
  if(path==='commits/'+sha+'/check-runs?per_page=100')return {total_count:fault==='pages'?101:5,check_runs:['presign-gate','source-policy','sdk-native-compile','rail-shade-probe','build'].filter(n=>!(fault==='missing'&&n==='presign-gate')).map(name=>({name,id:1,head_sha:fault==='checkSha'?'b'.repeat(40):sha,app:{slug:fault==='checkApp'?'other':'github-actions'},status:fault==='pending'?'in_progress':'completed',conclusion:fault==='failed'?'failure':'success'}))};
  throw Error('Unexpected GET');
 }};
}
test('exact candidate and canonical validation sources pass with GET-only requests',async()=>{
 const f=fixture();await verifySource(env,sha,f.get);assert.equal(f.reads.length,5);
 const reads=[];await verifySource({...env,APPROVED_SHA:baseline,GITHUB_SHA:baseline,GITHUB_REF:'refs/heads/'+base,CANDIDATE_PULL_REQUEST:''},baseline,async p=>{reads.push(p);return {commit:{sha:baseline}}});assert.deepEqual(reads,['branches/'+base]);
 const sw=fs.readFileSync('.github/workflows/test2-presign-check.yml','utf8').split('  real-cms-diagnostic:')[1];assert(sw.indexOf('test "$GITHUB_SHA" = "$APPROVED_SHA"')<sw.indexOf('uses: actions/checkout'));
 assert.match(fs.readFileSync('scripts/test2-diagnostic-source.mjs','utf8'),/method:'GET',redirect:'error'/);
});
test('wrong PR, refs, source, checks and moved release fail before secrets',async()=>{
 for(const fault of ['base','baseMoved','candidateMoved','closed','merged','baseRef','prBase','baseRepo','headRef','headSha','headRepo','pages','missing','checkSha','checkApp','pending','failed']){const f=fixture(fault);await assert.rejects(verifySource(env,sha,f.get),fault);}
 for(const extra of [{APPROVED_SHA:'HEAD'},{GITHUB_SHA:'b'.repeat(40)},{GITHUB_REPOSITORY:'other/repo'},{GITHUB_REF:'refs/heads/main'},{CANDIDATE_PULL_REQUEST:'34;echo unsafe'}]){const f=fixture();await assert.rejects(verifySource({...env,...extra},sha,f.get));}
 const f=fixture();await assert.rejects(verifySource(env,'b'.repeat(40),f.get));assert.equal(f.reads.length,0);
 await assert.rejects(verifySource({...env,GITHUB_REF:'refs/heads/'+base},sha,async()=>({commit:{sha}})));
});
