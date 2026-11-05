# Issue 455: iPad launch and rotation canvas

2026-11-05. Source base: `87a6c6761d188f302f6183192586ce1d6a630703` (PR11). Web canonical: `d2500890d00e839593b5f2d25a1bc327755e4597`. Scope authorized in [Web Issue455](https://github.com/rooom-talk/rooom-app/issues/455): minimal Native launch/background corrections, retain Web-driven normal presentation, no elaborate overlays or delays. Build/upload/deployment were not executed during implementation.

## Evidence and ownership

The supplied 14.26-second HEVC recording was decoded locally. Around 2s, an expanding app surface shows a grey left reservation and black WebView-sized right rectangle, then TOP content appears. Around 6.2–6.9s, rotation exposes outer black wedges and an interior black band while TOP controls remain visible. Video identifies the affected surfaces, but cannot identify every compositor layer or prove an OS theme setting.

The bundled original Splash asset is the default white Capacitor image, not a black/right split image. It and the existing LaunchScreen are retained for iPhone. The app's iPad container explicitly uses #efefef, but pinned Capacitor 8.5.0 `CAPBridgeViewController.prepareWebView` uses `UIColor.systemBackground` for WKWebView and scrollView when no background is configured. The existing Web `background` bridge only updates the container; window and WebView backing surfaces were not synchronized. That color ownership mismatch is established in source; its contribution to all observed rotation pixels still needs device verification.

Web `home.css` already paints html/body with --bg. The separate black returnOverlay defaults to opacity0 and activates only for `room_return_fade=1` without a fresh preview, then fades for5s. The rapid startup switch and rotation artifact do not establish that overlay as the cause. No unrelated Web transition or CSS is changed.

## Minimal correction

- Existing `capacitorDidLoad` sets iPad WKWebView, scrollView and underPage backgrounds before Capacitor calls viewDidLoad/loadWebView. WKWebView is nonopaque so unpainted WebKit areas expose the selected canvas. No navigation delegate, network load ordering, geometry or input handler is replaced.
- Existing trusted main-frame RGB `background` operation calls the same color application method for all backing surfaces plus parent/window. It keeps the existing Web --bg source, theme observers and validation. Initial window color is set before makeKeyAndVisible; viewDidAppear reapplies the current Web-selected color after attachment, not a reset to light.
- A named #efefef initial canvas is shared by Native and a separate `UILaunchStoryboardName~ipad` resource. iPad launch uses that canvas and a static RoooM wordmark near the top. It has no room/ad snapshots, fake buttons, fixed rail dimensions, spinner, delay or custom animation. This is a visual introduction, not an exact screenshot of the dynamically positioned TOP. Default/phone LaunchScreen and Splash resources are unchanged.
- Advertisement configuration, reservation capability, ready/no-fill handling, tablet portrait50px compatibility, rotation constraints, keyboard handling, notification code, SDK/IDs and generation are unchanged. iPhone is excluded from the new color application method. Safari/Android/Web code is untouched.
- Future theme and supported ad placement/size/OFF changes still come from Web. Launch storyboard branding itself is bundled and requires a future binary if deliberately redesigned; it does not duplicate Web layout.

## Verification

15 Node source/project tests passed (including original policy/SDK setup assertions). Storyboard and plist parse as XML; named color and Xcode Resources membership were checked. Existing SDK project patcher remains additive/idempotent. Real WebKit executed the shipped bootstrap with actual home.css and stubbed app modules/transport: TOP and ROOM routing, light→dark→light, viewport rotation/keyboard-class changes, phone exclusion and unrelated-origin exclusion passed (4 cases). ROOM test uses shared TOP color fixture, not a full live ROOM session. This proves the Web color protocol, not UIKit pixels.

Independent read-only audit found no actionable defect. Tests never execute the actual iOS view/window, Interface Builder compilation or installed app. No Swift build, Native workflow, TestFlight upload, Hosting deploy, DB change or Store release was performed. Commit/merge use `[skip ci]`; automatic workflows must remain skipped for this task.

The existing later unsigned Xcode workflow now also verifies the compiled iPad launch storyboard and Info.plist selector in App.app. That workflow and all actual iPad visual checks remain pending. Do not claim the OS compositor's outer rotation wedges or old cached launch snapshots are proven fixed. Apple notes subsequent launches may use system snapshots; static launch content cannot make live rooms/ads available before the app starts.

## Operator handoff

No Web asset changed, so there is no Hosting deploy command for this issue. Use the already prepared `scripts/request-testflight.ps1` with this PR's exact merged SHA/number:

1. `-BuildOnly -CheckOnly`: read-only candidate preflight.
2. `-BuildOnly`: explicitly starts source checks and unsigned SDK/Xcode build; does not upload.
3. After those succeed, omit BuildOnly to use the unchanged TestFlight workflow. It verifies prior Web compatibility assets and picks a build number greater than Apple latest (must exceed reported #66); generation remains3 for the same candidate. No public Store release.

Exact Windows commands are supplied after merge. No user Git sync/download/copy is needed; the local command entry is prepared. After installation, check iPad cold launch/relaunch in both orientations, repeated rotations, light/dark TOP and ROOM, failed ads, keyboard open/close and notification entry. Compare iPhone/browser unchanged behavior. If any black region remains, capture the new build's video to distinguish WebKit backing from OS animation rather than adding an overlay.

References: [Apple launch guidance](https://developer.apple.com/design/human-interface-guidelines/launching), [launch snapshot debugging](https://developer.apple.com/documentation/technotes/tn3118-debugging-your-apps-launch-screen), [WKWebView underPageBackgroundColor](https://developer.apple.com/documentation/webkit/wkwebview/underpagebackgroundcolor). Capacitor source inspected from locked npm package `@capacitor/ios@8.5.0`, without installing/upgrading dependencies.
