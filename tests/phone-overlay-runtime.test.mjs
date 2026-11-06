import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
const scene=fs.readFileSync(new URL('../ios/App/App/SceneDelegate.swift',import.meta.url),'utf8');
const ads=fs.readFileSync(new URL('../ios/App/App/RooomImobileBanner.swift',import.meta.url),'utf8');
function method(marker){
 const start=scene.indexOf(marker),open=scene.indexOf('{',start);assert.ok(start>=0);
 let depth=0;
 for(let i=open;i<scene.length;i++){
  if(scene[i]==='{')depth++;
  if(scene[i]==='}'&&--depth===0)return scene.slice(start,i+1);
 }
 throw Error(marker);
}
const bodies=[method('private func updateBridgeBottom()'),method('private func phonePresentationBottom(')];
const program=String.raw`
import Foundation
import CoreGraphics
enum Idiom { case phone, pad }
final class UIDevice { static let current=UIDevice(); var userInterfaceIdiom=Idiom.phone }
struct Insets { var bottom:CGFloat=0, left:CGFloat=0, right:CGFloat=0 }
typealias RooomAdInsets=Insets
enum RooomAdPolicy { static func advertisingPage(_ url:URL?) -> Bool { url?.host=="rooom-talk.com" && ["/","/room.html"].contains(url?.path ?? "") } }
final class Constraint { var constant:CGFloat=0 }
final class View { var bounds=CGRect(x:0,y:0,width:390,height:844); func setNeedsLayout() {} }
final class Web {
 var isLoading=false, url=URL(string:"https://rooom-talk.com/room.html")
 var calls:[String]=[], replies:[(Any?,Error?)->Void]=[]
 func evaluateJavaScript(_ script:String, completionHandler:@escaping(Any?,Error?)->Void) { calls.append(script); replies.append(completionHandler) }
 func reply(_ value:Bool=true) { replies.removeFirst()(value,nil) }
}
final class Bridge { var webView:Web?=Web() }
final class Engine { var reservation=Insets(bottom:84) }
final class Controller {
 var bridge:Bridge?=Bridge(), monetization:Engine?=Engine()
 var phoneOverlayDocument="document-A",phoneOverlayRequested=false
}
final class Harness {
 let bridgeViewController=Controller(),view=View()
 var bridgeBottomConstraint:Constraint!=Constraint(),bridgeLeadingConstraint:Constraint!=Constraint(),bridgeTrailingConstraint:Constraint!=Constraint()
 var lastKeyboardOverlap:CGFloat=0
 var phoneOverlayRequest:String?,phoneOverlayApplied:String?
 var web:Web { bridgeViewController.bridge!.webView! }
 var engine:Engine { bridgeViewController.monetization! }
 func layout() { updateBridgeBottom() }
 func requireBottom(_ value:CGFloat,_ name:String) { precondition(bridgeBottomConstraint.constant == -value,name) }
`+bodies.join('\n')+String.raw`
}
let h=Harness()
h.layout(); h.requireBottom(84,"old Web legacy"); precondition(h.web.calls.isEmpty)
h.bridgeViewController.phoneOverlayRequested=true; h.layout()
h.requireBottom(84,"pending Web never covers composer"); precondition(h.web.calls.count==1)
h.layout(); precondition(h.web.calls.count==1,"bounded evaluation")
h.web.reply(); h.requireBottom(0,"acknowledged full-height WebView")
h.lastKeyboardOverlap=320;h.engine.reservation.bottom=0;h.layout()
h.requireBottom(320,"keyboard owner preserved");h.web.reply();h.requireBottom(320,"no ad inset while keyboard open")
h.lastKeyboardOverlap=0;h.engine.reservation.bottom=84;h.layout();h.requireBottom(84,"close waits for new content exclusion")
h.web.reply();h.requireBottom(0,"close expands after ack")
h.engine.reservation.bottom=0;h.layout();h.web.reply();h.requireBottom(0,"failure removes gap")
precondition(h.web.calls.last!.contains("\"bottom\":0"))
h.engine.reservation.bottom=84;h.layout();h.requireBottom(84,"recovery pending")
h.view.bounds.size.width=430;h.layout();precondition(h.web.replies.count==2)
h.web.reply();h.requireBottom(84,"stale resize ack ignored")
h.web.reply();h.requireBottom(0,"new resize ack")
h.bridgeViewController.phoneOverlayRequested=false;h.layout();h.requireBottom(84,"rollback or zoom restores legacy first")
h.web.reply();h.requireBottom(84,"disabled remains legacy")
h.bridgeViewController.phoneOverlayRequested=true;h.layout()
h.bridgeViewController.phoneOverlayDocument="document-B";h.bridgeViewController.phoneOverlayRequested=false;h.web.isLoading=true;h.layout()
h.web.reply();h.requireBottom(84,"previous document ack ignored")
h.web.reply(false);h.web.isLoading=false;h.layout();h.requireBottom(84,"new document defaults legacy")
h.bridgeViewController.phoneOverlayRequested=true;h.layout();h.web.reply(false);h.requireBottom(84,"missing Web helper remains legacy")
let n=h.web.calls.count;h.layout();precondition(h.web.calls.count==n,"no retry loop after failed apply")
UIDevice.current.userInterfaceIdiom = .pad
let p=Harness();p.engine.reservation=Insets(bottom:110,left:316,right:7);p.bridgeViewController.phoneOverlayRequested=true;p.layout()
p.requireBottom(110,"iPad reservation unchanged");precondition(p.bridgeLeadingConstraint.constant==316 && p.bridgeTrailingConstraint.constant == -7 && p.web.calls.isEmpty)
print("PHONE OVERLAY ACTUAL CONTAINER METHODS PASS: ack, legacy, keyboard, failure, resize, navigation, rollback, iPad; UIKit/Web doubles")
`;
test('actual presentation methods are extracted; SDK engine and geometry stay unchanged',()=>{
 assert.ok(program.includes(bodies[0])&&program.includes(bodies[1]));
 const immutable=ads.slice(0,ads.indexOf('private final class RooomAdMessageHandler:')).replaceAll('\r\n','\n');
 assert.equal(crypto.createHash('sha256').update(immutable).digest('hex'),'2ce139eee775f5b8006f16ff58bf7301ecbff0afe512a7ebe42503834bfaa8b2');
});
test('actual Swift container methods: acknowledgement and lifecycle',{
 skip:process.platform!=='darwin'?'Requires macOS Swift; extraction/SDK integrity checked here':false,timeout:120000
},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rooom-phone-overlay-'));
 try{
  const input=path.join(dir,'main.swift'),output=path.join(dir,'overlay');fs.writeFileSync(input,program);
  for(const [cmd,args] of [['swiftc',[input,'-o',output]],[output,[]]]){
   const run=cp.spawnSync(cmd,args,{encoding:'utf8',timeout:60000});assert.equal(run.status,0,run.stdout+run.stderr);if(run.stdout)console.log(run.stdout.trim());
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
