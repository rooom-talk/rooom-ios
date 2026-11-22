# Independent audit: Web-owned rail shade Native boundary

## Verdict

**PASS for normal PR integration, with physical-device/distribution acceptance still pending. No important unresolved product defect was found.** Reviewed Native checkpoint: `6c2930c79435f48b16ed7e50f1587144e784f5ec`, based on canonical `3f2b5db1c6eec53376062b96fbbdfc0c565fc02b` (PR24 retained). Companion Web checkpoint: `34c7dcfbf07bde228a34d1464523c7dba02b486d`, based on `a15ddc39cf4a092da5db53b3353aca5d30d8a350` (PR651–654 retained). Documentation/evidence added after these checks must not change tested product/test source; otherwise affected validation must be repeated.

The independent auditor reviewed both implementations, authored test-only UIKit and publication probes, independently executed the Web9+21 tests, and independently read the final CI logs and downloaded Native report. The auditor did not modify product source or perform distribution signing/upload/deployment.

## Product and security review

Only `ios/App/App/RooomImobileBanner.swift` changes Native product behavior. `RooomRailShade` is generic transient RGBA drawing, not an advertisement container or onboarding controller. Web V5 remains sole guide state/step/timing owner. Its existing CSS shadow and Native instruction share the computed Web color; no opacity/step inventory is duplicated in Native.

The existing presentation handler retains its compiled HTTPS host, main-frame/version and current-document checks. Shade uses its own monotonic sequence, preserving it on OFF/expiry and resetting with document identity. Malformed/nonfinite/out-of-range RGBA and lease durations are rejected; inactive OFF remains possible. Capability is advertised only on iPad and independently from the existing presentation protocol version. Old binaries receive no new shade calls.

An overlay update invokes validation/drawing only, not permission mutation, ad layout, reservation/constraints or SDK operations. The view applies RGBA once with alpha1, covers the existing full left reservation, blocks covered touches and is placed above existing views after ordinary layout. Portrait/phone/denied/uncommitted/inactive states do not show a left overlay. Explicit background suspension avoids inferring transition state from `UIApplication.applicationState`; foreground retains bounded pixels and asks Web for current state. Navigation/disposal reset the view.

The five-second renewable lease bounds a lost-clear/missing-owner failure while active. It does not guarantee continuous shade when the foreground Web thread is stalled beyond that lease. No failed/missing acknowledgment is represented as confirmed success, and Web input does not remain blocked waiting indefinitely.

## Completed verification

All four scoped jobs were independently confirmed successful at the reviewed checkpoint:

| Job | Result |
| --- | --- |
| Source/policy137068745068, run44976910995 | **25/25** source/runtime tests, **28** pure policy tests, desktop real WK bootstrap and unsigned existing UIKit placement regression passed. |
| SDK137068744617, run44976910832 | Official i-mobile SDK Simulator build, device ARM64 Release build and unsigned archive succeeded. |
| TEST2 build137068744640, run44976910821 | Actual permission, UIKit/WK viewport (`ok:true`, failures empty), coordinator races and actual Simulator/device builds passed. Build success timestamps02:47:07/02:47:52 UTC. |
| Rail shade137068744472, run44976910821 | **68 assertions, 9 cases, failures empty** in actual Simulator UIKit/WK. |

The auditor downloaded artifact14736430939, `unsigned-rail-shade-probe`; ZIP SHA256 `ed8f97bfa673045331848e514623ec292e36b2722509cbbdef46d6571f78edf6` exactly matches GitHub metadata. Its extracted source hashes match the local product source. Simulator: iPad Pro13-inch(M5), iOS26.4. The report shows main/rail loads remain1/1 through all cases, blocked requests0 and cloud writes0.

The new probe compiles the actual generic class, actual engine shade/frame methods, document permission state and actual trusted handler. It verifies316x768 cover/main708x768 atx316, actual UIColor alpha, front order, ad touch interception and a non-cover hit inside the main WK. Real WK snapshot/ON/OFF and reordered/invalid-alpha/old-document commands execute using offline `loadHTMLString` with `https://rooom-talk.com/` as base URL. About-origin and same-origin child frames are rejected by the actual handler. Direct actual-class checks cover malformed/nonfinite RGBA, invalid lease, real five-second Timer expiry, generic suspend/resume, controlled resize and document reset. There is no mocked-positive fallback if real WK transport fails.

The source/runtime SDK harness freezes the instrumented SDK call ledger, SDK view identities/frames and reservation across actual owner shade ON/color/OFF methods. It passes with zero added calls. Drawing and SDK/UIKit are explicit doubles in that harness, not proof of real creative paint/network. The separate UIKit probe supplies actual drawing/UIColor/WK behavior. Earlier test-only callback-API and optional-identity assertion defects were corrected before the successful68-assertion run; product drawing/handler blocks were unchanged by those harness corrections.

Web verification is separate: the auditor independently ran **9/9** color/client/race tests and **21/21** scoped-CMD/publication tests. The implementation owner's relevant selection totals **62/62**; the auditor reviewed its **7/7** browser result JSON with zero observed external requests. Those browser cases run real V5/client/CSS with simulated Native transport. Publication replay uses a synthetic approved baseline and blocked real network; actual CMD/candidate/dependency/publisher paths select three files, preserve the8px policy and unselected inventory, and reject unexpected gate/inventory before any writer. Real authenticated TEST2 preflight is a separate implementation-owner receipt.

## Lifecycle and remaining acceptance

No shade command adds SDK refresh, release, registration or recreation in the checked source/harness. **Existing TEST2 Native portrait/background behavior already releases the rail and recreates it on eligible return. This existing lifecycle is preserved.** The extracted UIKit resize fixture retains its two WK objects; it does not execute the entire production monetization rotation path. Physical rotation with zero ad requests is not claimed.

Device/reservation/main-frame assignment, op-envelope dispatch and unrelated presentation handlers are fixtures in the UIKit app. Real positive trusted transport exercises the production-host handler branch; the TEST2-host branch is compiled by the actual TEST2 app build. Actual lifecycle-notification delivery, complete RoooM app first paint, real SDK fill, physical Safari/iPad safe areas/OS rotation, and installed TestFlight1.6.2(100079) behavior remain unverified. A new separately authorized signed build is needed to distribute this capability; an unsigned archive is not an installable TestFlight release.

Companion Web contracts run44976407137 reports45/55 because of ten pre-existing Android TWA VM fixture failures; WebKit44976407139 succeeds. The auditor independently reproduced identical Android errors on baseline/candidate earlier and verified the relevant test/layout/workflow source remains unchanged. This is disclosed rather than called an all-CI pass or repaired outside the authorized product scope.

## Superseded signing incident

Old source-policy run44975149130 at `f1f715d3c91185d150832d78dab2fa7799f69863` completed successfully at02:20:26 UTC before the requested stop could apply. Independent source/run checks establish that its old rotation probe unconditionally ran explicit `codesign --sign -` on temporary `OfflineRotationProbe.app`: a Simulator-fixture ad-hoc signature occurred. The initially missed step was reported to TN and removed. Do not describe the complete task history as signing-zero.

The reviewed source-policy workflow has no physical RoooM distribution signing, IPA export or TestFlight upload route. Current three probe runners contain no explicit codesign call; real app builds use `CODE_SIGNING_ALLOWED=NO` and `CODE_SIGNING_REQUIRED=NO`. SDK/compiler resolution and compilation precede Simulator boot, retaining all assertions/timeouts. Current passing results do not erase the earlier test-signature incident. No Firebase deployment, production publication, DB/Functions/Rules/gate mutation or real advertisement request was performed by this independent audit.
