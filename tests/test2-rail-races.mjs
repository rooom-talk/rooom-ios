// Compile the actual coordinator against deterministic WebKit transport doubles.
// This checks callback races, not a real iPad display or cookie transport.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
const source=fs.readFileSync('ios/App/App/RooomImobileBanner.swift','utf8');
const body=source.slice(source.indexOf('private final class RooomTestRail:'),source.indexOf('\n#endif',source.indexOf('private final class RooomTestRail:'))).replace('private final class','final class');
const mocks=String.raw`
import Foundation
import CoreGraphics
var jobs: [()->Void] = []
func drain() { var n=0; while !jobs.isEmpty { n += 1; precondition(n<100); jobs.removeFirst()() }; RunLoop.current.run(until: Date().addingTimeInterval(0.02)); if !jobs.isEmpty { drain() } }
struct Cookie { let name="__session", domain="rooom-test2.web.app", path="/"; let isSecure=true, isHTTPOnly=true; var expiresDate:Date?=nil; var value:String }
protocol WKHTTPCookieStoreObserver: AnyObject {}
class WKHTTPCookieStore { var cookies:[Cookie]=[]; func add(_ o:WKHTTPCookieStoreObserver){};func remove(_ o:WKHTTPCookieStoreObserver){}
 func getAllCookies(_ c:@escaping([Cookie])->Void){let s=cookies;jobs.append{c(s)}}
 func delete(_ c:Cookie, completionHandler:@escaping()->Void){jobs.append{self.cookies.removeAll{$0.value==c.value};completionHandler()}}
 func setCookie(_ c:Cookie, completionHandler:@escaping()->Void){jobs.append{self.cookies=[c];completionHandler()}}
}
class WKWebsiteDataStore {let httpCookieStore=WKHTTPCookieStore();static func nonPersistent()->WKWebsiteDataStore{WKWebsiteDataStore()}}
class WKUserContentController {}
class Preferences {var javaScriptCanOpenWindowsAutomatically=false}
class WKWebViewConfiguration {var websiteDataStore=WKWebsiteDataStore();var userContentController=WKUserContentController();var applicationNameForUserAgent:String?;let preferences=Preferences()}
class WKNavigation:NSObject {}
protocol WKNavigationDelegate:AnyObject {}
protocol WKUIDelegate:AnyObject {}
class WKWindowFeatures {}
enum NavigationType {case linkActivated,other};enum AppState {case active}
class UIApplication {static let shared=UIApplication();var applicationState=AppState.active;func open(_ url:URL,options:[String:Any],completionHandler:((Bool)->Void)?){}}
enum WKNavigationActionPolicy {case allow,cancel}
class Frame {var isMainFrame=true}
class WKNavigationAction {var navigationType=NavigationType.other;var request=URLRequest(url:URL(string:"https://example.com")!);var targetFrame:Frame?=Frame()}
enum Color {case clear};enum Inset {case never};enum World {case page}
class Scroll {var isScrollEnabled=true,bounces=true,showsVerticalScrollIndicator=true,showsHorizontalScrollIndicator=true;var contentInsetAdjustmentBehavior=Inset.never}
class UIView:NSObject {var frame=CGRect.zero;var superview:UIView?;func addSubview(_ v:UIView){v.superview=self};func removeFromSuperview(){superview=nil}}
class WKWebView:UIView {let configuration:WKWebViewConfiguration;weak var navigationDelegate:WKNavigationDelegate?;weak var uiDelegate:WKUIDelegate?;var isOpaque=true,isHidden=false;var backgroundColor=Color.clear;let scrollView=Scroll();var loadCount=0;var last:WKNavigation?
 init(frame:CGRect,configuration:WKWebViewConfiguration){self.configuration=configuration;super.init();self.frame=frame}
 func stopLoading(){}
 func load(_ request:URLRequest)->WKNavigation?{loadCount+=1;let n=WKNavigation();last=n;return n}
 func callAsyncJavaScript(_ s:String,arguments:[String:Any],in frame:Frame?,in world:World,completionHandler:@escaping(Result<Any,Error>)->Void){jobs.append{completionHandler(.success(true))}}
}
`;
const checks=String.raw`
func make(_ cookie:String?)->(WKHTTPCookieStore,RooomTestRail){let store=WKHTTPCookieStore();if let cookie{store.cookies=[Cookie(value:cookie)]};let rail=RooomTestRail(source:store,frame:CGRect(x:0,y:0,width:316,height:724));rail.setPresentationVisible(true);return(store,rail)}
let (s,r)=make("a")
r.cookiesDidChange(in:s);drain();precondition(r.view.loadCount==1,"same-cookie notification lost initial load")
let old=r.view.last!
s.cookies=[Cookie(value:"b")];r.cookiesDidChange(in:s)
s.cookies=[Cookie(value:"c")];r.cookiesDidChange(in:s);drain()
precondition(r.view.loadCount==2,"stale intermediate cookie was loaded")
precondition(r.view.configuration.websiteDataStore.httpCookieStore.cookies.first?.value=="c")
let current=r.view.last!
r.webView(r.view,didFinish:old);drain();precondition(r.view.isHidden,"stale finish showed old page")
r.webView(r.view,didFinish:current);drain();precondition(!r.view.isHidden)
r.webView(r.view,didFail:old,withError:NSError(domain:"cancelled",code:-999));precondition(!r.view.isHidden,"stale cancellation hid new ready page")
s.cookies=[];r.cookiesDidChange(in:s);drain();precondition(r.view.isHidden);precondition(r.view.configuration.websiteDataStore.httpCookieStore.cookies.isEmpty)
let (pending,p)=make("pending");p.release();drain();precondition(p.view.loadCount==0)
let (_,locked)=make(nil);drain();precondition(locked.view.loadCount==0)
let (same,t)=make("same");drain();same.cookies=[Cookie(expiresDate:Date().addingTimeInterval(30),value:"same")];t.cookiesDidChange(in:same);drain();precondition(t.view.loadCount==2,"same value expiry change ignored")
t.webView(t.view,didFinish:t.view.last);drain();precondition(!t.view.isHidden);t.webViewWebContentProcessDidTerminate(t.view);precondition(t.view.isHidden)
// A transient system interruption retains this actual coordinator. Late
// readiness/cookie callbacks must respect visibility until Native resumes it.
let (interruptedStore,interrupted)=make("interrupt");drain()
let interruptedNavigation=interrupted.view.last!,interruptedLoads=interrupted.view.loadCount
interrupted.setPresentationVisible(false)
interrupted.webView(interrupted.view,didFinish:interruptedNavigation);drain()
precondition(interrupted.view.isHidden,"pending readiness exposed suspended rail")
let interruptedShell=UIView()
interrupted.place(in:interruptedShell,frame:CGRect(x:0,y:0,width:316,height:724))
precondition(interrupted.view.isHidden,"placement exposed suspended rail")
for _ in 0..<3 {
 interrupted.setPresentationVisible(true);precondition(!interrupted.view.isHidden)
 interrupted.setPresentationVisible(false)
 interrupted.webView(interrupted.view,didFinish:interruptedNavigation);drain()
 precondition(interrupted.view.isHidden,"repeat readiness exposed suspended rail")
}
precondition(interrupted.view.loadCount==interruptedLoads,"suspend/resume reloaded authenticated surface")
interruptedStore.cookies=[Cookie(value:"interrupt-new")];interrupted.cookiesDidChange(in:interruptedStore);drain()
precondition(interrupted.view.loadCount==interruptedLoads+1,"real session rotation loads once")
interrupted.webView(interrupted.view,didFinish:interrupted.view.last);drain()
precondition(interrupted.view.isHidden,"cookie readiness exposed suspended rail")
interrupted.setPresentationVisible(true);precondition(!interrupted.view.isHidden,"resume did not reveal retained ready rail")
precondition(interrupted.view.loadCount==interruptedLoads+1,"resume after session rotation reloaded twice")
interrupted.release()
precondition(RooomTestRail.page(URL(string:"https://rooom-test2.web.app/room.html")))
for u in ["https://rooom-talk.com/","https://rooom-test2.web.app.evil/","http://rooom-test2.web.app/","https://rooom-test2.web.app/login"] {precondition(!RooomTestRail.page(URL(string:u)))}
r.release();locked.release();t.release()
print("TEST2 actual Swift coordinator callback/lock/origin cases PASS (transport doubles; not device acceptance)")
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rooom-rail-races-'));fs.writeFileSync(path.join(dir,'main.swift'),mocks+'\n'+body+'\n'+checks);
execFileSync('swiftc',[path.join(dir,'main.swift'),'-o',path.join(dir,'test')],{stdio:'inherit'});
execFileSync(path.join(dir,'test'),[],{stdio:'inherit'});
