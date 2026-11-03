#if ROOOM_IMOBILE_ADS
import UIKit

// i-mobile SDK 2.3.4: compiled only in explicitly prepared ad-enabled builds.
// The iPhone-app spot is never requested on iPad. No Web ad tags are injected.
final class RooomImobileBanner: NSObject, IMobileSdkAdsDelegate {
    private let publisherID = "85650"
    private let mediaID = "597836"
    private let spotID = "1951334"
    private weak var parentView: UIView?
    private let containerView = UIView()
    private let creativeView = UIView()
    private var heightConstraint: NSLayoutConstraint?
    private var didRequest = false
    private var adReady = false
    private var keyboardVisible = false

    // The owner updates its existing keyboard-height constraint when the
    // banner becomes available or disappears. No new keyboard owner.
    var onReservedHeightChange: (() -> Void)?

    var reservedBottomHeight: CGFloat {
        guard adReady && !keyboardVisible, let parent = parentView else { return 0 }
        return 50 + parent.safeAreaInsets.bottom
    }

    func install(in parent: UIView) {
        guard UIDevice.current.userInterfaceIdiom == .phone, !didRequest else { return }
        didRequest = true
        parentView = parent

        containerView.translatesAutoresizingMaskIntoConstraints = false
        containerView.isHidden = true
        containerView.backgroundColor = .systemBackground
        parent.addSubview(containerView)

        heightConstraint = containerView.heightAnchor.constraint(equalToConstant: 0)
        NSLayoutConstraint.activate([
            containerView.leadingAnchor.constraint(equalTo: parent.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: parent.trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: parent.safeAreaLayoutGuide.bottomAnchor),
            heightConstraint!
        ])

        creativeView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(creativeView)
        NSLayoutConstraint.activate([
            creativeView.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            creativeView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
            creativeView.widthAnchor.constraint(equalToConstant: 320),
            creativeView.heightAnchor.constraint(equalToConstant: 50)
        ])

        guard ImobileSdkAds.register(
            withPublisherID: publisherID,
            mediaID: mediaID,
            spotID: spotID
        ) else {
            NSLog("RoooM i-mobile: spot registration failed")
            return
        }
        ImobileSdkAds.setSpotDelegate(spotID, delegate: self)
        _ = ImobileSdkAds.start(bySpotID: spotID)
    }

    func setKeyboardVisible(_ visible: Bool) {
        guard keyboardVisible != visible else { return }
        keyboardVisible = visible
        refreshBar()
    }

    private func refreshBar() {
        let visible = adReady && !keyboardVisible
        heightConstraint?.constant = visible ? 50 : 0
        containerView.isHidden = !visible
        onReservedHeightChange?()
    }

    func imobileSdkAdsSpot(_ spotId: String!, didReadyWithValue value: ImobileSdkAdsReadyResult) {
        guard spotId == spotID else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            // Reserve visible UI space only after the SDK actually shows a creative.
            // A successful show request is not proof that an ad is on screen.
            if !ImobileSdkAds.show(bySpotID: self.spotID, view: self.creativeView) {
                self.adReady = false
                self.refreshBar()
            }
        }
    }

    func imobileSdkAdsSpot(_ spotId: String!, didFailWithValue value: ImobileSdkAdsFailResult) {
        guard spotId == spotID else { return }
        DispatchQueue.main.async { [weak self] in
            self?.adReady = false
            self?.refreshBar()
            NSLog("RoooM i-mobile: ad unavailable")
        }
    }

    func imobileSdkAdsSpotDidShow(_ spotId: String!) {
        guard spotId == spotID else { return }
        DispatchQueue.main.async { [weak self] in
            self?.adReady = true
            self?.refreshBar()
        }
    }

    deinit {
        if didRequest {
            ImobileSdkAds.setSpotDelegate(spotID, delegate: nil)
            _ = ImobileSdkAds.stop(bySpotID: spotID)
        }
    }
}
#endif
