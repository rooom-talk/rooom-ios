# TestFlight iPad fixed advertisements (Issue 14)

TN's screenshots on 2026-11-06 show accepted Native configuration, an active eligible page, valid bounds and closed keyboard. Both left slots are eligible in landscape; both are ineligible in portrait. All created slots remain `awaiting-callback`. This is not proof of no-fill, a lower-slot geometry defect, or a successful display.

## Implementation

- Keep the registered APP rectangles 1951342/1951343 at 300x250 in the existing native layout owner. For these iPad slots, follow the official 2.3.4 `InlineViewController.swift`: register, delegate, start, attach and frame the view, then show once. Waiting for Ready before show was an extra application prerequisite. Whether removing it resolves the reported blank state must be verified on-device.
- Check delegate registration acceptance. Preserve SDK failure codes, read SDK status and callback-selector presence, and distinguish show acceptance from DidShow. A later Ready can recover a failed iPad fixed slot without app retry timers or extra start requests. iPhone/feed retain their Ready gate.
- Replace the temporary portrait SDK320 slot with the supplied PC/Web728 tag in a separate WKWebView. It uses a fresh configuration, nonpersistent storage, no native message handlers and no injected app code. The authenticated main Capacitor WebView is unchanged. No PC/Web ID enters the native SDK.
- Reserve exactly 90px plus the existing safe area/gap in physical portrait if 728px fits. Landscape keeps the two existing rectangles. Keyboard, rotation, narrow split view, background, navigation and OFF release the Web ad surface so hidden provider JavaScript is not retained. Returning to an eligible posture creates one surface; no app refresh timer runs.
- The first-install seed is generated from the companion Web configuration. Old apps ignore the new field; a new TestFlight build is required. The existing upload path increases CFBundleVersion; marketing version1.6/generation3 stay unchanged for this candidate. No App Store release is requested.

## Web dependency and operator path

The companion rooom-app change publishes only ad-contract.mjs, verified-app-spots.mjs, monetization-config.mjs, ipad-ad-probe.mjs and ios-ipad-portrait-728.html under src/features/ads. Browser advertisements, Android TWA, TEST2, notifications, Functions and DB are outside this change.

Use the existing `scripts/request-testflight.ps1` with the exact merged SHA and PR. `-BuildOnly` starts only unsigned checks; `-CheckOnly` performs no dispatch. Before upload, the existing entry now also checks the published 728 HTML, new configuration and contract. The unchanged manual main.yml signs/uploads only on TN's command, not as part of PR verification.

## Verification limits

Local Node contracts and offline WebKit transport are checked separately from Mac compilation. The WebKit test used the real saved provider loader with every network route fulfilled locally or aborted: 728x90, one loader/spot request path, no browser/TEST2 ad requests. It is not actual iOS WKWebView or paid fill evidence. Mac checks and device results must be recorded before claiming those stages complete.

Completion still requires real 300x250 creatives in both landscape positions and a real728x90 creative in portrait on TestFlight. A loaded HTML document, successful request, callback or empty reserved region does not satisfy that requirement. Provider registration/inventory may still need confirmation if the real response returns no ad.
