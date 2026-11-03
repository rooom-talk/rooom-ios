# iOS 1.6: one native build, remotely configurable future placements (DESIGN, NOT IMPLEMENTED)

**Owner request (2026-11-03 JST):** Prepare the next TestFlight build so later ad insertions/reordering in the RoooM room-card / room-list views require only web code changes, not another iOS binary build. It also must include the initial iPhone/iPad native fixed placements and wheel haptic feedback. The in-feed card must have the same row/card shell geometry as the neighboring rooms; it is a real ad slot, not a room.

## Android parity requirement (TN, 2026-11-03)

This iOS implementation must be designed together with [Android architecture PR #441](https://github.com/rooom-talk/rooom-app/pull/441). All ad placements (`bottom`, `rail`, `tile`, `fullRow`) and Web-controlled insertion indexes/cadence/kill switch must have a platform-neutral Web contract; do not hardwire iOS-only logic into the common room renderer. Android is **TWA**, not an Android WebView, so the ad SDK/native screen compositor strategy has NOT been confirmed. The Android app is currently portrait-primary; do not promise tablet landscape parity without Android orientation and TWA verification. Keep Android and iOS native adapters independent but agree on the format/slot capability schema before app builds.

## Clear boundary and current status

- Existing draft PR #6 only stages an **iPhone 320x50 fixed banner** and a local Mac-only i-mobile SDK installer. It DOES NOT implement the bridge, iPad spots, in-feed ads, or haptics. Keep PR draft and do not trigger the release candidate's automatic App Store Connect upload.
- The uploaded i-mobile iOS SDK **2.3.4** includes `ImobileSdkAdsNativeObject` and `getNativeAdData` with `onNativeAdDataReciveCompleted`, a vendor Swift `NativeInfeedViewController` example using **native UITableView**, and a `sendClick` method documented as used by Unity. RoooM lists are **HTML in a Capacitor WKWebView**, not a UITableView. Their vendor example is NOT a drop-in Web in-feed solution.
- The SDK's README says 2.3.4 fixes a banner-flick scroll blocker, but that does not prove our WebView overlay scrolling works. Correct impression/click accounting and the permitted use of HTML-rendered SDK asset data must be confirmed with i-mobile before choosing a production integration.
- The currently inspected Web spot/media (e.g. `597834`) is **NOT** automatically an iPad app spot; app-specific iPad and Native in-feed media/spot IDs must be registered and verified in the AP platform.
- User's iPad portrait target is a wide fixed bottom creative. **Verified** the uploaded SDK 2.3.4 Swift iPad sample (`class/ipad/TableViewControlleriPad.swift`) uses a **728x90** big banner and a **300x250** rectangle. The older PDF's `768x90` figure is inconsistent; use the SDK sample's `728x90` as the implementation target, subject to actual **AP iOS app ad-spot** availability and iPad safe-area width. Never substitute a Web spot or stretch 468x60.

## One-build native capabilities to ship **together**

1. Fixed native `iphone.bottom` banner (app spot 1951334, 320x50).
2. Fixed native `ipad.portrait.bottom` wide banner centered horizontally, reserved from the Web screen, no overlay with composer.
3. Fixed native `ipad.landscape.rail.top` and `ipad.landscape.rail.bottom` rectangles (300x250), both on the LEFT and separately tracked; enforce i-mobile SDK's rules for 2 simultaneous spots.
4. **Generic in-feed native ad slot support**, with card/list and mobile/tablet responsive sizing and a secure Web/native bridge. Support BOTH independent layouts: `tile` (one regular room-card/list-item footprint, pushing subsequent rooms back one place) and `fullRow` (a single ad container spanning every active grid/list column, inserted BETWEEN entire rows, as marked across the 3-column list in TN's 2026-11-03 screenshot). Either or both may be enabled, disabled, ordered, and positioned by Web config. Start with `tile` at slot 5; fullRow enabled only after testing. Changing 5th/10th positions, frequency, tile/fullRow, and card/list mode should not require an iOS rebuild for pre-supported formats.
5. iOS wheel haptic feedback on each real centered detent (currently Web uses `navigator.vibrate(4)` for Android and an AudioContext click; iOS requires a once-installed native `UISelectionFeedbackGenerator` bridge). Haptics must respect device support and user settings and must not affect sounds/notifications.
6. iPhone portrait-only orientation, iPad portrait + landscape, native generation/navigation, notification sounds/FCM, image attachment, composer and archive remain unchanged.

## Two explicitly required room-feed layouts (added 2026-11-03 JST)

- **Tile / in-grid mode:** visually identical OUTER dimensions, corner radius, and gap to a room tile in card mode, or one normal list item in list mode. If the chosen ad is 5th, the old 5th room becomes 6th; no real room is replaced or hidden. Ad marked clearly. The creative uses an SDK-approved size/format inside the tile; NEVER distort or stretch a provider creative.
- **Full-row / spanning mode:** insert a new **single horizontal row across the entire room-list content area** (not across the separate desktop left ad rail). For 3-column lists it occupies the combined width of the 3 columns plus gutters; in 2-column/single-column layouts it spans the current column count. In CSS Grid, the placeholder can use `grid-column: 1 / -1`. The provider creative itself remains its approved dimensions, centered or positioned within that wide row; it must not be stretched to 100% unless the SDK explicitly permits that fluid format. Place between whole room rows rather than visually slicing a row in half; when columns/viewport change, recompute insertion after a complete row.
- **Mixed feed:** support zero, one, or both variants in a feed, provided maximum concurrent SDK view count, no-fill, visibility and provider policy allow them. Device and page can choose enabled variants through Web configuration; do not assume fixed and in-feed ads can all request simultaneously.
- **Configuration contract controlled by Web (conceptual):** `{ enabled, mode: 'tile' | 'fullRow', afterRoomCount, repeatEvery, formatKey, page: 'top' | 'room', devices }`. Native bridge receives an approved `formatKey` and stable slot identity plus element geometry, NOT a hardcoded index. Keep the ad formats allowlisted in the app binary and verify the vendor can supply those formats. Existing room data remains untouched.
- **Required same-binary acceptance test:** on a single signed TestFlight binary, change only Web configuration to (1) render tile at #5, (2) switch tile to #10, (3) insert fullRow after a full 3-column list row, (4) enable both if SDK permits, (5) switch card/list and 3→2→1 columns, (6) disable ads; all without changing the IPA. Test pagination/sort/filter and WebView scroll/touch/click attribution as well.

## Format support decided from TN's AP iPhone dropdown (2026-11-03)

The i-mobile manager's **AP iPhone media 597836** offers:
- Inline smartphone banner **320x50** and smartphone big banner **320x100**.
- Inline medium rectangle **300x250** (display density can also be described as 600x500 pixels for retina).
- Fullscreen inline/popup, interstitial, and smartphone native wide. These are **different lifecycles / click and impression APIs**, not merely different widths.
- **No 728x90 choice is visible in the AP iPhone dropdown.** Do not create a smartphone banner and assume it can be presented as an iPad 728x90 ad. Check the actual iPad app media/spot availability with i-mobile first.

**One-binary requirement:** implement an allowlisted, versioned native format factory and Web-configurable placements for currently needed inline sizes (320x50, 320x100, 300x250), separately verified iPad wide banner, and native in-feed / full-row rendering if supported and compliant with the vendor. New spot IDs for these **already implemented and tested formats** should be provided by validated remote Web config instead of requiring a binary edit. The default is OFF for unused formats; there should be zero ad requests when disabled. Explicitly do NOT build speculative fullscreen, popup, or interstitial display flows just because they are in a dropdown: they require distinct user experience and SDK lifecycle, increase review/test burden, and can change the RoooM conversation experience. A new, unsupported ad format, SDK upgrade, new permissions, or Apple privacy requirements may still require a binary update. **Do not promise permanent zero-rebuilds.**

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
- [ ] TestFlight physical iPhone and iPad: fixed ads, 2 simultaneous iPad landscape rail ads, portrait bottom, TOP tile at item 5, list tile at item 5, full-row spanning 3/2/1 columns between complete rows, both variants concurrently when permitted, card/list swap, scrolling, pagination/reorder, entering rooms, no-fill, offline, keyboard/no input overlap, ads unmount, tap tracking, iOS wheel haptics, FCM and archive.
- [ ] Confirm future **Web-only** test: publish a trial Web placement change from item 5 to item 10 (on TEST2/staging app environment where allowed), verify compiled app doesn't change, then roll back via remote kill switch.
- [ ] Only then merge and upload ONE coherent candidate to TestFlight (no automatic App Store public release).

## Next action

**Next operator action:** In i-mobile `サイト/アプリ管理`, enter the already approved **iOS app/AP iPhone** media (not the PC Web media). Show the `新規広告スポット` size dropdown before registration so we can confirm the app platform's actual 728x90, 300x250, ネイティブ / ネイティブワイド options. Do not assume there is a separate AP iPad app row: the shipped iOS SDK contains iPad spots in the same Swift iOS app sample. We also need i-mobile written confirmation on in-WKWebView native feed billing/click/impression handling and concurrent SDK spots before publishing.

Do not advance a fixed-banner-only app as the 'final' update. The iPad AP spots and in-feed native spot registration plus the WebView click/impression feasibility gate are prerequisites. No actual app build, PR merge, or server deployment is authorized by this design note.
