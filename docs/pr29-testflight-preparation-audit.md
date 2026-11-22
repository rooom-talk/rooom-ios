# Independent audit: PR29 TEST2 TestFlight preparation

## Verdict and exact scope

**PASS for preparation PR30 integration. Distribution signing/upload is NOT authorized or performed.** The required real unsigned TEST2 archive and actual archived binary validation have now succeeded; this verdict is not based on synthetic archive strings alone.

Reviewed/tested source: `b6fec758a7f2ed9e864dfc264cb75f14f3a272c0`, based on canonical `08239f81dd4f859f5196d801bf1a90a5c07f689d` with PR29 merged. Before final merge, any difference from this tested checkpoint must be limited to exactly these four evidence/documentation paths: `docs/TEST2_VERSION_TRAIN_REPAIR.md`, `docs/pr29-testflight-preparation.md`, `docs/pr29-testflight-web-preflight-receipt.json`, `docs/pr29-testflight-preparation-audit.md`. Other changes require renewed review/affected checks. A documentation-only final commit is not represented as a fresh execution of the product tests.

The auditor independently reviewed source, executed the27 local version/status/archive/declaration tests, authored and executed read-only preflight negative/replay tests, and read the actual successful CI/API records. Product Swift, advertising configuration, SDK/dependency pins, Capacitor settings, main signing/upload workflow and existing request entry are unchanged. `apple-testflight-preflight.mjs` changes only the inaccurate word `fresh` in its success message; its actual request/build-selection code is unchanged.

## Necessary validation corrections

The old policy always refused existing iOS1.6.2 prerelease metadata, so it would stop a subsequent build after100079. The new policy permits one valid matching iOS prerelease record, requiring a normal record type/ID and rejecting ambiguity across pagination. It still reads every App Store-version page and refuses a candidate equal to or below any registered Store version, including drafts. Malformed responses, missing platform/identity, pagination failure and Apple errors stop. This is not permission to ignore a closed/higher Store train.

Build-number safety remains separate: the existing Apple preflight must choose `100000 + main-workflow run number`, require a safe integer and require it to exceed the maximum live Apple build. The archive validator additionally rejects100079 or below and requires both PR24 presentation and PR29 shade capability markers, exact TEST2 endpoint/allowNavigation, bundle/version/build identity and the dummy-rail compile marker.

`main.yml` remains blob `81cfc5ded40b4768ce4db2d7951815a277852b0f`; no signing/export/upload entry was widened. Its separately approved upload mode rechecks canonical source and live Apple eligibility before certificate import, then checks the actual TEST2 archive before export/upload. Historical100079 encryption-declaration mutation is not part of this preparation and must not be reused for a new build.

## Completed tests and real unsigned archive

At the exact tested checkpoint, all five GitHub Actions checks were independently read as completed/success:

| Check | Successful job |
| --- | --- |
| version | 137079010765 |
| source-policy | 137079010420 |
| sdk-native-compile | 137079010290 |
| rail-shade-probe | 137080559674 |
| build (TEST2) | 137080558831 |

The new local selection passed **27/27** independently; the real TEST2 CI repeated27/27. The version/status CI's19 cases are overlapping isolated tests, not19 live Apple checks. The unchanged request entry passed the implementation owner's fully mocked Windows tests; the real credential-reading request script was not invoked.

[TEST2 run44980260790](https://github.com/rooom-talk/rooom-ios/actions/runs/44980260790) passed the existing real permission/UIKit viewport probe, coordinator races and actual Simulator/device compilation. The auditor read `BUILD SUCCEEDED` at03:34:53/03:35:38 UTC, `ARCHIVE SUCCEEDED` at03:36:14.504626 UTC, and the actual archive verifier output at03:36:14.827364 UTC:

- app `com.rooom.talk`;
- launch `https://rooom-test2.web.app/?rooom_native_generation=3`;
- version1.6.2, validation-only build100080;
- `test2DummyRailCompiled:true`, `webPresentationCapability:true`, `nativeRailShadeCapability:true`.

This real Release archive used `CODE_SIGNING_ALLOWED=NO` and `CODE_SIGNING_REQUIRED=NO`. No distribution certificate import, IPA export or Apple upload was executed. Its100080 is an unreserved validation identity, not a promised or allocated distribution build number.

The repeated real shade probe passed **68 assertions/9 cases**, failures empty, at03:26:55.982258 UTC. It uses actual extracted drawing/engine/handler blocks with real UIKit/WK transport, including trusted HTTPS-origin ON/OFF, stale/malformed/document rejection, child/about-origin refusal, alpha/frame/z-order/touch, retained fixture WK/DOM identity and real five-second lease. Its device/reservation/op-dispatch dependencies are fixtures; physical-device/full-app rotation acceptance is not implied. SDK compile/archive checks also succeeded separately.

The first TEST2 attempt137079010768 stopped before the new archive because `simctl bootstatus` timed out while CoreLocationMigrator data migration was pending. The same code/job was retried without skipping checks, changing assertions or increasing timeouts. The successful real archive above resolves the missing-archive evidence; the initial infrastructure failure is not hidden or mislabeled as a product test pass.

## Deployed Web prerequisite

Web PR655 was deployed/read back by TN. Before Native distribution, the old five-rail-file checker alone is insufficient: the new CSS, V5 controller and shade client must also match the reviewed deployed candidate.

The auditor authored/reviewed `TN-TEST2-RAIL-SHADE-native-preflight.cjs`, syntax-checked it and passed **16/16** offline self-tests, including write/destination rejection, compressed/raw/size corruption, CRLF-safe canonical matching, real content drift and manifest/gate drift. Its Git source is fixed to Web `8a783c61465330373eae8451053ea811df823e35`; every loaded repository JS/JSON module is checked before execution. The original reviewed local receipt is SHA256-bound. Shade3 raw digests remain exact to that receipt; V5/module also match canonical content. Rail5 accept only the two exact canonical LF/CRLF variants. This preserves the real Windows candidate's line endings without permitting content drift.

The implementation owner ran the real GET-only entry; the auditor read its safe receipt and matched entry SHA256 `3f022eb8cfe82b221e87da686b73ae6f5555f7949a17833b5f478c38bd3c200a` to the actual script. At **2026-11-22 12:25:48 JST** (`03:25:48.287Z`), it confirms eight assets, full original entrance configuration/version and stable manifest across end readback:2220 entries, generation `1795317051666143`, hash `934ac5e4eff33956e1bb654bbe28074f2004add8481828aaab06d00cc2414bed`. It used22 guarded GET requests; reported cloud/DB writes, dispatches, signing and uploads are all zero. Gate remains version765ae86fbf6cc59f. Full private inventory and credentials are not copied into the receipt/audit.

## Readiness entry and approval boundary

`TN-TEST2-TestFlight-preflight.ps1` was independently strengthened and passed **23/23** completely mocked cases in both PowerShell7 and Windows PowerShell5.1. It fixes tested b6fec/PR30/Web8a783/main-workflow blob and the four allowed document paths in code, validates plan agreement and a40-hex final merge SHA, checks public canonical/merged-PR metadata, checks source ancestry/document-only difference, accepts only exact-head GitHub Actions checks, and requires the reviewed eight-asset preflight script hash before executing its mandatory `--check`. It rejects stale/wrong/five-asset receipts and rereads canonical HEAD at the end. Its safe receipt records the five check IDs and explicitly sets distribution authorization false.

The original freshness implementation reparsed a PowerShell7 JSON-derived UTC `DateTime` through implicit locale-sensitive string conversion, losing its timezone and causing a safe-stop nine-hour error in Japan. The implementation owner reproduced this before final execution. The corrected entry preserves `DateTime`/`DateTimeOffset` UTC semantics directly, parses only explicit-timezone strings with invariant round-trip rules, and rejects unspecified dates. Regression cases now use Node's actual Z format and explicit+00:00 format as separate positives and stale negatives in both PowerShell versions; no freshness condition was relaxed.

At this review, that corrected entry's SHA256 is `f1d8a6c851a57176bf32d3c0468ecc33d07510b4c1cf7789539e653d7d5515a8`. It has no Git credential-helper, workflow-dispatch, signing or upload path. Its actual final merged-pin public-GET execution remains an implementation-owner completion step after PR30 merge; mock success is not substituted for that execution.

**Live Apple eligibility, final distribution build number, current signing certificate/profile validity and tester availability have not been verified in this preparation.** No new Apple API read is claimed from a CI job name: the version CI uses isolated data. The existing real Apple GET guards must run again after separate TN distribution approval and before certificate import. The completed read-only readiness command only reports preparation; it cannot authorize or dispatch the upload workflow. Approval-time inputs must explicitly select TEST2 and the final canonical SHA, not the production default.

## Product/acceptance limits

Web remains the only guide/progression/color owner. PR29 Native only draws generic Web RGBA/ON-OFF with its visual lease; no Native guide state, ad tag/ID/size/count/SDK or main-layout change was introduced by PR30. Shade commands add no lifecycle calls in the inspected integration harness. Existing portrait/background rail release/recreation remains; controlled probe resize is not proof of zero refetch during physical rotation.

Installed1.6.2(100079) has not been replaced by this work. New physical iPad/Safari/full-app first-run/rotation/SDK-fill verification must follow a separately authorized signed build, upload, processing and internal-testing availability. No production/Firebase/DB/Functions/Rules/gate change or real advertising request was performed by this preparation audit. Earlier work's disclosed Simulator-fixture ad-hoc signing incident remains historical; this preparation must not be used to rewrite that earlier task history as signing-zero.
