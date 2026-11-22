// GET-only source authorization before the validation step receives secrets.
import cp from 'node:child_process';
const repo='rooom-talk/rooom-ios',base='release/ios-review-candidate-20261011',candidate='codex/test2-apple-cms-policy-20261122';
const baseline='63a399108b884bdf74c1e3464418e41546fca844';
async function main(){
 const sha=process.env.APPROVED_SHA,prNumber=process.env.CANDIDATE_PULL_REQUEST||'';
 if(!/^[0-9a-f]{40}$/.test(sha||'')||process.env.GITHUB_REPOSITORY!==repo||!process.env.GH_TOKEN)throw Error();
 const git=cp.spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});
 if(git.status!==0||git.stdout.trim()!==sha)throw Error();
 async function get(path){const r=await fetch('https://api.github.com/repos/'+repo+'/'+path,{method:'GET',redirect:'error',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GH_TOKEN}});if(!r.ok)throw Error();return r.json();}
 const release=await get('branches/'+base);
 if(process.env.GITHUB_REF==='refs/heads/'+base){if(prNumber||release.commit.sha!==sha)throw Error();return;}
 if(process.env.GITHUB_REF!=='refs/heads/'+candidate||! /^[1-9][0-9]*$/.test(prNumber)||release.commit.sha!==baseline)throw Error();
 const pr=await get('pulls/'+prNumber);
 if(pr.state!=='open'||pr.merged||pr.base.ref!==base||pr.base.sha!==baseline||pr.base.repo.full_name!==repo||pr.head.repo.full_name!==repo||pr.head.ref!==candidate||pr.head.sha!==sha)throw Error();
 const checks=await get('commits/'+sha+'/check-runs?per_page=100');
 if(checks.total_count>100)throw Error();
 for(const name of ['presign-gate','source-policy','sdk-native-compile','rail-shade-probe','build']){
  const c=checks.check_runs.filter(c=>c.name===name&&c.head_sha===sha&&c.app.slug==='github-actions').sort((a,b)=>b.id-a.id)[0];
  if(!c||c.status!=='completed'||c.conclusion!=='success')throw Error();
 }
 // Recheck both refs after CI/PR validation; a moved candidate stops.
 if((await get('branches/'+base)).commit.sha!==baseline||(await get('branches/'+candidate)).commit.sha!==sha)throw Error();
}
try{await main();console.log('TEST2 diagnostic source verified; validation only.');}catch{console.error('TEST2 DIAGNOSTIC STOP: source or required checks');process.exitCode=1;}
