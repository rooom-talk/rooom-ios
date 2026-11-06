import UIKit
import Capacitor

// First-paint fallback only; the trusted Web theme replaces it after loading.
// Shared with the iPad launch storyboard through the named color asset.
enum RooomInitialCanvas {
    static let color = UIColor(named: "RooomInitialCanvas") ??
        UIColor(red: 239.0 / 255, green: 239.0 / 255, blue: 239.0 / 255, alpha: 1)
}

// Existing UIKit keyboard owner; advertising never replaces its resize policy.
final class RooomKeyboardContainerViewController: UIViewController {
#if ROOOM_IMOBILE_ADS
    private let bridgeViewController = RooomAdsBridgeViewController()
    private var bridgeLeadingConstraint: NSLayoutConstraint!
    private var bridgeTrailingConstraint: NSLayoutConstraint!
    private var lastKeyboardOverlap: CGFloat = 0
    private var phoneOverlayRequest: String?
    private var phoneOverlayApplied: String?
#else
    private let bridgeViewController = CAPBridgeViewController()
#endif
    private var bridgeBottomConstraint: NSLayoutConstraint!
    private var keyboardObserver: NSObjectProtocol?
    private var keyboardDidChangeObserver: NSObjectProtocol?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
#if ROOOM_IMOBILE_ADS
        // RoooM TOP's initial light-theme canvas, before the Web theme arrives.
        // The verified first-party page then synchronizes its actual --bg.
        // This is the native region OUTSIDE WKWebView, not a fake ad rectangle.
        if UIDevice.current.userInterfaceIdiom == .pad {
            view.backgroundColor = RooomInitialCanvas.color
        }
#endif
        addChild(bridgeViewController)
        let bridgeView = bridgeViewController.view!
        bridgeView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bridgeView)
        bridgeBottomConstraint = bridgeView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
#if ROOOM_IMOBILE_ADS
        bridgeLeadingConstraint = bridgeView.leadingAnchor.constraint(equalTo: view.leadingAnchor)
        bridgeTrailingConstraint = bridgeView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        NSLayoutConstraint.activate([
            bridgeView.topAnchor.constraint(equalTo: view.topAnchor),
            bridgeLeadingConstraint,
            bridgeTrailingConstraint,
            bridgeBottomConstraint
        ])
        bridgeViewController.adReservationChanged = { [weak self] _ in self?.updateBridgeBottom() }
        bridgeViewController.monetization?.layout()
        updateBridgeBottom()
#else
        NSLayoutConstraint.activate([
            bridgeView.topAnchor.constraint(equalTo: view.topAnchor),
            bridgeView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bridgeView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bridgeBottomConstraint
        ])
#endif
        bridgeViewController.didMove(toParent: self)
        keyboardObserver = NotificationCenter.default.addObserver(
            forName: UIResponder.keyboardWillChangeFrameNotification, object: nil, queue: .main
        ) { [weak self] notification in self?.applyKeyboardFrame(notification) }
        keyboardDidChangeObserver = NotificationCenter.default.addObserver(
            forName: UIResponder.keyboardDidChangeFrameNotification, object: nil, queue: .main
        ) { [weak self] notification in self?.finishKeyboardFrame(notification) }
    }
    deinit {
        if let keyboardObserver { NotificationCenter.default.removeObserver(keyboardObserver) }
        if let keyboardDidChangeObserver { NotificationCenter.default.removeObserver(keyboardDidChangeObserver) }
    }
    private func webViewScrollView() -> UIScrollView? { bridgeViewController.bridge?.webView?.scrollView }
    private func pinWebContentToTop() {
        guard let scrollView = webViewScrollView() else { return }
        if scrollView.contentOffset != .zero { scrollView.setContentOffset(.zero, animated: false) }
    }
    private func setKeyboardOpenClass(_ open: Bool) {
        let enabled = open ? "true" : "false"
        let script = """
        (function(){
          var root=document.documentElement;
          if(!root)return;
          root.classList.toggle('rooom-native-ios-keyboard-lock', (\(enabled)));
          root.classList.toggle('rooom-keyboard-open', (\(enabled)));
        })();
        """
        bridgeViewController.bridge?.webView?.evaluateJavaScript(script, completionHandler: nil)
    }
    private func keyboardOverlap(from notification: Notification) -> CGFloat? {
        guard let userInfo = notification.userInfo,
              let endFrameScreen = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return nil }
        let endFrame = view.convert(endFrameScreen, from: nil)
        let overlap = max(0, view.bounds.maxY - endFrame.minY)
        return endFrame.intersects(view.bounds) ? overlap : 0
    }
#if ROOOM_IMOBILE_ADS
    override func viewWillLayoutSubviews() {
        // Resolve the existing ad constraints before UIKit lays out the first
        // visible WebView frame, including rotation and cached-policy startup.
        bridgeViewController.monetization?.layout()
        updateBridgeBottom()
        super.viewWillLayoutSubviews()
    }
    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        bridgeViewController.monetization?.layout()
        if bridgeBottomConstraint != nil { updateBridgeBottom() }
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        bridgeViewController.monetization?.layout()
    }
    private func updateBridgeBottom() {
        guard bridgeBottomConstraint != nil, bridgeLeadingConstraint != nil,
              bridgeTrailingConstraint != nil else { return }
        let reserved = bridgeViewController.monetization?.reservation ?? RooomAdInsets()
        let bottom = phonePresentationBottom(reserved.bottom)
        guard bridgeBottomConstraint.constant != -(lastKeyboardOverlap + bottom) ||
              bridgeLeadingConstraint.constant != reserved.left ||
              bridgeTrailingConstraint.constant != -reserved.right else { return }
        bridgeBottomConstraint.constant = -(lastKeyboardOverlap + bottom)
        bridgeLeadingConstraint.constant = reserved.left
        bridgeTrailingConstraint.constant = -reserved.right
        view.setNeedsLayout()
    }
    // Translate the existing reservation at the container boundary only. Ad
    // fetching/show/failure, iPad geometry and the keyboard owner stay unchanged.
    private func phonePresentationBottom(_ reserved: CGFloat) -> CGFloat {
        guard UIDevice.current.userInterfaceIdiom == .phone,
              let web = bridgeViewController.bridge?.webView else { return reserved }
        let document = bridgeViewController.phoneOverlayDocument
        let enabled = bridgeViewController.phoneOverlayRequested && !web.isLoading &&
            RooomAdPolicy.advertisingPage(web.url)
        // Include viewport changes: late Web replies from rotation/keyboard or
        // the previous document must never expand a differently sized surface.
        let key = "\(document):\(enabled):\(reserved):\(view.bounds.width):\(view.bounds.height):\(lastKeyboardOverlap)"
        if phoneOverlayRequest != key {
            let hadRequest = phoneOverlayRequest != nil
            phoneOverlayRequest = key; phoneOverlayApplied = nil
            if enabled || hadRequest {
                let payload: [String: Any] = ["version":1,"documentId":document,
                    "enabled":enabled,"bottom":enabled ? Double(reserved) : 0,
                    "viewportHeight":Double(view.bounds.height - lastKeyboardOverlap)]
                if let data = try? JSONSerialization.data(withJSONObject: payload),
                   let json = String(data: data, encoding: .utf8) {
                    let script = "window.__rooomPhoneAdOverlay?.apply(\(json)) === true"
                    web.evaluateJavaScript(script) { [weak self] value, error in
                        guard let self, error == nil, value as? Bool == true,
                              self.phoneOverlayRequest == key,
                              self.bridgeViewController.phoneOverlayDocument == document else { return }
                        self.phoneOverlayApplied = key
                        self.updateBridgeBottom()
                    }
                }
            }
        }
        return enabled && phoneOverlayApplied == key ? 0 : reserved
    }
#endif
    private func applyKeyboardFrame(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let effectiveOverlap = keyboardOverlap(from: notification) else { return }
#if ROOOM_IMOBILE_ADS
        lastKeyboardOverlap = effectiveOverlap
        bridgeViewController.monetization?.setKeyboardVisible(effectiveOverlap > 0)
        updateBridgeBottom()
#else
        bridgeBottomConstraint.constant = -effectiveOverlap
#endif
        setKeyboardOpenClass(effectiveOverlap > 0)
        pinWebContentToTop()
        let duration = (userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber)?.doubleValue ?? 0.25
        let curveRaw = (userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? NSNumber)?.uintValue
            ?? UInt(UIView.AnimationCurve.easeInOut.rawValue)
        let curve = UIView.AnimationOptions(rawValue: curveRaw << 16)
        UIView.animate(withDuration: duration, delay: 0, options: [curve, .beginFromCurrentState, .allowUserInteraction]) {
            self.view.layoutIfNeeded(); self.pinWebContentToTop()
        } completion: { [weak self] _ in self?.pinWebContentToTop() }
    }
    private func finishKeyboardFrame(_ notification: Notification) {
        guard let effectiveOverlap = keyboardOverlap(from: notification) else { return }
#if ROOOM_IMOBILE_ADS
        lastKeyboardOverlap = effectiveOverlap
        bridgeViewController.monetization?.setKeyboardVisible(effectiveOverlap > 0)
        updateBridgeBottom()
#endif
        setKeyboardOpenClass(effectiveOverlap > 0)
        pinWebContentToTop()
        DispatchQueue.main.async { [weak self] in self?.pinWebContentToTop() }
    }
    override var childForStatusBarStyle: UIViewController? { bridgeViewController }
    override var childForStatusBarHidden: UIViewController? { bridgeViewController }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        window = UIWindow(windowScene: windowScene)
        if UIDevice.current.userInterfaceIdiom == .pad {
            window?.backgroundColor = RooomInitialCanvas.color
        }
        window?.rootViewController = RooomKeyboardContainerViewController()
        window?.makeKeyAndVisible()
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
