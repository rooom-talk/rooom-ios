# ACT5 native ad implementation candidate - 2026-11-03

This supersedes the **implementation status** in earlier design documents. It does not supersede the agreed rollout scope. The old single-iPhone hardcoded banner has been replaced with configurable phone/tablet fixed slots and native archive-feed rendering. All new advertising remains OFF through the first-party Web config. No TestFlight/Store upload or production deployment has been performed.

## Source implemented

`RooomImobileBanner.swift` now contains a pure Foundation configuration/layout policy plus the opt-in UIKit/SDK implementation. Reuses the source already registered in App.xcodeproj; no extra project file references are required. 320x50/320x100 phone bottom; 728x90 tablet portrait only if safe-area width permits; two 300x250 tablet left-rail placements. No-fill/keyboard hides and releases reserved space. The policy never stretches creatives or invents spot IDs.

`RooomAdsBridgeViewController` subclasses the existing Capacitor bridge without replacing its navigation delegate. Installs a main-frame, exact-origin HTTPS message-with-reply handler. Supports capability discovery, validated config, native-feed preparation, bounded rect updates, hide/release, selection haptics. Native configuration starts OFF and first-party `page-ad-runtime.mjs` from the companion Web PR configures it. No old app can invoke code it does not contain.

The feed uses actual SDK native objects and documented `addClickFunction` on native label/image views, not HTML-rendered assets or the internal/Unity sendClick API. Feed native views are clipped children of WKWebView.scrollView; Web supplies placeholder geometry and ancestor occlusion. This is implemented candidate code; physical scroll/touch correctness and provider viewability/billing still require verification.

`SceneDelegate.swift` remains the single keyboard owner. Ad-enabled builds adjust its existing bottom constraint and a leading constraint; non-ad builds keep original keyboard-overlap behavior. The previous JavaScript keyboard-class string used a literal `(enabled)` instead of Swift interpolation; this candidate fixes that to the actual boolean. This is a behavior fix that must be covered in physical keyboard acceptance, not described as byte-identical Scene code.

AppDelegate/FCM, app identity, entitlements, Info.plist orientation, Capacitor server URL/allowNavigation, generation/version, signing and existing release workflow remain unchanged. Native SDK ZIP and XCFramework are not committed to this public repository.

## Verification executed

- Supplied SDK archive CRC and SHA256 verified; public header and NativeWideViewController sample inspected for the APIs used.
- Swift 6.2.1 on Linux compiled and executed `tests/ad-policy-main.swift`: **16 PASS**. Config/OFF, safe-area dimensions, portrait/landscape/short-window geometry, keyboard/no-fill, first-party origin/page, invalid rect and IDs, native feed configuration.
- Both changed Swift source files passed `swiftc -frontend -parse -D ROOOM_IMOBILE_ADS`: **syntax only**, not UIKit/vendor API typechecking or iOS linking.
- Companion rooom-app shared tests: **11 Node tests PASS**, **8 offline Chromium mock-ad scenario groups PASS**, including actual existing keyed and legacy renderers, tile/fullRow, 3/2/1 columns, re-render/no duplicate request, no-fill, empty during pending load, modal occlusion and existing wheel feedback event.
- Updated installer source tests and a separate `ads-source-check.yml` workflow are provided. This workflow performs source/policy checks only and contains no signing secrets, App Store upload, Firebase changes, or vendor-network request. Its actual hosted result is separate from local evidence.

## Not ready to release

1. Real Mac/Xcode SDK typecheck/link/archive has NOT run here. Source parser success is not SDK compatibility proof.
2. iPad APP wide-banner and iPhone/iPad native-feed APP spot IDs remain unprovided/unverified. **Confirmed 2026-11-03 from operator's i-mobile 'アプリ設定取得' screenshots and exact pasted provider sample:** iPad landscape left upper rectangle (300x250, 600x500 asset) uses APP iPhone platform publisher `85650`, media `597836`, spot **`1951342`**; left lower rectangle uses the **same publisher/media** and its distinct spot **`1951343`**. The SDK's sample positions an ad bottom-center only as an example; RoooM must use its own non-overlapping LEFT top/bottom rail, not copy sample coordinates. Never reuse PC/SP media IDs 597834/597835. Known iPhone app bottom banner is publisher `85650`, media `597836`, spot `1951334`; production config is still OFF. The app uses validated remote slot config; do not hardcode ad IDs as release constants. These registrations do NOT yet prove two simultaneous native placements or usable iPad SDK inventory.
3. Confirm provider support/measurement for this WKWebView-adjacent native integration, concurrent spots, modern SDK privacy/ATT requirements. This ZIP has no PrivacyInfo.xcprivacy; do not invent privacy declarations from guessing.
4. Existing release workflow checks an earlier exact SceneDelegate hash and auto-uploads on the release branch. It has NOT been bypassed. Before a real candidate, verify the new native build then update its explicit source/version/generation checks and controlled SDK supply, with no surprise Store upload.
5. Android TWA does not own its browser drawing surface. Companion PR #441 implements shared Web policy but no Android native display adapter; no TWA-to-WebView migration was made.
6. Physical iPhone/iPad tests: fixed ads, rotation, keyboard/input, notifications, archive scroll, ad clicks/impressions, and same signed binary with Web-only tile-to-fullRow/position/OFF changes are still required.

Do not call the one-build goal complete yet. No production activation command or automatic release is appropriate at this stage. Keep the feature PR separate from the active release branch.
