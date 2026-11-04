# Issue 453: Web-owned initial iPad geometry

The previous document-loading reset cleared all Native insets before the asynchronous Web configure reply. Moving configure earlier in Web cannot guarantee the first UIKit layout. Native now reserves geometry in its existing layout owner before rendering; it does not implement a second screen or start SDK requests from cached data.

## Ownership and compatibility

- The existing Web monetization config remains authoritative. Validated configure updates both current SDK permission and a last-known geometry cache. OFF is persisted too.
- First install uses `public/rooom-initial-ad-layout.json`, generated from Web canonical `9eb7459c21dc1fd18bd2ee7709186d717b8c5b8a`. Use `node scripts/sync-initial-ad-layout.mjs <Web-checkout> --check` (or `--write` before a future candidate) to compare with the actual Web config. The existing Vite/cap sync pipeline bundles it; SDK staging checks the copied bytes.
- Native stores only validated configuration and uses the existing fixed-layout policy. SDK requests still require the current document's verified Web configure; navigation clears creatives/permission but retains geometry. Non-ad pages release the reserved space.
- Native advertises `fixedLayoutReservation: before-fill-v1`. Deploy the three Web modules below before installing this binary: the Web 50px portrait fallback must stop for this capability, and Web OFF must reach the cache even when the archive controller is inert. Old build 100065 retains its existing helper behavior.
- Physical shell orientation, safe areas and keyboard suppression use the existing Native policy. iPhone remains on the existing ready-only reservation. No notification, native generation, app identifier or upload workflow changes.
- Future Web changes to supported presentation/slots/OFF require no new binary. A never-before-seen Web configuration can initially show the last-known/bundled geometry until configure arrives; this fixes repeated resets for the same configuration, not advance knowledge of future server data. New unsupported SDK formats still require Native support.
- The app privacy manifest declares its app-only UserDefaults access (CA92.1), independently of SDK manifests.

## Verification and independent audit (2026-11-04)

Web related tests: 39 passed. Native source boundary assertions: 4 passed (not Swift compilation). Windows PowerShell command tests used mocked I/O: check-only performs no writes, failure paths stop, build-only dispatches exactly two pinned unsigned checks, upload stays separate. XML parsing and Xcode resource membership checked.

Real WebKit helper/CSS with modeled Native insets passed portrait/landscape cold-start/reload, delayed capability reply, ad ready/failure/release, rotation and keyboard scenarios without duplicate gaps. This does not execute UIKit. Swift policy tests were added for cache validation, Web changes, no-fill geometry, keyboard and phone behavior but were NOT executed.

Independent reviewer found and verified fixes for cached ON surviving Web OFF and missing app privacy declaration. No remaining actionable source findings. Swift compilation, built-bundle inclusion, signed build and real iPad first visible frame remain unverified by explicit user instruction. No Native build/CI, TestFlight upload, Hosting deploy or public release was executed. Commits use `[skip ci]`.

## Later operator steps (not executed)

1. Deploy only `src/features/ads/native-ipad-portrait-blank.mjs`, `src/features/ads/native-ad-adapter.mjs`, `src/features/ads/page-ad-runtime.mjs` using the existing Web scoped Hosting command, production `room-app-d04eb`. The prepared assets come from the merged Web PR. Read back these modules and confirm old build 100065 still behaves normally.
2. Run `scripts/request-testflight.ps1 -ApprovedSha <merged-iOS-SHA> -PullRequest <iOS-PR> -BuildOnly`. It verifies the merged candidate and starts only the existing source checks and unsigned SDK build. Adding `-CheckOnly` is read-only.
3. After those succeed, run the same command without `-BuildOnly`. It also checks all three public Web compatibility signatures before requesting the unchanged existing TestFlight upload workflow. Build number increases above Apple latest; this candidate remains 1.6 / generation 3. No general Store release is requested.
4. Test on iPad: terminate/relaunch and reload in landscape and portrait; empty/loading/failed ads retain two left spaces or one bottom space; rotate both ways; open/close keyboard in ROOM; check single-screen ROOM, notification entry and normal browser display. Report actual device results separately.

Do not dispatch these commands as part of this implementation task. Exact merged SHA/PR and Windows commands are in the delivery record.
