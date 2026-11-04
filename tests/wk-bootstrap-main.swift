// Execute the shipped bootstrap in real WKWebView (macOS), with a stub native
// capability/configure transport. No SDK request, Firebase page, or user data.
import Cocoa
import WebKit

final class Probe: NSObject, WKScriptMessageHandlerWithReply {
    var calls: [String] = []
    var device = "tablet"
    func userContentController(_ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        let op = (message.body as? [String: Any])?["op"] as? String ?? ""
        calls.append(op)
        if op == "capabilities" {
            replyHandler(["version":1,"implemented":true,"platform":"ios","device":device,
                          "formats":["rectangle"],"maxSlots":6],nil)
        } else { replyHandler(["ok":true],nil) }
    }
}

let app = NSApplication.shared
let probe = Probe()
let configuration = WKWebViewConfiguration()
configuration.userContentController.addScriptMessageHandler(probe, contentWorld:.page, name:"rooomMonetization")
let baseline = CommandLine.arguments.contains("--baseline")
let phone = CommandLine.arguments.contains("--phone")
let home = CommandLine.arguments.contains("--home")
let external = CommandLine.arguments.contains("--external")
probe.device = phone ? "phone" : "tablet"
let source = baseline ? """
if (window === window.top && location.origin === 'https://rooom-talk.com') {
  import('/src/features/ads/page-ad-runtime.mjs')
    .then(function(m){m.pageAdvertising();}).catch(function(e){document.documentElement.dataset.probeError=String(e);});
}
""" : RooomAdBootstrap.script(isTablet:!phone)
configuration.userContentController.addUserScript(WKUserScript(source:source,injectionTime:.atDocumentEnd,forMainFrameOnly:true))
let web = WKWebView(frame:NSRect(x:0,y:0,width:1024,height:768),configuration:configuration)
let window = NSWindow(contentRect:web.frame,styleMask:[.titled],backing:.buffered,defer:false)
window.contentView=web
window.orderFront(nil)
let url = external ? "https://example.com/room.html" : home ? "https://rooom-talk.com/" : "https://rooom-talk.com/room.html"
web.loadHTMLString("<!doctype html><html><head><style>:root{--bg:#efefef}:root.rooom-dark-theme{--bg:#171717}</style></head><body></body></html>",baseURL:URL(string:url)!)
var finished = false
var passed = false
var attempts = 0
let timer = Timer.scheduledTimer(withTimeInterval:0.5,repeats:true) { timer in
    attempts += 1
    web.evaluateJavaScript("JSON.stringify({marker:document.documentElement.getAttribute('data-rooom-ios16-ipad-room'), classes:document.documentElement.className, status:document.documentElement.dataset.rooomNativeLayoutStatus, error:document.documentElement.dataset.probeError, css:!!document.querySelector('link[data-rooom-ios16-ipad-room-style]')?.sheet})") { value,error in
        let text=value as? String ?? "{}"
        if let data=text.data(using:.utf8), let record=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any] {
            passed = record["marker"] as? String == "1" && record["css"] as? Bool == true && probe.calls.contains("configure")
            if !baseline { passed = passed && (record["classes"] as? String ?? "").contains("ipad-device") }
            if !baseline && !phone && !external { passed = passed && probe.calls.contains("background") }
            if !baseline && (phone || home || external) {
                passed = record["marker"] is NSNull && !(record["classes"] as? String ?? "").contains("ipad-device")
                    && (external ? attempts >= 4 && probe.calls.isEmpty : probe.calls.contains("configure"))
            }
        }
        if passed || attempts >= 40 {
            print("WKWEBVIEW \(CommandLine.arguments.dropFirst()): \(baseline ? "BASELINE" : "CANDIDATE"): \(text); calls=\(probe.calls); error=\(String(describing:error))")
            timer.invalidate();finished=true
        }
    }
}
let deadline=Date().addingTimeInterval(30)
while !finished && Date()<deadline { RunLoop.current.run(until:Date().addingTimeInterval(0.1)) }
if !finished || (!baseline && !passed) { exit(1) }
// Baseline is diagnostic: record the actual outcome, never require a failure.
exit(0)
