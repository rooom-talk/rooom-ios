import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {safeFailure} from '../scripts/test2-presign.mjs';
const swift=fs.readFileSync('scripts/test2-presign.swift','utf8'),workflow=fs.readFileSync('.github/workflows/test2-presign-check.yml','utf8');
test('all CMS layers/stages cross strict log boundary, injected data is rejected',()=>{
 const stages=swift.match(/enum CMSStage[\s\S]*?\n}/)[0].match(/case (.*)/)[1].split(',').map(s=>s.trim());
 for(const layer of ['outer','inner'])for(const stage of stages){const m=`TEST2 PRESIGN STOP: cms_${layer}_${stage}`;assert.equal(safeFailure(m+'\n'),m);}
 for(const s of ['TEST2 PRESIGN STOP: cms_outer_secret', 'TEST2 PRESIGN STOP: cms_outer_name_match\nprivate-value','TEST2 PRESIGN STOP: cms_outer_name_match\n\n','subject=private','TEST2 PRESIGN STOP: cms_OUTER_create'])assert.equal(safeFailure(s),'TEST2 PRESIGN STOP: validation unavailable');
});
test('diagnostic exits before stage write and wrapper never reads env markers',()=>{
 assert(swift.indexOf('if diagnosticOnly { print')<swift.indexOf('// Stage only after every check passes.'));
 assert.match(swift,/diagnosticOnly: diagnosticOnly/);assert.match(swift,/layer: \.outer/);assert.match(swift,/layer: \.inner/);
 assert.match(swift,/facts.commonName == "Apple iPhone OS Provisioning Profile Signing"/);
 assert.match(swift,/kSecRevocationRequirePositiveResponse/);
});
test('real workflow cannot reach distribution and secrets occur after exact source guard only',()=>{
 const job=workflow.slice(workflow.indexOf('  real-cms-diagnostic:'));
 assert.match(job,/github.ref == 'refs\/heads\/release\/ios-review-candidate-20261011'/);
 assert(job.indexOf('Verify exact diagnostic source')<job.indexOf('secrets.'));
 assert.match(job,/node scripts\/test2-presign.mjs --diagnose-only/);
 assert(!/security import|xcodebuild|codesign |upload-artifact|upload-app|request-testflight|main.yml|ROOOM_TEST2_PRESIGN_OK/.test(job));
});
