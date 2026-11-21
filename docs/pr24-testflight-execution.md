# PR24 TEST2 TestFlight execution

TN explicitly authorized build, signing and internal TestFlight upload for this task. No App Store release, production Native build, Firebase deployment, database change or Adstir fourth-slot change is authorized. This task supersedes the prior unsigned-only limit only for this specific TEST2 candidate.

Native base:393c3ccb2cf077a91926dc163aa054704e7bb8c4 (merged PR24). Swift, iOS project, public advertising config and Capacitor production settings remain unchanged. Only TEST2 release preparation/inspection changes: candidate marketing version1.6.2 (the existing fresh-train policy rejects already registered1.6.1), actual archived TEST2 config and compiled PR24 capability verification, and GET-only Apple processing/internal-testing observation. Existing production version default1.6, bundle ID, manual-only confirmation and internal-only export remain unchanged.

Existing scripts/request-testflight.ps1 is the upload entry. It retains canonical merged-head/tree equality, required successful source/SDK/TEST2 checks, audited workflow blob and TEST2 Web/gate validation. Full TEST2 Web10-asset completion is independently verified by Web PR652's read-only completion command; no Web redeployment is required. Build number remains100000+main workflow run number and must exceed Apple's maximum and100077 before signing.

The existing Apple key owner gains only TEST2 GET-only status modes. It emits version/build/processing/internal readiness and group count, never tester addresses, tokens, keys or IPA. A manual status request cannot enter the signing job. Public artifacts are restricted to the sanitized apple-test2-status.json; signed IPA stays on the ephemeral runner and is uploaded only to Apple. No review/public release API is added.

Local tests:12 pure version/status/archive cases; Windows PowerShell actual entry with mocked dispatch/negative paths; strict YAML parse. A21-test LF snapshot matches macOS line endings; the unmodified Windows CRLF checkout has pre-existing source-literal assertion failures and is not claimed as PASS. Relevant GitHub macOS checks and Apple read-only version eligibility must complete before upload. Archive/processing results and actual version/build are recorded in the delivery packet after execution. Physical iPad acceptance remains TN's task.

Apple references:
- https://developer.apple.com/documentation/appstoreconnectapi/get-v1-builds
- https://developer.apple.com/documentation/appstoreconnectapi/internalbetastate
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/

## Uploaded build and readback-only continuation

Run79 /44918013122 uploaded1.6.2(100079) successfully at2026-11-21T15:17:14Z. Apple preflight saw previous maximum100077. The archive's actual Capacitor config is TEST2 and its binary includes TEST2 rail and PR24 presentation capability; code signing/export/upload all passed. No App Store release or Firebase/DB action occurred.

The upload job's following GET-only status observation reached Apple's VALID build and beta-detail reads, then the build betaGroups endpoint returned403. That caused only the observation step to fail after upload. Do not rerun the build/upload job. The readback-only correction retains authoritative processing/internal-testing state while recording group metadata as null/forbidden-403. Other API errors and unknown internal states still reject. A canonical CHECK_TEST2_STATUS dispatch for exact build100079 reads the existing build; signing/upload jobs are skipped. Individual tester membership or group names are not inferred from that unavailable metadata.

## Existing declaration reference (GET only)

Build100079 is Apple VALID but its internal state is MISSING_EXPORT_COMPLIANCE. The status report also reads the exact prior100077 record's usesNonExemptEncryption value for operator comparison. It does not infer the answer or write an export declaration. App/marketing/build and original binary identity remain fixed; no rebuild/upload is part of this observation.

## TN-approved declaration for existing build100079

TN explicitly approved reusing100077's false declaration for100079 after confirming encryption use is unchanged. The comparison found only the PR24 advertisement-presentation change in Native code; iOS/public/Capacitor/dependency and SDK changes are absent beyond that approved product. No encryption implementation/import was added.

The manual APPLY_TEST2_EXPORT_100079 mode targets only existing app6800222762/com.rooom.talk, IOS1.6.2/build100079, VALID/INTERNAL_ONLY/non-expired. It requires the live1000771.6.1 reference value to remain false and accepts only current null/MISSING_EXPORT_COMPLIANCE or already-false. It checks again immediately before its one-field PATCH, verifies after by GET, and skips an already-applied answer. Other build/environment, another answer, stale identity or inconsistent state stops. Original uploaded Native product trees/blobs are fixed and checked before this metadata operation. Apple does not supply an atomic compare-and-swap here; no claim is made about an unseen simultaneous external update after the final GET.

This operation changes only usesNonExemptEncryption:false on100079. It cannot run the UPLOAD_TESTFLIGHT build job and does not change App Store release, previous build, tester identity, Firebase or DB. No signing or rebuild is needed. Repository commits use [skip ci] to honor the no-rebuild instruction; relevant pure regression tests, strict workflow structure checks, PowerShell entry mocks and independent audit are still performed, followed by the explicit metadata-only action. Apple state is read afterward; READY/MISSING/group403 is not called confirmed installation for TN.
