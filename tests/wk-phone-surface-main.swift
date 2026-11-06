// Appended to the exact production policy, bootstrap enum, and installer method.
// Real WebKit; only the UIKit device/Capacitor bridge wrappers are test doubles.
// Inline documents, delayed inline CSS, srcdoc and data frames: no network/SDK.
import Cocoa
import WebKit

func require(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() { fputs("PHONE SURFACE FAILURE: \(message)\n", stderr); exit(1) }
}
func sameScripts(_ actual: [WKUserScript], _ expected: [WKUserScript], _ label: String) {
    require(actual.count == expected.count, "\(label): script count")
    for index in actual.indices { require(actual[index] === expected[index], "\(label): script identity/order at \(index)") }
}
func phoneConfig(_ format: RooomAdFormat = .banner, gap: CGFloat = 0, fixed: Bool = true) -> RooomAdConfig {
    RooomAdConfig(version: 1, enabled: true, fixed: fixed, archive: false,
        slots: [RooomAdSlot(key: "phone", role: "phone.bottom", device: "phone", format: format,
            publisherId: "85650", mediaId: "597836", spotId: "1951334")],
        presentation: RooomAdPresentation(railSide: "left", railWidth: 316,
            railPadding: 8, railTop: 12, railGap: 12, bottomGap: gap))
}
final class SurfaceProbe: NSObject, WKScriptMessageHandler {
    var frames: [[String: Any]] = []
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard var body = message.body as? [String: Any] else { return }
        body["mainFrame"] = message.frameInfo.isMainFrame
        frames.append(body)
    }
}

let application = NSApplication.shared
let configuration = WKWebViewConfiguration()
configuration.websiteDataStore = .nonPersistent()
let content = configuration.userContentController
let probe = SurfaceProbe()
content.add(probe, name: "surfaceProbe")
let first = WKUserScript(source: "window.__otherOrder=['first'];", injectionTime: .atDocumentStart, forMainFrameOnly: false)
let second = WKUserScript(source: "window.__otherOrder.push('second');", injectionTime: .atDocumentEnd, forMainFrameOnly: false)
let third = WKUserScript(source: "window.__otherOrder.push('third');", injectionTime: .atDocumentStart, forMainFrameOnly: true)
content.addUserScript(first); content.addUserScript(second)
let web = WKWebView(frame: NSRect(x: 0, y: 0, width: 390, height: 844), configuration: configuration)
let controller = SurfaceController(web)
let window = NSWindow(contentRect: web.frame, styleMask: [.titled], backing: .buffered, defer: false)
window.contentView = web; window.orderFront(nil)

func evaluate(_ expression: String) -> Any? {
    var done = false, value: Any?, failure: Error?
    web.evaluateJavaScript(expression) { result, error in value = result; failure = error; done = true }
    let deadline = Date().addingTimeInterval(5)
    while !done && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.01)) }
    require(done && failure == nil, "evaluateJavaScript failed: \(String(describing: failure))")
    return value
}
func attributesExpression() -> String {
    "({full:document.documentElement.getAttribute('data-rooom-phone-full-canvas'),overlay:document.documentElement.getAttribute('data-rooom-phone-ad-overlay'),occupied:document.documentElement.style.getPropertyValue('--rooom-phone-ad-occupied-bottom')})"
}
func record(_ expression: String) -> [String: Any] {
    guard let json = evaluate("JSON.stringify(\(expression))") as? String,
          let data = json.data(using: .utf8),
          let result = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        require(false, "JSON result missing"); return [:]
    }
    return result
}
func escapedAttribute(_ text: String) -> String {
    text.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "\"", with: "&quot;")
        .replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
}
var navigation = 0
func navigate(_ url: String, page: String?, height: CGFloat, frames: Bool = false) {
    navigation += 1
    let run = navigation
    let snapshot = attributesExpression()
    func frameHTML(_ name: String) -> String {
        "<!doctype html><html><head><script>window.webkit.messageHandlers.surfaceProbe.postMessage(Object.assign({run:\(run),name:'\(name)',origin:location.origin},\(snapshot)));</script></head><body>frame</body></html>"
    }
    let frameMarkup = frames ? "<iframe srcdoc=\"\(escapedAttribute(frameHTML("same-origin")))\"></iframe><iframe src=\"data:text/html;base64,\(Data(frameHTML("opaque-external").utf8).base64EncodedString())\"></iframe>" : ""
    let html = """
    <!doctype html><html><head><script>
    window.__surfaceRun=\(run);
    window.__firstSurface=Object.assign({css:!!document.querySelector('style'),order:window.__otherOrder.slice()},\(snapshot));
    setTimeout(function(){
      const css=document.createElement('style');css.textContent=':root{--rooom-safe-bottom:7px}#probe{position:fixed;bottom:var(--rooom-phone-ad-occupied-bottom,0px);height:10px;width:10px}';
      document.head.appendChild(css);window.__surfaceCSS=true;
    },180);
    </script></head><body><div id="probe"></div>\(frameMarkup)</body></html>
    """
    web.loadHTMLString(html, baseURL: URL(string: url)!)
    let deadline = Date().addingTimeInterval(8)
    var ready = false
    while Date() < deadline {
        RunLoop.current.run(until: Date().addingTimeInterval(0.03))
        ready = evaluate("window.__surfaceRun===\(run)&&window.__surfaceCSS===true") as? Bool == true
        let frameReady = !frames || probe.frames.filter({ ($0["run"] as? Int) == run }).count == 2
        if ready && frameReady { break }
    }
    require(ready, "document \(run) did not finish delayed CSS")
    let initial = record("window.__firstSurface")
    require(initial["css"] as? Bool == false, "seed must precede CSS arrival")
    require(initial["order"] as? [String] == ["first", "third"], "unrelated documentStart scripts execute in original order")
    let current = record(snapshot)
    for state in [initial, current] {
        if let page {
            require(state["full"] as? String == page, "\(url): full canvas is present before first head script")
            require(height > 0 ? state["overlay"] as? String == page : state["overlay"] is NSNull, "\(url): overlay ON/OFF")
            let occupied = state["occupied"] as? String ?? ""
            require(height > 0 ? occupied.contains("\(Double(height))px") : occupied.isEmpty, "\(url): validated occupied geometry")
        } else {
            require(state["full"] is NSNull && state["overlay"] is NSNull && state["occupied"] as? String == "", "\(url): other page/origin is unaffected")
        }
    }
    let bottom = evaluate("parseFloat(getComputedStyle(document.getElementById('probe')).bottom)") as? Double ?? -1
    require(abs(bottom - (page != nil && height > 0 ? Double(height) + 7 : 0)) < 0.01, "delayed CSS consumes the already-seeded geometry: \(bottom)")
    require(evaluate("window.__otherOrder.join(',')") as? String == "first,third,second", "unrelated end script executes exactly once")
    if frames {
        let frameRecords = probe.frames.filter { ($0["run"] as? Int) == run }
        require(frameRecords.count == 2, "both iframe documents completed without network")
        require(Set(frameRecords.compactMap { $0["name"] as? String }) == Set(["same-origin", "opaque-external"]), "iframe fixtures")
        for frame in frameRecords {
            require(frame["mainFrame"] as? Bool == false, "frame probe is really a child frame")
            require(frame["full"] is NSNull && frame["overlay"] is NSNull && frame["occupied"] as? String == "", "seed never affects iframe")
        }
        require(frameRecords.first(where: { $0["name"] as? String == "opaque-external" })?["origin"] as? String == "null", "external data iframe has opaque origin")
    }
}

// Actual installer, including idempotence and preserving the same objects in a
// mixed injection-time list. The seed is deliberately not the last script.
controller.installPhoneSurfaceSeed(phoneConfig(.banner, gap: 10))
let originalSeed = content.userScripts[2]
require(originalSeed.injectionTime == .atDocumentStart && originalSeed.isForMainFrameOnly, "actual seed injection boundary")
content.addUserScript(third)
sameScripts(content.userScripts, [first, second, originalSeed, third], "initial installation")
controller.installPhoneSurfaceSeed(phoneConfig(.banner, gap: 10))
sameScripts(content.userScripts, [first, second, originalSeed, third], "same configuration is idempotent")
navigate("https://rooom-talk.com/", page: "home", height: 60, frames: true)

controller.installPhoneSurfaceSeed(.off)
let disabledSeed = content.userScripts[2]
require(disabledSeed !== originalSeed, "OFF replaces only the seed")
sameScripts(content.userScripts, [first, second, disabledSeed, third], "OFF keeps foreign script identity/order")
require(record(attributesExpression())["overlay"] as? String == "home", "next-document seed does not mutate the live Web owner's state")
navigate("https://rooom-talk.com/room.html", page: "room", height: 0)

controller.installPhoneSurfaceSeed(phoneConfig(.largeBanner, gap: 3))
let enabledSeed = content.userScripts[2]
sameScripts(content.userScripts, [first, second, enabledSeed, third], "ON again preserves foreign scripts")
navigate("https://rooom-talk.com/room.html", page: "room", height: 103)
controller.installPhoneSurfaceSeed(phoneConfig(.banner, gap: 101))
navigate("https://rooom-talk.com/index.html", page: "home", height: 0) // Invalid config fails closed.
controller.installPhoneSurfaceSeed(phoneConfig(.banner, fixed: false))
navigate("https://rooom-talk.com/", page: "home", height: 0)
controller.installPhoneSurfaceSeed(phoneConfig())
navigate("https://example.com/room.html", page: nil, height: 0)
navigate("https://rooom-talk.com/help.html", page: nil, height: 0)

let beforeTablet = content.userScripts
UIDevice.current.userInterfaceIdiom = .pad
controller.installPhoneSurfaceSeed(.off)
sameScripts(content.userScripts, beforeTablet, "iPad never installs or replaces a phone seed")
print("PHONE FULL CANVAS REAL WK PASS: earliest head state, delayed CSS, actual config validation, ON/OFF/navigation, foreign script identity/order, external origin and two child frames; no network/SDK")
exit(0)
