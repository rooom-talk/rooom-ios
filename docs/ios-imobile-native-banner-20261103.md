# i-mobile native iOS banner (staged / NOT RELEASED)

## Scope and inventory

- Candidate base: `release/ios-review-candidate-20261011` (iOS 1.5 Native generation 2).
- User-provided **i-mobile iOS SDK 2.3.4**, audited ZIP SHA-256:
  `a42e20c2c2fc87c9346f85c5bf8643c650b0b9e06ab8d44ec57b7e857f9ad0be`.
- Publisher 85650 / iPhone App media 597836 / inline 320x50 banner spot 1951334.
- Actual SDK `ImobileSdkAds.xcframework` contains arm64 and simulator library/headers.
- **No vendor binary has been committed to public Git.** The exact uploaded SDK ZIP must be made available locally on a Mac. No SDK library download or binary copy occurs at runtime.
- `rooom-ios` is a Capacitor 8 app with a UIKit keyboard owner in `SceneDelegate.swift`. Android is a TWA in a DIFFERENT repo; this iOS implementation does not solve Android.
- iPad native banners intentionally disabled until a suitable app-specific iPad spot is provided. Do not use the iPhone app ID on iPad.
- `main` remains the old 1.2 source; the 1.5 review-candidate branch is the correct base. Preserve its release identity, navigation, scroll, push, signing and keyboard owners.

## Implementation and lifecycle

The native banner (not a JavaScript ad tag) is compiled only with `ROOOM_IMOBILE_ADS`. No ad requests occur in the default app build. `RooomImobileBanner.swift` registers the approved spot once, requests the creative, and reserves **50pt plus safe-area bottom** only after actual SDK display. It hides the ad/reservation when the keyboard opens and restores when it closes; SDK no-fill/failure restores the whole Web content height. The existing keyboard owner and NotificationCenter handlers continue to move the Capacitor WebView. No Firebase, notification identity, storage, URL, browser ad, entitlement, or HTML change.

## Controlled Mac preparation (no deployment)

```sh
npm ci
npm run build
npx cap sync ios
node --test tests/ios-imobile-setup.test.mjs
node scripts/prepare-ios-imobile-sdk.mjs /absolute/path/to/imobile_for_SP_app_iOS_SDK_2.3.4.zip
```

The last step verifies the **exact archive hash**; extracts only on the Mac; stages the vendor xcframework/Swift bridging header to ignored local paths and patches the already verified Xcode project to link the static SDK in both Debug and Release. It is idempotent with the same ZIP, rejects unrecognized previous integration/configuration, and never performs App Store submission, Firebase changes or deployment.

**Order matters:** after a future `npx cap sync ios`, rerun the local preparation and all relevant checks before building; never silently ship a release without confirming the ad-enabled Xcode flags and linked SDK.

## Required before App Store upload

1. On a Mac/Xcode runner, compile a **test candidate** with the approved SDK. This repository agent has no Mac/Xcode runtime; source/static tests cannot prove native link or SDK compatibility. Resolve any iOS 2026/Xcode SDK issues before distribution.
2. Confirm the SDK privacy obligations (Apple privacy manifest/API use, IDFA/ATT where applicable, SKAdNetwork and App Store Connect privacy disclosures). The attached 2024 SDK ZIP has **no `PrivacyInfo.xcprivacy` file**. Do not claim it is compliant or upload to App Review without this check.
3. Test iPhone TOP and room with no-fill, ad displayed, keyboard open/close, safe area, orientation, foreground/background, notification receipt, first launch and app navigation. Confirm ad uses a **native bottom reservation**, never overlays the composer. iPad should have no new ad and no new spacing.
4. Verify App ID `com.rooom.talk`, production URL `https://rooom-talk.com/?rooom_native_generation=2`, and existing native generation/update behavior; do not upgrade native version/generation as part of mere SDK staging.
5. **Do not merge directly to the active review candidate** until build/runtime verification is arranged: a push to that branch runs an existing GitHub Actions workflow that uploads an IPA to App Store Connect. Normal main branch and Android remain untouched.

## Status

- [x] iPhone app spot configured in i-mobile
- [x] SDK upload checksum, headers, slices and sample inspected
- [x] Guarded Swift native banner and minimal Scene keyboard-container wiring staged
- [x] No-op default build code path and local Mac installer/test script written
- [ ] Mac/Xcode native build and archive
- [ ] Device ad/keyboard/notification acceptance
- [ ] Apple privacy/SDK version acceptance
- [ ] PR merged and TestFlight/App Store distribution

Do not generate a release CMD or claim ready-to-publish until those checks pass.
