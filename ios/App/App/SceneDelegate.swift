import UIKit
import Capacitor

// Existing UIKit keyboard owner; advertising never replaces its resize policy.
final class RooomKeyboardContainerViewController: UIViewController {
#if ROOOM_IMOBILE_ADS
    private let bridgeViewController = RooomAdsBridgeViewController()
    private var bridgeLeadingConstraint: NSLayoutConstraint!
    private var bridgeTrailingConstraint: NSLayoutConstraint!
    private var lastKeyboardOverlap: CGFloat = 0
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
            view.backgroundColor = UIColor(red: 239.0 / 255, green: 239.0 / 255,
                                           blue: 239.0 / 255, alpha: 1)
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
        bridgeBottomConstraint.constant = -(lastKeyboardOverlap + reserved.bottom)
        bridgeLeadingConstraint.constant = reserved.left
        bridgeTrailingConstraint.constant = -reserved.right
        view.setNeedsLayout()
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
