import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {safeFailure} from '../scripts/test2-presign.mjs';
import os from 'node:os';import path from 'node:path';import cp from 'node:child_process';import {pathToFileURL} from 'node:url';
const swift=fs.readFileSync('scripts/test2-presign.swift','utf8'),workflow=fs.readFileSync('.github/workflows/test2-presign-check.yml','utf8');
test('all CMS layers/stages cross strict log boundary, injected data is rejected',()=>{
 const stages=swift.match(/enum CMSStage[\s\S]*?\n}/)[0].match(/case (.*)/)[1].split(',').map(s=>s.trim());
 for(const layer of ['outer','inner'])for(const stage of stages){const m=`TEST2 PRESIGN STOP: cms_${layer}_${stage}`;assert.equal(safeFailure(m+'\n'),m);}
 for(const s of ['TEST2 PRESIGN STOP: cms_outer_secret', 'TEST2 PRESIGN STOP: cms_outer_name_match\nprivate-value','TEST2 PRESIGN STOP: cms_outer_name_match\n\n','subject=private','TEST2 PRESIGN STOP: cms_OUTER_create'])assert.equal(safeFailure(s),'TEST2 PRESIGN STOP: validation unavailable');
});
test('diagnostic exits before stage write and wrapper never reads env markers',()=>{
 assert(swift.indexOf('if diagnosticOnly { print')<swift.indexOf('// Stage only after every check passes.'));
 assert.match(swift,/diagnosticOnly: diagnosticOnly/);assert.match(swift,/layer: \.outer/);assert.match(swift,/layer: \.inner/);
 assert.match(swift,/if layer == \.outer \{ try check\(\.name_match/);
 assert.match(swift,/if layer == \.inner \{ try verifyProfilePurpose\(data, content: content as Data\)/);
 assert.match(swift,/if diagnosticOnly \{ try verifyProfilePolicyEvidence\(inner\)/);
 assert(swift.indexOf('if diagnosticOnly { try verifyProfilePolicyEvidence(inner)')<swift.indexOf('do { uuid = try validateProfile'));
 assert.match(swift,/status == 0 && flags & \(UInt64\(1\) << 39\) != 0/);
 assert.match(swift,/kSecRevocationRequirePositiveResponse/);
});
test('profile diagnostics emit only reviewed enum codes, never injected values',()=>{
 const issues=swift.match(/enum ProfileIssue[\s\S]*?\n}/)[0].match(/case (.*)/)[1].split(',').map(s=>s.trim());
 for(const issue of issues){const m='TEST2 PRESIGN STOP: profile_'+issue;assert.equal(safeFailure(m+'\n'),m);}
 assert.equal(safeFailure('TEST2 PRESIGN STOP: profile_uuid_inner_missing+platform_inner_missing\n'),'TEST2 PRESIGN STOP: profile_uuid_inner_missing+platform_inner_missing');
 for(const value of ['profile_private_value','profile_uuid_inner_missing+private_value','profile_uuid_inner_missing\nSECRET'])assert.equal(safeFailure('TEST2 PRESIGN STOP: '+value),'TEST2 PRESIGN STOP: validation unavailable');
});
test('actual CLI preserves multiple reviewed profile issues and masks injected stderr/stdout',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'presign-cli-boundary-')),mock=path.join(dir,'mock.mjs');
 fs.writeFileSync(mock,"import cp from 'node:child_process';Object.defineProperty(process,'platform',{value:'darwin'});cp.spawnSync=(command)=>command==='xcrun'?{status:0}:{status:1,stdout:'SYNTHETIC-DO-NOT-LOG',stderr:process.env.MOCK_FAILURE};\n");
 try{
  const valid='TEST2 PRESIGN STOP: profile_uuid_inner_missing+platform_inner_missing';
  for(const [failure,expected]of [[valid,valid],[valid+'+private_value','TEST2 PRESIGN STOP: validation unavailable'],[valid+'\nSYNTHETIC-SECRET','TEST2 PRESIGN STOP: validation unavailable']]){
   const r=cp.spawnSync(process.execPath,['--import',pathToFileURL(mock).href,'scripts/test2-presign.mjs','--diagnose-only'],{encoding:'utf8',env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TARGET_ENV:'test2',RUNNER_TEMP:dir,MOCK_FAILURE:failure}});
   assert.equal(r.status,1);assert.equal(r.stderr,expected+'\n');assert.equal(r.stdout,'');
  }
 }finally{fs.unlinkSync(mock);fs.rmdirSync(dir);}
});
test('real workflow cannot reach distribution and secrets occur after exact source guard only',()=>{
 const job=workflow.slice(workflow.indexOf('  real-cms-diagnostic:'));
 assert.match(job,/github.ref == 'refs\/heads\/release\/ios-review-candidate-20261011'/);
 assert(job.indexOf('Verify exact diagnostic source')<job.indexOf('secrets.'));
 assert.match(job,/node scripts\/test2-presign.mjs --diagnose-only/);
 assert(!/security import|xcodebuild|codesign |upload-artifact|upload-app|request-testflight|main.yml|ROOOM_TEST2_PRESIGN_OK/.test(job));
});
