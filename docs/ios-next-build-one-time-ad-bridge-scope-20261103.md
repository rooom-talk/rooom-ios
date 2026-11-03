# iOS 1.6: one native build, remotely configurable future placements (DESIGN, NOT IMPLEMENTED)

**Owner request (2026-11-03 JST):** Prepare the next TestFlight build so later ad insertions/reordering in the RoooM room-card / room-list views require only web code changes, not another iOS binary build. It also must include the initial iPhone/iPad native fixed placements and wheel haptic feedback. The in-feed card must have the same row/card shell geometry as the neighboring rooms; it is a real ad slot, not a room.

## Clear boundary and current status

- Existing draft PR #6 only stages an **iPhone 320x50 fixed banner** and a local Mac-only i-mobile SDK installer. It DOES NOT implement the bridge, iPad spots, in-feed ads, or haptics. Keep PR draft and do not trigger the release candidate's automatic App Store Connect upload.
- The uploaded i-mobile iOS SDK **2.3.4** includes `ImobileSdkAdsNativeObject` and `getNativeAdData` with `onNativeAdDataReciveCompleted`, a vendor Swift `NativeInfeedViewController` example using **native UITableView**, and a `sendClick` method documented as used by Unity. RoooM lists are **HTML in a Capacitor WKWebView**, not a UITableView. Their vendor example is NOT a drop-in Web in-feed solution.
- The SDK's README says 2.3.4 fixes a banner-flick scroll blocker, but that does not prove our WebView overlay scrolling works. Correct impression/click accounting and the permitted use of HTML-rendered SDK asset data must be confirmed with i-mobile before choosing a production integration.
- The currently inspected Web spot/media (e.g. `597834`) is **NOT** automatically an iPad app spot; app-specific iPad and Native in-feed media/spot IDs must be registered and verified in the AP platform.
- User's iPad portrait target is a wide fixed bottom creative, ideally **728x90** when supported by the AP inventory/safe area; the older i-mobile SDK guide lists an iPad `768x90` format, so confirm the actual AP choices before committing to numeric dimensions. Don't stretch an existing 468x60 ad.

## One-build native capabilities to ship **together**

1. Fixed native `iphone.bottom` banner (app spot 1951334, 320x50).
2. Fixed native `ipad.portrait.bottom` wide banner centered horizontally, reserved from the Web screen, no overlay with composer.
3. Fixed native `ipad.landscape.rail.top` and `ipad.landscape.rail.bottom` rectangles (300x250), both on the LEFT and separately tracked; enforce i-mobile SDK's rules for 2 simultaneous spots.
4. **Generic in-feed native ad slot support**, with card/list and mobile/tablet responsive sizing and a secure Web/native bridge. Start with position 5 (after room 4); future positions/cadence must be controlled by Web only.
5. iOS wheel haptic feedback on each real centered detent (currently Web uses `navigator.vibrate(4)` for Android and an AudioContext click; iOS requires a once-installed native `UISelectionFeedbackGenerator` bridge). Haptics must respect device support and user settings and must not affect sounds/notifications.
6. iPhone portrait-only orientation, iPad portrait + landscape, native generation/navigation, notification sounds/FCM, image attachment, composer and archive remain unchanged.

## Minimal, recoverable architecture

- **Single source of truth:** the Web room renderer inserts objects with discriminated `kind: room | ad`; ad object is never counted as a room, never inherits room actions, never consumes room capacity, and always carries visible `広告 / Ad` marking in all 4 supported languages. Cards/rows use the same outer size/radius/gap as actual rooms, with SDK creative/assets constrained inside that shell. When no fill, remove ad element entirely rather than leaving a fake room/blank hole.
- **One native bridge installed in this next build:** versioned `capabilities`, `bindAdSlot`, `updateSlotRect`, `hideSlot`, `releaseSlot`, `hapticDetent` calls, accessible only to the exact production Web origin `https://rooom-talk.com`. Web supplies logical slot key, supported format, visibility and bounding rectangle; native owns the SDK, impression/click tracking, UIView lifecycle, caching, rate limiting and teardown. Limit total active SDK slots and deduplicate on list/filter/route/scroll changes.
- **Choice of in-feed rendering technique is a build gate:** (A) i-mobile-approved native ad object asset bridge with correct impression/click path, OR (B) SDK-owned native UIView overlay clipped and synchronized to the Web card's `getBoundingClientRect`. The latter needs tests for finger-scrolling, z-order, tap targets, keyboard, clipping, dark mode and adaptive height. **Do not implement click forwarding using internal/Unity APIs without vendor approval.** If neither is safe, report a hard blocker rather than pretending the single-build guarantee is achieved.
- Placement controls are **Web code/config** (5th, 10th, list/card modes, turn on/off, frequency). The native binary should not hardcode arbitrary insertion indexes. Keep a remote kill switch/default OFF for in-feed until TestFlight passes.
- Ad type support and provider SDK remain **native capabilities**. New SDK versions, privacy requirements, unsupported ad formats, Apple entitlement changes, or different advertisers may still require a new app build. Never promise zero future rebuilds.
- Prefer a single native owner for all ads and haptic hooks rather than several independent bridges; keep existing UIKit keyboard controller and Capacitor navigation untouched.

## Completion gates before any ONE TestFlight build

- [ ] Obtain distinct i-mobile **AP** IDs for iPad portrait wide, 2x iPad landscape rectangles, plus app-native in-feed spots for the relevant iPhone/iPad media.
- [ ] Confirm with i-mobile SDK constraints: app in-feed in WKWebView, multiple concurrent spots, valid native click/impression tracking, allowed ad asset/UIView embedding, SDK 2.3.4 on current Xcode/iOS. Review ATT/privacy disclosure.
- [ ] Implement and unit-test the bridge and renderer. Reject non-production origins, malformed coordinates, unsupported formats, unbounded ad creation and duplicate requests; start with in-feed disabled.
- [ ] Real Mac/Xcode build and artifact verification, including linked XCFramework/bridging header. No unsafe `#if`-off release without noticing.
- [ ] TestFlight physical iPhone and iPad: fixed ads, 2 simultaneous iPad landscape rail ads, portrait bottom, TOP card item 5, list item 5, card/list swap, scrolling, pagination/reorder, entering rooms, no-fill, offline, keyboard/no input overlap, ads unmount, tap tracking, iOS wheel haptics, FCM and archive.
- [ ] Confirm future **Web-only** test: publish a trial Web placement change from item 5 to item 10 (on TEST2/staging app environment where allowed), verify compiled app doesn't change, then roll back via remote kill switch.
- [ ] Only then merge and upload ONE coherent candidate to TestFlight (no automatic App Store public release).

## Next action

Do not advance a fixed-banner-only app as the 'final' update. The iPad AP spots and in-feed native spot registration plus the WebView click/impression feasibility gate are prerequisites. No actual app build, PR merge, or server deployment is authorized by this design note.
