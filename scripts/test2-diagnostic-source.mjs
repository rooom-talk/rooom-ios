// GET-only source authorization before the validation step receives secrets.
import cp from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo='rooom-talk/rooom-ios',base='release/ios-review-candidate-20261011',candidate='codex/test2-apple-cms-policy-20261122';
const baseline='63a399108b884bdf74c1e3464418e41546fca844';
const workflows={
 '.github/workflows/test2-presign-check.yml':['presign-gate','profile-runtime (macos-15)','profile-runtime (macos-26)'],
 '.github/workflows/ads-source-check.yml':['source-policy'],
 '.github/workflows/ads-native-compile.yml':['sdk-native-compile'],
 '.github/workflows/test2-rail-compile.yml':['build','rail-shade-probe']
};
export async function verifyPullRequestRuns(sha,prNumber,get){
 const listing=await get('actions/runs?head_sha='+sha+'&event=pull_request&per_page=100');
 if(listing.total_count>100||listing.workflow_runs.length>100)throw Error();
 for(const [path,names]of Object.entries(workflows)){
  // Diagnostic dispatches create skipped checks with the same names. They are
  // outside the PR verification domain and cannot replace its latest result.
  const run=listing.workflow_runs.filter(r=>r.event==='pull_request'&&r.path===path).sort((a,b)=>b.id-a.id)[0];
  if(!run||run.head_sha!==sha||run.head_repository.full_name!==repo||run.head_branch!==candidate||!run.pull_requests.some(p=>String(p.number)===String(prNumber))||run.status!=='completed'||run.conclusion!=='success')throw Error();
  const result=await get('actions/runs/'+run.id+'/jobs?filter=latest&per_page=100');
  if(result.total_count>100||result.jobs.length>100)throw Error();
  for(const name of names){
   const jobs=result.jobs.filter(j=>j.name===name);
   if(jobs.length!==1||jobs[0].run_id!==run.id||jobs[0].status!=='completed'||jobs[0].conclusion!=='success')throw Error();
  }
 }
}
export async function verifySource(env,head,get){
 const sha=env.APPROVED_SHA,prNumber=env.CANDIDATE_PULL_REQUEST||'';
 if(!/^[0-9a-f]{40}$/.test(sha||'')||env.GITHUB_REPOSITORY!==repo||env.GITHUB_SHA!==sha||head!==sha)throw Error();
 const release=await get('branches/'+base);
 if(env.GITHUB_REF==='refs/heads/'+base){if(prNumber||release.commit.sha!==sha)throw Error();return;}
 if(env.GITHUB_REF!=='refs/heads/'+candidate||! /^[1-9][0-9]*$/.test(prNumber)||release.commit.sha!==baseline)throw Error();
 const pr=await get('pulls/'+prNumber);
 if(pr.state!=='open'||pr.merged||pr.base.ref!==base||pr.base.sha!==baseline||pr.base.repo.full_name!==repo||pr.head.repo.full_name!==repo||pr.head.ref!==candidate||pr.head.sha!==sha)throw Error();
 await verifyPullRequestRuns(sha,prNumber,get);
 // Recheck both refs after CI/PR validation; a moved candidate stops.
 if((await get('branches/'+base)).commit.sha!==baseline||(await get('branches/'+candidate)).commit.sha!==sha)throw Error();
}
async function main(){
 const env=process.env;if(!env.GH_TOKEN)throw Error();
 const git=cp.spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});if(git.status!==0)throw Error();
 async function get(path){const r=await fetch('https://api.github.com/repos/'+repo+'/'+path,{method:'GET',redirect:'error',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+env.GH_TOKEN}});if(!r.ok)throw Error();return r.json();}
 await verifySource(env,git.stdout.trim(),get);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();console.log('TEST2 diagnostic source verified; validation only.');}catch{console.error('TEST2 DIAGNOSTIC STOP: source or required checks');process.exitCode=1;}
}
