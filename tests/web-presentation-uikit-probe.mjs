// OFFLINE iPad UIKit/WK probe, not the RoooM application or a device acceptance test.
// Movable to Native tests/: default source root is ../; scratch work/ also finds ./ios-source.
// ROOOM_IOS_SOURCE_ROOT overrides that root. --extract-only NEVER compiles/boots/signs.
// macOS execution uses an unsigned simulator binary; no signing or upload.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=process.env.ROOOM_IOS_SOURCE_ROOT||[path.resolve(here,'..'),path.resolve(here,'ios-source')].find(p=>fs.existsSync(path.join(p,'ios/App/App/SceneDelegate.swift')));
assert(root,'Native source root not found');
const read=p=>fs.readFileSync(path.join(root,p),'utf8').replaceAll('\r\n','\n');
const ads=read('ios/App/App/RooomImobileBanner.swift'),scene=read('ios/App/App/SceneDelegate.swift');
function block(text,marker){const begin=text.indexOf(marker);assert(begin>=0,marker);const open=text.indexOf('{',begin);let d=0;for(let i=open;i<text.length;i++){if(text[i]==='{')d++;if(text[i]==='}'&&--d===0)return text.slice(begin,i+1);}throw Error('Unclosed '+marker);}
const permission=block(ads,'struct WebPresentationPermission {');
const insets=block(ads,'struct RooomAdInsets:');
const methods=[block(scene,'private func updateBridgeBottom()'),block(scene,'private func phonePresentationBottom(')].join('\n');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const swift=String.raw`
import Foundation
import UIKit
import WebKit
import QuartzCore
`+permission+'\n'+insets+String.raw`
// Transport/engine doubles only: the actual permission and actual constraint
// methods below are untouched. No monetization engine, SDK or Capacitor is linked.
private enum RooomAdPolicy { static func advertisingPage(_ url:URL?) -> Bool { false } }
private final class Engine { var permission=WebPresentationPermission();var reservation=RooomAdInsets() }
private final class Bridge { let webView:WKWebView?;init(_ web:WKWebView){webView=web} }
private final class BridgeController {
 let bridge:Bridge?;let monetization:Engine?=Engine()
 var phoneOverlayDocument="offline-probe",phoneOverlayRequested=false,phoneOverlayLayoutReady=false
 init(_ web:WKWebView){bridge=Bridge(web)}
}
private func rect(_ r:CGRect)->[String:Double]{["x":Double(r.minX),"y":Double(r.minY),"width":Double(r.width),"height":Double(r.height)]}
private func close(_ a:CGFloat,_ b:CGFloat)->Bool{abs(a-b)<1.01}
private final class ProbeController:UIViewController,WKNavigationDelegate {
 private var bridgeViewController:BridgeController!
 private var bridgeBottomConstraint:NSLayoutConstraint!,bridgeLeadingConstraint:NSLayoutConstraint!,bridgeTrailingConstraint:NSLayoutConstraint!
 private var lastKeyboardOverlap:CGFloat=0
 private var phoneOverlayRequest:String?,phoneOverlayApplied:String?
 private var web:WKWebView!
 private var engine:Engine { bridgeViewController.monetization! }
 private var shell=UIView(),started=false,finished=false
 private var failures:[String]=[],rows:[[String:Any]]=[],samples:[[String:Any]]=[]
 private var link:CADisplayLink?,remaining=0,stage=""
 private var frameContinuation:CheckedContinuation<Void,Never>?
 private var loadContinuation:CheckedContinuation<Void,Error>?
 private var blockedRequests=0
 override func viewDidLoad(){
  super.viewDidLoad();view.backgroundColor = .white;shell.backgroundColor = .white
  shell.frame=view.bounds;view.addSubview(shell)
  let config=WKWebViewConfiguration();config.websiteDataStore = .nonPersistent()
  web=WKWebView(frame:.zero,configuration:config);web.navigationDelegate=self
  web.scrollView.contentInsetAdjustmentBehavior = .never
  web.translatesAutoresizingMaskIntoConstraints=false;shell.addSubview(web)
  bridgeViewController=BridgeController(web)
  bridgeBottomConstraint=web.bottomAnchor.constraint(equalTo:shell.bottomAnchor)
  bridgeLeadingConstraint=web.leadingAnchor.constraint(equalTo:shell.leadingAnchor)
  bridgeTrailingConstraint=web.trailingAnchor.constraint(equalTo:shell.trailingAnchor)
  NSLayoutConstraint.activate([web.topAnchor.constraint(equalTo:shell.topAnchor),bridgeBottomConstraint,bridgeLeadingConstraint,bridgeTrailingConstraint])
 }
 override func viewDidAppear(_ animated:Bool){super.viewDidAppear(animated);guard !started else{return};started=true
  shell.frame=view.bounds;view.layoutIfNeeded()
  Task { @MainActor in do { try await runProbe();finish() } catch { failures.append(String(describing:error));finish() } }
 }
 private func check(_ okay:Bool,_ label:String){if !okay{failures.append(label)}}
 private func applyReservation(_ value:RooomAdInsets){engine.reservation=value;updateBridgeBottom();shell.layoutIfNeeded();view.layoutIfNeeded()}
 private func sameCanvas()->Bool{close(web.frame.minX,0)&&close(web.frame.minY,0)&&close(web.bounds.width,shell.bounds.width)&&close(web.bounds.height,shell.bounds.height)}
 @objc private func tick(){
  samples.append(["stage":stage,"shell":rect(shell.bounds),"web":rect(web.frame),"left":bridgeLeadingConstraint.constant,"bottom":bridgeBottomConstraint.constant,"allowed":engine.permission.allowed,"committed":engine.permission.committed])
  if stage=="initial-first-observed-frames"{check(sameCanvas() && bridgeLeadingConstraint.constant==0 && bridgeBottomConstraint.constant==0,"Initial observed UIKit frame must fill shell")}
  remaining-=1;if remaining==0{link?.invalidate();link=nil;let c=frameContinuation;frameContinuation=nil;c?.resume()}
 }
 private func frames(_ count:Int,_ label:String)async{await withCheckedContinuation{c in frameContinuation=c;remaining=count;stage=label;link=CADisplayLink(target:self,selector:#selector(tick));link?.add(to:.main,forMode:.common)}}
 private func js(_ code:String)async throws->Any{try await withCheckedThrowingContinuation{c in web.evaluateJavaScript(code){v,e in if let e{c.resume(throwing:e)}else{c.resume(returning:v ?? NSNull())}}}}
 private func loadInline()async throws{
  try await withCheckedThrowingContinuation{(c:CheckedContinuation<Void,Error>) in
   loadContinuation=c
   web.loadHTMLString("<meta name='viewport' content='width=device-width,initial-scale=1'><meta http-equiv='Content-Security-Policy' content=\"default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline';connect-src 'none';img-src 'none';frame-src 'none'\"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}</style><body>Offline viewport probe</body>",baseURL:nil)
  }
 }
 func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){let c=loadContinuation;loadContinuation=nil;c?.resume()}
 func webView(_ webView:WKWebView,didFail navigation:WKNavigation!,withError error:Error){let c=loadContinuation;loadContinuation=nil;c?.resume(throwing:error)}
 func webView(_ webView:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError error:Error){let c=loadContinuation;loadContinuation=nil;c?.resume(throwing:error)}
 func webView(_ webView:WKWebView,decidePolicyFor action:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void){
  let scheme=action.request.url?.scheme ?? "about"
  if scheme=="about"{decisionHandler(.allow)}else{blockedRequests+=1;decisionHandler(.cancel)}
 }
 private func viewport(_ label:String)async throws{
  var matched=0,last:[String:Any]=[:]
  for _ in 0..<120{
   await frames(1,label)
   guard let value=try await js("({width:innerWidth,height:innerHeight,visualWidth:visualViewport.width,visualHeight:visualViewport.height})") as? [String:Any],let w=value["width"] as? NSNumber,let h=value["height"] as? NSNumber else{throw NSError(domain:"Invalid WK viewport result",code:1)}
   last=value
   if close(CGFloat(w.doubleValue),web.bounds.width)&&close(CGFloat(h.doubleValue),web.bounds.height){matched+=1}else{matched=0}
   if matched>=2{rows.append(["stage":label,"nativeAck":rect(web.bounds),"css":value,"twoConsecutiveMatches":true]);return}
  }
  rows.append(["stage":label,"nativeAck":rect(web.bounds),"css":last,"twoConsecutiveMatches":false]);throw NSError(domain:"WK CSS viewport did not match native bounds before deadline",code:2)
 }
 private func runProbe()async throws{
  check(UIDevice.current.userInterfaceIdiom == .pad,"Probe must run on iPad simulator")
  check(!engine.permission.allowed && !engine.permission.committed,"Default permission must deny")
  applyReservation(RooomAdInsets());await frames(3,"initial-first-observed-frames")
  try await loadInline();try await viewport("initial-inline-viewport")
  let doc=engine.permission.documentId
  check(engine.permission.set(document:doc,sequence:1,allowed:true),"Stage permission")
  // A transport fixture supplies a 316px reservation. This does not assert the
  // production engine selected that width: its actual layout is a separate test.
  applyReservation(RooomAdInsets(left:316))
  check(close(bridgeLeadingConstraint.constant,316) && !engine.permission.committed,"Prepare applies actual constraint before commit")
  try await viewport("prepared-constraint-ack-css")
  check(engine.permission.commit(document:doc,sequence:1),"Commit matching permission")
  await frames(3,"committed")
  check(engine.permission.set(document:doc,sequence:2,allowed:true) && !engine.permission.committed,"Restage hides permission before new commit")
  // Controlled parent resize exercises real Auto Layout + WK viewport. It is
  // deliberately not presented as physical OS rotation or an inactive-app test.
  let old=shell.bounds.size;shell.frame.size=CGSize(width:old.height,height:old.width)
  applyReservation(RooomAdInsets(left:316));try await viewport("controlled-parent-resize")
  check(!engine.permission.commit(document:doc,sequence:1),"Old sequence cannot commit resized layout")
  check(engine.permission.commit(document:doc,sequence:2),"New sequence commits resized layout")
  check(engine.permission.set(document:doc,sequence:3,allowed:false),"Revoke permission")
  applyReservation(RooomAdInsets());check(sameCanvas(),"Revoke restores actual full canvas")
  try await viewport("revoked-full-canvas")
  check(!engine.permission.commit(document:doc,sequence:3),"Denied permission cannot commit")
  engine.permission.reset();applyReservation(RooomAdInsets())
  check(!engine.permission.set(document:doc,sequence:4,allowed:true),"Previous document cannot stage")
  check(!engine.permission.commit(document:doc,sequence:2),"Previous document cannot commit")
  await frames(3,"navigation-reset");check(sameCanvas(),"Navigation reset full canvas")
 }
 private func finish(){guard !finished else{return};finished=true;link?.invalidate();link=nil
  let report:[String:Any]=["ok":failures.isEmpty,"failures":failures,"cases":rows,"samples":samples,"blockedRequests":blockedRequests,
   "network":"Offline loadHTMLString only; CSP connect/img/frame/default none; no provider, Capacitor, Firebase or SDK linked. Non-about navigations are denied.",
   "scope":"Actual extracted Swift permission and SceneDelegate constraint methods, real iPad Simulator UIKit Auto Layout/CADisplayLink/WK CSS viewport. Reservation is a transport fixture; full production monetization layout/RPC authentication/SDK visibility and actual app first paint are NOT exercised. Initial frames mean first observed frames after probe viewDidAppear; controlled parent resize is NOT physical rotation; inactive lifecycle/lease timers/phone overlay path are NOT acceptance-tested."]
  do{let folder=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0];try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true);try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("presentation-report.json"),options:.atomic)}catch{NSLog("Probe report failed: %@",String(describing:error))}
 }
`+methods+String.raw`
}
@main private final class ProbeApp:UIResponder,UIApplicationDelegate {
 var window:UIWindow?
 func application(_ application:UIApplication,didFinishLaunchingWithOptions launchOptions:[UIApplication.LaunchOptionsKey:Any]?=nil)->Bool{window=UIWindow(frame:UIScreen.main.bounds);window?.rootViewController=ProbeController();window?.makeKeyAndVisible();return true}
}
`;
assert(swift.includes(permission)&&swift.includes(methods));
assert.doesNotMatch(swift,/import (?:ImobileSdkAds|Firebase|Capacitor)/);
const extraction={permissionSha256:hash(permission),constraintMethodsSha256:hash(methods),swiftSha256:hash(swift)};
if(process.argv.includes('--extract-only')||process.platform!=='darwin'){
 const target=process.env.ROOOM_PRESENTATION_PROBE_SWIFT;
 if(target)fs.writeFileSync(target,swift);
 console.log(JSON.stringify({extraction:'PASS',...extraction,simulator:'NOT RUN',generated:target||null}));
}else{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rooom-presentation-probe-')),app=path.join(tmp,'OfflinePresentationProbe.app');
 const bundle='com.rooom.offline.presentationprobe.'+crypto.randomBytes(4).toString('hex');
 const run=(command,args,timeout=120000)=>{const r=cp.spawnSync(command,args,{encoding:'utf8',timeout,maxBuffer:8e6});assert.equal(r.status,0,`${command}\n${r.error?.message||''}\n${r.stdout||''}\n${r.stderr||''}`);return r.stdout.trim();};
 // Resolve the toolchain before starting CoreSimulator. The prior timeout
 // was SDK lookup ETIMEDOUT; contention is a hypothesis, not a product finding.
 const sdk=run('xcrun',['--sdk','iphonesimulator','--show-sdk-path']);
 const compiler=run('xcrun',['--sdk','iphonesimulator','--find','swiftc']);
 const available=JSON.parse(run('xcrun',['simctl','list','devices','available','--json']));
 const devices=Object.entries(available.devices).filter(([runtime])=>runtime.includes('.iOS-')).flatMap(([runtime,ds])=>ds.filter(d=>d.isAvailable!==false&&d.name.includes('iPad')).map(d=>({...d,runtime})));
 assert(devices.length,'No existing iPad runtime; this script never downloads one');devices.sort((a,b)=>Number(b.state==='Booted')-Number(a.state==='Booted'));
 const device=devices[0],bootedHere=device.state!=='Booted';let installed=false,startedHere=false;
 try{
  fs.mkdirSync(app);fs.writeFileSync(path.join(tmp,'Probe.swift'),swift);
  fs.writeFileSync(path.join(app,'Info.plist'),`<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${bundle}</string><key>CFBundleExecutable</key><string>OfflinePresentationProbe</string><key>CFBundleName</key><string>Offline Presentation Probe</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string><key>MinimumOSVersion</key><string>15.0</string><key>UIDeviceFamily</key><array><integer>2</integer></array><key>UIRequiresFullScreen</key><true/><key>UISupportedInterfaceOrientations</key><array><string>UIInterfaceOrientationPortrait</string></array><key>UILaunchScreen</key><dict/></dict></plist>`);
  run(compiler,['-swift-version','5','-parse-as-library','-target',`${process.arch==='arm64'?'arm64':'x86_64'}-apple-ios15.0-simulator`,'-sdk',sdk,'-module-cache-path',path.join(tmp,'module-cache'),path.join(tmp,'Probe.swift'),'-o',path.join(app,'OfflinePresentationProbe'),'-framework','UIKit','-framework','WebKit','-framework','QuartzCore']);
  // Compile must succeed before boot; no assertion, timeout or signing bypass.
  if(bootedHere){run('xcrun',['simctl','boot',device.udid]);startedHere=true;}
  run('xcrun',['simctl','bootstatus',device.udid,'-b'],240000);
  run('xcrun',['simctl','install',device.udid,app]);installed=true;run('xcrun',['simctl','launch',device.udid,bundle]);
  const data=run('xcrun',['simctl','get_app_container',device.udid,bundle,'data']),file=path.join(data,'Documents','presentation-report.json'),deadline=Date.now()+90000;
  while(!fs.existsSync(file)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,250));
  assert(fs.existsSync(file),'Probe did not finish; sources retained at '+tmp);
  const report=JSON.parse(fs.readFileSync(file,'utf8'));report.extraction=extraction;report.simulator={name:device.name,runtime:device.runtime};
  const output=path.resolve(process.env.ROOOM_PRESENTATION_PROBE_REPORT||path.join(tmp,'report.json'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,output,failures:report.failures,scope:report.scope}));assert.equal(report.ok,true,'Offline UIKit/WK probe failed');
 }finally{
  if(installed){cp.spawnSync('xcrun',['simctl','terminate',device.udid,bundle]);cp.spawnSync('xcrun',['simctl','uninstall',device.udid,bundle]);}
  if(startedHere)cp.spawnSync('xcrun',['simctl','shutdown',device.udid]);
 }
}
