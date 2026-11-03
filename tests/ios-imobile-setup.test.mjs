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
