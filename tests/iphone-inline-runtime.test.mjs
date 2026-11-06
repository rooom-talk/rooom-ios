import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Runs actual production method bodies, not a JS reimplementation of their gates.
// UIKit, SDK, persistence and main-queue scheduling are deterministic doubles.
// This checks application lifecycle decisions, NOT vendor rendering or paid fill.
const root=fileURLToPath(new URL('../',import.meta.url));
const source=fs.readFileSync(path.join(root,'ios/App/App/RooomImobileBanner.swift'),'utf8');
const baseline=JSON.parse(fs.readFileSync(new URL('./iphone-inline-baseline.json',import.meta.url),'utf8'));

function block(text,marker){
 const start=text.indexOf(marker);assert.ok(start>=0,`Missing production method ${marker}`);
 const open=text.indexOf('{',start);let depth=0,quoted=false,line=false,comment=0;
 for(let i=open;i<text.length;i++){
  const a=text[i],b=text[i+1];
  if(line){if(a==='\n')line=false;continue;}
  if(comment){if(a==='/'&&b==='*'){comment++;i++;}else if(a==='*'&&b==='/'){comment--;i++;}continue;}
  if(quoted){if(a==='\\')i++;else if(a==='"')quoted=false;continue;}
  if(a==='/'&&b==='/'){line=true;i++;continue;}
  if(a==='/'&&b==='*'){comment=1;i++;continue;}
  if(a==='"'){quoted=true;continue;}
  if(a==='{')depth++;
  if(a==='}'&&--depth===0)return text.slice(start,i+1);
 }
 throw Error(`Unclosed production method ${marker}`);
}
const slotStart=source.indexOf('private final class RooomSdkSlot:');
const ownerStart=source.indexOf('final class RooomMonetization {');
assert.ok(slotStart>0&&ownerStart>slotStart);
const slot=source.slice(slotStart,ownerStart),owner=source.slice(ownerStart);
const slotMethods=['func start()', 'func showBannerIfNeeded(', 'private func fail(',
 'func imobileSdkAdsSpot(_ spotId: String!, didReadyWithValue',
 'func imobileSdkAdsSpot(_ spotId: String!, didFailWithValue',
 'func imobileSdkAdsSpotDidShow(', 'func release()', 'deinit'];
const ownerMethods=['func configure(', 'private func releaseCreatives()', 'private func beginDocument()',
 'func clear()', 'private func setReservation(', 'func setKeyboardVisible(', 'func hideFeed()',
 'private func hideAll()', 'private func entry(', 'private func phoneReservedInsets(', 'func layout()', 'fileprivate func slotChanged('];
const foundation=source.split('#if ROOOM_IMOBILE_ADS')[0];

const doubles=String.raw`
private final class UIWindow: NSObject {}
private class UIView: NSObject {
    var frame: CGRect = .zero
    var bounds: CGRect { CGRect(origin: .zero, size: frame.size) }
    var safeAreaInsets = RooomAdInsets()
    var isHidden = false, clipsToBounds = false
    var attachedWindow: UIWindow?
    weak var superview: UIView?
    var children: [UIView] = []
    var window: UIWindow? { attachedWindow ?? superview?.window }
    func addSubview(_ view: UIView) { view.removeFromSuperview(); children.append(view); view.superview = self }
    func removeFromSuperview() { superview?.children.removeAll { $0 === self }; superview = nil }
}
private typealias RooomAdClippingView = UIView
private final class RooomNativeCreativeView {}
private final class ImobileSdkAdsNativeObject { func destroy() {} }
private protocol IMobileSdkAdsDelegate: AnyObject {}
private enum ImobileSdkAdsReadyResult: Int { case ready = 0 }
private enum ImobileSdkAdsFailResult: Int { case network = 4, notFound = 7 }
private enum ImobileSdkAdsStatus: Int { case ready = 0, notReady = 1 }
private enum DispatchQueue {
    static let main = Queue()
    final class Queue {
        var pending: [() -> Void] = []
        func async(execute: @escaping () -> Void) { pending.append(execute) }
        func drain() {
            var count = 0
            while !pending.isEmpty { count += 1; precondition(count < 100, "callback loop"); pending.removeFirst()() }
        }
    }
}
private final class UserDefaults {
    static let standard = UserDefaults()
    func set(_ data: Data, forKey key: String) {} // Never write device preferences.
}
private final class UIApplication {
    enum State { case active, inactive }
    static let shared = UIApplication()
    var applicationState: State = .active
}
private final class FakeWeb { var url: URL? = URL(string: "https://rooom-talk.com/") }
private final class FakeBridgeConfig { var serverURL: URL? = URL(string: "https://rooom-talk.com/") }
private final class FakeBridge { var config = FakeBridgeConfig() }
private final class FakeController {
    var bridge: FakeBridge? = FakeBridge()
    var adReservationChanged: ((RooomAdInsets) -> Void)?
}
private final class RooomTabletWebAd {
    let view = UIView()
    static var created = 0, released = 0
    init(url: URL, frame: CGRect = .zero) { Self.created += 1; view.frame = frame; view.isHidden = true }
    func place(in shell: UIView, frame: CGRect) { view.frame = frame; if view.superview !== shell { shell.addSubview(view) }; view.isHidden = false }
    func release() { Self.released += 1; view.removeFromSuperview() }
}
private enum ImobileSdkAds {
    static var registerOK = true, delegateOK = true, startOK = true, showOK = true
    static var status = ImobileSdkAdsStatus.ready
    static var calls: [String] = []
    static var views: [UIView] = []
    static var delegates: [String: IMobileSdkAdsDelegate] = [:]
    static func reset() {
        registerOK = true; delegateOK = true; startOK = true; showOK = true; status = .ready
        calls.removeAll(); views.removeAll(); delegates.removeAll()
    }
    static func register(withPublisherID: String, mediaID: String, spotID: String) -> Bool {
        calls.append("register:" + spotID); return registerOK
    }
    static func setSpotDelegate(_ id: String, delegate: IMobileSdkAdsDelegate?) -> Bool {
        calls.append((delegate == nil ? "clear:" : "delegate:") + id)
        if delegateOK { delegates[id] = delegate }; return delegateOK
    }
    static func start(bySpotID id: String) -> Bool { calls.append("start:" + id); return startOK }
    static func stop(bySpotID id: String) -> Bool { calls.append("stop:" + id); return true }
    static func show(bySpotID id: String, view: UIView) -> Bool {
        precondition(view.window != nil && !view.isHidden && view.frame.width > 0 && view.frame.height > 0,
            "show must follow attachment, visible frame assignment and window attachment")
        calls.append("show:" + id); views.append(view); return showOK
    }
    static func getNativeAdData(_ id: String, viewController: FakeController, delegate: IMobileSdkAdsDelegate) -> Bool {
        calls.append("native:" + id); return false
    }
    static func getStatusBySpotID(_ id: String) -> ImobileSdkAdsStatus { status }
}
`;

function swiftProgram(useBaseline=false){
 const chosenSlot=useBaseline ? slot.replace(block(slot,'func showBannerIfNeeded('),baseline.show) : slot;
 const chosenOwner=useBaseline ? owner.replace(block(owner,'func layout()'),baseline.layout) : owner;
 const slotClass=chosenSlot.slice(0,chosenSlot.indexOf('func start()'))+
  slotMethods.map(m=>block(chosenSlot,m)).join('\n')+'\n}\n';
 return foundation+doubles+slotClass+String.raw`
private final class RooomMonetization {
    let device: String
    var controller: FakeController? = FakeController()
    var shell: UIView? = UIView()
    var web: FakeWeb? = FakeWeb()
    private var config = RooomAdConfig.off, initialLayout = RooomAdConfig.off
    private var entries: [String: RooomSdkSlot] = [:]
    private var tabletWebAd: RooomTabletWebAd?
    private var keyboard = false, layingOut = false
    private(set) var reservation = RooomAdInsets()
    var events: [[String: Any]] = []
    init(device: String = "phone", attached: Bool = true) {
        self.device = device
        shell!.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        shell!.safeAreaInsets = RooomAdInsets(bottom: 34)
        if attached { shell!.attachedWindow = UIWindow() }
    }
    func testSeed(_ seed: RooomAdConfig) { initialLayout = seed }
    func testBeginDocument() { beginDocument() }
    func testEntry(_ key: String = "phone") -> RooomSdkSlot { entries[key]! }
    func testNavigate(_ url: String, config: RooomAdConfig) throws {
        beginDocument(); web!.url = URL(string: url); try configure(config)
    }
    private func emit(_ value: [String: Any]) { events.append(value) }
`+ownerMethods.map(m=>block(chosenOwner,m)).join('\n')+'\n}\n'+String.raw`
private let phone = RooomAdSlot(key: "phone", role: "phone.bottom", device: "phone", format: .banner,
    publisherId: "85650", mediaId: "597836", spotId: "1951334")
private let upper = RooomAdSlot(key: "upper", role: "tablet.left.top", device: "tablet", format: .rectangle,
    publisherId: "85650", mediaId: "597836", spotId: "1951342")
private let lower = RooomAdSlot(key: "lower", role: "tablet.left.bottom", device: "tablet", format: .rectangle,
    publisherId: "85650", mediaId: "597836", spotId: "1951343")
private var config: RooomAdConfig {
    var result = RooomAdConfig(version: 1, enabled: true, fixed: true, archive: false, slots: [phone, upper, lower])
    result.tabletPortraitWebBanner = RooomTabletWebBanner(version: 1, url: RooomTabletWebBanner.approvedURL)
    return result
}
private func count(_ prefix: String) -> Int { ImobileSdkAds.calls.filter { $0.hasPrefix(prefix) }.count }
private func reset() {
    ImobileSdkAds.reset(); RooomSdkSlot.registered.removeAll(); DispatchQueue.main.pending.removeAll()
    UIApplication.shared.applicationState = .active; RooomTabletWebAd.created = 0; RooomTabletWebAd.released = 0
}
private func require(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() { fatalError(message) }
}
private func runCase(_ name: String, _ body: () throws -> Void) throws {
    reset(); try body(); print("PASS " + name)
}
`+(useBaseline ? String.raw`
try runCase("100069 SDK_READY without Ready callback reproduces zero show") {
    let owner = RooomMonetization(); try owner.configure(config)
    let entry = owner.testEntry()
    require(ImobileSdkAds.getStatusBySpotID(phone.spotId) == .ready, "fixture must model observed SDK READY")
    require(!entry.ready && !entry.shown && entry.view.isHidden && count("show:") == 0, "baseline gate not reproduced")
    require(owner.reservation.bottom == 0, "baseline must reserve no phone footer")
    owner.clear()
}
` : String.raw`
try runCase("cold start reserves verified geometry before configuration without SDK calls") {
    let owner = RooomMonetization(); owner.testSeed(config)
    owner.web!.url = nil
    owner.layout()
    require(owner.reservation.bottom == 84 && ImobileSdkAds.calls.isEmpty, "pre-document reserve without SDK")
    owner.web!.url = URL(string: "https://rooom-talk.com/")
    owner.layout(); owner.layout()
    require(owner.reservation.bottom == 84 && ImobileSdkAds.calls.isEmpty, "delayed Web keeps initial geometry")
    try owner.configure(config)
    require(owner.reservation.bottom == 84 && count("show:") == 1, "configuration does not move footer")
    owner.testEntry().imobileSdkAdsSpot(phone.spotId, didReadyWithValue: .ready); DispatchQueue.main.drain()
    owner.layout(); require(owner.reservation.bottom == 84 && count("show:") == 1, "Ready and repeated layout stable")
    owner.testBeginDocument()
    require(owner.reservation.bottom == 84, "new document preserves verified layout before config")
    try owner.configure(.off)
    require(owner.reservation.bottom == 0, "explicit Web OFF remains authoritative")
    owner.layout(); require(owner.reservation.bottom == 0, "OFF does not restore old seed")
    owner.clear()
}
try runCase("invalid size external page and keyboard never keep initial phone space") {
    let owner = RooomMonetization(); owner.testSeed(config)
    owner.setKeyboardVisible(true)
    require(owner.reservation.bottom == 0 && ImobileSdkAds.calls.isEmpty, "initial keyboard no request or space")
    owner.setKeyboardVisible(false); require(owner.reservation.bottom == 84, "keyboard close restores initial geometry")
    owner.web!.url = URL(string: "https://example.com/"); owner.layout()
    require(owner.reservation.bottom == 0, "external page excludes seed")
    owner.web!.url = URL(string: "https://rooom-talk.com/")
    owner.shell!.frame.size.width = 300; owner.layout()
    require(owner.reservation.bottom == 0, "banner too wide")
    owner.clear()
}
try runCase("SDK_READY without callback shows once on a framed attached view") {
    let owner = RooomMonetization(); try owner.configure(config)
    let entry = owner.testEntry()
    require(ImobileSdkAds.getStatusBySpotID(phone.spotId) == .ready, "observed status fixture")
    require(count("register:") == 1 && count("start:") == 1 && count("show:") == 1, "one SDK sequence")
    require(ImobileSdkAds.calls.prefix(4).map { String($0.split(separator: ":")[0]) } == ["register", "delegate", "start", "show"], "official sequence")
    require(!entry.ready && !entry.displayCallbackReceived && entry.shown, "show acceptance is not callback or fill")
    require(entry.view.frame == CGRect(x: 35, y: 760, width: 320, height: 50), "exact phone geometry")
    require(owner.reservation.bottom == 84 && !entry.view.isHidden, "reserve safe area exactly once in first pass")
    for _ in 0..<8 { owner.layout() }; try owner.configure(config)
    require(count("show:") == 1 && count("start:") == 1, "no retry on layout or identical config")
    entry.imobileSdkAdsSpotDidShow(phone.spotId); DispatchQueue.main.drain()
    require(entry.displayCallbackReceived && !entry.ready && owner.reservation.bottom == 84, "DidShow does not invent Ready")
    owner.clear()
}
for failure in ["register", "delegate", "start", "show"] {
 try runCase("first-pass synchronous " + failure + " failure clears reservation") {
    if failure == "register" { ImobileSdkAds.registerOK = false }
    if failure == "delegate" { ImobileSdkAds.delegateOK = false }
    if failure == "start" { ImobileSdkAds.startOK = false }
    if failure == "show" { ImobileSdkAds.showOK = false }
    let owner = RooomMonetization(); try owner.configure(config); let entry = owner.testEntry()
    require(entry.failed && !entry.shown && entry.view.isHidden && owner.reservation.bottom == 0, "failure must clear during current guarded layout")
    let attempts = ImobileSdkAds.calls.count; owner.layout(); owner.layout()
    require(ImobileSdkAds.calls.count == attempts, "failed entry must not retry")
    owner.clear()
 }
}
try runCase("no-fill removes footer; real later Ready recovers without restarting") {
    let owner = RooomMonetization(); try owner.configure(config); let entry = owner.testEntry()
    entry.imobileSdkAdsSpot(phone.spotId, didFailWithValue: .notFound); DispatchQueue.main.drain()
    require(entry.failed && entry.lastFailureCode == 7 && !entry.shown && entry.view.isHidden, "real failure retained")
    require(owner.reservation.bottom == 0 && !entry.displayCallbackReceived, "no-fill reserves zero")
    owner.layout(); require(count("show:") == 1, "no application retry")
    entry.imobileSdkAdsSpot(phone.spotId, didReadyWithValue: .ready); DispatchQueue.main.drain()
    require(entry.ready && !entry.failed && entry.shown && count("show:") == 2 && count("start:") == 1, "one recovery show from actual Ready")
    require(owner.reservation.bottom == 84 && !entry.view.isHidden, "recovered geometry")
    owner.clear()
}
try runCase("keyboard, background and untrusted pages hide and release footer") {
    let owner = RooomMonetization(); try owner.configure(config); let entry = owner.testEntry()
    owner.setKeyboardVisible(true)
    require(entry.view.isHidden && owner.reservation.bottom == 0, "keyboard footer removal")
    owner.setKeyboardVisible(false)
    require(!entry.view.isHidden && owner.reservation.bottom == 84 && count("show:") == 1, "keyboard return reuses submitted view")
    UIApplication.shared.applicationState = .inactive; owner.layout()
    require(entry.view.isHidden && owner.reservation.bottom == 0, "background footer removal")
    UIApplication.shared.applicationState = .active; owner.layout()
    owner.web!.url = URL(string: "https://example.com/room.html"); owner.layout()
    require(entry.view.isHidden && owner.reservation.bottom == 0 && count("show:") == 1, "external page cannot show")
    owner.clear()
}
try runCase("TOP to ROOM uses cached registration with new delegate and new view") {
    let owner = RooomMonetization(); try owner.configure(config); let first = owner.testEntry()
    try owner.testNavigate("https://rooom-talk.com/room.html?id=test", config: config)
    let second = owner.testEntry()
    require(first !== second && first.released && first.view.superview == nil, "old document released")
    require(count("register:") == 1 && count("delegate:") == 2 && count("start:") == 2 && count("show:") == 2, "cached spot still gets fresh delegate/start/show")
    require(ImobileSdkAds.delegates[phone.spotId] === second && owner.reservation.bottom == 84, "ROOM owns delegate and footer")
    first.imobileSdkAdsSpot(phone.spotId, didReadyWithValue: .ready); DispatchQueue.main.drain()
    first.release()
    require(!second.ready && count("show:") == 2 && ImobileSdkAds.delegates[phone.spotId] === second, "stale callback/release cannot alter new entry")
    try owner.configure(.off)
    require(second.released && owner.reservation == RooomAdInsets() && ImobileSdkAds.delegates[phone.spotId] == nil, "OFF fully releases")
}
try runCase("unattached shell waits; attaching shows once; initial keyboard makes no request") {
    let owner = RooomMonetization(attached: false); try owner.configure(config)
    require(count("show:") == 0 && owner.reservation.bottom == 84, "pending geometry before window attachment; no show")
    owner.shell!.attachedWindow = UIWindow(); owner.layout()
    require(count("show:") == 1 && owner.reservation.bottom == 84, "attached shell resumes")
    owner.clear()
    reset(); let keyboardOwner = RooomMonetization(); keyboardOwner.setKeyboardVisible(true)
    try keyboardOwner.configure(config)
    require(ImobileSdkAds.calls.isEmpty && keyboardOwner.reservation.bottom == 0, "no initial hidden keyboard request")
    keyboardOwner.setKeyboardVisible(false)
    require(count("show:") == 1, "keyboard close starts eligible slot once")
    keyboardOwner.clear()
}
try runCase("iPad rectangles, Web728 and failure reservation remain unchanged") {
    let owner = RooomMonetization(device: "tablet")
    owner.shell!.frame = CGRect(x: 0, y: 0, width: 1180, height: 820)
    owner.shell!.safeAreaInsets = RooomAdInsets(bottom: 20)
    try owner.configure(config)
    require(count("show:") == 2 && owner.reservation.left == 316 && owner.reservation.bottom == 0, "two landscape rectangles")
    require(ImobileSdkAds.views.allSatisfy { $0.frame.size == CGSize(width: 300, height: 250) }, "no resized creative")
    owner.testEntry("upper").imobileSdkAdsSpot(upper.spotId, didFailWithValue: .notFound); DispatchQueue.main.drain()
    require(owner.reservation.left == 316, "iPad failure still preserves rail")
    owner.shell!.frame = CGRect(x: 0, y: 0, width: 820, height: 1180); owner.layout()
    require(owner.reservation.bottom == 110 && owner.reservation.left == 0 && RooomTabletWebAd.created == 1, "portrait Web728 plus safe area")
    require(count("show:") == 2 && count("register:1951334") == 0, "phone SDK never activated on iPad")
    owner.layout(); require(RooomTabletWebAd.created == 1, "same portrait layout keeps one view")
    owner.shell!.frame = CGRect(x: 0, y: 0, width: 1180, height: 820); owner.layout()
    require(owner.reservation.left == 316 && owner.reservation.bottom == 0 && RooomTabletWebAd.released == 1, "landscape releases portrait surface")
    owner.shell!.frame = CGRect(x: 0, y: 0, width: 820, height: 1180); owner.layout()
    require(RooomTabletWebAd.created == 2 && owner.reservation.bottom == 110, "portrait return creates exactly one replacement")
    owner.setKeyboardVisible(true); require(owner.reservation == RooomAdInsets(), "iPad keyboard unchanged")
    require(RooomTabletWebAd.released == 2, "keyboard releases portrait surface")
    owner.setKeyboardVisible(false); require(RooomTabletWebAd.created == 3 && owner.reservation.bottom == 110, "keyboard close restores portrait surface once")
    UIApplication.shared.applicationState = .inactive; owner.layout()
    require(RooomTabletWebAd.released == 3, "background releases surface")
    UIApplication.shared.applicationState = .active; owner.layout()
    require(RooomTabletWebAd.created == 4, "foreground restores once")
    owner.clear()
}
`)+ '\nprint("ACTUAL METHOD HARNESS COMPLETE; UIKit/SDK doubles only, no real ad rendering/network")\n';
}

test('harness extracts production lifecycle bodies and immutable 100069 gate evidence',()=>{
 assert.equal(baseline.commit,'5d4366bb7d32c9750ea48428cb3e1b7c15a504be');
 assert.match(baseline.show,/guard \(ready \|\| allowPending\)/);
 assert.match(baseline.layout,/allowPending: device == "tablet"/);
 for(const mode of [false,true]){
  const code=swiftProgram(mode);
  for(const marker of slotMethods.filter(m=>m!=='func showBannerIfNeeded('))assert.ok(code.includes(block(slot,marker)));
  assert.ok(code.includes(mode?baseline.show:block(slot,'func showBannerIfNeeded(')));
  assert.ok(code.includes(mode?baseline.layout:block(owner,'func layout()')));
 }
});

test('actual Swift lifecycle: reproduce 100069 then exercise corrected inline behavior',{
 skip: process.platform!=='darwin' ? 'Requires macOS Swift compiler; extraction checks still run on Windows' : false,
 timeout:120000
},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rooom-inline-runtime-'));
 try{
  for(const previous of [true,false]){
   const name=previous?'baseline':'current',input=path.join(dir,name+'.swift'),output=path.join(dir,name);
   fs.writeFileSync(input,swiftProgram(previous));
   const compiled=cp.spawnSync('swiftc',[input,'-o',output],{encoding:'utf8',timeout:60000});
   assert.equal(compiled.status,0,compiled.stdout+compiled.stderr);
   const run=cp.spawnSync(output,[],{encoding:'utf8',timeout:20000});
   assert.equal(run.status,0,run.stdout+run.stderr);
   assert.match(run.stdout,/ACTUAL METHOD HARNESS COMPLETE/);
   console.log(run.stdout.trim());
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
