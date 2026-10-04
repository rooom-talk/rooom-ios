import UIKit
import Capacitor

// TEST iOS keyboard owner.
//
// Keep Capacitor out of keyboard resizing and animate the entire
// CAPBridgeViewController view with UIKit's own keyboard frame, duration,
// and curve. iPhone and iPad use this same owner and the same geometry rule.
final class RooomKeyboardContainerViewController: UIViewController {
    private let bridgeViewController = CAPBridgeViewController()
    private var bridgeBottomConstraint: NSLayoutConstraint!
    private var keyboardObserver: NSObjectProtocol?

    override func viewDidLoad() {
        super.viewDidLoad()

        view.backgroundColor = .systemBackground

        addChild(bridgeViewController)

        let bridgeView = bridgeViewController.view!
        bridgeView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bridgeView)

        bridgeBottomConstraint = bridgeView.bottomAnchor.constraint(equalTo: view.bottomAnchor)

        NSLayoutConstraint.activate([
            bridgeView.topAnchor.constraint(equalTo: view.topAnchor),
            bridgeView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bridgeView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bridgeBottomConstraint
        ])

        bridgeViewController.didMove(toParent: self)

        keyboardObserver = NotificationCenter.default.addObserver(
            forName: UIResponder.keyboardWillChangeFrameNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.applyKeyboardFrame(notification)
        }
    }

    deinit {
        if let keyboardObserver {
            NotificationCenter.default.removeObserver(keyboardObserver)
        }
    }

    private func applyKeyboardFrame(_ notification: Notification) {
        guard
            let userInfo = notification.userInfo,
            let endFrameScreen = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect
        else {
            return
        }

        let endFrame = view.convert(endFrameScreen, from: nil)
        let overlap = max(0, view.bounds.maxY - endFrame.minY)

        // A non-overlapping / off-screen keyboard means fully open web content.
        let effectiveOverlap = endFrame.intersects(view.bounds) ? overlap : 0
        bridgeBottomConstraint.constant = -effectiveOverlap

        let duration = (userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber)?.doubleValue ?? 0.25
        let curveRaw = (userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? NSNumber)?.uintValue
            ?? UInt(UIView.AnimationCurve.easeInOut.rawValue)
        let curve = UIView.AnimationOptions(rawValue: curveRaw << 16)

        UIView.animate(
            withDuration: duration,
            delay: 0,
            options: [curve, .beginFromCurrentState, .allowUserInteraction]
        ) {
            self.view.layoutIfNeeded()
        }
    }

    override var childForStatusBarStyle: UIViewController? {
        bridgeViewController
    }

    override var childForStatusBarHidden: UIViewController? {
        bridgeViewController
    }
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
