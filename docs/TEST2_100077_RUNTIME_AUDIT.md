# TEST2 build100077 runtime mismatch audit

## Confirmed and unknown

Run44897483168 compiled App with both ROOOM_IMOBILE_ADS and ROOOM_TEST2_RAIL, archived/exported 1.6.1 build100077 and uploaded successfully. It generated ios/App/App/capacitor.config.json and copied that resource into App.app. The old guard checked the repository-root JSON, not the generated file or archived/exported bundle contents. Original signed IPA was ephemeral and not preserved as a public artifact.

Therefore the actual100077 bundled JSON and actual device runtime host cannot be recovered from these logs. Source inspection finds no TEST2 layout path creating the production Native SDK slots: layout returns before entry creation and its bridge refuses production commands. Capacitor8.5.0 starts config.appStartServerURL; its persisted serverBasePath affects local assets and is reset on a new binary, not a stored production server host. These are evidence boundaries, not a diagnosis that TN installed a wrong app or that cookies/cache caused the report.

## Changes

Exact TEST2 config checks after Capacitor sync inspect root and generated JSON. Archive and exported IPA checks inspect actual capacitor.config.json, bundle identity, marketing/build numbers and a compiled-mode marker before upload. An unsigned Release archive using the same pipeline exercises the packaged guard without signing/uploading.

TEST2 avoids the production Web advertising bootstrap and refuses SDK start calls even if invoked accidentally. Production compilation retains its existing code. An optional-mode conditional is excluded when checking the pinned production SDK source hash.

In the existing iPad rail's top margin, a noninteractive label reports TEST2/build/actual main-page host/dummy. It does not create a second ad rail or a separate inspection page. Existing first dummy also reports Web revision/build. Runtime diagnostics log host/path/build only, never query strings, cookies or UID. DOM mode/build markers identify the executing Native build.

The previously conservative version policy rejected any existing1.6.1 prerelease train, which would prevent uploading another test build after100077. It now permits a newer build in a TestFlight-only train while still requiring1.6.1 above every registered iOS App Store version (including drafts) and validating Apple records. Existing build-number increase and all signing/internal-only/SHA guards remain. Apple may still reject a later request; no API lookup guarantees acceptance.

## Required TN acceptance

Actual100077 runtime URL remains unknown until device evidence is obtained. No claim of root-cause resolution or physical acceptance is made. After TN approves and installs a newly guarded build, open that exact build via TestFlight and inspect the label within normal TOP and room: expected current build, rooom-test2.web.app, dummy. Then unlock TEST2 normally; dummy tiles require its valid entry cookie. A valid mode/host label with absent dummy narrows failure to eligibility/cookie/document loading; absence of label means that instrumented Native controller is not executing and must not be reported as ad success.

Check landscape/rotation/re-entry and same-build Web configuration A/B on the normal room surface. Do not delete cookies, reinstall, reset DB or erase state as a speculative fix. Logs and simulated/browser/unsigned archive results are separate from real-device acceptance. No deployment or TestFlight re-upload was performed by this work.
