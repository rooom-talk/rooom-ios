// Deterministic lifecycle exercise of the shipped renderer and coordinator.
// Timer/UIKit/application transport are doubles; macOS compiles actual Swift blocks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
const source=fs.readFileSync(new URL('../ios/App/App/RooomImobileBanner.swift',import.meta.url),'utf8').replaceAll('\r\n','\n');
function block(marker){const start=source.indexOf(marker);assert(start>=0,marker);const open=source.indexOf('{',start);let depth=0;for(let i=open;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);}throw Error(marker);}
function observer(name){const start=source.indexOf('forName: UIApplication.'+name);assert(start>=0,name);const from=source.indexOf('{ [weak self] _ in',start),to=source.indexOf('\n        })',from);assert(from>start&&to>from);return source.slice(from+'{ [weak self] _ in'.length,to);}
const shade=block('final class RooomRailShade {'),set=block('    func setRailShade('),frame=block('    private func updateRailShadeFrame()'),background=block('    private func enterRailShadeBackground()'),reset=block('    private func resetRailShade()');
assert.match(observer('willResignActiveNotification'),/railShade\.suspend\(\)/);
assert.match(observer('didEnterBackgroundNotification'),/enterRailShadeBackground\(\)/);
assert.match(observer('didBecomeActiveNotification'),/railShade\.resume\(\); self\.layout\(\)/);
assert.match(frame,/applicationState != \.background/);
assert.match(set,/document == railShadeDocument/);
assert.match(source,/command == "shadeSnapshot"[\s\S]*?engine\.railShadeDocument/);
const command=block('if command == "shade" {'),snapshot=block('if command == "shadeSnapshot" {');
assert.match(snapshot,/applicationState != \.background/);
assert.match(command,/!enabled \|\| UIApplication\.shared\.applicationState != \.background/);
assert.doesNotMatch(shade,/renew\(milliseconds: 5000\)|resume\(\)[^\n]*5000/);
const swift=String.raw`
import Foundation
import CoreGraphics
enum RooomAdError: Error { case invalidRequest }
class UIColor {let rgba:[CGFloat];init(red:CGFloat,green:CGFloat,blue:CGFloat,alpha:CGFloat){rgba=[red,green,blue,alpha]}}
class UIView {var isOpaque=true,isHidden=false,isAccessibilityElement=true,accessibilityElementsHidden=false,isUserInteractionEnabled=false,frame=CGRect.zero;var backgroundColor:UIColor?;weak var superview:UIView?
 func addSubview(_ v:UIView){v.superview=self};func bringSubviewToFront(_ v:UIView){};func removeFromSuperview(){superview=nil};static func performWithoutAnimation(_ f:()->Void){f()}}
class Timer {static var made:[Timer]=[];let interval:Double;let callback:(Timer)->Void;var invalidated=false
 init(timeInterval:Double,repeats:Bool,block:@escaping(Timer)->Void){interval=timeInterval;callback=block;Self.made.append(self)}
 func invalidate(){invalidated=true};func fireEvenIfInvalidated(){callback(self)}}
class RunLoop {static let main=RunLoop();enum Mode{case common};func add(_ t:Timer,forMode:Mode){}}
enum AppState {case active,inactive,background};class UIApplication {static let shared=UIApplication();var applicationState=AppState.active}
struct Permission {var allowed=true,committed=true}
struct Insets {var left:CGFloat=316}
`+shade+String.raw`
final class Engine {
 var shell:UIView?=UIView(),device="tablet",reservation=Insets(),presentation=Permission()
 let railShade:RooomRailShade;var railShadeDocument=UUID().uuidString
 init(_ shade:RooomRailShade){railShade=shade;shell?.frame=CGRect(x:0,y:0,width:1024,height:768)}
 func refresh(){updateRailShadeFrame()}
 func background(){enterRailShadeBackground()};func reset(){resetRailShade()}
`+set+'\n'+frame+'\n'+background+'\n'+reset+String.raw`
}
// The actual frame method reads shell.bounds; its mocked view exposes the same geometry.
extension UIView {var bounds:CGRect {CGRect(origin:.zero,size:frame.size)}}
final class Handler {
 let engine:Engine
 init(_ engine:Engine){self.engine=engine}
 func receive(_ command:String,_ body:[String:Any],document:String,sequence:Int,reply:(Any?,String?)->Void){
`+snapshot+'\n'+String.raw`
  do {
`+command+String.raw`
  }catch{reply(nil,"Rejected")}
 }
 func invoke(_ command:String="shade",document:String,sequence:Int,enabled:Bool=true)->Bool {
  var accepted=false
  receive(command,["enabled":enabled,"rgba":[4.0,5.0,6.0,0.2],"leaseMilliseconds":500.0],document:document,sequence:sequence){_,error in accepted=error==nil}
  return accepted
 }
}
var assertions=0
func check(_ value:Bool,_ message:String){assertions+=1;precondition(value,message)}
func near(_ a:Double,_ b:Double)->Bool{abs(a-b)<0.000001}
func rejects(_ message:String,_ operation:()throws->Void){do{try operation();check(false,message)}catch{check(true,message)}}
var time=100.0
let shade=RooomRailShade(now:{time}),engine=Engine(shade),doc=engine.railShadeDocument
let handler=Handler(engine)
try engine.setRailShade(document:doc,sequence:1,rgba:[9,17,31,0.42],leaseMilliseconds:700)
check(!shade.view.isHidden && shade.rgba==[9,17,31,0.42],"Web color starts visible")
let original=Timer.made.last!;check(near(original.interval,0.7),"Web duration used without substitution")
time+=0.2;shade.suspend();let count=Timer.made.count
check(original.invalidated && !shade.view.isHidden && shade.rgba != nil,"inactive retains pixels and cancels timer")
time+=100;shade.suspend();check(Timer.made.count==count && !shade.view.isHidden,"duplicate suspend preserves frozen lease")
UIApplication.shared.applicationState = .inactive
for _ in 0..<5{engine.refresh();check(!shade.view.isHidden,"inactive layout retains overlay")}
shade.resume();let resumed=Timer.made.last!;check(near(resumed.interval,0.5),"resume uses only unconsumed Web lease")
original.fireEvenIfInvalidated();check(shade.rgba != nil,"stale same-sequence timer cannot clear resumed state")
let resumedCount=Timer.made.count;time+=0.3;shade.resume();engine.refresh();check(Timer.made.count==resumedCount,"duplicate resume and layout cannot extend lease")
shade.suspend();time+=100
try engine.setRailShade(document:doc,sequence:2,rgba:[1,2,3,0.6],leaseMilliseconds:350)
check(Timer.made.count==resumedCount && !shade.view.isHidden,"inactive new ON updates Web pixels without running timer")
check(shade.rgba==[1,2,3,0.6],"inactive color remains Web-owned")
shade.resume();check(near(Timer.made.last!.interval,0.35),"new Web ON owns its own remaining lease")
resumed.fireEvenIfInvalidated();check(shade.sequence==2 && shade.rgba != nil,"old timer cannot erase newer ON")
shade.suspend();let beforeOff=Timer.made.count
try engine.setRailShade(document:doc,sequence:3,rgba:nil,leaseMilliseconds:350)
shade.resume();check(shade.rgba==nil && shade.view.isHidden && Timer.made.count==beforeOff,"OFF while inactive cannot resurrect")
Timer.made.last!.fireEvenIfInvalidated();check(shade.rgba==nil && shade.sequence==3,"stale timer after OFF remains inert")
try engine.setRailShade(document:doc,sequence:4,rgba:[1,2,3,0.6],leaseMilliseconds:250)
time+=0.3;shade.suspend();shade.resume();check(shade.rgba==nil && shade.sequence==4,"already elapsed lease cannot revive on suspend/resume")
try engine.setRailShade(document:doc,sequence:5,rgba:[1,2,3,0.6],leaseMilliseconds:5000)
let beforeBackground=Timer.made.last!;shade.suspend();UIApplication.shared.applicationState = .background;engine.background();engine.refresh()
check(shade.rgba==nil && shade.view.isHidden && shade.sequence==5,"true background clears pixels while retaining ordering")
check(engine.railShadeDocument != doc,"true background invalidates pre-background shade identity")
check(!handler.invoke("shadeSnapshot",document:engine.railShadeDocument,sequence:6),"true-background snapshot rejected")
check(!handler.invoke(document:engine.railShadeDocument,sequence:6),"true-background ON rejected")
check(handler.invoke(document:engine.railShadeDocument,sequence:6,enabled:false),"true-background OFF accepted")
let backgroundCount=Timer.made.count
UIApplication.shared.applicationState = .active;shade.resume();engine.refresh();check(shade.rgba==nil && shade.view.isHidden && Timer.made.count==backgroundCount,"return cannot replay cached ON")
rejects("pre-background queued ON rejected after active return"){try engine.setRailShade(document:doc,sequence:99,rgba:[4,5,6,0.2],leaseMilliseconds:5000)}
beforeBackground.fireEvenIfInvalidated();check(shade.rgba==nil,"old background timer inert")
UIApplication.shared.applicationState = .inactive
check(handler.invoke("shadeSnapshot",document:engine.railShadeDocument,sequence:7),"inactive snapshot allowed")
check(handler.invoke(document:engine.railShadeDocument,sequence:7),"inactive ON allowed through actual handler block")
check(handler.invoke(document:engine.railShadeDocument,sequence:8,enabled:false),"inactive OFF allowed")
UIApplication.shared.applicationState = .active
let fresh=engine.railShadeDocument
try engine.setRailShade(document:fresh,sequence:9,rgba:[7,8,9,0.35],leaseMilliseconds:600)
check(!shade.view.isHidden && shade.rgba==[7,8,9,0.35],"fresh Web snapshot identity can restore latest pixels")
let beforeReset=Timer.made.last!;engine.reset();engine.refresh()
check(shade.rgba==nil && shade.view.isHidden && shade.sequence==0 && shade.view.superview==nil,"navigation reset detaches pixels and clears sequence")
check(engine.railShadeDocument != fresh,"navigation has a separate shade identity")
rejects("old document ON rejected after navigation"){try engine.setRailShade(document:fresh,sequence:77,rgba:[7,8,9,0.35],leaseMilliseconds:600)}
beforeReset.fireEvenIfInvalidated();check(shade.rgba==nil,"old navigation timer inert")
let current=engine.railShadeDocument
try engine.setRailShade(document:current,sequence:1,rgba:[1,2,3,0.4],leaseMilliseconds:250)
let validTimer=Timer.made.last!;validTimer.fireEvenIfInvalidated()
check(shade.rgba==nil && shade.view.isHidden && shade.sequence==1,"current expiry clears only pixels, not ordering")
rejects("expired ordering cannot be reused"){try engine.setRailShade(document:current,sequence:1,rgba:[1,2,3,0.4],leaseMilliseconds:250)}
print("RAIL SHADE LIFECYCLE PASS: \(assertions) actual-source assertions; deterministic Timer/UIKit/state doubles, not physical acceptance")
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rooom-shade-lifecycle-')),file=path.join(dir,'main.swift');fs.writeFileSync(file,swift);
if(process.platform==='darwin'){const binary=path.join(dir,'probe');cp.execFileSync('swiftc',[file,'-o',binary],{stdio:'inherit'});cp.execFileSync(binary,[],{stdio:'inherit'});}
else console.log('Rail shade lifecycle source boundaries PASS; actual Swift fixture generated. macOS runtime not run on this host.');
