# TEST2 pre-signing gate

Base: ec0907518d0d2523c2e440e9165ca0df6dee6d3c on release/ios-review-candidate-20261011. Dedicated branch: codex/test2-presign-identity-gate-20261122; PR31. TN authorized implementation, tests, independent audit, canonical integration and a new fixed SHA only. No main.yml dispatch, real distribution signing, IPA export or TestFlight upload is included. The earlier ec090751 distribution approval does not authorize the new source.

## Execution boundary

For TEST2 only: existing Apple app/version/global-build-maximum GET preflight -> new macOS validation -> install the exact prevalidated identity/profile -> manual exact-identity signed archive -> actual TEST2/PR24/PR29 archive validation -> manual/internal-only IPA export -> existing upload -> GET-only processing observation. Every step uses the default success dependency; no continue-on-error or fallback exists. Stage binding/expiry checks run before installation, archive and export. Product Swift, Native ad policy/SDK/config, Web tour/rail and app entitlements are unchanged. The production certificate-installation body is byte-identical after removing its new production-only condition (baseline normalized SHA2567941f51e92a2ec3683f63200c217ffc1a61f3a74f36eec93bd215b19f96fb0ea). Added signing flags and gate calls are TEST2-only.

## Checks

The new Swift command uses macOS15+ Security.framework and CryptoKit without installing a third-party parser. PKCS12 uses kSecImportToMemoryOnly so validation does not add keys to the user's/default keychain. Exactly one identity is required; certificate public key must equal the private key's derived public key, and the trusted chain's first certificate must equal that identity leaf. No private key is exported and no SecKey signing operation is used. Certificate dates, non-CA digital-signature key usage, codeSigning EKU, Apple's critical iOS submission extension, distribution CN and expected Team OU are required.

Trust is limited to the three exact public Apple roots obtained from the official PKI page, SHA256-pinned in code and repository. SecTrust uses anchors-only and an explicit positive OCSP/CRL revocation-response policy. Expired, not-yet-valid, revoked, unreachable/unknown revocation or otherwise untrusted material stops; there is no best-effort acceptance. This may stop during Apple/network outages and does not permit bypassing the gate.

Both the outer profile CMS and inner DER-Encoded-Profile CMS require one valid signature, the expected Apple provisioning-profile signer and the same pinned-root trust evaluation. CMS decoding success alone is insufficient. A bounded definite-length DER reader supports the documented profile dictionary/array/entitlement form; malformed, duplicate, unsupported or ambiguous structures stop. Required outer/inner dates, UUID, iOS platform, Team, AppIdentifierPrefix and all entitlements must agree. The outer DeveloperCertificates contains the exact identity DER; the inner contains its SHA256, each with exactly one certificate.

The App ID is exact profile prefix + com.rooom.talk; prefix need not equal Team ID. Profile TeamIdentifier, team entitlement and certificate OU must all match the expected Team. App Store/TestFlight purpose requires no ProvisionedDevices or ProvisionsAllDevices, get-task-allow strictly boolean false, beta-reports-active strictly boolean true and APNs production. The app's actual requested entitlement file must still contain only the existing APNs production claim. Integer0/1 cannot replace critical boolean values. Internal-only export and TEST2 compiler conditions are also mandatory context.

Only after all checks succeed are the original encrypted P12 and signed profile staged under RUNNER_TEMP with directory700/files600. Hashes, UUID, identity SHA1 and validity deadline bind later steps to those exact bytes. The Node checker refuses changed bytes, symlinks, wrong ownership/modes, missing markers, wrong environment, unsafe numbers, expired validity and path escape. The archive and IPA export are pinned to the same manual identity/profile.

## Privacy and test scope

Production errors are fixed categories only. No underlying CFError, certificate subject, profile contents, password or private key is printed. The PKCS12 password enters validation through the existing secret environment, not a command argument. Subsequent authorized keychain import retains the normal Apple security tool, with shell tracing off and output suppressed. Derived profile/identity/path metadata is masked before later workflow steps. No signing material is uploaded as a public artifact.

PR validation uses disposable synthetic CA/certificates/private keys/CMS, not RoooM secrets. Creating those cryptographic fixtures is not app distribution signing. Generic positive trust tests use the synthetic anchor only through test calls; production CLI hardcodes the Apple roots, live time and required revocation and rejects that same synthetic CA. Negative cases cover expiry, wrong dates/Team/app/purpose/certificate/key/password, missing fields, integer/boolean confusion, CMS payload corruption, unknown trust/revocation, staging drift and order/boundaries. Test compilation cannot add a bypass to the production CLI. Actual Apple certificate/profile eligibility remains untested until a separately approved distribution run.

## References

- https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles.md
- https://developer.apple.com/documentation/technotes/tn3161-inside-code-signing-certificates.md
- https://developer.apple.com/documentation/security/cmsdecodercopysignerstatus(_:_:_:_:_:_:_:)
- https://developer.apple.com/documentation/security/ksecrevocationrequirepositiveresponse
- https://www.apple.com/certificateauthority/
- https://images.apple.com/certificateauthority/pdf/Apple_WWDR_CPS_v3.0.pdf

Executed CI/independent-audit receipts and the final fixed SHA are recorded separately after all required results are read back. An unsigned or synthetic test result is not a claim about current Apple credentials, a signed binary, upload receipt or device acceptance.

## Executed source checkpoint

At cbc15132ecc87897a26fcc388e1456863c7c641f, all six checks passed. The presign job137115535370 executed8/8 Node tests with0 skips,83 real Swift/Security checks, actual synthetic CMS/PKCS12/trust and production-CLI rejection, keychain non-addition, and existing request-entry mocks. The new read-only Windows entry separately passed25/25 mocked cases in PowerShell7 and5.1, including missing presign-CI and product-drift rejection; the independent auditor repeated both.

The source-policy job's first Simulator installation timed out before that unchanged rotation fixture's assertions; only the same unsigned source job was rerun, and137117535418 passed without changing assertions, deadlines or source. The earlier synthetic CA fixture contained duplicate extensions from OpenSSL defaults; the gate correctly rejected it. The fixture now has an explicit CA config, and the complete positive/negative cryptographic suite passes. Neither correction weakened production checks.

CI: source137117535418/run44992218329; shade137115535535 andTEST2build137115535381/run44992218358; SDK137115535263/run44992218345; presign137115535370/run44992218370; version137115535359/run44992218336. See test2-presign-verification.json and the independent audit. Final documentation-only PR head will also complete exact-head CI before merge so the existing request entry remains usable; later execution receipts live in PR31 and TN's delivery artifacts rather than a self-referential code pin.
