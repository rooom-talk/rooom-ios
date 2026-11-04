# iPad native layout handoff — 2026-11-04 JST

Request: rooom-talk/rooom-app#447. Use the existing ad-ready RoooM screen on
iPad: two landscape ad positions on the left, single-column ROOM on the right,
including when the ad service returns no fill. TN authorized native fixes,
tests, audit, merge and preparation of the next TestFlight command. No upload
or public release is authorized for the agent.

## Evidence and cause

- TestFlight 1.6 (100062) came from iOS `1fc43a5d02948b7323953ffae843d2537449f965`.
  Successful build https://github.com/rooom-talk/rooom-ios/actions/runs/41764719410
  contains the actual `-DROOOM_IMOBILE_ADS` compiler flag and compiles both
  SceneDelegate.swift and RooomImobileBanner.swift. Missing SDK compilation is
  not the explanation.
- Web canonical HEAD was `cc7e8ea29aec055c393bf3341b5d214eeea3d365` (PR #446).
  The four deployed ROOM/bootstrap files returned 200 and matched that source
  after CRLF/final-newline normalization. Module MIME is JavaScript; no CSP
  response header was present on room.html. This is not byte-exact verification.
- A normal page-context WebKit import succeeded. The original **WKUserScript at
  document end** failed in real macOS WKWebView with:
  `TypeError: Module name, '/src/features/ads/page-ad-runtime.mjs' does not resolve to a valid URL.`
  No capabilities/configure call occurred. Its empty catch hid the failure.
- The candidate uses an absolute first-party module URL. The same WKWebView test
  reached capabilities/configure, applied `data-rooom-ios16-ipad-room=1`, and loaded
  the existing stylesheet. Baseline/candidate evidence:
  https://github.com/rooom-talk/rooom-ios/actions/runs/41778527378
- Independently, `fixedLayout(...readyKeys:[])` suppressed the left reservation.
  Thus successful startup alone still could not show the rail before ad fill.
- The physical iPad's URL, runtime class state and bridge replies have not been
  captured. The WKUserScript failure is a reproduced code defect, not a claim
  that every possible cause on that particular device has been measured.

## Reuse and minimal changes

`RooomAdPolicy.fixedLayout` remains the owner of native ad geometry. The approved
two 300x250 positions, 316pt rail, safe-area checks, minimum 320pt room width,
OFF and keyboard suppression stay in this owner. Only tablet landscape space
reservation is made independent of readyKeys. An empty rail is not a fake ad;
SDK views still appear only when ready and not failed.

`RooomAdsBridgeViewController.capacitorDidLoad` still installs the bootstrap.
Native tablet identity connects directly to the **already deployed**
`src/features/room/native-ipad-modern-room.mjs` and its CSS, before starting the
shared page advertising owner. The capability gate and trusted origin/path
remain. A non-sensitive DOM status records applied/rejected/module-error.
No new ROOM DOM, copied CSS, browser ad tag or additional ad ID is introduced.

SceneDelegate.swift, AppDelegate.swift, notification settings, keyboard owners,
Web files, production settings, TEST2 and Firebase are unchanged. iPhone and
iPad portrait/archives are not enabled for additional ads. Native generation
remains 3 for the same TestFlight candidate; no production minimum is raised.

## Validation and limits

- Six existing Node source/setup tests pass on Windows with the canonical LF
  checkout. Initial Windows CRLF checkout failed LF-specific existing tests;
  checkout normalization resolved that without changing their assertions.
- Twenty pure Swift policy tests pass on macOS, including tablet no-fill,
  one-ready-ad, keyboard, OFF, portrait, safe-area and narrow-window boundaries.
- Real macOS WKWebView executes the actual emitted native bootstrap, with a
  stub capability/configure bridge and actual published modules. The test
  intentionally loads no Firebase application page and requests no SDK ads.
  It is not an iPad simulator/device or live ad-delivery test.
- SDK simulator/device ARM64/unsigned archive verification is performed by
  `ads-native-compile.yml` on the final PR revision. Source/WK checks run through
  `ads-source-check.yml`; inspect the final PR checks for current results.
- Windows PowerShell 5 runs the actual TestFlight command entry with mocked
  GitHub I/O: CheckOnly performs no write, changed HEAD/tree/workflow/failed
  checks reject, and successful dispatch forwards the exact SHA and confirmation.

Audit: diff scope is the existing native advertising owner, its tests, and the
operator command. No notification/keyboard owner file changes. Signed upload
workflow blob remains `6e61eefa9ef0e3d44c4d02d25e593e7f489c9e7d`.

## Operator path

Reuse `.github/workflows/main.yml`, the successful existing Mac build and
TestFlight upload path. Windows has Git authentication but no `gh` executable;
`scripts/request-testflight.ps1` uses that existing Git credential in memory,
never prints/stores it, and dispatches the same workflow. It accepts an exact
merged SHA and PR number, validates canonical HEAD, merge/tree equivalence,
source and SDK checks, and the unchanged audited upload workflow.

Run with `-CheckOnly` for read-only verification. Without it, **TN's execution**
requests signing and TestFlight upload. The existing workflow independently
rechecks release HEAD, chooses a build number greater than Apple's current
maximum, builds version 1.6/generation 3, and uploads only to TestFlight processing.
It does not submit App Review, release publicly or deploy Hosting. An exact
absolute Windows command is supplied in the completion message after merge.

After TN uploads/installs: open iPad landscape TOP and ROOM; check left space,
single-column ROOM, rotation, settings, input/keyboard and established
notifications. Actual ad fill is checked separately. Physical-device acceptance
is pending and is not a prerequisite for supplying the upload command.
