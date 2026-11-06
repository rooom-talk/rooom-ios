// Dedicated OFFLINE UIKit/WebKit probe, never the RoooM app or SDK.
// macOS: node tests/ipad-rotation-simulator.mjs
// Any OS: node tests/ipad-rotation-simulator.mjs --extract-only
// Optional ROOOM_IPAD_PROBE_REPORT chooses a report artifact path.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('../ios/App/App/RooomImobileBanner.swift',import.meta.url),'utf8').replaceAll('\r\n','\n');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function block(text,marker){
 const start=text.indexOf(marker);assert.ok(start>=0,`Missing production marker: ${marker}`);
 const open=text.indexOf('{',start);let depth=0;
 for(let i=open;i<text.length;i++){
  if(text[i]==='{')depth++;
  if(text[i]==='}'&&--depth===0)return text.slice(start,i+1);
 }
 throw Error(`Unbalanced production block: ${marker}`);
}
function placement(text){
 const marker='if tabletWebAd == nil {';
 const first=block(text,marker),start=text.indexOf(marker);
 const rest=text.slice(start+first.length);
 const second=block(rest,'if let ad = tabletWebAd {');
 return first+'\n'+second;
}
const policy=source.slice(source.indexOf('enum RooomAdFormat:'),source.indexOf('// A last verified Web configuration'));
const currentClass=block(source,'private final class RooomTabletWebAd:');
const currentPlacement=placement(source);
// Verbatim LF baseline class and call site from fa5ac6e. Embedded for shallow CI.
const baseline={
  "commit": "fa5ac6e3a091b41cf144daac2fe6af42ba90933b",
  "classSha256": "82e0271636d4856228535e43290264da5fcdc5743ac58a17f5a29adf52ac86c4",
  "placementSha256": "53f7afaf04e9074e9ad03397d42eef6927a6e242b41de549aff2f3fab900e18b",
  "policySha256": "ec1ab166d66f68c72db5f3cf6350044a8b8e6d7725d770ac2ae81cbc7414b5f9",
  "classSource": "private final class RooomTabletWebAd: NSObject, WKNavigationDelegate, WKUIDelegate {\n    let view: WKWebView\n    private(set) var phase = \"created\"\n    init(url: URL) {\n        let settings = WKWebViewConfiguration()\n        settings.websiteDataStore = .nonPersistent()\n        settings.userContentController = WKUserContentController()\n        settings.applicationNameForUserAgent = \"RoooMAdSurface/1\"\n        settings.preferences.javaScriptCanOpenWindowsAutomatically = false\n        view = WKWebView(frame: CGRect(x: 0, y: 0, width: 728, height: 90), configuration: settings)\n        super.init()\n        view.navigationDelegate = self; view.uiDelegate = self\n        view.isOpaque = false; view.backgroundColor = .clear\n        view.scrollView.isScrollEnabled = false\n        view.scrollView.contentInsetAdjustmentBehavior = .never\n        view.scrollView.bounces = false\n        phase = \"loading-document\"\n        view.load(URLRequest(url: url))\n    }\n    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {\n        phase = \"document-loaded\" // Never equate this with an ad impression.\n        inspect()\n    }\n    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { phase = \"document-failed\" }\n    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { phase = \"document-failed\" }\n    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { phase = \"content-process-ended\" }\n    private func open(_ url: URL?) {\n        guard let url, [\"https\", \"http\"].contains(url.scheme ?? \"\"),\n              UIApplication.shared.applicationState == .active else { return }\n        UIApplication.shared.open(url, options: [:], completionHandler: nil)\n    }\n    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,\n                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {\n        // Provider subframes stay in the isolated surface. Only our exact page\n        // may replace its main frame. User links open via the existing OS path.\n        if navigationAction.targetFrame?.isMainFrame == false { decisionHandler(.allow); return }\n        if navigationAction.request.url?.absoluteString == RooomTabletWebBanner.approvedURL {\n            decisionHandler(.allow); return\n        }\n        if navigationAction.navigationType == .linkActivated { open(navigationAction.request.url) }\n        decisionHandler(.cancel)\n    }\n    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,\n                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {\n        // WebKit blocks automatic popups above; preserve genuine user clicks.\n        open(navigationAction.request.url); return nil\n    }\n    func inspect() {\n        view.evaluateJavaScript(\"document.documentElement.dataset.adPhase || 'document-loaded'\") { [weak self] value, _ in\n            guard let self, let value = value as? String,\n                  [\"tag-started\", \"loader-loaded\", \"loader-failed\", \"document-loaded\"].contains(value) else { return }\n            self.phase = value\n        }\n    }\n    func release() { view.stopLoading(); view.navigationDelegate = nil; view.uiDelegate = nil; view.removeFromSuperview() }\n}",
  "placementSource": "if tabletWebAd == nil { tabletWebAd = RooomTabletWebAd(url: url) }\nif let ad = tabletWebAd {\n                if ad.view.superview !== shell { shell.addSubview(ad.view) }\n                ad.view.frame = rect; ad.view.isHidden = false\n            }"
};
assert.equal(hash(baseline.classSource),baseline.classSha256);
assert.equal(hash(baseline.placementSource),baseline.placementSha256);
assert.equal(hash(policy),baseline.policySha256,'Pure geometry/configuration policy must remain unchanged for this comparison');
assert.match(currentClass,/init\(url: URL, frame: CGRect\)/);
assert.match(currentClass,/WKWebView\(frame: frame,/);
assert.match(currentPlacement,/RooomTabletWebAd\(url: url, frame: rect\)/);
const swift=String.raw`
import Foundation
import UIKit
import WebKit
import QuartzCore
`+policy+'\n'+currentClass+'\n'+baseline.classSource.replaceAll('RooomTabletWebAd','BaselineRooomTabletWebAd')+String.raw`

private func coordinates(_ r:CGRect) -> [String:Double] {
    ["x":Double(r.minX),"y":Double(r.minY),"width":Double(r.width),"height":Double(r.height)]
}
private func same(_ a:CGRect,_ b:CGRect) -> Bool {
    abs(a.minX-b.minX)<1 && abs(a.minY-b.minY)<1 && abs(a.width-b.width)<1 && abs(a.height-b.height)<1
}
private final class ProbeShell:UIView {
    var attached:((UIView)->Void)?
    override func didAddSubview(_ subview:UIView) { super.didAddSubview(subview);attached?(subview) }
}
private final class ProbeController:UIViewController {
    private var baselineAd:BaselineRooomTabletWebAd?
    private var currentAd:RooomTabletWebAd?
    private var activeView:WKWebView?
    private var shell=ProbeShell()
    private var link:CADisplayLink?
    private var samples:[[String:Any]]=[]
    private var attaches:[[String:Any]]=[]
    private var presentationRects:[CGRect]=[]
    private var rows:[[String:Any]]=[]
    private var failures:[String]=[]
    private var index=0,started=false
    private var startTime:CFTimeInterval=0
    private var baselineReleased=0,currentReleased=0
    private let modes=[false,true,false,true,false,true]
    private func check(_ okay:Bool,_ message:String) { if !okay { failures.append(message) } }
    override func viewDidAppear(_ animated:Bool) {
        super.viewDidAppear(animated)
        guard !started else { return };started=true
        view.backgroundColor = .white
        DispatchQueue.main.asyncAfter(deadline:.now()+0.15) { self.next() }
    }
    private func next() {
        guard index<modes.count else { finish();return }
        let modern=modes[index],cycle=index/2+1
        let portrait=CGSize(width:min(view.bounds.width,view.bounds.height),height:max(view.bounds.width,view.bounds.height))
        let landscape=CGSize(width:portrait.height,height:portrait.width)
        let s=view.safeAreaInsets,safe=RooomAdInsets(top:s.top,left:0,bottom:s.bottom,right:0)
        let config=RooomAdConfig(version:1,enabled:true,fixed:true,archive:false,slots:[
            RooomAdSlot(key:"top",role:"tablet.left.top",device:"tablet",format:.rectangle,publisherId:"85650",mediaId:"597836",spotId:"1951342"),
            RooomAdSlot(key:"lower",role:"tablet.left.bottom",device:"tablet",format:.rectangle,publisherId:"85650",mediaId:"597836",spotId:"1951343")
        ],presentation:.standard,tabletPortraitWebBanner:RooomTabletWebBanner(version:1,url:RooomTabletWebBanner.approvedURL))
        let wide=RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:landscape,safe:safe)
        let tall=RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:portrait,safe:safe)
        check(wide.placements.count==2 && wide.placements.allSatisfy { $0.rect.size==CGSize(width:300,height:250) },"Landscape SDK geometry changed")
        check(wide.webBannerRect==nil && wide.reserved.left==316 && wide.reserved.bottom==0,"Landscape reservation changed")
        check(tall.placements.isEmpty && tall.reserved.left==0 && tall.reserved.bottom==90+safe.bottom,"Portrait reservation changed")
        guard let destination=tall.webBannerRect else { failures.append("Available iPad cannot fit 728x90");finish();return }
        check(destination.size==CGSize(width:728,height:90),"Portrait size changed")
        check(CGRect(origin:.zero,size:portrait).contains(destination),"Destination outside visible parent bounds")
        let keyboard=RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:portrait,safe:safe,keyboard:true)
        check(keyboard.webBannerRect==nil && keyboard.reserved==RooomAdInsets(),"Keyboard exclusion changed")
        shell.removeFromSuperview();shell=ProbeShell(frame:CGRect(origin:.zero,size:landscape))
        shell.backgroundColor = .white
        view.addSubview(shell)
        samples=[];attaches=[];presentationRects=[]
        shell.attached={ [weak self] ad in
            guard let self else { return }
            self.attaches.append(["frame":coordinates(ad.frame),"hidden":ad.isHidden,"inWindow":ad.window != nil])
            if modern {
                self.check(same(ad.frame,destination),"Current first attachment is not at destination")
                self.check(ad.isHidden,"Current first attachment was visible before placement completed")
            }
        }
        // Commit ONLY the parent. There is no ad yet, and no flush/wait is
        // inserted between the production constructor/attach/frame statements.
        DispatchQueue.main.asyncAfter(deadline:.now()+0.08) {
            self.startTime=CACurrentMediaTime()
            self.link=CADisplayLink(target:self,selector:#selector(self.sample))
            self.link?.add(to:.main,forMode:.common)
            UIView.animate(withDuration:0.6,delay:0,options:[.curveLinear,.allowUserInteraction],animations:{
                self.shell.frame=CGRect(origin:.zero,size:portrait)
                if modern { self.placeCurrent(destination) } else { self.placeBaseline(destination) }
            },completion:{ _ in
                DispatchQueue.main.asyncAfter(deadline:.now()+0.08) {
                    self.complete(modern:modern,cycle:cycle,destination:destination,safe:safe)
                }
            })
        }
    }
    private func placeCurrent(_ rect:CGRect) {
        let shell=self.shell,url=URL(string:"about:blank")!
        var tabletWebAd=currentAd
`+currentPlacement+String.raw`
        currentAd=tabletWebAd;activeView=tabletWebAd?.view
    }
    private func placeBaseline(_ rect:CGRect) {
        let shell=self.shell,url=URL(string:"about:blank")!
        var tabletWebAd=baselineAd
`+baseline.placementSource.replaceAll('RooomTabletWebAd','BaselineRooomTabletWebAd')+String.raw`
        baselineAd=tabletWebAd;activeView=tabletWebAd?.view
    }
    @objc private func sample() {
        guard let ad=activeView else { return }
        let p=ad.layer.presentation()
        if let p { presentationRects.append(p.frame) }
        samples.append(["seconds":CACurrentMediaTime()-startTime,"model":coordinates(ad.frame),
            "presentation":p.map { coordinates($0.frame) as Any } ?? NSNull(),
            "hidden":ad.isHidden,"inWindow":ad.window != nil,"animationKeys":ad.layer.animationKeys() ?? []])
    }
    private func complete(modern:Bool,cycle:Int,destination:CGRect,safe:RooomAdInsets) {
        sample();link?.invalidate();link=nil
        guard let ad=activeView else { failures.append("No WKWebView");finish();return }
        check(attaches.count==1,"Unexpected repeated attachment")
        check(same(ad.frame,destination) && ad.superview===shell && !ad.isHidden,"Final attached geometry/visibility differs")
        check(presentationRects.count>=2,"No usable presentation samples; cannot validate visible placement")
        let displaced=presentationRects.filter { !same($0,destination) }
        if modern { check(displaced.isEmpty,"Current presentation layer moved outside destination") }
        let phase=modern ? currentAd?.phase ?? "missing" : baselineAd?.phase ?? "missing"
        rows.append(["version":modern ? "current" : "baseline-fa5ac6e","cycle":cycle,
            "destination":coordinates(destination),"finalFrame":coordinates(ad.frame),"reservedBottom":90+safe.bottom,
            "attach":attaches,"presentationDisplaced":!displaced.isEmpty,"samples":samples,
            "phase":phase,"pageURL":ad.url?.absoluteString ?? "nil",
            "note":modern ? "Initial/final/presentation geometry asserted" :
                (displaced.isEmpty ? "No baseline fly-in reproduced in this controlled UIKit animation" : "Baseline displacement observed in controlled UIKit animation")])
        if modern { currentAd?.release();currentAd=nil;currentReleased+=1 }
        else { baselineAd?.release();baselineAd=nil;baselineReleased+=1 }
        check(ad.superview==nil && ad.navigationDelegate==nil && ad.uiDelegate==nil,"Release left a view or delegate attached")
        activeView=nil;shell.removeFromSuperview();index+=1
        DispatchQueue.main.asyncAfter(deadline:.now()+0.05) { self.next() }
    }
    private func finish() {
        link?.invalidate();link=nil
        check(currentReleased==3 && baselineReleased==3,"Three independent create/release cycles were not completed")
        let report:[String:Any]=["ok":failures.isEmpty,"failures":failures,"cases":rows,
            "currentReleased":currentReleased,"baselineReleased":baselineReleased,
            "network":"Only about:blank is passed to the actual WK class; its unchanged main-frame allowlist may cancel that blank load. No HTML/ad script is injected and no SDK or Firebase is linked.",
            "scope":"Real UIKit/WKWebView with inherited UIView.animate and CADisplayLink; controlled parent resize, not the production app or an actual device rotation. No creative fill or black-pixel claim."]
        do {
            let folder=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0]
            try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
            try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys])
                .write(to:folder.appendingPathComponent("rotation-report.json"),options:.atomic)
        } catch { NSLog("OFFLINE PROBE RESULT WRITE FAILED: %@",String(describing:error)) }
    }
}
@main private final class ProbeApp:UIResponder,UIApplicationDelegate {
    var window:UIWindow?
    func application(_ application:UIApplication,didFinishLaunchingWithOptions launchOptions:[UIApplication.LaunchOptionsKey:Any]?=nil)->Bool {
        window=UIWindow(frame:UIScreen.main.bounds);window?.rootViewController=ProbeController();window?.makeKeyAndVisible();return true
    }
}
`;
assert.ok(swift.includes(currentClass)&&swift.includes(currentPlacement),'Actual production implementation must be compiled');
assert.equal((swift.match(/let shell=self\.shell,url=URL\(string:"about:blank"\)!/g)||[]).length,2);
assert.doesNotMatch(swift,/import (?:ImobileSdkAds|Firebase|Capacitor)/);
if(process.argv.includes('--extract-only')||process.platform!=='darwin'){
 console.log(JSON.stringify({extraction:'PASS',currentClassSha256:hash(currentClass),baseline:baseline.commit,
  simulator:'NOT RUN: requires macOS with an already available iPad simulator'}));
}else{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rooom-ipad-rotation-probe-'));
 const app=path.join(tmp,'OfflineRotationProbe.app'),bundle='com.rooom.offline.rotationprobe.'+crypto.randomBytes(4).toString('hex');
 const run=(command,args,timeout=120000)=>{
  const r=cp.spawnSync(command,args,{encoding:'utf8',timeout,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,`${command} ${args.join(' ')}\n${r.error?.message||''}\n${r.stdout||''}\n${r.stderr||''}`);
  return r.stdout.trim();
 };
 const list=JSON.parse(run('xcrun',['simctl','list','devices','available','--json']));
 const devices=Object.entries(list.devices).filter(([runtime])=>runtime.includes('.iOS-')).flatMap(([runtime,ds])=>
  ds.filter(d=>d.isAvailable!==false&&d.name.includes('iPad')).map(d=>({...d,runtime})));
 assert.ok(devices.length,'No available iPad simulator. This test never downloads runtimes.');
 devices.sort((a,b)=>Number(b.state==='Booted')-Number(a.state==='Booted'));
 const selected=devices[0],bootedHere=selected.state!=='Booted';let installed=false;
 try{
  if(bootedHere)run('xcrun',['simctl','boot',selected.udid]);
  run('xcrun',['simctl','bootstatus',selected.udid,'-b'],240000);
  const sdk=run('xcrun',['--sdk','iphonesimulator','--show-sdk-path']);
  fs.mkdirSync(app);fs.writeFileSync(path.join(tmp,'Probe.swift'),swift);
  const plist=`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${bundle}</string><key>CFBundleExecutable</key><string>OfflineRotationProbe</string><key>CFBundleName</key><string>Offline Rotation Probe</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string><key>MinimumOSVersion</key><string>15.0</string><key>UIDeviceFamily</key><array><integer>2</integer></array><key>UIRequiresFullScreen</key><true/><key>UISupportedInterfaceOrientations</key><array><string>UIInterfaceOrientationPortrait</string></array><key>UILaunchScreen</key><dict/></dict></plist>`;
  fs.writeFileSync(path.join(app,'Info.plist'),plist);
  run('xcrun',['--sdk','iphonesimulator','swiftc','-swift-version','5','-parse-as-library','-target',`${process.arch==='arm64'?'arm64':'x86_64'}-apple-ios15.0-simulator`,
   '-sdk',sdk,'-module-cache-path',path.join(tmp,'module-cache'),path.join(tmp,'Probe.swift'),'-o',path.join(app,'OfflineRotationProbe'),'-framework','UIKit','-framework','WebKit','-framework','QuartzCore']);
  run('/usr/bin/codesign',['--force','--sign','-','--timestamp=none',app]);
  run('xcrun',['simctl','install',selected.udid,app]);installed=true;
  run('xcrun',['simctl','launch',selected.udid,bundle]);
  const data=run('xcrun',['simctl','get_app_container',selected.udid,bundle,'data']),output=path.join(data,'Documents','rotation-report.json');
  const deadline=Date.now()+60000;
  while(!fs.existsSync(output)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,250));
  assert.ok(fs.existsSync(output),`Probe did not finish; sources retained at ${tmp}`);
  const report=JSON.parse(fs.readFileSync(output,'utf8'));
  report.simulator={name:selected.name,runtime:selected.runtime};report.baselineCommit=baseline.commit;report.currentClassSha256=hash(currentClass);
  const artifact=path.resolve(process.env.ROOOM_IPAD_PROBE_REPORT||path.join(tmp,'report.json'));
  fs.mkdirSync(path.dirname(artifact),{recursive:true});fs.writeFileSync(artifact,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:report.ok,artifact,failures:report.failures,cases:report.cases.map(c=>({version:c.version,cycle:c.cycle,attach:c.attach,destination:c.destination,presentationDisplaced:c.presentationDisplaced,note:c.note})),scope:report.scope},null,2));
  assert.equal(report.ok,true,'Offline UIKit geometry probe failed; see report');
 }finally{
  if(installed){cp.spawnSync('xcrun',['simctl','terminate',selected.udid,bundle],{encoding:'utf8'});cp.spawnSync('xcrun',['simctl','uninstall',selected.udid,bundle],{encoding:'utf8'});}
  if(bootedHere)cp.spawnSync('xcrun',['simctl','shutdown',selected.udid],{encoding:'utf8'});
 }
}
