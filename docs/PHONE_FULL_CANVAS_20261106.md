# iPhone full canvas from first paint (2026-11-06)

TN reported PR19's early reservation exposes a white Native footer before the overlay ACK. This regressed the full RoooM background requirement. TN approved a Native/Web structure adjustment: keep WK full height from startup and keep future spacing tweaks on the Web.

The phone container always excludes only the existing keyboard overlap, never ad height. It retains document/geometry ACK protection: SDK views stay hidden until the matching Web exclusion is acknowledged, then the existing layout/show path runs. Registration, SDK version, IDs, Ready/no-fill callbacks and retry ownership remain unchanged. Missing Web support keeps the full canvas and no visible ad instead of reverting to a white footer. iPad layout is untouched.

A minimal phone-only document-start seed carries verified cached/bundled geometry and route attributes. No SDK permission or static document UUID is embedded. Existing render-blocking src/core/app-viewport-shell.css owns dock/composer exclusion, so there is no post-first-paint CSS insertion dependency. Geometry changes and OFF refresh only this marked user script for the next document; other scripts retain their objects/order. The existing theme canvas/background synchronization also covers iPhone.

The existing Web overlay helper waits for the shell readiness marker before enabling, with a bounded window-load retry for delayed CSS. A missing marker fails closed. Removing the active overlay attribute restores existing no-ad safe-area rules. Native and Web validations, independent audit, exact CMD checks and limitations are recorded on the PRs. Physical first paint, actual ads and hardware keyboard/rotation remain TN device verification.

Publish the Web CSS/helper first. request-testflight.ps1 checks their readiness signatures before it can request the existing TestFlight workflow. Keep iOS1.6/generation3 and increment the build number through the unchanged upload workflow. No App Store public release or notifications/DB/BAN changes. Revert ordinary source changes to roll back; a v2 disabled Web overlay keeps full height and hides ads.
