# PR29 TEST2 TestFlight preparation

Base canonical release/ios-review-candidate-20261011:08239f81dd4f859f5196d801bf1a90a5c07f689d (PR29 merged). Work branch:codex/test2-rail-shade-build-preparation-20261122. Web canonical8a783c61465330373eae8451053ea811df823e35 (PR655) was deployed/read back by TN.

This preparation changes only release validation, unsigned CI and documentation. Native Swift, public advertising settings, SDK/dependency pins, Capacitor production configuration, reservation/layout and main.yml signing/export/upload workflow are unchanged. Web remains the sole tour owner; Native only paints the Web RGBA/ON-OFF. Once the capability ships, future timing/color adjustments remain Web-only.

The original fresh-train guard would reject existing1.6.2 after100079. The corrected policy permits a unique valid matching iOS prerelease record while retaining full Store-version, pagination/error and increasing-build guards. The archive validator now requires the PR29 nativeRailShadeVersion1 capability as well as PR24, actual TEST2 endpoint/allowNavigation and1.6.2/new build identity.

Unsigned TEST2 CI creates a real Release archive with the TEST2 compiler condition and validates its actual config/plist/binary. Its100080 is a validation-only identity, not reserved or uploaded to Apple. Distribution will use the existing100000+main-workflow-run-number policy and must exceed the live Apple maximum; do not promise100080 for release. Certificate import, distribution signing, IPA export, TestFlight upload, encryption declaration writes and tester assignment are not authorized by this preparation.

Local version/status/archive/declaration regressions:27/27; actual PowerShell request entry with all network/Git/Node effects mocked passes CheckOnly, rejection paths, unsigned-only and TEST2 forwarding. Tests do not contact Apple. New Mac CI and independent audit receipts are appended after execution.

Approval boundary: after TN separately authorizes distribution signing and TEST2 upload, use only the exact final canonical SHA with main.yml target_environment=test2 and confirmation=UPLOAD_TESTFLIGHT. The workflow rechecks canonical SHA and Apple version/build eligibility before certificate import, archives with TEST2 dummy rail, validates the actual binary and exports INTERNAL_ONLY. Upload is not tester availability or acceptance. Current100079 remains untouched; do not rerun its export declaration for a new build.

Live Apple candidate eligibility, final build number and current certificate/profile validity are not established by this preparation. No Apple API secret is retrieved or printed here; the existing private Mac workflow performs its guarded GETs at execution. No claim is made that physical-device verification has occurred.

Final acceptance after separately approved upload/processing: on iPad landscape, Web body and full left rail dim with the same Web RGBA throughout next/back; finish/skip clears both; interruption/reload/navigation/rotation leaves no residue. Check unchanged main frame, ad slots/sizes and no extra requests from shade commands. Existing portrait/background rail release/recreation is retained and must not be described as zero network across physical rotation.

## Executed receipts

Tested head:b6fec758a7f2ed9e864dfc264cb75f14f3a272c0. All five checks succeeded:version137079010765 (19 tests),source-policy137079010420,SDK137079010290,shade137080559674 (68 assertions/9 cases),TEST2 build137080558831. TEST2 job ran27/27 version/status/archive/declaration tests, existing permission/UIKit/races, Simulator and device compiles, then actual unsigned Release archive. At2026-11-22T03:36:14Z the actual binary validator reported TEST2 endpoint,1.6.2/validation100080,dummyrail,PR24 andPR29 capability all true. No certificate import, signing, IPA export or upload ran. The100080 identity belongs only to that ephemeral validation archive.

The first TEST2 attempt137079010768 stopped at xcrun simctl bootstatus ETIMEDOUT while the host's CoreLocation data migration was running; it never reached the new archive. Only the same unsigned job at the same source was rerun. No test deadline/assertion/skip was changed; its retry passed.

Independent Web prerequisite readback at2026-11-22T03:25:48.287Z found all8 expected assets,2220 inventory entries,generation1795317051666143,manifest SHA256934ac5e4eff33956e1bb654bbe28074f2004add8481828aaab06d00cc2414bed,unchanged full gate and22 GET requests. Writes,distribution signing,upload anddispatch were zero. See pr29-testflight-web-preflight-receipt.json. Canonical Web/module/CSS checks distinguish CRLF from LF while retaining exact reviewed deployed raw hashes for shade assets.

Safe Windows readiness entry was exercised with23 isolated mocked rejection/positive cases in both PowerShell7 and Windows PowerShell5.1 and the Web read-only checker with16 self-tests. It anchors testedSHA/PR30/WebSHA/workflow blob/four documentation paths; validates actual canonical/mergedPR andfive latest GitHub Actions checks; then requires the eight-asset Web preflight and fresh zero-write receipt. It has no signing/upload/dispatch or credential-helper path. Final source/evidence-only merge and actual complete-entry readback are recorded in TN's delivery receipt; this document does not substitute a previous candidate check for that receipt.

CI evidence:
- https://github.com/rooom-talk/rooom-ios/actions/runs/44980260790/job/137080558831
- https://github.com/rooom-talk/rooom-ios/actions/runs/44980260790/job/137080559674
- https://github.com/rooom-talk/rooom-ios/actions/runs/44980260762/job/137079010765
- https://github.com/rooom-talk/rooom-ios/actions/runs/44980260724/job/137079010420
- https://github.com/rooom-talk/rooom-ios/actions/runs/44980260649/job/137079010290
