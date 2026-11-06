// Independent source-boundary audit. This is NOT Swift compilation or UIKit execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const swift=fs.readFileSync('ios/App/App/RooomImobileBanner.swift','utf8');
const scene=fs.readFileSync('ios/App/App/SceneDelegate.swift','utf8');
test('initial geometry never grants permission to start SDK requests',()=>{
 assert.match(swift,/private var config = RooomAdConfig.off/);
 assert.match(swift,/releaseCreatives\(\); config = \.off; layout\(\)/);
 assert.match(swift,/if device == "tablet" \{\s*let ready = Set\(entries\.values\.filter/);
 assert.match(swift,/setReservation\(RooomAdPolicy.fixedLayout\(config: initialLayout,/);
 assert.match(swift,/let desired = RooomAdPolicy.fixedLayout\(config: config,/);
 assert.ok(swift.indexOf('setReservation(RooomAdPolicy.fixedLayout(config: initialLayout')<swift.indexOf('let desired = RooomAdPolicy.fixedLayout(config: config'));
 const phone=swift.slice(swift.indexOf('if device == "phone" {',swift.indexOf('func layout()')),
   swift.indexOf('fileprivate func slotChanged'));
 assert.match(phone,/\$0\.shown && !\$0\.failed && !\$0\.released/);
 assert.match(phone,/fixedLayout\(config: config,/);
 assert.doesNotMatch(phone,/initialLayout/);
});
test('Web update validates before persisting, and unknown pages release geometry',()=>{
 const configure=swift.slice(swift.indexOf('func configure('),swift.indexOf('private func releaseCreatives'));
 assert.ok(configure.indexOf('try next.validated()')<configure.indexOf('initialLayout = valid'));
 assert.match(configure,/UserDefaults.standard.set/);
 assert.match(swift,/guard RooomAdPolicy.advertisingPage\(pageURL\) else \{\s*hideAll\(\); setReservation\(RooomAdInsets\(\)\); return/);
 assert.match(swift,/"fixedLayoutReservation":"before-fill-v1"/);
});
test('first UIKit layout is pre-sized and unchanged constraints do not loop',()=>{
 const early=scene.slice(scene.indexOf('override func viewWillLayoutSubviews'),scene.indexOf('override func viewSafeAreaInsetsDidChange'));
 assert.ok(early.indexOf('updateBridgeBottom()')<early.indexOf('super.viewWillLayoutSubviews()'));
 assert.match(scene,/bridgeBottomConstraint.constant != -\(lastKeyboardOverlap \+ bottom\)/);
 assert.match(scene,/bridgeTrailingConstraint.constant != -reserved.right else \{ return \}/);
});
test('fresh-install seed stays data in the existing resource pipeline',()=>{
 const seed=JSON.parse(fs.readFileSync('public/rooom-initial-ad-layout.json','utf8'));
 assert.equal(seed.version,1);assert.equal(seed.enabled,true);
 assert.deepEqual(seed.slots.map(x=>x.role),['tablet.left.top','tablet.left.bottom']);
 assert.equal(seed.presentation.railSide,'left');assert.equal(seed.presentation.railWidth,316);
 assert.equal(seed.tabletPortraitWebBanner.url,'https://rooom-talk.com/src/features/ads/ios-ipad-portrait-728.html');
 assert.match(swift,/subdirectory: "public"/);
 assert.match(fs.readFileSync('scripts/stage-imobile-official-sdk.mjs','utf8'),/Initial Web-owned layout seed was not copied/);
});
