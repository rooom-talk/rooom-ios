# Apple profile CMS policy correction (TEST2 only)

Baseline: `63a399108b884bdf74c1e3464418e41546fca844`, the canonical release HEAD verified from GitHub on 2026-11-22. PRs #29, #30, #31, #32 and #33 are merged ancestors in that order.

## Independent findings

The previous shared `verifiedCMS` required the outer profile signer's common name for both layers. The layer parameter selected diagnostics only. This is the immediate cause of `cms_inner_name_match`. The passing synthetic suite used that same outer signer name for both layers, so it did not demonstrate compatibility with Apple's actual DER profile signer. This finding supersedes the same-signer conclusions in `test2-presign-audit.md` and `test2-presign-gate.md`.

Apple [TN3125](https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles) describes the outer CMS/plist and the separately CMS-wrapped DER profile. Modern systems use the inner DER form as the source of truth. We still validate and bind both forms before trusting entitlement, identity, Team, Bundle and expiration data.

Apple's [legacy Security policy](https://github.com/apple-oss-distributions/Security/blob/main/OSX/sec/Security/SecPolicy.c#L2304) pins the old outer issuer and common name and disables network revocation. Substituting this legacy policy for the inner CA4 signer does not solve the mismatch.

Apple's [CoreTrust public header](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/CoreTrust/CTEvaluate.h#L607) defines `CTEvaluateProvisioningProfile`. [CTConfig.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/CoreTrust/CTConfig.h#L53) defines its C ABI. [The CoreTrust policy description](https://github.com/apple-oss-distributions/xnu/blob/main/libkern/libkern/coretrust/coretrust.h#L149) identifies provisioning-profile signature/certificate-chain purpose authorization.

OID `1.2.840.113635.100.12.19` has not been independently mapped to a published Apple purpose name. It is not an allowlist entry. Authorization must come from the production-root-only Apple profile policy, demonstrated on real materials. General Apple trust or CA4 membership alone is insufficient.

## Proposed validation

- Outer: preserve the existing signer name requirement, signature and fixed-root trust checks.
- Inner: preserve cryptographic CMS signature validation, signer count, fixed production Apple roots, current-time X.509 evaluation and required positive revocation. Bind the CMS signer certificate to the evaluated chain leaf.
- Replace only the inner outer-name requirement with Apple's `CTEvaluateProvisioningProfile`, `allowTestRoots=false`, return status zero, and exact equality between the returned bounded payload and independently signature-verified CMS content.
- Load only the absolute system library path. Missing library/symbol, policy rejection, malformed returned bounds or payload disagreement stops validation. No environment or CLI bypass exists.
- Retain profile consistency, certificate hash binding, Team, explicit `com.rooom.talk`, distribution purpose, entitlements, expiration and stage guards.

The public CoreTrust header does not guarantee macOS availability, expiration or revocation semantics. Therefore those existing checks remain mandatory. Apple [CMSDecoder implementation](https://github.com/apple-oss-distributions/Security/blob/main/OSX/libsecurity_cms/lib/CMSDecoder.cpp#L451) verifies the CMS signature even when certificate trust is evaluated separately.

The initial credential-free macOS 15.8.2 test failed closed because `/usr/lib/libCoreTrust.dylib` was not available. Runtime probe job [137153534276](https://github.com/rooom-talk/rooom-ios/actions/runs/45004689163/job/137153534276) established that both `CTEvaluateProvisioningProfile` and `CTVerifyAmfiCertificateChain` are exported through the absolute system image `/usr/lib/libmis.dylib`. The implementation now uses that image, with no search-path or weaker-policy fallback. Runtime probe success is availability evidence only, not profile authorization.

## Validation evidence and constraints

Final exact-source macOS test results, real-material validation-only evidence, and independent re-audit results must be recorded in PR #34 and the TN delivery report before integration. In inspection mode only, `CTVerifyAmfiCertificateChain` must also return success and `CORETRUST_POLICY_PROVISIONING_PROFILE` (bit 39), whose purpose is explicitly documented in Apple's header. This adds an auditable purpose result without exposing the signer or allowing an OID by guesswork.

Real-material diagnostic [45011353432](https://github.com/rooom-talk/rooom-ios/actions/runs/45011353432/job/137174159446) accepted both Apple profile-purpose checks, then rejected only `profile_platform`. The bounded enum evidence also established that iOS was present, both platform arrays matched, and the remaining profile checks were satisfied. The old `platforms == ["iOS"]` condition imposed an unsupported single-platform restriction. Requiring the signed platform list to contain the actual iOS build target removes that restriction; the complete outer/inner list equality and string-array type remain mandatory. The target archive and its iOS configuration are independently checked. Missing iOS, wrong types and differing signed platform lists still stop.

These are Apple system private exports, not a public SDK compatibility guarantee. OS/provider changes fail closed. This document does not grant deployment approval. Product Native code, ad SDK/placement, PR29 shade, Web, Firebase and the existing distribution workflow are unchanged. No app signing, IPA export or TestFlight upload is authorized by this change.
