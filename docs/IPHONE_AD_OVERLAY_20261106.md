# iPhone full Web canvas behind the existing 320×50 ad

TN explicitly includes this presentation repair with the Web picker feedback and iPad composer-icon repairs. Native canonical baseline: `237f40711514b79a2962d605e9eff25610982020` (PR #16). Web baseline: `22b0b33254a44960f6e1d6d91afcb7386c8cc73f` (PR #473).

## Existing owners and scope

Android's existing full Web viewport plus a content exclusion area is the visual reference. It cannot share the iOS native ad surface. Reuse the existing iOS SDK, ad reservation and keyboard owners instead: only `SceneDelegate` translates a phone reservation from a reduced WKWebView into a full WKWebView with a Web content exclusion area. The SDK slot class, engine, policy, spot IDs, show/failure lifecycle and iPad 300×250×2/isolated728×90 implementation are unchanged, checked against the PR #16 source hash. No Web configuration, SDK dependency, notification, app generation or upload workflow changes belong in this Native PR.

## Compatibility and rollback

The trusted existing main-frame bridge advertises `phoneOverlay.version=1` and a per-document identifier. New Web installs its phone-only CSS and apply handler, then requests the feature. The container keeps legacy constraints until the current document confirms that the current occupied bottom is applied. It rejects late replies after navigation, rotation or keyboard changes. Evaluation is bounded to geometry/state changes, with no polling/retry timer.

Old Native + new Web and new Native + old/missing Web retain legacy resize. iPad never enters the new container path. Failed/OFF/background/keyboard ad reservations still come from the existing engine. The keyboard subtraction is unchanged; the content inset is removed when its reservation is zero. Zoomed pages use legacy resize because UIKit points and zoomed CSS pixels differ. Native resets agreement at every document load. Roll back by changing the companion Web module's `PHONE_AD_OVERLAY_ENABLED` to false and reloading; no SDK or Native rollback is needed.

## Verification and handoff

The new runtime harness executes the actual container methods with deterministic UIKit/Web doubles for acknowledgement, legacy/missing helper, keyboard opening/closing, failure/recovery, stale rotation/navigation replies, rollback and iPad exclusion. Existing actual SDK lifecycle and 28-case Swift geometry checks remain. macOS unsigned SDK compilation and real WKWebView bootstrap checks run in the existing PR checks; these are not a signed TestFlight distribution.

The companion Web PR separately verifies Chromium/WebKit CSS geometry and picker behavior. TN performs actual device verification after deploying Web and installing the single new candidate: iPhone TOP/ROOM background, bottom buttons/composer, keyboard, home indicator, resume and the three iPad ads. Mocks/source checks are not evidence of real advertising fill or physical haptics.

Use the existing `scripts/request-testflight.ps1 -ApprovedSha <merged SHA> -PullRequest <this PR>` entry. Its `-CheckOnly` is the read-only preparation path. Keep iOS 1.6 and generation 3; the existing workflow increases CFBundleVersion above Apple's latest. Exact merged SHA, independent audit, CI runs and inspected CMD are recorded on the PR. Actual TestFlight dispatch/upload and production Web deployment await TN's instruction; do not execute them as part of preparation.
