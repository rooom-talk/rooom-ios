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
// Layout is presentation data owned by first-party Web. The signed SDK binary
// owns registration, consent boundaries, view lifecycle and input/keyboard.
// Every field has a conservative range; missing policy reproduces iOS 1.6.
struct RooomAdPresentation: Codable, Equatable {
    let railSide: String
    let railWidth: CGFloat
    let railPadding: CGFloat
    let railTop: CGFloat
    let railGap: CGFloat
    let bottomGap: CGFloat
    static let standard = RooomAdPresentation(railSide: "left", railWidth: 316,
        railPadding: 8, railTop: 12, railGap: 12, bottomGap: 0)
    func validated() throws -> RooomAdPresentation {
        guard ["left", "right"].contains(railSide),
              [railWidth, railPadding, railTop, railGap, bottomGap].allSatisfy({ $0.isFinite }),
              (308...460).contains(railWidth),
              railPadding >= 0 && railPadding <= railWidth - 300,
              (0...100).contains(railTop), (0...100).contains(railGap),
              (0...100).contains(bottomGap) else { throw RooomAdError.invalidConfig }
        return self
    }
}
struct RooomTabletWebBanner: Codable, Equatable {
    let version: Int
    let url: String
    static let approvedURL = "https://rooom-talk.com/src/features/ads/ios-ipad-portrait-728.html"
    func validated() throws -> RooomTabletWebBanner {
        guard version == 1, url == Self.approvedURL else { throw RooomAdError.invalidConfig }
        return self
    }
}
struct RooomAdConfig: Codable, Equatable {
    let version: Int, enabled: Bool, fixed: Bool, archive: Bool
    let slots: [RooomAdSlot]
    var presentation: RooomAdPresentation? = nil
    var tabletPortraitWebBanner: RooomTabletWebBanner? = nil
    static let off = RooomAdConfig(version: 1, enabled: false, fixed: false, archive: false, slots: [])
    func validated() throws -> RooomAdConfig {
        guard version == 1 else { throw RooomAdError.invalidConfig }
        if !enabled { return .off }
        guard slots.count <= 20 else { throw RooomAdError.limit }
        _ = try presentation?.validated()
        if let webBanner = tabletPortraitWebBanner {
            _ = try webBanner.validated()
            guard fixed, !slots.contains(where: { $0.role == "tablet.bottom" }) else { throw RooomAdError.invalidConfig }
        }
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
            case "tablet.bottom": valid = s.device == "tablet" && [.banner, .tabletBanner].contains(s.format)
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
    var webBannerRect: CGRect? = nil
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
                            readyKeys: Set<String>? = nil,
                            reserveTabletBottom: Bool = false) -> RooomAdLayout {
        var out = RooomAdLayout()
        guard config.enabled, config.fixed, !keyboard, bounds.width.isFinite, bounds.height.isFinite,
              bounds.width > 0, bounds.height > 0 else { return out }
        // iPad portrait may use an approved 320x50 or 728x90 bottom spot.
        // Landscape is LEFT rail only: never fall back to the portrait banner.
        let look = config.presentation ?? .standard
        let landscapeTablet = device == "tablet" && bounds.width > bounds.height
        if device == "tablet", !landscapeTablet, config.tabletPortraitWebBanner != nil,
           bounds.width - safe.left - safe.right >= 728,
           bounds.height - safe.top - safe.bottom - look.bottomGap >= 90 {
            out.webBannerRect = CGRect(x: safe.left + (bounds.width - safe.left - safe.right - 728) / 2,
                y: bounds.height - safe.bottom - 90 - look.bottomGap, width: 728, height: 90)
            out.reserved.bottom = 90 + safe.bottom + look.bottomGap
        }
        let roles = device == "phone" ? ["phone.bottom"] : landscapeTablet
            ? ["tablet.left.top", "tablet.left.bottom"] : ["tablet.bottom"]
        for role in roles {
            guard let s = config.slots.first(where: { $0.device == device && $0.role == role }) else { continue }
            let size = s.format.size
            guard size.width <= bounds.width - safe.left - safe.right,
                  size.height <= bounds.height - safe.top - safe.bottom else { continue }
            if role.hasPrefix("tablet.left") {
                // Publisher creative remains 300x250. Web controls only the
                // rail's location and padding, never the SDK's intrinsic size.
                guard bounds.width - safe.left - safe.right - look.railWidth >= 320 else { continue }
                let y = safe.top + look.railTop + (role.hasSuffix("bottom") ? size.height + look.railGap : 0)
                guard y + size.height <= bounds.height - safe.bottom else { continue }
                // Reserving the rail does not claim an ad impression/no-fill.
                // Both the 1.6 default and new Web policy reserve while loading.
                let railStart = look.railSide == "left" ? safe.left : bounds.width - safe.right - look.railWidth
                if look.railSide == "left" { out.reserved.left = safe.left + look.railWidth }
                else { out.reserved.right = safe.right + look.railWidth }
                if readyKeys == nil || readyKeys!.contains(s.key) {
                    out.placements.append(RooomFixedPlacement(slot: s, rect: CGRect(x: railStart + look.railPadding,
                        y: y, width: size.width, height: size.height)))
                }
            } else {
                let ready = readyKeys == nil || readyKeys!.contains(s.key)
                guard ready || (device == "tablet" && reserveTabletBottom) else { continue }
                guard size.height + look.bottomGap + safe.bottom <= bounds.height else { continue }
                if ready {
                    out.placements.append(RooomFixedPlacement(slot: s, rect: CGRect(x: (bounds.width - size.width) / 2,
                        y: bounds.height - safe.bottom - size.height - look.bottomGap,
                        width: size.width, height: size.height)))
                }
                out.reserved.bottom = size.height + safe.bottom + look.bottomGap
            }
        }
        return out
    }
}

// A last verified Web configuration is used for geometry only, never to start
// the SDK. Fresh installs use a generated snapshot of that same Web owner.
enum RooomInitialAdLayout {
    static let cacheKey = "rooom.verified-ad-layout.v1"
    static func decode(_ data: Data?) -> RooomAdConfig? {
        guard let data, data.count <= 16384,
              let config = try? JSONDecoder().decode(RooomAdConfig.self, from: data) else { return nil }
        return try? config.validated()
    }
    static func restore(cached: Data?, bundled: Data?) -> RooomAdConfig {
        return decode(cached) ?? decode(bundled) ?? .off
    }
}

// Native knows the physical device before Web runtime detection runs. Reuse the
// deployed ROOM owner and stylesheet; do not embed a second layout in the IPA.
enum RooomAdBootstrap {
    static func script(isTablet: Bool) -> String {
        return """
        if (window === window.top && location.origin === 'https://rooom-talk.com') {
          (async function() {
            if (\(isTablet ? "true" : "false") && location.pathname === '/room.html') {
              document.documentElement.classList.add('ios-device', 'ipad-device');
              try {
                const room = await import('https://rooom-talk.com/src/features/room/native-ipad-modern-room.mjs');
                const applied = await room.installNativeIpadModernRoom();
                document.documentElement.dataset.rooomNativeLayoutStatus = applied ? 'applied' : 'capability-rejected';
              } catch (error) {
                document.documentElement.dataset.rooomNativeLayoutStatus = 'module-error';
                console.warn('RoooM iPad layout module unavailable', String(error));
              }
            }
            // Native rail is outside WKWebView. Match its background to the
            // actual first-party RoooM CSS theme, even when no ad is filled.
            // This changes only appearance; never changes a placement/reservation.
            if (!window.__rooomNativeRailBackgroundSync) {
              window.__rooomNativeRailBackgroundSync = true;
              const syncRailBackground = function() {
                try {
                  const root = document.documentElement;
                  const css = getComputedStyle(root);
                  const value = css.getPropertyValue('--bg').trim();
                  if (!value) return;
                  const probe = document.createElement('span');
                  probe.style.backgroundColor = value;
                  (document.body || root).appendChild(probe);
                  const rgb = getComputedStyle(probe).backgroundColor;
                  probe.remove();
                  const match = /^rgba?\\(\\s*(\\d+)\\s*[, ]+\\s*(\\d+)\\s*[, ]+\\s*(\\d+)/.exec(rgb);
                  if (!match) return;
                  const channels = match.slice(1,4).map(Number);
                  if (channels.some(v => !Number.isInteger(v) || v < 0 || v > 255)) return;
                  window.webkit?.messageHandlers?.rooomMonetization?.postMessage({
                    version:1, op:'background', rgb:channels
                  });
                } catch (_) {}
              };
              syncRailBackground();
              new MutationObserver(syncRailBackground).observe(document.documentElement,{
                attributes:true, attributeFilter:['class','data-theme']
              });
              // Some routes update body classes instead of the root theme.
              if (document.body) new MutationObserver(syncRailBackground).observe(document.body,{
                attributes:true, attributeFilter:['class','style']
              });
            }
            try {
              const ads = await import('https://rooom-talk.com/src/features/ads/page-ad-runtime.mjs');
              ads.pageAdvertising();
            } catch (error) {
              console.warn('RoooM advertising bootstrap unavailable', String(error));
            }
          })();
        }
        """
    }
}

#if ROOOM_IMOBILE_ADS
import UIKit
import WebKit
import Capacitor

// The publisher's Web 728x90 tag has no APP SDK spot. Keep its scripts outside
// the authenticated Capacitor WebView: no handlers, injected app scripts, app
// cookies, main-page DOM or permission bridge exist on this dedicated surface.
private final class RooomTabletWebAd: NSObject, WKNavigationDelegate, WKUIDelegate {
    let view: WKWebView
    private(set) var phase = "created"
    init(url: URL, frame: CGRect) {
        let settings = WKWebViewConfiguration()
        settings.websiteDataStore = .nonPersistent()
        settings.userContentController = WKUserContentController()
        settings.applicationNameForUserAgent = "RoooMAdSurface/1"
        settings.preferences.javaScriptCanOpenWindowsAutomatically = false
        // Construct at the actual destination before entering the rotating
        // shell. Attaching at (0,0) then changing frame creates a fly-in path.
        view = WKWebView(frame: frame, configuration: settings)
        super.init()
        view.isHidden = true
        view.navigationDelegate = self; view.uiDelegate = self
        view.isOpaque = false; view.backgroundColor = .clear
        view.scrollView.backgroundColor = .clear
        view.underPageBackgroundColor = .clear
        view.scrollView.isScrollEnabled = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.scrollView.bounces = false
        phase = "loading-document"
        view.load(URLRequest(url: url))
    }
    func place(in shell: UIView, frame: CGRect) {
        view.frame = frame
        if view.superview !== shell { shell.addSubview(view) }
        view.isHidden = false
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        phase = "document-loaded" // Never equate this with an ad impression.
        inspect()
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { phase = "document-failed" }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { phase = "document-failed" }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { phase = "content-process-ended" }
    private func open(_ url: URL?) {
        guard let url, ["https", "http"].contains(url.scheme ?? ""),
              UIApplication.shared.applicationState == .active else { return }
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Provider subframes stay in the isolated surface. Only our exact page
        // may replace its main frame. User links open via the existing OS path.
        if navigationAction.targetFrame?.isMainFrame == false { decisionHandler(.allow); return }
        if navigationAction.request.url?.absoluteString == RooomTabletWebBanner.approvedURL {
            decisionHandler(.allow); return
        }
        if navigationAction.navigationType == .linkActivated { open(navigationAction.request.url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        // WebKit blocks automatic popups above; preserve genuine user clicks.
        open(navigationAction.request.url); return nil
    }
    func inspect() {
        view.evaluateJavaScript("document.documentElement.dataset.adPhase || 'document-loaded'") { [weak self] value, _ in
            guard let self, let value = value as? String,
                  ["tag-started", "loader-loaded", "loader-failed", "document-loaded"].contains(value) else { return }
            self.phase = value
        }
    }
    func release() { view.stopLoading(); view.navigationDelegate = nil; view.uiDelegate = nil; view.removeFromSuperview() }
}

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
    // Read-only status for TestFlight triage; no SDK behavior or retries change.
    private(set) var diagnosticPhase = "created"
    private(set) var lastFailureCode: Int? = nil
    private(set) var displayCallbackReceived = false
    weak var owner: RooomMonetization?
    private var nativeObject: ImobileSdkAdsNativeObject?
    private var creative: RooomNativeCreativeView?
    init(slot: RooomAdSlot, owner: RooomMonetization) {
        self.slot = slot; self.owner = owner; super.init()
        view.clipsToBounds = true; view.isHidden = true
    }
    func start() {
        diagnosticPhase = "registering"
        if let old = Self.registered[slot.spotId] {
            // Layout/key are Web configuration, not SDK registration identity.
            // Switching tile/fullRow must not require a new binary or process.
            guard old.publisherId == slot.publisherId, old.mediaId == slot.mediaId,
                  old.format == slot.format else { fail("registration-mismatch"); return }
        } else {
            guard ImobileSdkAds.register(withPublisherID: slot.publisherId, mediaID: slot.mediaId, spotID: slot.spotId) else { fail("register-rejected"); return }
            Self.registered[slot.spotId] = slot
        }
        guard ImobileSdkAds.setSpotDelegate(slot.spotId, delegate: self) else { fail("delegate-rejected"); return }
        diagnosticPhase = "starting"
        if !ImobileSdkAds.start(bySpotID: slot.spotId) { fail("start-rejected") }
        else { diagnosticPhase = "awaiting-callback" }
    }
    func showBannerIfNeeded() {
        // Official 2.3.4 inline sample attaches the View and calls show after
        // start, without waiting for Ready. Use that same path for both fixed
        // devices. Ready and DidShow remain actual callbacks, not show's Bool.
        guard !failed, !released, !shown,
              slot.format != .native, !view.isHidden, view.window != nil else { return }
        shown = true
        if !ImobileSdkAds.show(bySpotID: slot.spotId, view: view) { fail("show-rejected") }
        else { diagnosticPhase = "show-accepted" }
    }
    private func fail(_ phase: String = "sdk-failed-callback") {
        guard !released else { return }
        diagnosticPhase = phase; failed = true; ready = false; shown = false
        displayCallbackReceived = false; view.isHidden = true
        owner?.slotChanged(self, status: "failed")
    }
    func imobileSdkAdsSpot(_ spotId: String!, didReadyWithValue value: ImobileSdkAdsReadyResult) {
        guard spotId == slot.spotId else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self, !self.released else { return }
            // The SDK owns retry timing. A later Ready after a transient failure
            // must restore this slot; never start an application retry loop.
            if self.slot.format != .native { self.failed = false }
            guard !self.failed else { return }
            if self.slot.format == .native {
                guard !self.nativeRequested, let controller = self.owner?.controller else { return }
                self.nativeRequested = true
                if !ImobileSdkAds.getNativeAdData(self.slot.spotId, viewController: controller, delegate: self) { self.fail() }
            } else {
                self.diagnosticPhase = "sdk-ready"
                self.ready = true; self.owner?.slotChanged(self, status: "ready")
            }
        }
    }
    func imobileSdkAdsSpot(_ spotId: String!, didFailWithValue value: ImobileSdkAdsFailResult) {
        guard spotId == slot.spotId else { return }
        DispatchQueue.main.async { [weak self] in
            self?.lastFailureCode = Int(value.rawValue)
            self?.fail()
        }
    }
    func imobileSdkAdsSpotDidShow(_ spotId: String!) {
        guard spotId == slot.spotId else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self, !self.released else { return }
            self.displayCallbackReceived = true; self.diagnosticPhase = "display-callback"
        }
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
        guard !released else { return }; diagnosticPhase = "released"; released = true
        view.removeFromSuperview(); nativeObject?.destroy(); nativeObject = nil
        ImobileSdkAds.setSpotDelegate(slot.spotId, delegate: nil)
        _ = ImobileSdkAds.stop(bySpotID: slot.spotId)
    }
    deinit { release() }
}

final class RooomMonetization {
    weak var controller: RooomAdsBridgeViewController?
    private var config = RooomAdConfig.off
    private var initialLayout: RooomAdConfig
    private var entries: [String: RooomSdkSlot] = [:]
    private var tabletWebAd: RooomTabletWebAd?
    private var keyboard = false, layingOut = false
    private var observers: [NSObjectProtocol] = []
    private var navigation: NSKeyValueObservation?
    private var pageLocation: NSKeyValueObservation?
    private var lastHaptic = 0.0
    private let selection = UISelectionFeedbackGenerator()
    private(set) var reservation = RooomAdInsets()
    var device: String { UIDevice.current.userInterfaceIdiom == .pad ? "tablet" : "phone" }
    var web: WKWebView? { controller?.bridge?.webView }
    var shell: UIView? { controller?.parent?.view }
    init(controller: RooomAdsBridgeViewController) {
        let seedURL = Bundle.main.url(forResource: "rooom-initial-ad-layout", withExtension: "json", subdirectory: "public")
        let seed = seedURL.flatMap { try? Data(contentsOf: $0) }
        initialLayout = RooomInitialAdLayout.restore(
            cached: UserDefaults.standard.data(forKey: RooomInitialAdLayout.cacheKey), bundled: seed)
        self.controller = controller
        controller.installPhoneSurfaceSeed(initialLayout)
        // Drop creatives/permission on navigation, retain only verified geometry.
        navigation = web?.observe(\.isLoading, options: [.new]) { [weak self] web, _ in
            if web.isLoading { self?.beginDocument() }
        }
        pageLocation = web?.observe(\.url, options: [.new]) { [weak self] _, _ in self?.layout() }
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.hideAll() })
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.layout() })
    }
    deinit { for observer in observers { NotificationCenter.default.removeObserver(observer) }; clear() }
    func configure(_ next: RooomAdConfig) throws {
        let valid = try next.validated()
        // Web stays authoritative, including OFF. Persist only after validation
        // through the existing trusted main-frame bridge; no eager SDK loading.
        initialLayout = valid
        controller?.installPhoneSurfaceSeed(valid)
        if let data = try? JSONEncoder().encode(valid) {
            UserDefaults.standard.set(data, forKey: RooomInitialAdLayout.cacheKey)
        }
        guard valid != config else { layout(); return }
        releaseCreatives(); config = valid; layout()
    }
    private func releaseCreatives() {
        tabletWebAd?.release(); tabletWebAd = nil
        let old = entries; entries.removeAll(); for entry in old.values { entry.release() }
    }
    private func beginDocument() {
        releaseCreatives(); config = .off; layout()
    }
    func clear() {
        releaseCreatives()
        config = .off; setReservation(RooomAdInsets())
    }
    private func setReservation(_ next: RooomAdInsets) {
        guard reservation != next else { return }; reservation = next; controller?.adReservationChanged?(next)
    }
    func setKeyboardVisible(_ value: Bool) { keyboard = value; if value { hideFeed() }; layout() }
    func hideFeed() { for e in entries.values where e.slot.format == .native { e.view.isHidden = true } }
    private func hideAll() {
        tabletWebAd?.release(); tabletWebAd = nil
        for e in entries.values { e.view.isHidden = true }
        if device != "tablet" { setReservation(RooomAdInsets()) }
    }
    // Read-only native snapshot. No spot IDs, SDK requests, user identifiers or URLs.
    func diagnostics() -> [String: Any] {
        let currentURL = web?.url ?? controller?.bridge?.config.serverURL
        let safePage = RooomAdPolicy.advertisingPage(currentURL)
        let dimensions = shell?.bounds.size ?? .zero
        let validBounds = dimensions.width > 0 && dimensions.height > 0
        let appActive = UIApplication.shared.applicationState == .active
        let layout = RooomAdPolicy.fixedLayout(config: config, device: device,
            bounds: dimensions, safe: RooomAdInsets(top: shell?.safeAreaInsets.top ?? 0,
                left: shell?.safeAreaInsets.left ?? 0,
                bottom: shell?.safeAreaInsets.bottom ?? 0,
                right: shell?.safeAreaInsets.right ?? 0), keyboard: keyboard)
        let selectedKeys = Set(layout.placements.map { $0.slot.key })
        let slots = config.slots.filter { $0.device == device && $0.format != .native }.map { slot -> [String: Any] in
            let entry = entries[slot.key]
            return ["key": slot.key,
                    "phase": entry?.diagnosticPhase ?? "not-created",
                    "eligible": selectedKeys.contains(slot.key),
                    "ready": entry?.ready ?? false,
                    "failed": entry?.failed ?? false,
                    "shown": entry?.shown ?? false,
                    "displayCallback": entry?.displayCallbackReceived ?? false,
                    "failureCode": entry?.lastFailureCode ?? -1,
                    "sdkStatus": entry == nil ? -1 : Int(ImobileSdkAds.getStatusBySpotID(slot.spotId).rawValue),
                    "readySelector": entry?.responds(to: NSSelectorFromString("imobileSdkAdsSpot:didReadyWithValue:")) ?? false,
                    "failSelector": entry?.responds(to: NSSelectorFromString("imobileSdkAdsSpot:didFailWithValue:")) ?? false,
                    "viewAttached": entry?.view.window != nil,
                    "viewHidden": entry?.view.isHidden ?? true]
        }
        tabletWebAd?.inspect()
        return ["version": 1, "device": device, "configured": config.enabled && config.fixed,
                "build": Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown",
                "sdkVersion": ImobileSdkAds.getSdkVersion() ?? "unknown",
                "pageEligible": safePage, "shellReady": shell != nil, "validBounds": validBounds,
                "appActive": appActive, "keyboard": keyboard,
                "orientation": dimensions.width > dimensions.height ? "landscape" : "portrait",
                "width": dimensions.width, "height": dimensions.height,
                "web728": ["configured": config.tabletPortraitWebBanner != nil,
                    "eligible": layout.webBannerRect != nil,
                    "phase": tabletWebAd?.phase ?? "not-created",
                    "viewAttached": tabletWebAd?.view.window != nil,
                    "viewHidden": tabletWebAd?.view.isHidden ?? true],
                "slots": slots]
    }
    private func entry(_ slot: RooomAdSlot) throws -> RooomSdkSlot {
        if let e = entries[slot.key] { return e }
        guard entries.count < RooomAdPolicy.maxSlots else { throw RooomAdError.limit }
        let e = RooomSdkSlot(slot: slot, owner: self); entries[slot.key] = e; e.start(); return e
    }
    // Reuse verified Web geometry before the document configures the SDK.
    // A pending slot owns space; explicit failure/release removes it. This is
    // layout only and never starts an ad request or claims Ready/impression.
    private func phoneReservedInsets(safe: RooomAdInsets) -> RooomAdInsets {
        guard let shell else { return RooomAdInsets() }
        let pendingOrVisible = Set(initialLayout.slots.filter { slot in
            guard let entry = entries[slot.key] else { return true }
            return !entry.failed && !entry.released
        }.map { $0.key })
        return RooomAdPolicy.fixedLayout(config: initialLayout, device: device,
            bounds: shell.bounds.size, safe: safe, keyboard: keyboard,
            readyKeys: pendingOrVisible).reserved
    }
    func layout() {
        guard !layingOut, let shell, let web else { return }
        layingOut = true; defer { layingOut = false }
        // The configured launch URL is available before WKWebView has its first
        // URL. After navigation starts, always use the real page URL.
        let pageURL = web.url ?? controller?.bridge?.config.serverURL
        guard RooomAdPolicy.advertisingPage(pageURL) else {
            hideAll(); setReservation(RooomAdInsets()); return
        }
        let s = shell.safeAreaInsets, safe = RooomAdInsets(top: s.top, left: s.left, bottom: s.bottom, right: s.right)
        // Preserve the iPad pre-document/loading geometry unchanged.
        if device == "tablet" {
            let ready = Set(entries.values.filter { $0.ready && !$0.failed }.map { $0.slot.key })
            setReservation(RooomAdPolicy.fixedLayout(config: initialLayout, device: device, bounds: shell.bounds.size,
                safe: safe, keyboard: keyboard, readyKeys: ready, reserveTabletBottom: true).reserved)
        }
        guard UIApplication.shared.applicationState == .active else { hideAll(); return }
        if device == "phone" { setReservation(phoneReservedInsets(safe: safe)) }
        let desired = RooomAdPolicy.fixedLayout(config: config, device: device, bounds: shell.bounds.size, safe: safe, keyboard: keyboard)
        tabletWebAd?.view.isHidden = true
        if let rect = desired.webBannerRect, let banner = config.tabletPortraitWebBanner,
           let url = URL(string: banner.url) {
            if tabletWebAd == nil { tabletWebAd = RooomTabletWebAd(url: url, frame: rect) }
            if let ad = tabletWebAd {
                ad.place(in: shell, frame: rect)
            }
        } else {
            // Hiding WKWebView alone does not suspend provider JavaScript.
            // End this surface on rotation, keyboard, split view or OFF; create
            // one new surface only when a user returns to an eligible posture.
            tabletWebAd?.release(); tabletWebAd = nil
        }
        let desiredKeys = Set(desired.placements.map { $0.slot.key })
        for e in entries.values where e.slot.format != .native && !desiredKeys.contains(e.slot.key) { e.view.isHidden = true }
        for p in desired.placements {
            guard let e = try? entry(p.slot) else { continue }
            if e.view.superview !== shell { shell.addSubview(e.view) }
            e.view.frame = p.rect
            e.view.isHidden = e.failed || (device == "phone" && controller?.phoneOverlayLayoutReady != true)
        }
        for p in desired.placements { entries[p.slot.key]?.showBannerIfNeeded() }
        if device == "phone" {
            // Re-evaluate after SDK calls so synchronous no-fill/failure drops
            // the initial reservation in this same pass. A later real recovery
            // uses the same geometry, without changing SDK show/refresh logic.
            setReservation(phoneReservedInsets(safe: safe))
        }
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
    // Per-document presentation agreement; old/missing Web keeps legacy resize.
    private(set) var phoneOverlayDocument = UUID().uuidString
    private(set) var phoneOverlayRequested = false
    var phoneOverlayLayoutReady = false {
        didSet { if oldValue != phoneOverlayLayoutReady { monetization?.layout() } }
    }
    func installPhoneSurfaceSeed(_ config: RooomAdConfig) {
        guard UIDevice.current.userInterfaceIdiom == .phone, let content = bridge?.webView?.configuration.userContentController else { return }
        let source = RooomPhoneSurfaceBootstrap.script(config: config)
        let old = content.userScripts
        if old.contains(where: { $0.source == source }) { return }
        let seed = WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        // Replace only our seed, preserving all existing script content/order.
        var replaced = false
        content.removeAllUserScripts()
        for script in old {
            if script.source.hasPrefix(RooomPhoneSurfaceBootstrap.marker) {
                if !replaced { content.addUserScript(seed); replaced = true }
            } else { content.addUserScript(script) }
        }
        if !replaced { content.addUserScript(seed) }
    }
    private var overlayNavigation: NSKeyValueObservation?
    private var adHandler: RooomAdMessageHandler?
    private var canvasBackground = RooomInitialCanvas.color
    private func applyCanvasBackground(_ color: UIColor) {
        guard let web = bridge?.webView else { return }
        canvasBackground = color
        // Keep the same canvas behind the page while WebKit replaces tiles or
        // UIKit rotates/resizes it. Web still owns all layout and theme choices.
        web.isOpaque = false
        web.backgroundColor = color
        web.scrollView.backgroundColor = color
        web.underPageBackgroundColor = color
        parent?.view.backgroundColor = color
        web.window?.backgroundColor = color
    }
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let web = bridge?.webView else { return }
        // Capacitor invokes this before viewDidLoad/loadWebView. Do not wait
        // for a document or an ad capability/configure reply to paint the canvas.
        applyCanvasBackground(canvasBackground)
        monetization = RooomMonetization(controller: self)
        overlayNavigation = web.observe(\.isLoading, options: [.new]) { [weak self] web, _ in
            guard let self else { return }
            if web.isLoading {
                self.phoneOverlayDocument = UUID().uuidString
                self.phoneOverlayRequested = false
                self.phoneOverlayLayoutReady = false
            }
            self.adReservationChanged?(self.monetization?.reservation ?? RooomAdInsets())
        }
        let handler = RooomAdMessageHandler(self); adHandler = handler
        web.configuration.userContentController.addScriptMessageHandler(handler, contentWorld: .page, name: "rooomMonetization")
        // Same first-party Web module for TOP and direct room notification entry.
        // Missing/unpublished modules fail closed: current UI remains unchanged.
        let bootstrap = RooomAdBootstrap.script(isTablet: UIDevice.current.userInterfaceIdiom == .pad)
        web.configuration.userContentController.addUserScript(WKUserScript(source: bootstrap, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        web.evaluateJavaScript(bootstrap, completionHandler: nil)
    }
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        applyCanvasBackground(canvasBackground) // window is attached now
        monetization?.layout()
    }
    fileprivate func handle(_ message: WKScriptMessage, reply: @escaping (Any?, String?) -> Void) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "https", origin.host == "rooom-talk.com",
              [0, 443].contains(origin.port), RooomAdPolicy.trusted(bridge?.webView?.url),
              let body = message.body as? [String: Any], body["version"] as? Int == 1,
              let op = body["op"] as? String, let engine = monetization else { reply(nil, "Untrusted or unsupported request"); return }
        do {
            switch op {
            case "capabilities": reply(["version":1,"implemented":true,"platform":"ios","device":engine.device,
                "phoneOverlay":["version":1,"documentId":phoneOverlayDocument,"surface":"full-height-v2"],
                "fixedLayoutReservation":"before-fill-v1",
                "tabletPortraitWebBanner":"isolated-wkwebview-v1",
                "formats":["banner","largeBanner","rectangle","tabletBanner","native"],"maxSlots":RooomAdPolicy.maxSlots],nil)
            case "phoneOverlay":
                guard engine.device == "phone", body["documentId"] as? String == phoneOverlayDocument,
                      let enabled = body["enabled"] as? Bool else { throw RooomAdError.invalidRequest }
                phoneOverlayRequested = enabled
                adReservationChanged?(engine.reservation)
                reply(["ok":true],nil)
            case "background":
                // Appearance only: restricted to the existing trusted first-party
                // main-frame handler. Reject malformed/oversized color data.
                guard let values = body["rgb"] as? [NSNumber], values.count == 3,
                      values.allSatisfy({ $0.intValue >= 0 && $0.intValue <= 255 &&
                          $0.doubleValue == Double($0.intValue) }) else { throw RooomAdError.invalidRequest }
                let color = UIColor(red: CGFloat(values[0].intValue) / 255,
                    green: CGFloat(values[1].intValue) / 255,
                    blue: CGFloat(values[2].intValue) / 255, alpha: 1)
                applyCanvasBackground(color)
                reply(["ok":true],nil)
            case "diagnostics":
                reply(engine.diagnostics(), nil)
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

// Initial presentation data only. CSS lives in the render-blocking Web shell.
enum RooomPhoneSurfaceBootstrap {
    static let marker = "// RoooM phone full-canvas seed v2\n"
    static func script(config: RooomAdConfig) -> String {
        let valid = (try? config.validated()) ?? .off
        let slot = valid.enabled && valid.fixed ? valid.slots.first(where: { $0.device == "phone" && $0.role == "phone.bottom" }) : nil
        let height = slot.map { Double($0.format.size.height + (valid.presentation ?? .standard).bottomGap) } ?? 0
        return marker + """
        if (window === window.top && location.origin === 'https://rooom-talk.com') {
          const page = ['/', '/index.html'].includes(location.pathname) ? 'home' : location.pathname === '/room.html' ? 'room' : null;
          if (page) {
            const apply = function() {
            const root = document.documentElement;
            if (!root) return false;
            root.setAttribute('data-rooom-phone-full-canvas', page);
            if (\(height) > 0) {
              root.setAttribute('data-rooom-phone-ad-overlay', page);
              root.style.setProperty('--rooom-phone-ad-occupied-bottom', 'calc(\(height)px + var(--rooom-safe-bottom, env(safe-area-inset-bottom, 0px)))');
            }
            return true;
            };
            if (!apply()) {
              const observer = new MutationObserver(function() { if (apply()) observer.disconnect(); });
              observer.observe(document, {childList:true});
            }
          }
        }
        """
    }
}
