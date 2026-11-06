import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {patchProject} from '../scripts/prepare-ios-imobile-sdk.mjs';

const pbx=fs.readFileSync('ios/App/App.xcodeproj/project.pbxproj','utf8');
test('i-mobile project staging is strictly additive and reproducible',()=>{
 const next=patchProject(pbx);
 assert.equal(patchProject(next),next);
 assert.match(fs.readFileSync('ios/App/App/SceneDelegate.swift','utf8'),/RooomKeyboardContainerViewController/);
 assert.ok(next.includes('ImobileSdkAds.xcframework in Frameworks'));
 assert.equal(next.split('SWIFT_OBJC_BRIDGING_HEADER').length-1,2);
 assert.equal(next.split('ROOOM_IMOBILE_ADS').length-1,2);
 assert.equal(next.split('MARKETING_VERSION = 1.5;').length-1,2);
 assert.equal(next.split('PRODUCT_BUNDLE_IDENTIFIER = com.rooom.talk;').length-1,2);
 assert.equal(next.split('PROVISIONING_PROFILE_SPECIFIER = "$(APP_PROFILE)";').length-1,1);
 assert.ok(next.includes('SceneDelegate.swift in Sources'));
 assert.ok(next.includes('FirebaseMessaging') === pbx.includes('FirebaseMessaging'));
 assert.ok(next.includes('AppDelegate.swift in Sources'));
});
test('i-mobile rejects unrelated or partially prepared Xcode changes',()=>{
 assert.throws(()=>patchProject(pbx.replaceAll('MARKETING_VERSION = 1.5;','MARKETING_VERSION = 1.6;')));
 assert.throws(()=>patchProject(pbx.replace('RooomImobileBanner.swift in Sources','missing Swift ad file')));
 assert.throws(()=>patchProject(pbx.replace('SWIFT_VERSION = 5.0;','SWIFT_VERSION = 6.0;')));
 const partial=pbx.replace('MARKETING_VERSION = 1.5;','SWIFT_OBJC_BRIDGING_HEADER = unsafe.h;\nMARKETING_VERSION = 1.5;');
 assert.throws(()=>patchProject(partial));
});
test('generalized native bridge is opt-in, origin restricted and SDK-owned',()=>{
 const scene=fs.readFileSync('ios/App/App/SceneDelegate.swift','utf8');
 const ad=fs.readFileSync('ios/App/App/RooomImobileBanner.swift','utf8');
 assert.equal((scene.match(/#if ROOOM_IMOBILE_ADS/g)||[]).length,(scene.match(/#endif/g)||[]).length);
 assert.match(ad,/#if ROOOM_IMOBILE_ADS\nimport UIKit/);
 for(const size of ['320, height: 50','320, height: 100','300, height: 250','728, height: 90'])assert.ok(ad.includes(size));
 assert.match(ad,/WKScriptMessageHandlerWithReply/);
 assert.match(ad,/message\.frameInfo\.isMainFrame/);
 assert.match(ad,/origin\.host == "rooom-talk.com"/);
 assert.match(ad,/private var config = RooomAdConfig.off/);
 assert.match(ad,/maxSlots = 6/);
 assert.match(ad,/UISelectionFeedbackGenerator/);
 assert.match(ad,/onNativeAdDataReciveCompleted\(_ spotId: String!, nativeArray: \[AnyObject\]!\)/);
 assert.doesNotMatch(ad,/onNativeAdDataReciveCompleted\(_ spotId: String!, nativeArray: \[Any\]!\)/);
 assert.match(ad,/addClickFunction/);
 assert.doesNotMatch(ad,/sendClick\(/);
 assert.match(scene,/RooomKeyboardContainerViewController/);
 assert.match(scene,/#else\n        bridgeBottomConstraint.constant = -effectiveOverlap/);
 assert.doesNotMatch(ad,/AdSupport\.ASIdentifierManager|ATTrackingManager/);
});

test('ad candidate CI archives unsigned and has no Store upload or signing secret exposure',()=>{
 const src=fs.readFileSync('.github/workflows/ads-native-compile.yml','utf8');
 assert.match(src,/Archive ad-enabled iOS build without signing or uploading/);
 assert.match(src,/CODE_SIGNING_ALLOWED=NO/);
 assert.match(src,/CODE_SIGNING_REQUIRED=NO/);
 assert.match(src,/RoooM-ads-unsigned\.xcarchive/);
 assert.match(src,/Print :CFBundleIdentifier/);
 assert.match(src,/Print :CFBundleShortVersionString/);
 assert.doesNotMatch(src,/secrets\.|xcrun altool|upload-artifact|app-store-connect/);
 assert.doesNotMatch(src,/firebase deploy|npx cap run ios/);
});

test('signing uses explicit manual dispatch, reviewed PR SHA, and never uploads an IPA',()=>{
 const ci=fs.readFileSync('.github/workflows/ads-signed-candidate.yml','utf8');
 assert.match(ci,/on:\n  workflow_dispatch:/);
 assert.doesNotMatch(ci,/\n\s+(?:push|pull_request):/);
 assert.match(ci,/inputs\.confirmation == 'SIGN_ONLY'/);
 assert.match(ci,/pr\.head\.sha,process\.env\.APPROVED_SHA/);
 assert.match(ci,/source SHA|approved_sha/i);
 assert.match(ci,/node scripts\/stage-imobile-official-sdk\.mjs/);
 assert.match(ci,/clean archive/);
 assert.match(ci,/codesign --verify --deep --strict/);
 assert.match(ci,/CFBundleShortVersionString/);
 assert.match(ci,/NO App Store Connect\/TestFlight submission/);
 assert.doesNotMatch(ci,/xcrun altool|upload-artifact@|firebase deploy|fastlane pilot|notarytool/);
});

test('iOS 1.6 TestFlight upload uses the existing Mac workflow, manual only and immutable release commit',()=>{
 const ci=fs.readFileSync('.github/workflows/main.yml','utf8');
 const capacitor=JSON.parse(fs.readFileSync('capacitor.config.json','utf8'));
 assert.equal(capacitor.server.url,'https://rooom-talk.com/?rooom_native_generation=3');
 assert.match(ci,/on:\n  workflow_dispatch:/);
 assert.doesNotMatch(ci,/\n  push:/);
 assert.match(ci,/inputs\.confirmation == 'UPLOAD_TESTFLIGHT'/);
 assert.match(ci,/github\.ref == 'refs\/heads\/release\/ios-review-candidate-20261011'/);
 assert.match(ci,/test "\$\(git rev-parse HEAD\)" = "\$APPROVED_SHA"/);
 assert.match(ci,/test "\$CURRENT" = "\$APPROVED_SHA"/);
 assert.match(ci,/node scripts\/stage-imobile-official-sdk\.mjs/);
 assert.match(ci,/ROOOM_TESTFLIGHT_BUILD_NUMBER/);
 assert.match(ci,/Apple build lookup HTTP/);
 assert.match(ci,/const expectedAppId='6800222762';/);
 assert.match(ci,/const expectedBundleId='com\.rooom\.talk';/);
 assert.match(ci,/app\.data\?\.attributes\?\.bundleId/);
 assert.match(ci,/STOP: Apple app does not match RoooM bundle ID/);
 assert.doesNotMatch(ci,/\/v1\/apps\?filter/);
 assert.match(ci,/\/v1\/apps\/.*\/builds\?limit=200/);
 assert.match(ci,/MARKETING_VERSION=1\.6/);
 assert.match(ci,/rooom_native_generation=3/);
 assert.match(ci,/private var config = RooomAdConfig\.off/);
 assert.match(ci,/xcrun altool/);
 assert.doesNotMatch(ci,/actions\/upload-artifact@/);
 assert.doesNotMatch(ci,/firebase deploy|fastlane deliver|submit-for-review/);
});

test('unfilled native ad rail inherits RoooM body theme without changing ad reservation',()=>{
 const ad=fs.readFileSync('ios/App/App/RooomImobileBanner.swift','utf8');
 assert.match(ad,/getComputedStyle\(root\)/);
 assert.match(ad,/getPropertyValue\('--bg'\)/);
 assert.match(ad,/op:'background', rgb:channels/);
 assert.match(ad,/MutationObserver\(syncRailBackground\)/);
 assert.match(ad,/attributeFilter:\['class','data-theme'\]/);
 assert.match(ad,/case "background":/);
 assert.match(ad,/message\.frameInfo\.isMainFrame/);
 assert.match(ad,/origin\.host == "rooom-talk.com"/);
 assert.match(ad,/values\.allSatisfy/);
 assert.match(ad,/parent\?\.view\.backgroundColor = color/);
 assert.match(ad,/applyCanvasBackground\(color\)/);
 // Background updates are presentation-only; do not touch reserved layout.
 const backgroundCase=ad.split('case "background":')[1].split('case "configure":')[0];
 assert.doesNotMatch(backgroundCase,/setReservation|fixedLayout|adReservationChanged|ImobileSdkAds|clear\(/);
 assert.match(ad,/let roles = device == "phone" \? \["phone.bottom"\]/);
 assert.match(ad,/\? \["tablet.left.top", "tablet.left.bottom"\] : \["tablet.bottom"\]/);
});

test('iPad ad geometry is configurable from Web, with legacy defaults and right-side UIKit reservation',()=>{
 const ad=fs.readFileSync('ios/App/App/RooomImobileBanner.swift','utf8');
 const scene=fs.readFileSync('ios/App/App/SceneDelegate.swift','utf8');
 assert.match(ad,/struct RooomAdPresentation: Codable, Equatable/);
 assert.match(ad,/var presentation: RooomAdPresentation\? = nil/);
 assert.match(ad,/let look = config\.presentation \?\? \.standard/);
 assert.match(ad,/look\.railWidth/);
 assert.match(ad,/look\.railPadding/);
 assert.match(ad,/look\.railTop/);
 assert.match(ad,/look\.railGap/);
 assert.match(ad,/look\.bottomGap/);
 assert.match(ad,/out\.reserved\.right = safe\.right \+ look\.railWidth/);
 assert.match(scene,/bridgeTrailingConstraint/);
 assert.match(scene,/bridgeTrailingConstraint\.constant = -reserved\.right/);
 // Native must keep publisher SDK registration, click handling, and keyboard ownership.
 assert.match(ad,/ImobileSdkAds\.register/);
 assert.match(ad,/ImobileSdkAds\.show/);
 assert.match(scene,/setKeyboardVisible\(effectiveOverlap > 0\)/);
});

test('TestFlight native advertisement diagnostics are read-only and require the existing trusted bridge',()=>{
 const source=fs.readFileSync('ios/App/App/RooomImobileBanner.swift','utf8');
 assert.match(source,/case "diagnostics":\s*reply\(engine\.diagnostics\(\), nil\)/);
 assert.match(source,/func diagnostics\(\) -> \[String: Any\]/);
 assert.match(source,/diagnosticPhase = "awaiting-callback"/);
 assert.match(source,/fail\("register-rejected"\)/);
 assert.match(source,/fail\("start-rejected"\)/);
 assert.match(source,/fail\("show-rejected"\)/);
 assert.match(source,/diagnosticPhase = "sdk-ready"/);
 assert.match(source,/status: "failed"/);
 const audit = source.split('func diagnostics() -> [String: Any]')[1].split('private func entry(')[0];
 assert.match(audit,/appActive/);
 assert.match(audit,/pageEligible/);
 assert.match(audit,/slots/);
 assert.match(audit,/ImobileSdkAds\.getStatusBySpotID/);
 assert.doesNotMatch(audit,/ImobileSdkAds\.(?!getStatusBySpotID|getSdkVersion)|"(?:publisherId|mediaId|spotId)"|UserDefaults|HTTPURLSession|URLSession/);
 // The new operation shares the same origin/main-frame guard as configure.
 const bridge=source.split('fileprivate func handle(')[1];
 assert.ok(bridge.indexOf('origin.host == "rooom-talk.com"') < bridge.indexOf('case "diagnostics":'));
 assert.ok(bridge.indexOf('message.frameInfo.isMainFrame') < bridge.indexOf('case "diagnostics":'));
});
