// Independent actual Swift handler checks with message/color transport doubles.
// No app installation, SDK, network, signing or physical display acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import cp from 'node:child_process';
const source=fs.readFileSync(new URL('../ios/App/App/RooomImobileBanner.swift',import.meta.url),'utf8').replaceAll('\r\n','\n');
const marker='    private func handleBackground(',start=source.indexOf(marker);assert(start>=0);
const open=source.indexOf('{',start);let depth=0,end;
for(let i=open;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0){end=i+1;break;}}
assert(end>start);const actual=source.slice(start,end);
for(const required of ['message.frameInfo.isMainFrame','origin.protocol == "https"','origin.host == expectedHost','url.scheme == "https"','url.host == expectedHost','values.count == 3','CFBooleanGetTypeID()','$0.doubleValue.isFinite','$0.doubleValue.rounded() == $0.doubleValue'])assert(actual.includes(required),required);
assert(!/configure\(|layout\(|setReservation\(|secret|SDK/.test(actual));
const handling=source.slice(source.indexOf('fileprivate func handle('),start);
assert(handling.indexOf('handleBackground(message')>=0&&handling.indexOf('handleBackground(message')<handling.indexOf('Production SDK bridge is disabled'));
console.log('Background source boundaries PASS: exact first-party appearance-only operation precedes TEST2 SDK refusal');
const swift=String.raw`
import Foundation
import CoreFoundation
import CoreGraphics
struct UIColor {let red:CGFloat,green:CGFloat,blue:CGFloat,alpha:CGFloat;init(red:CGFloat,green:CGFloat,blue:CGFloat,alpha:CGFloat){self.red=red;self.green=green;self.blue=blue;self.alpha=alpha}}
struct Origin {var ${'`'}protocol${'`'}="https",host=expected,port=443}
struct Frame {var isMainFrame=true,securityOrigin=Origin()}
struct WKScriptMessage {var frameInfo=Frame()}
class Web {var url:URL?=URL(string:"https://"+expected+"/")}
class Bridge {var webView:Web?=Web()}
#if ROOOM_TEST2_RAIL
let expected="rooom-test2.web.app"
let other="rooom-talk.com"
#else
let expected="rooom-talk.com"
let other="rooom-test2.web.app"
#endif
final class Probe {
 var bridge:Bridge?=Bridge(),applied:[UIColor]=[]
 func applyCanvasBackground(_ color:UIColor){applied.append(color)}
`+actual+String.raw`
 func send(_ message:WKScriptMessage,_ body:[String:Any])->Bool {
  var success=false
  handleBackground(message,body:body){value,error in success=error==nil && (value as? [String:Bool])?["ok"]==true}
  return success
 }
}
func check(_ value:Bool,_ label:String){precondition(value,label)}
let p=Probe(),valid:[String:Any]=["version":1,"op":"background","rgb":[NSNumber(value:15),NSNumber(value:17),NSNumber(value:20)]]
check(p.send(WKScriptMessage(),valid),"trusted background accepted")
check(p.applied.count==1 && p.applied[0].red==15.0/255 && p.applied[0].green==17.0/255 && p.applied[0].blue==20.0/255,"color channels preserved")
func reject(_ message:WKScriptMessage=WKScriptMessage(),_ body:[String:Any]=valid,_ label:String){let count=p.applied.count;check(!p.send(message,body),label);check(p.applied.count==count,"rejection must not paint")}
var message=WKScriptMessage();message.frameInfo.isMainFrame=false;reject(message,valid,"subframe")
message=WKScriptMessage();message.frameInfo.securityOrigin.host=other;reject(message,valid,"cross environment")
message=WKScriptMessage();message.frameInfo.securityOrigin.host=expected+".evil";reject(message,valid,"lookalike")
message=WKScriptMessage();message.frameInfo.securityOrigin.protocol="http";reject(message,valid,"insecure origin")
message=WKScriptMessage();message.frameInfo.securityOrigin.port=444;reject(message,valid,"wrong origin port")
for url in ["https://"+other+"/","https://"+expected+".evil/","http://"+expected+"/","https://"+expected+":444/"] {p.bridge?.webView?.url=URL(string:url);reject(WKScriptMessage(),valid,"current document "+url)}
p.bridge?.webView?.url=nil;reject(WKScriptMessage(),valid,"missing document")
p.bridge?.webView?.url=URL(string:"https://"+expected+"/")
let badRGB:[[Any]]=[[],[1,2],[1,2,3,4],[-1,2,3],[256,2,3],[1.5,2,3],[Double.nan,2,3],[Double.infinity,2,3],[true,2,3],["1",2,3]]
for rgb in badRGB {var b=valid;b["rgb"]=rgb;reject(WKScriptMessage(),b,"invalid RGB")}
let badVersions:[Any]=[0,2,"1"]
for version in badVersions {var b=valid;b["version"]=version;reject(WKScriptMessage(),b,"unsupported version")}
var missing=valid;missing.removeValue(forKey:"rgb");reject(WKScriptMessage(),missing,"missing RGB")
for port in [0,443] {message=WKScriptMessage();message.frameInfo.securityOrigin.port=port;check(p.send(message,valid),"allowed HTTPS port")}
print("Actual Swift background handler PASS "+expected+": trusted RGB and negative origin/document/frame/type/bounds cases; doubles, not UIKit acceptance")
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rooom-canvas-permission-')),file=path.join(dir,'main.swift');fs.writeFileSync(file,swift);
if(process.platform==='darwin')for(const test2 of [false,true]){const binary=path.join(dir,test2?'test2':'production');cp.execFileSync('swiftc',[...(test2?['-D','ROOOM_TEST2_RAIL']:[]),file,'-o',binary],{stdio:'inherit'});cp.execFileSync(binary,[],{stdio:'inherit'});}
else console.log('Actual Swift fixtures generated; both environment runtime checks require macOS.');
