# Independent audit: TEST2 pre-signing gate

Verdict: PASS for the implementation and unsigned/synthetic verification at `cbc15132ecc87897a26fcc388e1456863c7c641f`, based on independent source review, local mock execution and GitHub log/metadata readback on 2026-11-22. This is suitable for canonical integration after the final PR head's required checks succeed. It is not authorization to dispatch the distribution workflow, sign the app, export an IPA or upload to TestFlight. The final merged SHA must receive separate TN approval.

Base: `ec0907518d0d2523c2e440e9165ca0df6dee6d3c`, canonical branch `release/ios-review-candidate-20261011`, PR31. Audited main workflow blob: `92bb47601e980c923fcc01a27d48be1362bb2fe4`.

## Source and security findings

The TEST2 path now executes the existing live Apple version/build-maximum preflight, then the new validator, before installing signing material or starting a signed archive. Validation failure stops the job; there is no continue-on-error, weaker fallback or production CLI override for roots, time or revocation. The production certificate-installation body retains its baseline hash `7941f51e92a2ec3683f63200c217ffc1a61f3a74f36eec93bd215b19f96fb0ea`; TEST2-specific signing flags and stage checks are conditional. The shared request entry updates its audited workflow pin and requires the added TEST2 gate check.

The validator uses memory-only PKCS12 import on macOS 15+, requires one identity, compares the private key's derived public key with the certificate public key, and explicitly binds the trusted chain's first certificate to that identity. It does not export the private key or perform a signing operation. Leaf validity, Team OU, digital-signature usage, non-CA status, codeSigning EKU and critical iOS submission purpose are checked. Trust evaluation uses exact SHA256-pinned Apple root bytes, anchors-only evaluation, current time and required positive revocation evidence. Unknown/unavailable trust evidence stops rather than passing.

Both outer and inner profile CMS signatures are verified with the expected provisioning-profile signer and constrained trust. The bounded DER reader rejects duplicate keys, unsupported encodings and malformed structures. Required plist/DER values agree; the outer certificate DER and inner SHA256 must match the identity. Expiry, explicit app identifier, iOS platform, Team, App Store/TestFlight flags and the app's existing APNs production claim are checked. App ID prefix is correctly treated separately from Team ID. Critical boolean values are type-checked on both representations.

Only validated encrypted P12/profile bytes are staged, with restricted ownership/permissions. Later TEST2 steps recheck markers, context, safe numbers, expiry, exact hashes, paths and file types before identity installation, archive and export. Manual signing identity/profile are pinned. Fixed-category production errors avoid dumping underlying certificates, profiles, passwords or private keys; derived identity/profile/path metadata is masked for subsequent Actions steps.

Independent review identified and resolved inner boolean type ambiguity, missing directory ownership/mode checks, explicit chain/identity binding, incomplete keychain comparison and a CMS corruption test that could pass without modifying its intended payload. No unresolved source finding remains.

An independent Git object comparison found no change from the base in `ios`, `public`, `capacitor.config.json`, package manifests/lockfile, TEST2 preparation or official SDK staging. Native guide ownership, generic RGBA shade, ad sizes/policy/SDKs and Web assets therefore remain outside this change. This preparation does not change the earlier baseline's rotation-related ad release/recreation behavior.

## Observed results at the tested head

All six latest required checks were independently read back as completed/success for the exact tested SHA:

| Check | Successful job | Observed evidence |
| --- | --- | --- |
| presign-gate | 137115535370 | Node 8/8, zero skips; actual macOS Swift 83 checks; CMS/PKCS12/trust and production CLI rejection; complete request-entry mocks |
| version | 137115535359 | Successful exact-head check metadata |
| source-policy | 137117535418 | 25/25 source checks, 28 pure policy cases, desktop WK cases and Simulator rotation probe with no failures |
| sdk-native-compile | 137115535263 | Unsigned Simulator/device builds and archive succeeded |
| rail-shade-probe | 137115535535 | 68 assertions across 9 UIKit/WK cases, failures empty |
| TEST2 build | 137115535381 | 27/27 tests, existing UIKit/permission/race checks, unsigned Simulator/device builds and actual TEST2 archive validation |

The new gate log records Node success at 06:09:03 UTC, Swift 83 checks at 06:09:20, real synthetic CMS/PKCS12/trust/CLI checks and unchanged full keychain identity set at 06:09:21, and the final mock assertions at 06:09:23. Disposable synthetic certificates/keys exercise real Security.framework APIs; the same synthetic CA is rejected by the production CLI with pinned Apple roots, with no stage or success marker produced. These are not RoooM distribution credentials.

The actual unsigned TEST2 archive succeeded at 06:16:01 UTC. Its binary/configuration check reported app `com.rooom.talk`, endpoint `https://rooom-test2.web.app/?rooom_native_generation=3`, version `1.6.2`, validation-only build `100080`, dummy rail, Web presentation and Native rail-shade capability all present. The number is not an allocated distribution build number or an Apple upload receipt.

The independent auditor also executed the new read-only readiness entry's 25 completely mocked cases under both PowerShell 7 and Windows PowerShell 5.1, all passing. These cover fixed anchors, required presign check, forbidden product drift, stale/mismatched Web evidence and canonical drift; they perform no real network, credential-helper, signing or dispatch operation.

Earlier failures were retained as failures: malformed synthetic CA duplicate extensions, a leftover expected native mock exit code, and initial exact-head source-policy job 137115535311 timing out during `simctl install` before rotation assertions. The latter's same-source retry 137117535418 passed without changes to assertions or timeout limits. No failed attempt is counted as successful coverage.

## Limits and release boundary

Actual Apple certificate/profile expiry, revocation availability, identity eligibility and current maximum build number have not been checked with RoooM secrets in this task. The future approved distribution run must obtain those results through the new fail-closed gate; any mismatch or unknown result stops. Synthetic trust success does not prove that current Apple materials will pass.

UIKit fixtures and unsigned builds do not establish physical-device rotation, live SDK behavior, installed TestFlight behavior or user acceptance. The shade fixture explicitly retains controlled WK objects; it does not replace full production monetization rotation acceptance. No distribution workflow was dispatched, no RoooM signing secret was read, no app distribution signature/IPA export/TestFlight upload was performed, and no Firebase/public environment was changed for this preparation. Historical activities outside this preparation are documented separately and are not recharacterized by these statements.

Evidence documentation added after the tested SHA must be the reviewed three documentation files only. The final PR head must again complete its six required checks before integration. Final SHA/read-only readiness receipts belong in the final PR/output record so this audit does not imply that an as-yet untested documentation commit has passed.
