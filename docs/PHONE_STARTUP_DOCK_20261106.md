# iPhone startup dock placement, 2026-11-06

TN observed the create/settings/view dock at the bottom during launch and then moving above the ad. TN approved reserving the normal ad position before fill, collapsing only on explicit failure/OFF (and existing keyboard/unsupported layout), restoring after real recovery. Ordinary refresh retains its position.

Reuse RooomInitialAdLayout and RooomAdPolicy geometry; phoneReservedInsets reads validated cached/bundled Web config without starting SDK requests. Apply before document configuration and again after SDK calls to capture synchronous failures. Keep SDK slot registration, show, callback, refresh, iPad geometry and notification behavior unchanged. Generate the fresh-install seed using the existing sync-initial-ad-layout.mjs from current Web owner, including the already-live phone slot.

Companion Web repair extends the existing syncNativeInitialLayoutOff to supported iPhones, so global Web OFF also revokes the cached geometry even though the archive controller stays inert. Web and Native are separate PRs/CMDs. Never infer fill/Ready from reservation. A permanently absent Web configuration can retain the last verified geometry, matching the existing iPad model; no new timeout or advertisement request is introduced.

Verify actual extracted Swift startup/configure/failure/recovery/navigation/keyboard/OFF behavior, Web OFF clearing, existing iPad/SDK regressions and the container's overlay handshake. Physical launch smoothness remains TN's device check after delivery. No Hosting publication/TestFlight upload is performed by Codex. Existing request-testflight.ps1 is the only eventual upload entry; same generation, increased build number. Ordinary source revert restores prior behavior.
