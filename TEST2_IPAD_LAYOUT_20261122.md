# TEST2 iPad canvas and inactive layout

Canonical baseline verified remotely on 2026-11-22 JST: c3d00078e99a088759f20aec79c921e29c988b17, release/ios-review-candidate-20261011. Related PR29/34 remain ancestors. Fresh checkout; no historical local source used as authority.

## Cause and scope

TEST2 layout() mixed active application state with geometric eligibility. Any inactive layout pass zeroed the reservation, which SceneDelegate converts directly to the Web leading constraint. The Web then correctly responded to the enlarged viewport; no Web breakpoint modification is required. Activity now gates creation/visibility after posture-dependent reservation calculation. willResignActive hides the retained TEST2 surface via presentationVisible=false, preventing asynchronous finish callbacks from revealing it. Repeated interruptions reuse the same instance. Ineligible orientation, page, keyboard, explicit Web OFF and insufficient width still release it. Production SDK lifecycle is unchanged.

TEST2 rejected the existing background operation before its production-only handler. The existing temporary presentation cover also reverted to the fixed initial canvas at commit. Web-only theme synchronization therefore cannot solve the boundary. The appearance-only background handler is reused before TEST2's SDK refusal, with exact build-specific main-frame origin/current URL, HTTPS port, version and finite integral non-boolean RGB validation. It paints the existing canvas surfaces and pending cover only. Web still selects the color and owns the separate RGBA shade. No new ad permission, SDK, slot, dimensions, 8px policy or SceneDelegate change.

## Verification and boundaries

Independent reviewer inspected the cause and product changes and authored actual-source Swift extraction tests for inactive geometry and background security. Windows source/Node checks pass; unsigned macOS Swift/UIKit and simulator/device compilation results are tracked in the candidate PR. An initial validation draft PR may be needed to run existing macOS CI; integration requires the final independent verdict.

The extracted tests cover repeated inactive/background layout, retained reservation and instance/load counts, recovery, inactive rotation, safe areas, preparation/guide interruption, keyboard, Web OFF, wrong page and insufficient width. Background tests compile both environment variants and reject invalid origins/frames/ports/data. Existing UIKit/WK probes and SDK compilation remain enabled. These simulate lifecycle inputs; they do not prove physical Control Center or Notification Center behavior.

No signing, IPA export, TestFlight upload, Firebase deployment, production or DB writes are part of this task. TN must deploy the corresponding Web assets and separately approve a new TEST2 Native build to obtain both fixes on the physical iPad. Existing scripts/request-testflight.ps1 remains the future approval-controlled route, with a new increasing build number and unchanged Native generation. It is not invoked here.
