import Foundation
#if canImport(CoreGraphics)
import CoreGraphics
#endif

// Shared, deterministic geometry/configuration policy. UIKit is not needed to test it.
enum RooomAdFormat: String, Codable {
    case banner, largeBanner, rectangle, tabletBanner, native
    var size: CGSize {
        switch self {
        case .banner: return CGSize(width: 320, height: 50)
        case .largeBanner: return CGSize(width: 320, height: 100)
        case .rectangle: return CGSize(width: 300, height: 250)
        case .tabletBanner: return CGSize(width: 728, height: 90)
        case .native: return .zero
        }
    }
}
struct RooomAdSlot: Codable, Equatable {
    let key: String, role: String, device: String
    let format: RooomAdFormat
    let publisherId: String, mediaId: String, spotId: String
}
struct RooomAdConfig: Codable, Equatable {
    let version: Int, enabled: Bool, fixed: Bool, archive: Bool
    let slots: [RooomAdSlot]
    static let off = RooomAdConfig(version: 1, enabled: false, fixed: false, archive: false, slots: [])
    func validated() throws -> RooomAdConfig {
        guard version == 1 else { throw RooomAdError.invalidConfig }
        if !enabled { return .off }
        guard slots.count <= 20 else { throw RooomAdError.limit }
        var keys = Set<String>(), spots = Set<String>()
        for s in slots {
            guard RooomAdPolicy.validKey(s.key), keys.insert(s.key).inserted,
                  spots.insert(s.spotId).inserted, s.publisherId == "85650",
                  RooomAdPolicy.validID(s.mediaId), RooomAdPolicy.validID(s.spotId),
                  !["597834", "597835"].contains(s.mediaId),
                  ["phone", "tablet"].contains(s.device) else { throw RooomAdError.invalidConfig }
            let valid: Bool
            switch s.role {
            case "phone.bottom": valid = s.device == "phone" && [.banner, .largeBanner].contains(s.format)
            case "tablet.bottom": valid = s.device == "tablet" && s.format == .tabletBanner
            case "tablet.left.top", "tablet.left.bottom": valid = s.device == "tablet" && s.format == .rectangle
            case "archive.tile", "archive.row": valid = s.format == .native
            default: valid = false
            }
            guard valid else { throw RooomAdError.invalidConfig }
        }
        return self
    }
}
enum RooomAdError: Error { case invalidConfig, untrustedOrigin, invalidRequest, unsupported, limit }
struct RooomAdInsets: Equatable {
    var top: CGFloat = 0, left: CGFloat = 0, bottom: CGFloat = 0, right: CGFloat = 0
}
struct RooomFixedPlacement: Equatable { let slot: RooomAdSlot; let rect: CGRect }
struct RooomAdLayout: Equatable {
    var placements: [RooomFixedPlacement] = []
    var reserved = RooomAdInsets()
}
enum RooomAdPolicy {
    static let maxSlots = 6
    static func validKey(_ v: String) -> Bool { v.range(of: "^[a-zA-Z0-9._-]{1,64}$", options: .regularExpression) != nil }
    static func validID(_ v: String) -> Bool { v.range(of: "^[1-9][0-9]{0,15}$", options: .regularExpression) != nil }
    static func trusted(_ url: URL?, mainFrame: Bool = true) -> Bool {
        guard mainFrame, let url else { return false }
        return url.scheme == "https" && url.host == "rooom-talk.com" && (url.port == nil || url.port == 443)
            && url.user == nil && url.password == nil
    }
    static func advertisingPage(_ url: URL?) -> Bool {
        guard trusted(url), let url else { return false }
        return ["", "/", "/index.html", "/room.html"].contains(url.path)
    }
    static func validRect(_ r: CGRect) -> Bool {
        [r.origin.x, r.origin.y, r.width, r.height].allSatisfy { $0.isFinite }
            && r.width > 0 && r.height > 0 && r.width <= 4096 && r.height <= 4096
            && abs(r.origin.x) <= 100000 && abs(r.origin.y) <= 100000
    }
    // Physical OUTER view, not the WebView already narrowed by our own rail.
    static func fixedLayout(config: RooomAdConfig, device: String, bounds: CGSize,
                            safe: RooomAdInsets = RooomAdInsets(), keyboard: Bool = false,
                            readyKeys: Set<String>? = nil) -> RooomAdLayout {
        var out = RooomAdLayout()
        guard config.enabled, config.fixed, !keyboard, bounds.width.isFinite, bounds.height.isFinite,
              bounds.width > 0, bounds.height > 0 else { return out }
        let roles = device == "phone" ? ["phone.bottom"] : bounds.width > bounds.height
            ? ["tablet.left.top", "tablet.left.bottom"] : ["tablet.bottom"]
        for role in roles {
            guard let s = config.slots.first(where: { $0.device == device && $0.role == role }),
                  readyKeys == nil || readyKeys!.contains(s.key) else { continue }
            let size = s.format.size
            guard size.width <= bounds.width - safe.left - safe.right,
                  size.height <= bounds.height - safe.top - safe.bottom else { continue }
            if role.hasPrefix("tablet.left") {
                guard bounds.width - safe.left - safe.right - 316 >= 320 else { continue }
                let y = safe.top + 12 + (role.hasSuffix("bottom") ? 262 : 0)
                guard y + size.height <= bounds.height - safe.bottom else { continue }
                out.placements.append(RooomFixedPlacement(slot: s, rect: CGRect(x: safe.left + 8, y: y, width: 300, height: 250)))
                out.reserved.left = safe.left + 316
            } else {
                out.placements.append(RooomFixedPlacement(slot: s, rect: CGRect(x: (bounds.width - size.width) / 2,
                    y: bounds.height - safe.bottom - size.height, width: size.width, height: size.height)))
                out.reserved.bottom = size.height + safe.bottom
            }
        }
        return out
    }
}

#if ROOOM_IMOBILE_ADS
import UIKit
import WebKit
import Capacitor

// SDK-owned native object: NO HTML asset copying, custom click forwarding or fake impressions.
private final class RooomNativeCreativeView: UIView {
    let image = UIImageView(), title = UILabel(), detail = UILabel(), sponsor = UILabel(), badge = UILabel()
    var style = "list" { didSet { setNeedsLayout() } }
    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .secondarySystemBackground
        layer.cornerRadius = 14; clipsToBounds = true
        image.contentMode = .scaleAspectFit
        badge.text = "Ad"; badge.font = .systemFont(ofSize: 10, weight: .semibold)
        title.font = .systemFont(ofSize: 13, weight: .semibold)
        detail.font = .systemFont(ofSize: 11); sponsor.font = .systemFont(ofSize: 9)
        [title, detail, sponsor].forEach { $0.numberOfLines = 1 }
        [image, title, detail, sponsor, badge].forEach { addSubview($0) }
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) not supported") }
    override func layoutSubviews() {
        super.layoutSubviews()
        let w = bounds.width, h = bounds.height
        badge.frame = CGRect(x: 8, y: 3, width: 42, height: 13)
        if style == "card" && h >= 160 {
            image.frame = CGRect(x: 8, y: 18, width: w - 16, height: max(40, h - 80))
            title.frame = CGRect(x: 8, y: h - 58, width: w - 16, height: 20)
            detail.frame = CGRect(x: 8, y: h - 37, width: w - 16, height: 17)
            sponsor.frame = CGRect(x: 8, y: h - 19, width: w - 16, height: 14)
        } else {
            let iw = min(100, max(40, h - 20))
            image.frame = CGRect(x: 8, y: 17, width: iw, height: max(24, h - 21))
            let x = iw + 16, width = max(0, w - x - 8)
            title.frame = CGRect(x: x, y: 3, width: width, height: 19)
            detail.frame = CGRect(x: x, y: 23, width: width, height: 16)
            sponsor.frame = CGRect(x: x, y: 41, width: width, height: 13)
        }
    }
}

private final class RooomAdClippingView: UIView {
    var visibleRect: CGRect? {
        didSet {
            if let rect = visibleRect {
                let shape = CAShapeLayer(); shape.path = UIBezierPath(rect: rect).cgPath; layer.mask = shape
            } else { layer.mask = nil }
        }
    }
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        return (visibleRect?.contains(point) ?? true) && super.point(inside: point, with: event)
    }
}
private final class RooomSdkSlot: NSObject, IMobileSdkAdsDelegate {
    static var registered: [String: RooomAdSlot] = [:]
    let slot: RooomAdSlot
    let view = RooomAdClippingView()
    var ready = false, failed = false, released = false, shown = false, nativeRequested = false
    weak var owner: RooomMonetization?
    private var nativeObject: ImobileSdkAdsNativeObject?
    private var creative: RooomNativeCreativeView?
    init(slot: RooomAdSlot, owner: RooomMonetization) {
        self.slot = slot; self.owner = owner; super.init()
        view.clipsToBounds = true; view.isHidden = true
    }
    func start() {
        if let old = Self.registered[slot.spotId] {
            // Layout/key are Web configuration, not SDK registration identity.
            // Switching tile/fullRow must not require a new binary or process.
            guard old.publisherId == slot.publisherId, old.mediaId == slot.mediaId,
                  old.format == slot.format else { fail(); return }
        } else {
            guard ImobileSdkAds.register(withPublisherID: slot.publisherId, mediaID: slot.mediaId, spotID: slot.spotId) else { fail(); return }
            Self.registered[slot.spotId] = slot
        }
        ImobileSdkAds.setSpotDelegate(slot.spotId, delegate: self)
        if !ImobileSdkAds.start(bySpotID: slot.spotId) { fail() }
    }
    func showBannerIfNeeded() {
        guard ready, !failed, !released, !shown, slot.format != .native, !view.isHidden else { return }
        shown = true
        if !ImobileSdkAds.show(bySpotID: slot.spotId, view: view) { fail() }
    }
    private func fail() {
        guard !released else { return }; failed = true; ready = false; view.isHidden = true
        owner?.slotChanged(self, status: "failed")
    }
    func imobileSdkAdsSpot(_ spotId: String!, didReadyWithValue value: ImobileSdkAdsReadyResult) {
        guard spotId == slot.spotId else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self, !self.released, !self.failed else { return }
            if self.slot.format == .native {
                guard !self.nativeRequested, let controller = self.owner?.controller else { return }
                self.nativeRequested = true
                if !ImobileSdkAds.getNativeAdData(self.slot.spotId, viewController: controller, delegate: self) { self.fail() }
            } else { self.ready = true; self.owner?.slotChanged(self, status: "ready") }
        }
    }
    func imobileSdkAdsSpot(_ spotId: String!, didFailWithValue value: ImobileSdkAdsFailResult) {
        guard spotId == slot.spotId else { return }
        DispatchQueue.main.async { [weak self] in self?.fail() }
    }
    func onNativeAdDataReciveCompleted(_ spotId: String!, nativeArray: [AnyObject]!) {
        guard spotId == slot.spotId else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self, !self.released, let ad = nativeArray?.first as? ImobileSdkAdsNativeObject else { self?.fail(); return }
            self.nativeObject = ad
            let content = RooomNativeCreativeView(frame: self.view.bounds)
            content.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            content.title.text = ad.getAdTitle(); content.detail.text = ad.getAdDescription(); content.sponsor.text = ad.getAdSponsored()
            ad.getAdImageCompleteHandler { [weak content] image in DispatchQueue.main.async { content?.image.image = image } }
            // Public vendor API attaches real SDK click accounting to native views.
            ad.addClickFunction(content.title); ad.addClickFunction(content.detail); ad.addClickFunction(content.image)
            self.view.addSubview(content); self.creative = content
            self.ready = true; self.owner?.slotChanged(self, status: "ready")
        }
    }
    func style(_ value: String, label: String) {
        creative?.style = ["card", "list", "row"].contains(value) ? value : "list"
        creative?.badge.text = label
    }
    func release() {
        guard !released else { return }; released = true
        view.removeFromSuperview(); nativeObject?.destroy(); nativeObject = nil
        ImobileSdkAds.setSpotDelegate(slot.spotId, delegate: nil)
        _ = ImobileSdkAds.stop(bySpotID: slot.spotId)
    }
    deinit { release() }
}

final class RooomMonetization {
    weak var controller: RooomAdsBridgeViewController?
    private var config = RooomAdConfig.off
    private var entries: [String: RooomSdkSlot] = [:]
    private var keyboard = false, layingOut = false
    private var observers: [NSObjectProtocol] = []
    private var navigation: NSKeyValueObservation?
    private var lastHaptic = 0.0
    private let selection = UISelectionFeedbackGenerator()
    private(set) var reservation = RooomAdInsets()
    var device: String { UIDevice.current.userInterfaceIdiom == .pad ? "tablet" : "phone" }
    var web: WKWebView? { controller?.bridge?.webView }
    var shell: UIView? { controller?.parent?.view }
    init(controller: RooomAdsBridgeViewController) {
        self.controller = controller
        // Clear on document navigation, not hash changes within the same page.
        navigation = web?.observe(\.isLoading, options: [.new]) { [weak self] web, _ in
            if web.isLoading { self?.clear() }
        }
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.hideAll() })
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.layout() })
    }
    deinit { for observer in observers { NotificationCenter.default.removeObserver(observer) }; clear() }
    func configure(_ next: RooomAdConfig) throws {
        let valid = try next.validated()
        guard valid != config else { layout(); return }
        clear(); config = valid; layout()
    }
    func clear() {
        let old = entries; entries.removeAll(); for entry in old.values { entry.release() }
        config = .off; setReservation(RooomAdInsets())
    }
    private func setReservation(_ next: RooomAdInsets) {
        guard reservation != next else { return }; reservation = next; controller?.adReservationChanged?(next)
    }
    func setKeyboardVisible(_ value: Bool) { keyboard = value; if value { hideFeed() }; layout() }
    func hideFeed() { for e in entries.values where e.slot.format == .native { e.view.isHidden = true } }
    private func hideAll() { for e in entries.values { e.view.isHidden = true }; setReservation(RooomAdInsets()) }
    private func entry(_ slot: RooomAdSlot) throws -> RooomSdkSlot {
        if let e = entries[slot.key] { return e }
        guard entries.count < RooomAdPolicy.maxSlots else { throw RooomAdError.limit }
        let e = RooomSdkSlot(slot: slot, owner: self); entries[slot.key] = e; e.start(); return e
    }
    func layout() {
        guard !layingOut, let shell, let web else { return }
        layingOut = true; defer { layingOut = false }
        guard RooomAdPolicy.advertisingPage(web.url), UIApplication.shared.applicationState == .active else { hideAll(); return }
        let s = shell.safeAreaInsets, safe = RooomAdInsets(top: s.top, left: s.left, bottom: s.bottom, right: s.right)
        let desired = RooomAdPolicy.fixedLayout(config: config, device: device, bounds: shell.bounds.size, safe: safe, keyboard: keyboard)
        let desiredKeys = Set(desired.placements.map { $0.slot.key })
        for e in entries.values where e.slot.format != .native && !desiredKeys.contains(e.slot.key) { e.view.isHidden = true }
        for p in desired.placements {
            guard let e = try? entry(p.slot) else { continue }
            if e.view.superview !== shell { shell.addSubview(e.view) }
            e.view.frame = p.rect; e.view.isHidden = !e.ready || e.failed
        }
        let ready = Set(entries.values.filter { $0.ready && !$0.failed }.map { $0.slot.key })
        setReservation(RooomAdPolicy.fixedLayout(config: config, device: device, bounds: shell.bounds.size, safe: safe, keyboard: keyboard, readyKeys: ready).reserved)
        for p in desired.placements { entries[p.slot.key]?.showBannerIfNeeded() }
    }
    fileprivate func slotChanged(_ entry: RooomSdkSlot, status: String) {
        guard entries[entry.slot.key] === entry else { return }
        layout(); emit(["version": 1, "slotKey": entry.slot.key, "status": status])
    }
    private func emit(_ data: [String: Any]) {
        guard let web, RooomAdPolicy.trusted(web.url), let bytes = try? JSONSerialization.data(withJSONObject: data),
              let json = String(data: bytes, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('rooom:monetization',{detail:\(json)}));", completionHandler: nil)
    }
    func prepare(key: String) throws -> String {
        guard config.enabled, config.archive, let web, ["/", "", "/index.html"].contains(web.url?.path ?? "!"),
              let slot = config.slots.first(where: { $0.key == key && $0.device == device && $0.format == .native }) else { throw RooomAdError.unsupported }
        let e = try entry(slot)
        if e.view.superview !== web.scrollView { web.scrollView.addSubview(e.view) }
        return e.failed ? "failed" : e.ready ? "ready" : "loading"
    }
    func release(key: String) { entries.removeValue(forKey: key)?.release(); layout() }
    func update(_ rows: [[String: Any]], viewport: [String: Any]) throws {
        guard rows.count <= RooomAdPolicy.maxSlots, let web else { throw RooomAdError.limit }
        hideFeed()
        guard !keyboard, config.enabled, config.archive, RooomAdPolicy.trusted(web.url),
              UIApplication.shared.applicationState == .active,
              (viewport["scale"] as? Double ?? 1) == 1 else { return }
        let width = viewport["width"] as? Double ?? 0
        guard width > 0, width.isFinite else { return }
        let factor = web.bounds.width / CGFloat(width)
        guard factor > 0.5 && factor < 2 else { return }
        for row in rows {
            guard row["visible"] as? Bool == true, let key = row["slotKey"] as? String,
                  let e = entries[key], e.slot.format == .native, e.ready, !e.failed,
                  let r = row["rect"] as? [String: Double], let x = r["x"], let y = r["y"],
                  let w = r["width"], let h = r["height"] else { continue }
            let rect = CGRect(x: x, y: y, width: w, height: h)
            guard RooomAdPolicy.validRect(rect), w >= 200, h >= 58 else { continue }
            // Child of WKWebView.scrollView: outer page scrolling and native pan
            // gestures remain owned by UIScrollView, not a touch-blocking window overlay.
            e.view.frame = CGRect(x: CGFloat(x) * factor + web.scrollView.contentOffset.x,
                y: CGFloat(y) * factor + web.scrollView.contentOffset.y, width: CGFloat(w) * factor, height: CGFloat(h) * factor)
            if let c = row["clip"] as? [String: Double], let cx = c["x"], let cy = c["y"], let cw = c["width"], let ch = c["height"] {
                let clipped = CGRect(x: cx, y: cy, width: cw, height: ch).intersection(rect)
                guard RooomAdPolicy.validRect(clipped) else { continue }
                e.view.visibleRect = CGRect(x: (clipped.minX - rect.minX) * factor, y: (clipped.minY - rect.minY) * factor,
                    width: clipped.width * factor, height: clipped.height * factor)
            } else { continue }
            e.style(row["layout"] as? String ?? "list", label: row["label"] as? String ?? "Ad")
            e.view.isHidden = false; web.scrollView.bringSubviewToFront(e.view)
        }
    }
    func haptic() {
        guard RooomAdPolicy.trusted(web?.url), UIApplication.shared.applicationState == .active else { return }
        let now = ProcessInfo.processInfo.systemUptime
        guard now - lastHaptic >= 0.028 else { return }; lastHaptic = now
        selection.selectionChanged(); selection.prepare()
    }
}

private final class RooomAdMessageHandler: NSObject, WKScriptMessageHandlerWithReply {
    weak var owner: RooomAdsBridgeViewController?
    init(_ owner: RooomAdsBridgeViewController) { self.owner = owner }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let owner else { replyHandler(nil, "Unavailable"); return }
        owner.handle(message, reply: replyHandler)
    }
}
final class RooomAdsBridgeViewController: CAPBridgeViewController {
    var monetization: RooomMonetization?
    var adReservationChanged: ((RooomAdInsets) -> Void)?
    private var adHandler: RooomAdMessageHandler?
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let web = bridge?.webView else { return }
        monetization = RooomMonetization(controller: self)
        let handler = RooomAdMessageHandler(self); adHandler = handler
        web.configuration.userContentController.addScriptMessageHandler(handler, contentWorld: .page, name: "rooomMonetization")
        // Same first-party Web module for TOP and direct room notification entry.
        // Missing/unpublished modules fail closed: current UI remains unchanged.
        let bootstrap = """
        if (window === window.top && location.origin === 'https://rooom-talk.com') {
          import('/src/features/ads/page-ad-runtime.mjs')
            .then(function(m){m.pageAdvertising();}).catch(function(){});
        }
        """
        web.configuration.userContentController.addUserScript(WKUserScript(source: bootstrap, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        web.evaluateJavaScript(bootstrap, completionHandler: nil)
    }
    override func viewDidAppear(_ animated: Bool) { super.viewDidAppear(animated); monetization?.layout() }
    fileprivate func handle(_ message: WKScriptMessage, reply: @escaping (Any?, String?) -> Void) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "https", origin.host == "rooom-talk.com",
              [0, 443].contains(origin.port), RooomAdPolicy.trusted(bridge?.webView?.url),
              let body = message.body as? [String: Any], body["version"] as? Int == 1,
              let op = body["op"] as? String, let engine = monetization else { reply(nil, "Untrusted or unsupported request"); return }
        do {
            switch op {
            case "capabilities": reply(["version":1,"implemented":true,"platform":"ios","device":engine.device,
                "formats":["banner","largeBanner","rectangle","tabletBanner","native"],"maxSlots":RooomAdPolicy.maxSlots],nil)
            case "configure":
                guard let value = body["config"], JSONSerialization.isValidJSONObject(value) else { throw RooomAdError.invalidConfig }
                let data = try JSONSerialization.data(withJSONObject: value)
                guard data.count <= 16384 else { throw RooomAdError.limit }
                try engine.configure(JSONDecoder().decode(RooomAdConfig.self, from: data)); reply(["ok":true],nil)
            case "prepare":
                guard let key = body["slotKey"] as? String else { throw RooomAdError.invalidRequest }
                reply(["status":try engine.prepare(key:key)],nil)
            case "update": try engine.update(body["slots"] as? [[String:Any]] ?? [], viewport:body["viewport"] as? [String:Any] ?? [:]); reply(["ok":true],nil)
            case "release":
                guard let key = body["slotKey"] as? String else { throw RooomAdError.invalidRequest }
                engine.release(key:key); reply(["ok":true],nil)
            case "hide": engine.hideFeed(); reply(["ok":true],nil)
            case "haptic": engine.haptic(); reply(["ok":true],nil)
            default: throw RooomAdError.unsupported
            }
        } catch { reply(nil,"Ad request rejected: \(error)") }
    }
}
#endif
