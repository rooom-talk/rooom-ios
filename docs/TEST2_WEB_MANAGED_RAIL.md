# TEST2 Web-managed iPad landscape rail

This is a dummy-placement test build, not a production ad rollout. Web PR #649 and iOS PR #21 must be reviewed together. The existing 316-point left reservation/SceneDelegate owner is reused once. TOP and room use the normal main WebView, with no new browser ad column or fixed card/list column rules. iPhone and portrait production behavior remain in the existing non-TEST2 compilation path.

## Build and delivery boundary

- `prepare-test2-rail.mjs` stages the exact TEST2 URL and only its navigation host in an ephemeral build workspace. Committed production launch configuration is unchanged.
- `ROOOM_TEST2_RAIL` excludes the production SDK lifecycle/bridge and creates one isolated WKWebView for the fixed first-party rail page. The main app retains its existing keyboard and notification owners. No production ad configuration, Firebase project configuration or DB is changed.
- The isolated store receives only TEST2's secure HttpOnly `__session` entry cookie, never Firebase authentication data or all app cookies. The user must unlock TEST2 normally. The password page is not accepted as rail-ready. Cookie updates are serialized, old navigation callbacks are rejected, expiry/background/navigation release the surface.
- The unsigned Mac workflow compiles simulator and device targets. It does not create an installable signed IPA or upload it.
- The existing manual TestFlight workflow now has an explicit `target_environment=test2` mode and internal-testing-only export. Default production mode retains the existing URL, SDK bridge and archive arguments. Unknown environment values stop before signing. `request-testflight.ps1 -Test2Rail` requires the pinned Web repository/SHA and a read-only protected-manifest check before requesting an upload.
- Do not use the historical production command for this candidate. No App Store review submission/public release is included. No signed IPA is published as a GitHub artifact.

## TN sequence

1. Obtain final independent approval of both merged candidates and the new Windows commands.
2. Run the new TEST2 Hosting command supplied in the task report. It changes five selected Web assets only and preserves the entrance lock.
3. Run the supplied TestFlight preflight in check-only mode with `-Test2Rail`, `-WebRoot` and `-WebSha`. It must find the exact deployed five assets and the unchanged entrance protection. A missing/mismatched file stops the upload path.
4. Only when ready to distribute the test build, run the same explicit TEST2 entry without `-CheckOnly`. It requests the existing manual Mac signing/upload workflow. It does not publish to the Store. Apple processing and tester assignment are separate steps.
5. In App Store Connect, TestFlight, select the new internal-only build and add it to TN's authorized internal testing group. Install that build in TestFlight on the iPad. Signing credentials/profile and tester privileges must be available in the existing Apple/GitHub accounts; no credentials should be pasted into chat.
6. Unlock TEST2 in the app, open normal TOP and a room in landscape. Capture the first dummy's `layout-a / Build N` label, all selected whole slots and normal main UI. Check rotation, return from background, entry lock expiry, keyboard and no-fill/OFF states. No scrollbar may exist inside the ad surface.
7. Keep that exact installed build. Publish a reviewed Web-only policy B changing count, order and dimensions. Re-enter the normal page or relaunch the same app (new isolated document; no Native rebuild/reinstall). Capture `layout-b / Build N`, the same N and changed slots. The A/B Web publication must use the same bounded, guarded Hosting owner after the current TEST2 state is read back.
8. Restore policy A using another reviewed Web-only publication. Record both policy hashes/build numbers/screenshots and results. Until steps 6–8 are verified, overall device acceptance is **pending**, even when compilation/browser tests pass.

## Web-only controls and remaining Native cases

The Web policy controls candidate count/order, enabled state, dimensions, spacing and padding. The current renderer makes only fitting DOM elements; it does not load advertisers. Default gap10/top16/bottom12 fits 1+4 in a 768px surface; more height can fit 1+5. Native safe area reduces available height and is intentionally respected.

Future Web advertising loaders and Web-owned CSP can change without a new Native inventory. Real ad approval, billing/tracking/consent and tags are not implemented here. New Native SDKs, privileged app bridges, new trusted top-level origins or a changed physical rail reservation still need Native review/build. The current SDK slots are not stretched to arbitrary dimensions. The test surface has no app bridge; its CSP currently blocks frames, images and connections.

Apple guidance: https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/ and https://developer.apple.com/documentation/webkit/wkwebviewconfiguration .
