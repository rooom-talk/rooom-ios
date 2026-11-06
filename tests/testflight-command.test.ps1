$ErrorActionPreference='Stop'
$global:testflightFixture=@{posts=@();fault=''}
$sha='a'*40
$head='b'*40
function global:git {
    $global:LASTEXITCODE=0
    if ($args -contains 'remote') { return 'https://github.com/rooom-talk/rooom-ios.git' }
    if ($args -contains 'credential') { return @('username=fixture','password=fixture-not-a-token') }
    throw 'Unexpected Git operation'
}
function global:Invoke-RestMethod {
    param($Headers,$Uri,$Method,$ContentType,$Body)
    if ($Method -eq 'Post') {
        if ($Uri -notmatch '/actions/workflows/(main|ads-source-check|ads-native-compile)\.yml/dispatches$') { throw 'Unexpected write' }
        $record=$Body | ConvertFrom-Json
        $record | Add-Member NoteProperty uri $Uri
        $global:testflightFixture.posts+=$record
        return
    }
    if ($Uri -match '/branches/') { return @{commit=@{sha=$(if($global:testflightFixture.fault -eq 'head'){'c'*40}else{$sha})}} }
    if ($Uri -match '/pulls/') { return @{merged=$true;merge_commit_sha=$sha;base=@{ref='release/ios-review-candidate-20261011'};head=@{sha=$head;repo=@{full_name='rooom-talk/rooom-ios'}}} }
    if ($Uri -match '/git/commits/') { return @{tree=@{sha=$(if($global:testflightFixture.fault -eq 'tree' -and $Uri.EndsWith($head)){'different'}else{'same'})}} }
    if ($Uri -match '/contents/') { return @{sha=$(if($global:testflightFixture.fault -eq 'workflow'){'unexpected'}else{'6e61eefa9ef0e3d44c4d02d25e593e7f489c9e7d'})} }
    if ($Uri -match '/actions/runs\?') {
        return @{workflow_runs=@('ads-source-check.yml','ads-native-compile.yml') | ForEach-Object { @{id=10;path='.github/workflows/'+$_;head_sha=$sha;status='completed';conclusion=$(if($global:testflightFixture.fault -eq 'checks'){'failure'}else{'success'})} }}
    }
    throw ('Unexpected request '+$Uri)
}
function global:Invoke-WebRequest {
    param([switch]$UseBasicParsing,$Uri,$Headers)
    if ($Uri -notmatch '^https://rooom-talk.com/src/features/ads/(native-ipad-portrait-blank.mjs|native-ad-adapter.mjs|page-ad-runtime.mjs|ad-contract.mjs|verified-app-spots.mjs|monetization-config.mjs|ios-ipad-portrait-728.html)$') { throw 'Unexpected Web request' }
    return @{StatusCode=200;Content=$(if($global:testflightFixture.fault -eq 'web'){'legacy'}else{"reply.fixedLayoutReservation==='before-fill-v1'; export async function syncNativeInitialLayoutOff; syncNativeInitialLayoutOff(globalThis,monetizationConfig); Invalid isolated iPad Web banner; https://rooom-talk.com/src/features/ads/ios-ipad-portrait-728.html; ...(tabletPortraitWebBanner !== undefined; tabletPortraitBottom:false; tabletPortraitWebBanner:{version:1,url:IPAD_WEB_BANNER_URL}; RoooMAdSurface/1; asid:1951545"})}
}
$entry=Join-Path $PSScriptRoot '../scripts/request-testflight.ps1'
& $entry -ApprovedSha $sha -PullRequest 8 -CheckOnly
if ($global:testflightFixture.posts.Count -ne 0) { throw 'CheckOnly wrote to GitHub' }
foreach($fault in @('head','tree','workflow','checks','web')) {
    $global:testflightFixture.fault=$fault
    $rejected=$false
    try { & $entry -ApprovedSha $sha -PullRequest 8 } catch { $rejected=$true }
    if (!$rejected -or $global:testflightFixture.posts.Count -ne 0) { throw ('Failed closed boundary: '+$fault) }
}
$global:testflightFixture.fault=''
& $entry -ApprovedSha $sha -PullRequest 8
if ($global:testflightFixture.posts.Count -ne 1 -or $global:testflightFixture.posts[0].inputs.approved_sha -ne $sha -or
    $global:testflightFixture.posts[0].inputs.confirmation -ne 'UPLOAD_TESTFLIGHT' -or
    $global:testflightFixture.posts[0].ref -ne 'release/ios-review-candidate-20261011') { throw 'Dispatch arguments differ' }
Write-Host 'PASS: Windows PowerShell actual entry, CheckOnly, five rejection paths and exact mocked dispatch. No network used.'
$global:testflightFixture.posts=@()
& $entry -ApprovedSha $sha -PullRequest 8 -BuildOnly -CheckOnly
if ($global:testflightFixture.posts.Count -ne 0) { throw 'BuildOnly CheckOnly dispatched' }
& $entry -ApprovedSha $sha -PullRequest 8 -BuildOnly
if ($global:testflightFixture.posts.Count -ne 2) { throw 'Expected two unsigned checks only' }
foreach($request in $global:testflightFixture.posts) {
    if ($request.uri -match '/main.yml/' -or $request.inputs.approved_sha -ne $sha -or $request.inputs.confirmation) { throw 'BuildOnly leaked an upload or lost the pinned SHA' }
}
Write-Host 'PASS: build-only uses exact SHA, never dispatches upload. All I/O mocked.'
