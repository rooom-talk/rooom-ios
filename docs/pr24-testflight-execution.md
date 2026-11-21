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
