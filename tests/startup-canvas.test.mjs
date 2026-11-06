// Source/resource boundaries only. Does not compile Swift or exercise UIKit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const source=read('ios/App/App/RooomImobileBanner.swift');
const scene=read('ios/App/App/SceneDelegate.swift');
test('initial iPad canvas is set before document loading and window visibility',()=>{
 const init=source.slice(source.indexOf('override func capacitorDidLoad()'),source.indexOf('override func viewDidAppear'));
 assert.ok(init.indexOf('applyCanvasBackground(canvasBackground)')>0);
 assert.ok(init.indexOf('applyCanvasBackground(canvasBackground)')<init.indexOf('web.evaluateJavaScript'));
 const connect=scene.slice(scene.indexOf('window = UIWindow'));
 assert.ok(connect.indexOf('window?.backgroundColor = RooomInitialCanvas.color')<connect.indexOf('window?.makeKeyAndVisible()'));
 assert.match(connect,/if UIDevice.current.userInterfaceIdiom == \.pad/);
});
test('same existing trusted Web background message paints every exposed native surface',()=>{
 const apply=source.slice(source.indexOf('private func applyCanvasBackground'),source.indexOf('override func capacitorDidLoad'));
 assert.match(apply,/guard let web = bridge\?\.webView/); // same canvas path now covers phone too
 for(const target of ['web','web.scrollView','parent?.view','web.window?']) assert.ok(apply.includes(target+'.backgroundColor = color'));
 assert.ok(apply.includes('web.underPageBackgroundColor = color'));
 assert.ok(apply.includes('web.isOpaque = false'));
 assert.doesNotMatch(apply,/constraint|reserved|keyboard|configure\(|addSubview|evaluateJavaScript/);
 const handler=source.slice(source.indexOf('case "background":'),source.indexOf('case "configure":'));
 assert.ok(handler.includes('applyCanvasBackground(color)'));
 assert.ok(handler.includes('values.count == 3'));
 assert.ok(handler.includes('$0.doubleValue == Double($0.intValue)'));
 assert.match(source,/message\.frameInfo\.isMainFrame/); // security stays on existing handler
});
test('iPad launch is a static canvas/wordmark; iPhone launch and all ad geometry stay separate',()=>{
 const plist=read('ios/App/App/Info.plist');
 assert.match(plist,/<key>UILaunchStoryboardName<\/key>\s*<string>LaunchScreen<\/string>/);
 assert.match(plist,/<key>UILaunchStoryboardName~ipad<\/key>\s*<string>LaunchScreen-iPad<\/string>/);
 const launch=read('ios/App/App/LaunchScreen-iPad.storyboard');
 assert.match(launch,/text="RoooM"/);assert.match(launch,/name="RooomInitialCanvas"/);
 assert.doesNotMatch(launch,/customClass|imageView|webView|300|250|316|320|advert/);
 assert.ok(read('ios/App/App/Base.lproj/LaunchScreen.storyboard').includes('image="Splash"'));
 const colors=JSON.parse(read('ios/App/App/Assets.xcassets/RooomInitialCanvas.colorset/Contents.json')).colors;
 assert.equal(colors.length,1);assert.equal(colors[0].color.components.red,'0xEF');
 assert.match(scene,/UIColor\(named: "RooomInitialCanvas"\)/);
 const pbx=read('ios/App/App.xcodeproj/project.pbxproj');
 assert.equal(pbx.split('B45500000000000000000001').length-1,2);
 assert.equal(pbx.split('B45500000000000000000002').length-1,3);
});
