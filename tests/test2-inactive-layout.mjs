// Independent audit: execute the shipped TEST2 layout and notification bodies.
// UIKit/WebKit/rail transports are doubles; this is not physical system-UI acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
const source=fs.readFileSync(new URL('../ios/App/App/RooomImobileBanner.swift',import.meta.url),'utf8').replaceAll('\r\n','\n');
const coordinator=source.slice(source.indexOf('final class RooomMonetization {'));
function block(marker){const start=coordinator.indexOf(marker);assert(start>=0,marker);const open=coordinator.indexOf('{',start);let depth=0;for(let i=open;i<coordinator.length;i++){if(coordinator[i]==='{')depth++;if(coordinator[i]==='}'&&--depth===0)return coordinator.slice(start,i+1);}throw Error(marker);}
function observer(name){const start=coordinator.indexOf('forName: UIApplication.'+name);assert(start>=0,name);const from=coordinator.indexOf('{ [weak self] _ in',start),to=coordinator.indexOf('\n        })',from);assert(from>start&&to>from);return coordinator.slice(from+'{ [weak self] _ in'.length,to);}
const layout=block('    func layout() {'),hide=block('    private func hideAll() {'),reserve=block('    private func setReservation(');
const resign=observer('willResignActiveNotification'),resume=observer('didBecomeActiveNotification');
const test2=layout.slice(layout.indexOf('#if ROOOM_TEST2_RAIL'),layout.indexOf('#else'));
const reservation=test2.indexOf('setReservation(RooomAdInsets(left: safe.left + railWidth))');
const activity=test2.indexOf('guard UIApplication.shared.applicationState == .active');
assert(reservation>=0&&activity>reservation,'TEST2 must reserve eligible geometry before checking activity');
assert(test2.indexOf('if testRail == nil')>activity,'Inactive layout must not allocate a rail');
assert.match(test2.slice(activity,test2.indexOf('if testRail == nil')),/testRail\?\.setPresentationVisible\(false\); return/);
assert.match(resign,/#if ROOOM_TEST2_RAIL[\s\S]*testRail\?\.setPresentationVisible\(false\)[\s\S]*#else[\s\S]*hideAll\(\)/);
assert.match(resume,/railShade.resume\(\); self.layout\(\)/);
console.log('TEST2 source boundaries PASS: activity controls visibility, geometry precedes activity, production observer unchanged');
const swift=String.raw`
import Foundation
enum AppState { case active, inactive, background }
class UIApplication { static let shared=UIApplication(); var applicationState=AppState.active }
struct RooomAdInsets: Equatable { var top:CGFloat=0,left:CGFloat=0,bottom:CGFloat=0,right:CGFloat=0 }
struct RooomAdPresentation { static let standard=RooomAdPresentation(); let railWidth:CGFloat=316 }
class Shell {var bounds=CGRect(x:0,y:0,width:1024,height:768);var safeAreaInsets=RooomAdInsets()}
class Store {}
class Configuration {let websiteDataStore=DataStore()};class DataStore {let httpCookieStore=Store()}
class Web {var url:URL?=URL(string:"https://rooom-test2.web.app/");let configuration=Configuration();func evaluateJavaScript(_ s:String,completionHandler:((Any?,Error?)->Void)?) {}}
class BridgeConfig {var serverURL:URL?=URL(string:"https://rooom-test2.web.app/")};class Bridge {let config=BridgeConfig()}
class Controller {var bridge:Bridge?=Bridge();var adReservationChanged:((RooomAdInsets)->Void)?}
class Shade {let view=View();func suspend(){view.isHidden=true};func resume(){}}
class View {var isHidden=false}
class Entry {let view=View()}
class Tablet {func release(){}}
class RooomTestRail {
 static var created=0,released=0,loads=0
 static func page(_ u:URL?)->Bool {u?.scheme=="https" && u?.host=="rooom-test2.web.app" && ["/","/index.html","/room.html"].contains(u?.path ?? "")}
 var visible=false;var frame=CGRect.zero
 init(source:Store,frame:CGRect){Self.created+=1;Self.loads+=1;self.frame=frame}
 func setPresentationVisible(_ b:Bool){visible=b}
 func place(in shell:Shell,frame:CGRect){self.frame=frame}
 func release(){Self.released+=1;visible=false}
}
struct Permission {var allowed=true,committed=true}
final class Probe {
 var shell:Shell?=Shell(),web:Web?=Web(),controller:Controller?=Controller()
 var device="tablet",keyboard=false,layingOut=false,presentation=Permission()
 var railShade=Shade(),testRail:RooomTestRail?,tabletWebAd:Tablet?,entries:[String:Entry]=[:]
 var reservation=RooomAdInsets(),leading:CGFloat=0,reservationChanges=0
 init(){controller?.adReservationChanged={ [weak self] value in self?.leading=value.left;self?.reservationChanges+=1}}
 func updateRailShadeFrame(){}
`+reserve+'\n'+hide+'\n'+layout+String.raw`
 func resign(){let callback:()->Void={ [weak self] in
`+resign+String.raw`
 };callback()}
 func resume(){let callback:()->Void={ [weak self] in
`+resume+String.raw`
 };callback()}
}
func check(_ value:Bool,_ label:String){precondition(value,label)}
let p=Probe();p.layout();let original=p.testRail
check(p.leading==316 && original?.visible==true,"normal landscape reservation")
let initialLoads=RooomTestRail.loads,initialCreated=RooomTestRail.created
// Notifications arrive before/while UIKit changes its activity state.
for state in [AppState.inactive,.background,.inactive] {
 p.resign();check(original?.visible==false,"willResign must hide retained surface")
 UIApplication.shared.applicationState=state
 for _ in 0..<5 {p.layout();check(p.leading==316 && p.reservation.left==316,"inactive must not widen main Web");check(p.testRail===original,"inactive must retain the same rail");check(original?.visible==false,"inactive rail stays hidden")}
 UIApplication.shared.applicationState = .active;p.resume()
 check(p.testRail===original && original?.visible==true,"resume reuses rail")
}
check(RooomTestRail.loads==initialLoads && RooomTestRail.created==initialCreated && RooomTestRail.released==0,"temporary interruptions must not reload or recreate")
UIApplication.shared.applicationState = .inactive;p.resign()
p.shell?.bounds=CGRect(x:0,y:0,width:768,height:1024);p.layout()
check(p.leading==0 && p.testRail==nil,"portrait clears landscape geometry even inactive")
let before=RooomTestRail.created
p.shell?.bounds=CGRect(x:0,y:0,width:1024,height:768);p.shell?.safeAreaInsets.left=20;p.layout()
check(p.leading==336 && p.testRail==nil && RooomTestRail.created==before,"inactive landscape reserves current safe area without allocation")
UIApplication.shared.applicationState = .active;p.resume()
check(p.leading==336 && p.testRail != nil && RooomTestRail.created==before+1,"rotation resume creates one eligible rail")
p.presentation.committed=false;p.layout();check(p.leading==336 && p.testRail?.visible==false,"guide preparation reserves but stays hidden")
p.resign();UIApplication.shared.applicationState = .inactive;p.layout();check(p.leading==336,"guide interruption retains geometry")
UIApplication.shared.applicationState = .active;p.presentation.committed=true;p.resume();check(p.testRail?.visible==true,"guide resume restores surface")
p.keyboard=true;p.layout();check(p.leading==0 && p.testRail==nil,"keyboard remains ineligible")
p.keyboard=false;p.layout();p.web?.url=URL(string:"https://example.com/");p.layout();check(p.leading==0 && p.testRail==nil,"untrusted navigation clears geometry")
p.web?.url=URL(string:"https://rooom-test2.web.app/");p.layout();p.presentation.allowed=false;p.layout();check(p.leading==0 && p.testRail==nil,"Web OFF clears geometry")
p.presentation.allowed=true;p.shell?.bounds=CGRect(x:0,y:0,width:600,height:400);p.layout();check(p.leading==0 && p.testRail==nil,"insufficient width remains ineligible")
print("TEST2 actual Swift layout and lifecycle PASS: inactive/background/recovery/rotation/guide/eligibility; transport doubles, not physical acceptance")
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rooom-test2-inactive-')),file=path.join(dir,'main.swift');fs.writeFileSync(file,swift);
if(process.platform==='darwin'){const binary=path.join(dir,'probe');cp.execFileSync('swiftc',['-D','ROOOM_TEST2_RAIL',file,'-o',binary],{stdio:'inherit'});cp.execFileSync(binary,[],{stdio:'inherit'});}
else console.log('Actual Swift fixture generated; runtime requires macOS. No UIKit or physical iPad execution on this host.');
