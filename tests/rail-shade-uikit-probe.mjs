// Independent offline UIKit/WK test. Actual source blocks; no SDK or app build.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=process.env.ROOOM_IOS_SOURCE_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'ios/App/App/RooomImobileBanner.swift'),'utf8').replaceAll('\r\n','\n');
function block(marker){const start=source.indexOf(marker);assert(start>=0,marker);const open=source.indexOf('{',start);let depth=0;for(let i=open;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);}throw Error('Unclosed source block '+marker);}
const shade=block('final class RooomRailShade {'),permission=block('struct WebPresentationPermission {'),insets=block('struct RooomAdInsets:'),error=block('enum RooomAdError:'),set=block('func setRailShade('),frame=block('private func updateRailShadeFrame()'),handler=block('private func handlePresentation(');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const swift=String.raw`
import Foundation
import UIKit
import WebKit
import QuartzCore
`+error+'\n'+insets+'\n'+permission+'\n'+shade+String.raw`
// Engine dependencies only are fixtures. The two actual shade methods below
// are copied verbatim, including actual UIApplication eligibility checks.
private final class ProbeEngine {
 var shell:UIView?;var device="tablet",reservation=RooomAdInsets()
 var presentation=WebPresentationPermission();let railShade=RooomRailShade()
 init(_ shell:UIView){self.shell=shell}
 func refresh(){updateRailShadeFrame()}
 func setPresentation(document:String,sequence:Int,allowed:Bool,cover:UIColor?)throws{throw RooomAdError.invalidRequest}
 func commitPresentation(document:String,sequence:Int)throws{throw RooomAdError.invalidRequest}
 func abortPresentation(document:String,sequence:Int){}
`+set+'\n'+frame+String.raw`
}
private final class ProbeBridge { let webView:WKWebView?;init(_ web:WKWebView){webView=web} }
private func rect(_ r:CGRect)->[String:Double]{["x":Double(r.minX),"y":Double(r.minY),"width":Double(r.width),"height":Double(r.height)]}
private final class ProbeController:UIViewController,WKNavigationDelegate,WKScriptMessageHandlerWithReply {
 private let shell=UIView();private var main:WKWebView!,rail:WKWebView!
 private var bridge:ProbeBridge?,monetization:ProbeEngine?
 private var presentationAcknowledgement:(document:String,sequence:Int,allowed:Bool,reply:(Any?,String?)->Void)?
 private func flushPresentationAcknowledgement(){}
 private var started=false,finished=false,loadCounts=["main":0,"rail":0],blockedRequests=0
 private var pending:[ObjectIdentifier:CheckedContinuation<Void,Error>]=[:]
 private var failures:[String]=[],cases:[[String:Any]]=[]
 private var assertions=0
 private var engine:ProbeEngine {monetization!}
 override func viewDidLoad(){super.viewDidLoad();view.backgroundColor = .white;shell.frame=CGRect(x:0,y:0,width:1024,height:768);shell.backgroundColor = .white;view.addSubview(shell)
  func make(_ frame:CGRect)->WKWebView{let c=WKWebViewConfiguration();c.websiteDataStore = .nonPersistent();let w=WKWebView(frame:frame,configuration:c);w.navigationDelegate=self;w.scrollView.contentInsetAdjustmentBehavior = .never;shell.addSubview(w);return w}
  main=make(CGRect(x:316,y:0,width:708,height:768));rail=make(CGRect(x:0,y:0,width:316,height:768))
  main.configuration.userContentController.addScriptMessageHandler(self,contentWorld:.page,name:"rooomMonetization")
  // The second about-origin handler exists only to test trusted-handler refusal;
  // the actual shipped isolated rail has no privileged handler.
  rail.configuration.userContentController.addScriptMessageHandler(self,contentWorld:.page,name:"rooomMonetization")
  bridge=ProbeBridge(main);monetization=ProbeEngine(shell)
 }
 override func viewDidAppear(_ animated:Bool){super.viewDidAppear(animated);guard !started else{return};started=true;Task{@MainActor in do{try await runProbe()}catch{failures.append(String(describing:error))};finish()}}
 private func check(_ condition:Bool,_ label:String){assertions+=1;if !condition{failures.append(label)}}
 private func pause(_ ns:UInt64)async{try? await Task.sleep(nanoseconds:ns)}
 private func js(_ web:WKWebView,_ code:String)async throws->Any{try await withCheckedThrowingContinuation{c in web.evaluateJavaScript(code){v,e in if let e{c.resume(throwing:e)}else{c.resume(returning:v ?? NSNull())}}}}
 private func asyncJS(_ web:WKWebView,_ code:String)async throws->Any{try await web.callAsyncJavaScript(code,arguments:[:],in:nil,contentWorld:.page) ?? NSNull()}
 private func load(_ web:WKWebView)async throws{try await withCheckedThrowingContinuation{(c:CheckedContinuation<Void,Error>)in pending[ObjectIdentifier(web)]=c;web.loadHTMLString("<meta name='viewport' content='width=device-width,initial-scale=1'><meta http-equiv='Content-Security-Policy' content=\"default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline';connect-src 'none';img-src 'none';frame-src 'self'\"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:white}</style><body><div id='retained'>offline retained node</div><script>window.retainedNode=document.getElementById('retained');window.marker=17;</script>",baseURL:web===main ? URL(string:"https://rooom-talk.com/"):nil)}}
 func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){let key=webView===main ? "main":"rail";loadCounts[key,default:0]+=1;let c=pending.removeValue(forKey:ObjectIdentifier(webView));c?.resume()}
 func webView(_ webView:WKWebView,didFail navigation:WKNavigation!,withError error:Error){pending.removeValue(forKey:ObjectIdentifier(webView))?.resume(throwing:error)}
 func webView(_ webView:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError error:Error){pending.removeValue(forKey:ObjectIdentifier(webView))?.resume(throwing:error)}
 func webView(_ webView:WKWebView,decidePolicyFor action:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void){
  let inlineBase=webView===main && loadCounts["main"]==0 && pending[ObjectIdentifier(webView)] != nil && action.request.url?.absoluteString=="https://rooom-talk.com/"
  if (action.request.url?.scheme ?? "about")=="about" || inlineBase{decisionHandler(.allow)}else{blockedRequests+=1;decisionHandler(.cancel)}
 }
 func userContentController(_ controller:WKUserContentController,didReceive message:WKScriptMessage,replyHandler:@escaping(Any?,String?)->Void){guard let body=message.body as? [String:Any],body["op"] as? String == "presentation" else{replyHandler(nil,"Invalid fixture dispatch envelope");return};handlePresentation(message,body:body,reply:replyHandler)}
 private func command(_ web:WKWebView,_ body:[String:Any])async throws->[String:Any]{let encoded=String(data:try JSONSerialization.data(withJSONObject:body),encoding:.utf8)!;let response=try await asyncJS(web,"try { return {accepted:true,value:await window.webkit.messageHandlers.rooomMonetization.postMessage("+encoded+")}; } catch (error) { return {accepted:false,error:String(error)}; }");guard let object=response as? [String:Any] else{throw NSError(domain:"Invalid bridge response",code:1)};return object}
 private func mark(_ name:String){cases.append(["case":name,"main":rect(main.frame),"rail":rect(rail.frame),"cover":rect(engine.railShade.view.frame),"hidden":engine.railShade.view.isHidden,"sequence":engine.railShade.sequence,"loads":loadCounts])}
 private func retained(_ mainFrame:CGRect,_ railFrame:CGRect,_ label:String)async throws{check(main.frame==mainFrame && rail.frame==railFrame,label+" frames unchanged");for w in [main!,rail!]{let value=try await js(w,"window.marker===17 && window.retainedNode===document.getElementById('retained')");check(value as? Bool == true,label+" retained DOM")};check(loadCounts==["main":1,"rail":1],label+" no extra navigation/load")}
 private func rejects(_ label:String,_ body:()throws->Void){do{try body();check(false,label)}catch{check(true,label)}}
 private func runProbe()async throws{
  check(UIDevice.current.userInterfaceIdiom == .pad,"iPad simulator required");try await load(main);try await load(rail)
  let mainIdentity=ObjectIdentifier(main!),railIdentity=ObjectIdentifier(rail!),m=main.frame,r=rail.frame,doc=engine.presentation.documentId
  check(engine.presentation.set(document:doc,sequence:1,allowed:true),"fixture allowed");check(engine.presentation.commit(document:doc,sequence:1),"fixture committed");engine.reservation=RooomAdInsets(left:316)
  let snapshot=try await command(main,["version":1,"op":"presentation","command":"shadeSnapshot"])
  check(main.url?.absoluteString=="https://rooom-talk.com/","offline inline main document has actual trusted URL")
  check(snapshot["accepted"] as? Bool == true,"real trusted HTTPS-origin WK snapshot accepted")
  guard let identity=snapshot["value"] as? [String:Any],identity["documentId"] as? String == doc,identity["sequence"] as? Int == 0 else{throw NSError(domain:"Real trusted WK snapshot did not match engine; no transport fallback",code:2)}
  let on=try await command(main,["version":1,"op":"presentation","command":"shade","documentId":doc,"sequence":1,"enabled":true,"rgba":[5.0,8.0,12.0,0.73],"leaseMilliseconds":5000.0]);check(on["accepted"] as? Bool == true,"real trusted WK shade ON accepted")
  let cover=engine.railShade.view;check(!cover.isHidden,"ON actual UIView visible");check(cover.frame==CGRect(x:0,y:0,width:316,height:768),"full left reservation covered");check(shell.subviews.last===cover,"shade above WK rail");check(cover.isUserInteractionEnabled && shell.hitTest(CGPoint(x:100,y:100),with:nil)===cover,"ad touch intercepted")
  let mainHit=shell.hitTest(CGPoint(x:500,y:100),with:nil)
  let mainOwnsHit=mainHit.map { ($0 === main) || $0.isDescendant(of:main) } ?? false
  let mainHitOkay=(mainHit !== cover) && mainOwnsHit
  check(mainHitOkay,"main touches not intercepted")
  if !mainHitOkay { cases.append(["case":"main-hit-failure-diagnostic","hitClass":mainHit.map { String(describing:type(of:$0)) } ?? "nil","hitInShell":mainHit.map { rect($0.convert($0.bounds,to:shell)) } ?? [:],"mainFrame":rect(main.frame),"coverFrame":rect(cover.frame),"mainOwnsHit":mainOwnsHit]) }
  var red:CGFloat=0,green:CGFloat=0,blue:CGFloat=0,alpha:CGFloat=0;check(cover.backgroundColor?.getRed(&red,green:&green,blue:&blue,alpha:&alpha)==true,"RGBA readable");check(abs(red-5/255)<0.0001 && abs(green-8/255)<0.0001 && abs(blue-12/255)<0.0001 && abs(alpha-0.73)<0.0001 && cover.alpha==1,"actual UIColor alpha applied once")
  try await retained(m,r,"ON");mark("on-frame-alpha-hit-test")
  shell.addSubview(UIView(frame:r));engine.refresh();check(shell.subviews.last===cover,"existing-layout end reasserts front order")
  let off=try await command(main,["version":1,"op":"presentation","command":"shade","documentId":doc,"sequence":2,"enabled":false,"leaseMilliseconds":5000.0]);check(off["accepted"] as? Bool == true && cover.isHidden,"real trusted WK OFF hides cover")
  for (label,body) in [("old sequence",["version":1,"op":"presentation","command":"shade","documentId":doc,"sequence":1,"enabled":true,"rgba":[5.0,8.0,12.0,0.73],"leaseMilliseconds":5000.0] as [String:Any]),("invalid alpha",["version":1,"op":"presentation","command":"shade","documentId":doc,"sequence":3,"enabled":true,"rgba":[5.0,8.0,12.0,1.01],"leaseMilliseconds":5000.0] as [String:Any]),("old document",["version":1,"op":"presentation","command":"shade","documentId":"old-document","sequence":3,"enabled":true,"rgba":[5.0,8.0,12.0,0.73],"leaseMilliseconds":5000.0] as [String:Any])]{let response=try await command(main,body);check(response["accepted"] as? Bool == false,"actual trusted handler rejects "+label)}
  check(cover.isHidden && engine.railShade.sequence==2,"rejected WK commands cannot revive or advance");try await retained(m,r,"OFF");mark("real-WK-clear-reordered-invalid-document")
  for color in [[Double.nan,8,12,0.73],[5,8,12,Double.infinity],[5,8,12,1.01],[-1,8,12,0.73],[256,8,12,0.73],[5,8,12]]{rejects("malformed RGBA rejected"){try engine.setRailShade(document:doc,sequence:3,rgba:color,leaseMilliseconds:5000)}}
  for duration in [249.0,5001.0,Double.nan]{rejects("invalid lease rejected"){try engine.setRailShade(document:doc,sequence:3,rgba:[5,8,12,0.73],leaseMilliseconds:duration)}}
  rejects("old document rejected"){try engine.setRailShade(document:"previous-document",sequence:3,rgba:[5,8,12,0.73],leaseMilliseconds:5000)};check(engine.railShade.sequence==2,"invalid inputs never advance sequence");mark("invalid-color-lease-document")
  try engine.setRailShade(document:doc,sequence:3,rgba:[5,8,12,0.73],leaseMilliseconds:5000);let started=ProcessInfo.processInfo.systemUptime;await pause(1_000_000_000);check(!cover.isHidden && engine.railShade.rgba != nil,"five-second lease not expired at one second");await pause(4_350_000_000)
  for _ in 0..<30{if engine.railShade.rgba==nil{break};await pause(50_000_000)}
  check(ProcessInfo.processInfo.systemUptime-started>=5,"real five-second wait");check(cover.isHidden && engine.railShade.rgba==nil && engine.railShade.sequence==3,"real common-runloop lease expires without sequence reset");try await retained(m,r,"lease expiry");mark("actual-five-second-expiry")
  try engine.setRailShade(document:doc,sequence:4,rgba:[5,8,12,0.73],leaseMilliseconds:5000);engine.railShade.suspend();check(cover.isHidden && engine.railShade.rgba != nil,"suspend hides but retains Web pixels");await pause(150_000_000);engine.railShade.resume();engine.refresh();check(!cover.isHidden && engine.railShade.sequence==4,"resume preserves same visual state/sequence");try await retained(m,r,"suspend/resume");mark("generic-suspend-resume")
  shell.frame.size=CGSize(width:768,height:1024);main.frame=CGRect(x:0,y:0,width:768,height:1024);engine.reservation=RooomAdInsets();engine.refresh();check(cover.isHidden,"portrait has no rail cover");check(engine.railShade.rgba != nil,"portrait retains Web desired pixels");mark("controlled-portrait-resize")
  shell.frame.size=CGSize(width:1024,height:768);main.frame=m;engine.reservation=RooomAdInsets(left:316);engine.refresh();check(!cover.isHidden && cover.frame==r,"return landscape follows existing reservation");try await retained(m,r,"resize return");mark("controlled-landscape-return")
  let response=try await command(rail,["version":1,"op":"presentation","command":"shadeSnapshot"]);check(response["accepted"] as? Bool == false,"actual trusted handler rejects offline about origin")
  let child=try await asyncJS(main,"return await new Promise(resolve=>{let frame;const timer=setTimeout(()=>{removeEventListener('message',receive);frame?.remove();resolve('timeout');},3000);function receive(e){if(e.data?.railShadeChild!==true)return;clearTimeout(timer);removeEventListener('message',receive);frame.remove();resolve(e.data.accepted?'accepted':'rejected');}addEventListener('message',receive);frame=document.createElement('iframe');frame.srcdoc=\"<script>window.webkit.messageHandlers.rooomMonetization.postMessage({version:1,op:'presentation',command:'shadeSnapshot'}).then(()=>parent.postMessage({railShadeChild:true,accepted:true},'*'),()=>parent.postMessage({railShadeChild:true,accepted:false},'*'))</script>\";document.body.append(frame);});")
  check(child as? String == "rejected","actual trusted handler rejects real same-origin child frame");mark("real-WK-about-origin-and-child-frame-rejection")
  engine.presentation.reset();engine.railShade.reset();engine.refresh();check(cover.isHidden && cover.superview==nil && engine.railShade.sequence==0,"actual document reset helpers clear/detach");rejects("prior document cannot set after reset"){try engine.setRailShade(document:doc,sequence:100,rgba:[5,8,12,0.73],leaseMilliseconds:5000)}
  check(ObjectIdentifier(main!)==mainIdentity && ObjectIdentifier(rail!)==railIdentity,"WK object identities retained");try await retained(m,r,"document reset helpers");check(blockedRequests==0,"no external/provider request attempted");mark("document-reset-prior-document")
 }
 private func finish(){guard !finished else{return};finished=true;main.configuration.userContentController.removeScriptMessageHandler(forName:"rooomMonetization",contentWorld:.page);rail.configuration.userContentController.removeScriptMessageHandler(forName:"rooomMonetization",contentWorld:.page)
  let report:[String:Any]=["ok":failures.isEmpty,"failures":failures,"assertions":assertions,"cases":cases,"loads":loadCounts,"blockedRequests":blockedRequests,"cloudWrites":0,
   "scope":"Actual extracted RooomRailShade class, engine set/frame methods, permission state and trusted handler; real UIKit UIColor/UIView z-order/hit-test and two WKWebViews with retained DOM. Device/reservation/main frame assignment, op-envelope dispatch and unused presentation handlers are fixtures. The main page uses offline loadHTMLString with exact HTTPS baseURL, exercising real WK frameInfo/securityOrigin/web.url for snapshot/ON/OFF/reordered/invalid-alpha/old-document messages. The real handler must reject the about-origin document and same-origin srcdoc child; failure is not replaced with mocked transport. Real five-second Timer expiry and generic suspend/resume are exercised; lifecycle notification delivery, full SDK/Capacitor monetization, actual app first paint, physical OS rotation and TestFlight are NOT proven. No advertising/backend/SDK linked; inline CSP default/connect/img none and frame self only for srcdoc. Only about navigations and the initial pending trusted inline base URL are permitted; no remote page is loaded."]
  do{let folder=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0];try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true);try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("rail-shade-report.json"),options:.atomic)}catch{NSLog("Probe report failure %@",String(describing:error))}
 }
`+handler+String.raw`
}
@main private final class ProbeApp:UIResponder,UIApplicationDelegate {
 var window:UIWindow?
 func application(_ application:UIApplication,didFinishLaunchingWithOptions options:[UIApplication.LaunchOptionsKey:Any]?=nil)->Bool{window=UIWindow(frame:UIScreen.main.bounds);window?.rootViewController=ProbeController();window?.makeKeyAndVisible();return true}
}
`;
assert.doesNotMatch(swift,/import (?:ImobileSdkAds|Firebase|Capacitor)/);
const extraction={shadeSha256:hash(shade),engineMethodsSha256:hash(set+'\n'+frame),handlerSha256:hash(handler),permissionSha256:hash(permission),swiftSha256:hash(swift)};
if(process.argv.includes('--extract-only')||process.platform!=='darwin'){
 const file=process.env.ROOOM_RAIL_SHADE_PROBE_SWIFT;if(file){fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});fs.writeFileSync(file,swift);}console.log(JSON.stringify({extraction:'PASS',...extraction,simulator:'NOT RUN',generated:file||null}));
}else{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rooom-rail-shade-probe-')),app=path.join(tmp,'OfflineRailShadeProbe.app'),bundle='com.rooom.offline.railshade.'+crypto.randomBytes(4).toString('hex');
 const run=(command,args,timeout=120000)=>{const r=cp.spawnSync(command,args,{encoding:'utf8',timeout,maxBuffer:8e6});assert.equal(r.status,0,`${command}\n${r.error?.message||''}\n${r.stdout||''}\n${r.stderr||''}`);return r.stdout.trim();};
 // Resolve the toolchain before starting CoreSimulator. The prior timeout
 // was SDK lookup ETIMEDOUT; contention is a hypothesis, not a product finding.
 const sdk=run('xcrun',['--sdk','iphonesimulator','--show-sdk-path']);
 const compiler=run('xcrun',['--sdk','iphonesimulator','--find','swiftc']);
 const available=JSON.parse(run('xcrun',['simctl','list','devices','available','--json'])),devices=Object.entries(available.devices).filter(([r])=>r.includes('.iOS-')).flatMap(([runtime,ds])=>ds.filter(d=>d.isAvailable!==false&&d.name.includes('iPad')).map(d=>({...d,runtime})));assert(devices.length,'No existing iPad simulator; probe never downloads one');devices.sort((a,b)=>Number(b.state==='Booted')-Number(a.state==='Booted'));
 const device=devices[0],bootedHere=device.state!=='Booted';let installed=false,startedHere=false;
 try{
  fs.mkdirSync(app);fs.writeFileSync(path.join(tmp,'Probe.swift'),swift);
  fs.writeFileSync(path.join(app,'Info.plist'),`<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${bundle}</string><key>CFBundleExecutable</key><string>OfflineRailShadeProbe</string><key>CFBundleName</key><string>Offline Rail Shade Probe</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string><key>MinimumOSVersion</key><string>15.0</string><key>UIDeviceFamily</key><array><integer>2</integer></array><key>UIRequiresFullScreen</key><true/><key>UISupportedInterfaceOrientations</key><array><string>UIInterfaceOrientationPortrait</string></array><key>UILaunchScreen</key><dict/></dict></plist>`);
  run(compiler,['-swift-version','5','-parse-as-library','-target',`${process.arch==='arm64'?'arm64':'x86_64'}-apple-ios15.0-simulator`,'-sdk',sdk,'-module-cache-path',path.join(tmp,'module-cache'),path.join(tmp,'Probe.swift'),'-o',path.join(app,'OfflineRailShadeProbe'),'-framework','UIKit','-framework','WebKit','-framework','QuartzCore']);
  // Compile must succeed before boot; no assertion, timeout or signing bypass.
  if(bootedHere){run('xcrun',['simctl','boot',device.udid]);startedHere=true;}
  run('xcrun',['simctl','bootstatus',device.udid,'-b'],240000);
  run('xcrun',['simctl','install',device.udid,app]);installed=true;run('xcrun',['simctl','launch',device.udid,bundle]);
  const data=run('xcrun',['simctl','get_app_container',device.udid,bundle,'data']),file=path.join(data,'Documents','rail-shade-report.json'),deadline=Date.now()+90000;
  while(!fs.existsSync(file)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,250));assert(fs.existsSync(file),'Probe did not finish; source retained at '+tmp);
  const report=JSON.parse(fs.readFileSync(file,'utf8'));report.extraction=extraction;report.simulator={name:device.name,runtime:device.runtime};const output=path.resolve(process.env.ROOOM_RAIL_SHADE_PROBE_REPORT||path.join(tmp,'report.json'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,output,assertions:report.assertions,cases:report.cases.length,failures:report.failures,scope:report.scope}));assert.equal(report.ok,true,'Independent offline rail shade UIKit/WK probe failed');
 }finally{if(installed){cp.spawnSync('xcrun',['simctl','terminate',device.udid,bundle]);cp.spawnSync('xcrun',['simctl','uninstall',device.udid,bundle]);}if(startedHere)cp.spawnSync('xcrun',['simctl','shutdown',device.udid]);}
}
