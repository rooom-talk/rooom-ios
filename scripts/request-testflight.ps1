param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{40}$')][string]$ApprovedSha,
    [Parameter(Mandatory=$true)][int]$PullRequest,
    [switch]$CheckOnly,
    [switch]$BuildOnly
)
$ErrorActionPreference = 'Stop'
$repo = 'rooom-talk/rooom-ios'
$branch = 'release/ios-review-candidate-20261011'
$root = Split-Path -Parent $PSScriptRoot
$origin = (& git -C $root remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0 -or $origin -ne 'https://github.com/rooom-talk/rooom-ios.git') { throw 'Unexpected repository' }
$credentialLines = "protocol=https`nhost=github.com`n`n" | & git -C $root credential fill
if ($LASTEXITCODE -ne 0) { throw 'Existing GitHub authentication is unavailable' }
$credential = @{}
foreach ($entry in $credentialLines) {
    $pair = $entry -split '=', 2
    if ($pair.Length -eq 2) { $credential[$pair[0]] = $pair[1] }
}
if (!$credential.username -or !$credential.password) { throw 'Existing GitHub authentication is unavailable' }
$headers = @{Accept='application/vnd.github+json';Authorization='Basic '+[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($credential.username+':'+$credential.password))}
function Read-GitHub([string]$path) {
    Invoke-RestMethod -Headers $headers -Uri ('https://api.github.com/repos/'+$repo+'/'+$path) -Method Get
}
$release = Read-GitHub ('branches/'+$branch)
if ($release.commit.sha -ne $ApprovedSha) { throw 'Release HEAD changed; stop and have the candidate reviewed again' }
$pr = Read-GitHub ('pulls/'+$PullRequest)
if (!$pr.merged -or $pr.merge_commit_sha -ne $ApprovedSha -or $pr.base.ref -ne $branch -or $pr.head.repo.full_name -ne $repo) { throw 'Approved SHA is not the merged, reviewed release PR' }
$merged = Read-GitHub ('git/commits/'+$ApprovedSha)
$tested = Read-GitHub ('git/commits/'+$pr.head.sha)
if ($merged.tree.sha -ne $tested.tree.sha) { throw 'Merged content differs from the tested PR; inspect before upload' }
$workflow = Read-GitHub ('contents/.github/workflows/main.yml?ref='+$ApprovedSha)
if ($workflow.sha -ne '6e61eefa9ef0e3d44c4d02d25e593e7f489c9e7d') { throw 'TestFlight workflow differs from the audited manual-only upload path' }
if ($BuildOnly) {
    if ($CheckOnly) { Write-Host 'BUILD PREFLIGHT PASS: no workflow dispatched, no Native build or upload.'; return }
    foreach ($name in @('ads-source-check.yml','ads-native-compile.yml')) {
        if ((Read-GitHub ('branches/'+$branch)).commit.sha -ne $ApprovedSha) { throw 'Release changed during preflight' }
        $request = @{ref=$branch;inputs=@{approved_sha=$ApprovedSha}} | ConvertTo-Json -Depth 4
        Invoke-RestMethod -Headers $headers -Uri ('https://api.github.com/repos/'+$repo+'/actions/workflows/'+$name+'/dispatches') -Method Post -ContentType 'application/json' -Body $request | Out-Null
    }
    Write-Host 'Requested pinned source checks and unsigned SDK build only. No signing, TestFlight upload or deployment.'
    return
}
$checkSha=$ApprovedSha
$runs = Read-GitHub ('actions/runs?head_sha='+$checkSha+'&per_page=100')
if (@($runs.workflow_runs).Count -eq 0) {
    $checkSha=$pr.head.sha
    $runs = Read-GitHub ('actions/runs?head_sha='+$checkSha+'&per_page=100')
}
foreach ($path in @('.github/workflows/ads-source-check.yml','.github/workflows/ads-native-compile.yml')) {
    $run = @($runs.workflow_runs | Where-Object { $_.path -eq $path -and $_.head_sha -eq $checkSha } | Sort-Object id -Descending | Select-Object -First 1)
    if ($run.Count -ne 1 -or $run[0].status -ne 'completed' -or $run[0].conclusion -ne 'success') { throw ('Required candidate verification is not successful: '+$path) }
}
$webChecks=@{
    'native-ipad-portrait-blank.mjs'="reply.fixedLayoutReservation==='before-fill-v1'"
    'native-ad-adapter.mjs'='export async function syncNativeInitialLayoutOff'
    'page-ad-runtime.mjs'='syncNativeInitialLayoutOff(globalThis,monetizationConfig)'
}
foreach($file in $webChecks.Keys) {
    $webHelper = Invoke-WebRequest -UseBasicParsing -Uri ('https://rooom-talk.com/src/features/ads/'+$file) -Headers @{'Cache-Control'='no-cache'}
    if ($webHelper.StatusCode -ne 200 -or !$webHelper.Content.Contains($webChecks[$file])) {
        throw ('Deploy the compatible Web layout helpers before requesting upload: '+$file)
    }
}
Write-Host ('Verified merged candidate '+$ApprovedSha+'; app com.rooom.talk; iOS 1.6; generation 3.')
Write-Host 'The existing Mac workflow selects a build number greater than Apple latest. No Hosting or public Store release.'
if ($CheckOnly) { Write-Host 'CHECK ONLY: no workflow dispatched, no signing or upload.'; return }
if ((Read-GitHub ('branches/'+$branch)).commit.sha -ne $ApprovedSha) { throw 'Release changed during preflight' }
$body = @{ref=$branch;inputs=@{approved_sha=$ApprovedSha;confirmation='UPLOAD_TESTFLIGHT'}} | ConvertTo-Json -Depth 4
Invoke-RestMethod -Headers $headers -Uri ('https://api.github.com/repos/'+$repo+'/actions/workflows/main.yml/dispatches') -Method Post -ContentType 'application/json' -Body $body | Out-Null
Write-Host 'Requested the existing TestFlight build/upload workflow. Apple processing and device verification are still pending.'
Write-Host 'https://github.com/rooom-talk/rooom-ios/actions/workflows/main.yml'
