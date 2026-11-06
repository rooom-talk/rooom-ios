# iPhone inline SDK show without a Ready callback

## Evidence and scope

TN reports TestFlight 1.6 / 100069 with accepted Native/Web configuration, eligible iPhone320 placement, valid bounds and closed keyboard, SDK status READY, but `awaiting-callback`, Ready=false, shown=false and DidShow=false. Web PR #473 was deployed successfully. Both production origins were independently read back on 2026-11-06 and match Web canonical `22b0b33254a44960f6e1d6d91afcb7386c8cc73f`, including phone activation and the device-specific diagnostic.

Native baseline is `5d4366bb7d32c9750ea48428cb3e1b7c15a504be` (PR #15, successful TestFlight workflow run `42143991072`). Its iPhone view visibility and show call require the app's Ready callback; the SDK status is diagnostic only. Thus the reported state cannot progress to show. Why this SDK instance did not emit/deliver Ready remains unproved. Delegate selectors and register → delegate → start order match the official 2.3.4 sample. The process registration cache skips only duplicate registration; every new entry reattaches its delegate and starts, and old released entries cannot later clear a replacement delegate.

Use the existing successful iPad inline sequence and the pinned official 2.3.4 `sample/Swift/ImobileSample-Swift/class/InlineViewController.swift`: attach/frame the view, then call show without awaiting Ready. SDK source: `imobile/adnw-sdk-ios` at `736b6edc9ab6e1ada1b0dc557531370cf5923dc8`. Vendor show acceptance is not proof of actual fill or an impression.

## Minimal repair

Only `ios/App/App/RooomImobileBanner.swift` changes product behavior:

- Fixed inline views on both devices use the same existing attach → show-once path. Native feed ads retain their separate data/Ready lifecycle.
- iPhone reserves 320×50 plus the existing safe-bottom/gap after show acceptance, in the same main-thread layout pass. A missing Ready callback no longer prevents show or leaves a submitted view over the Web composer. No callback state is fabricated.
- The end-of-pass reservation also covers synchronous register/start/show failures occurring under the layout reentrancy guard: failures leave no phone reservation. Asynchronous explicit failure, keyboard, OFF, navigation to an ineligible page and background likewise release phone space.
- A real subsequent Ready can recover a failed phone fixed slot through the same existing iPad recovery mechanism. No polling, application retry timer, extra start loop, or mutating diagnostic operation is introduced.
- iPad initial/landscape/portrait geometry, two APP300×250 spots and isolated Web728 surface remain intact. The pure geometry policy and keyboard container are unchanged. TOP and ROOM continue using the same document lifecycle.

No Web assets, SDK binary/version, spot IDs, list/archive settings, notification code, Firebase resources, native generation, or release workflow are changed. Existing production Web activation is reused.

## Verification and delivery

`scripts/check-ad-source.sh` runs the existing source checks and pure Swift policy tests plus the focused inline lifecycle regression harness. That harness executes extracted production methods with UIKit/SDK test doubles; it does not prove real SDK fill. PR verification also uses the existing unsigned simulator/device compile/archive and WKWebView bootstrap checks. The independent review and exact successful run IDs are recorded on the PR after results arrive.

Reuse `scripts/request-testflight.ps1` with the merged SHA and this PR number. Its `-CheckOnly` follows the same repository/merged-tree/workflow/CI/live-Web checks and returns before dispatch. The existing manual TestFlight workflow produces a build number strictly greater than Apple's latest, keeps iOS 1.6 and generation 3, and uploads one candidate; it does not submit App Store review or publish a general release. Do not use a Web deployment or the earlier combined iPad/Web coordinator for this Native-only repair. The exact pinned Windows CMD and its inspection result belong in the PR/chat handoff.

After TN installs the new TestFlight candidate: verify real iPhone320 on TOP and ROOM, opening/closing the keyboard, repeat navigation, background/foreground, and all three existing iPad placements. Distinguish Ready receipt, show acceptance, DidShow and actual visible creative. If absent, retain the diagnostic build/SDK state/phase/failure code rather than declaring no-fill from callback waiting.

At source preparation, no new TestFlight upload or real-device display result is claimed. The reported 100069 Ready gate is reproduced/fixed by internal verification; final paid creative display remains an actual-device completion condition.
