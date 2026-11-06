import Foundation
#if canImport(CoreGraphics)
import CoreGraphics
#endif
var count = 0
func check(_ name: String, _ body: () throws -> Void) { do { try body(); count += 1; print("PASS \(name)") } catch { fatalError("FAIL \(name): \(error)") } }
func slot(_ key: String, _ role: String, _ device: String, _ format: RooomAdFormat, _ id: String) -> RooomAdSlot {
 RooomAdSlot(key:key,role:role,device:device,format:format,publisherId:"85650",mediaId:device == "phone" ? "597836" : "999800",spotId:id)
}
let phone = slot("p","phone.bottom","phone",.banner,"1951334")
let bottom = slot("b","tablet.bottom","tablet",.tabletBanner,"999801")
let left = slot("l","tablet.left.top","tablet",.rectangle,"999802")
let lower = slot("l2","tablet.left.bottom","tablet",.rectangle,"999803")
let config = RooomAdConfig(version:1,enabled:true,fixed:true,archive:false,slots:[phone,bottom,left,lower])
check("config validates") { _ = try config.validated() }
check("OFF makes no fixed placements") { assert(RooomAdPolicy.fixedLayout(config:.off,device:"phone",bounds:CGSize(width:390,height:844)).placements.isEmpty) }
check("phone safe area reserved once") {
 let l=RooomAdPolicy.fixedLayout(config:config,device:"phone",bounds:CGSize(width:390,height:844),safe:RooomAdInsets(bottom:34))
 assert(l.reserved.bottom==84 && l.placements[0].rect.minY==760 && l.placements[0].rect.width==320)
}
check("keyboard releases all ad space") { assert(RooomAdPolicy.fixedLayout(config:config,device:"phone",bounds:CGSize(width:390,height:844),keyboard:true).reserved.bottom==0) }
check("iPad portrait wide 728x90") {
 let l=RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:CGSize(width:768,height:1024),safe:RooomAdInsets(bottom:20))
 assert(l.placements.count==1 && l.placements[0].rect.width==728 && l.reserved.bottom==110)
}
check("iPad split view never clips oversized banner") { assert(RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:CGSize(width:500,height:1024)).placements.isEmpty) }
check("iPad landscape reserves one left rail for two ads") {
 let l=RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:CGSize(width:1024,height:768))
 assert(l.placements.count==2 && l.reserved.left==316 && l.reserved.bottom==0)
}
check("compact 320x50 iPad portrait uses bottom only") {
 let compact = slot("compact","tablet.bottom","tablet",.banner,"999805")
 let c = RooomAdConfig(version:1,enabled:true,fixed:true,archive:false,slots:[compact,left,lower])
 let portrait = RooomAdPolicy.fixedLayout(config:c,device:"tablet",bounds:CGSize(width:768,height:1024))
 assert(portrait.placements.count==1 && portrait.placements[0].slot.key=="compact")
 assert(portrait.placements[0].rect.width==320 && portrait.reserved.bottom==50 && portrait.reserved.left==0)
 let landscape = RooomAdPolicy.fixedLayout(config:c,device:"tablet",bounds:CGSize(width:1024,height:768))
 assert(landscape.placements.count==2 && landscape.reserved.left==316 && landscape.reserved.bottom==0)
}
check("iPad landscape never falls back to bottom banner without left spots") {
 let compact = slot("compact","tablet.bottom","tablet",.banner,"999805")
 let c = RooomAdConfig(version:1,enabled:true,fixed:true,archive:false,slots:[compact])
 assert(RooomAdPolicy.fixedLayout(config:c,device:"tablet",bounds:CGSize(width:1024,height:768)).placements.isEmpty)
 assert(RooomAdPolicy.fixedLayout(config:c,device:"tablet",bounds:CGSize(width:768,height:1024)).placements.count==1)
}
check("short window suppresses lower rectangle") {
 let l=RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:CGSize(width:1024,height:430))
 assert(l.placements.count==1 && l.placements[0].slot.key=="l")
}
check("Web-owned iPad rail moves to the right without a new SDK build") {
 var c=config
 c.presentation = RooomAdPresentation(railSide:"right",railWidth:360,railPadding:18,
     railTop:24,railGap:30,bottomGap:0)
 let valid=try! c.validated()
 let l=RooomAdPolicy.fixedLayout(config:valid,device:"tablet",
     bounds:CGSize(width:1024,height:768),readyKeys:[])
 assert(l.reserved.left==0 && l.reserved.right==360 && l.placements.isEmpty)
 let filled=RooomAdPolicy.fixedLayout(config:valid,device:"tablet",
     bounds:CGSize(width:1024,height:768))
 assert(filled.placements.count==2 && filled.reserved.right==360)
 assert(filled.placements[0].rect.origin.x==682)
 assert(filled.placements[0].rect.origin.y==24)
 assert(filled.placements[1].rect.origin.y==304)
}
check("Web-owned bottom inset supports future approved portrait APP spot") {
 var c=config
 c.presentation = RooomAdPresentation(railSide:"left",railWidth:316,railPadding:8,
     railTop:12,railGap:12,bottomGap:24)
 let l=RooomAdPolicy.fixedLayout(config:try! c.validated(),device:"tablet",
     bounds:CGSize(width:768,height:1024),safe:RooomAdInsets(bottom:20))
 assert(l.placements.count==1 && l.placements[0].rect.minY==890)
 assert(l.reserved.bottom==134)
}
check("native bounds reject any dangerous Web placement") {
 for railWidth in [CGFloat.nan,-1,299,800,CGFloat.infinity] {
  var c=config
  c.presentation=RooomAdPresentation(railSide:"left",railWidth:railWidth,
    railPadding:8,railTop:12,railGap:12,bottomGap:0)
  do { _=try c.validated();assertionFailure("bad rail width accepted") } catch {}
 }
 var bad=config
 bad.presentation=RooomAdPresentation(railSide:"bottom",railWidth:316,railPadding:8,
   railTop:12,railGap:12,bottomGap:0)
 do { _=try bad.validated();assertionFailure("bad side accepted") } catch {}
}
check("legacy iOS layout has no Web presentation and retains the original rail") {
 assert(config.presentation == nil)
 let l=RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:CGSize(width:1024,height:768))
 assert(l.reserved.left==316 && l.reserved.right==0)
 assert(l.placements[0].rect.origin.x==8 && l.placements[1].rect.origin.y==274)
}
check("no fill no reserved space") { assert(RooomAdPolicy.fixedLayout(config:config,device:"phone",bounds:CGSize(width:390,height:844),readyKeys:[]).reserved.bottom==0) }
check("one ready landscape ad keeps width, never doubles rail") {
 assert(RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:CGSize(width:1024,height:768),readyKeys:["l2"]).reserved.left==316)
}
check("iPad no-fill retains approved left layout without pretending creatives are ready") {
 let l=RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:CGSize(width:1024,height:768),readyKeys:[])
 assert(l.reserved.left==316 && l.reserved.bottom==0 && l.placements.isEmpty)
 let loading=RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:CGSize(width:1024,height:768))
 assert(loading.placements.count==2 && loading.reserved.left==l.reserved.left)
}
check("iPad rail still obeys OFF, keyboard, portrait, safe area and minimum room width") {
 for c in [RooomAdConfig.off, RooomAdConfig(version:1,enabled:true,fixed:false,archive:false,slots:[left,lower])] {
  assert(RooomAdPolicy.fixedLayout(config:c,device:"tablet",bounds:CGSize(width:1024,height:768),readyKeys:[]).reserved.left==0)
 }
 assert(RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:CGSize(width:1024,height:768),keyboard:true,readyKeys:[]).reserved.left==0)
 assert(RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:CGSize(width:768,height:1024),readyKeys:[]).reserved==RooomAdInsets())
 assert(RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:CGSize(width:630,height:600),readyKeys:[]).reserved.left==0)
 assert(RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:CGSize(width:1024,height:768),safe:RooomAdInsets(left:20),readyKeys:[]).reserved.left==336)
}
check("origin allowlist and main-frame restriction") {
 assert(RooomAdPolicy.trusted(URL(string:"https://rooom-talk.com/")))
 for u in ["https://rooom-talk.com.evil.test/","http://rooom-talk.com/","https://rooom-talk.com:444/","https://user@rooom-talk.com/"] { assert(!RooomAdPolicy.trusted(URL(string:u))) }
 assert(!RooomAdPolicy.trusted(URL(string:"https://rooom-talk.com/"),mainFrame:false))
}
check("no ads on policy, admin or external screens") {
 for u in ["https://rooom-talk.com/privacy.html","https://rooom-talk.com/admin","https://example.com/"] { assert(!RooomAdPolicy.advertisingPage(URL(string:u))) }
 assert(RooomAdPolicy.advertisingPage(URL(string:"https://rooom-talk.com/room.html?id=a")))
}
check("reject nonfinite and excessive geometry") {
 assert(!RooomAdPolicy.validRect(CGRect(x:0,y:0,width:CGFloat.infinity,height:50)))
 assert(!RooomAdPolicy.validRect(CGRect(x:0,y:0,width:5000,height:50)))
 assert(RooomAdPolicy.validRect(CGRect(x:0,y:-40,width:300,height:60)))
}
check("reject duplicate IDs") {
 do { _ = try RooomAdConfig(version:1,enabled:true,fixed:true,archive:false,slots:[phone,phone]).validated();assertionFailure() } catch {}
}
check("reject Web media in native app") {
 let s=RooomAdSlot(key:"p",role:"phone.bottom",device:"phone",format:.banner,publisherId:"85650",mediaId:"597834",spotId:"1951168")
 do { _ = try RooomAdConfig(version:1,enabled:true,fixed:true,archive:false,slots:[s]).validated();assertionFailure() } catch {}
}
check("same protocol accepts multiple native feed slots") {
 let s=slot("feed","archive.tile","phone",.native,"999804")
 let c=RooomAdConfig(version:1,enabled:true,fixed:false,archive:true,slots:[s]); _ = try c.validated()
 assert(RooomAdPolicy.fixedLayout(config:c,device:"phone",bounds:CGSize(width:390,height:844)).placements.isEmpty)
}
check("initial geometry uses last validated Web policy, including OFF") {
 let seed=try! JSONEncoder().encode(config)
 let off=try! JSONEncoder().encode(RooomAdConfig.off)
 assert(RooomInitialAdLayout.restore(cached:nil,bundled:seed)==config)
 assert(RooomInitialAdLayout.restore(cached:off,bundled:seed)==RooomAdConfig.off)
 assert(RooomInitialAdLayout.restore(cached:Data("bad".utf8),bundled:seed)==config)
 assert(RooomInitialAdLayout.restore(cached:nil,bundled:nil)==RooomAdConfig.off)
 assert(RooomInitialAdLayout.decode(Data(repeating:32,count:16385))==nil)
 var changed=config
 changed.presentation=RooomAdPresentation(railSide:"right",railWidth:340,railPadding:16,railTop:20,railGap:14,bottomGap:10)
 assert(RooomInitialAdLayout.restore(cached:try! JSONEncoder().encode(changed),bundled:seed)==changed)
}
check("iPad initial portrait reservation is stable through fill and rotation; phone unchanged") {
 let compact=slot("compact","tablet.bottom","tablet",.banner,"999805")
 let c=RooomAdConfig(version:1,enabled:true,fixed:true,archive:false,slots:[compact,left,lower,phone])
 let blank=RooomAdPolicy.fixedLayout(config:c,device:"tablet",bounds:CGSize(width:768,height:1024),safe:RooomAdInsets(bottom:20),readyKeys:[],reserveTabletBottom:true)
 let ready=RooomAdPolicy.fixedLayout(config:c,device:"tablet",bounds:CGSize(width:768,height:1024),safe:RooomAdInsets(bottom:20),readyKeys:["compact"],reserveTabletBottom:true)
 assert(blank.reserved.bottom==70 && blank.placements.isEmpty && blank.reserved==ready.reserved)
 let landscape=RooomAdPolicy.fixedLayout(config:c,device:"tablet",bounds:CGSize(width:1024,height:768),readyKeys:[],reserveTabletBottom:true)
 assert(landscape.reserved.left==316 && landscape.reserved.bottom==0)
 let keyboard=RooomAdPolicy.fixedLayout(config:c,device:"tablet",bounds:CGSize(width:1024,height:768),keyboard:true,readyKeys:[],reserveTabletBottom:true)
 assert(keyboard.reserved==RooomAdInsets())
 let iphone=RooomAdPolicy.fixedLayout(config:c,device:"phone",bounds:CGSize(width:390,height:844),readyKeys:[],reserveTabletBottom:true)
 assert(iphone.reserved==RooomAdInsets())
}
check("isolated Web banner reserves exactly 728x90 plus safe area without an SDK bottom") {
 var c=RooomAdConfig(version:1,enabled:true,fixed:true,archive:false,slots:[left,lower])
 c.tabletPortraitWebBanner=RooomTabletWebBanner(version:1,url:RooomTabletWebBanner.approvedURL)
 _ = try c.validated()
 let p=RooomAdPolicy.fixedLayout(config:c,device:"tablet",bounds:CGSize(width:820,height:1180),safe:RooomAdInsets(bottom:20),readyKeys:[])
 assert(p.placements.isEmpty && p.reserved.bottom==110 && p.reserved.left==0)
 assert(p.webBannerRect == CGRect(x:46,y:1070,width:728,height:90))
 let wide=RooomAdPolicy.fixedLayout(config:c,device:"tablet",bounds:CGSize(width:1180,height:820))
 assert(wide.placements.count==2 && wide.webBannerRect==nil && wide.reserved.left==316 && wide.reserved.bottom==0)
 for width in [CGFloat(600),727] {
  let compact=RooomAdPolicy.fixedLayout(config:c,device:"tablet",bounds:CGSize(width:width,height:1024))
  assert(compact.webBannerRect==nil && compact.reserved==RooomAdInsets() && compact.placements.isEmpty)
 }
 let keyboard=RooomAdPolicy.fixedLayout(config:c,device:"tablet",bounds:CGSize(width:820,height:1180),keyboard:true)
 assert(keyboard.webBannerRect==nil && keyboard.reserved==RooomAdInsets())
 let phone=RooomAdPolicy.fixedLayout(config:c,device:"phone",bounds:CGSize(width:820,height:1180))
 assert(phone.webBannerRect==nil && phone.reserved==RooomAdInsets())
 let data=try JSONEncoder().encode(c)
 assert(RooomInitialAdLayout.decode(data)==c)
 let offData=try JSONEncoder().encode(RooomAdConfig.off)
 assert(RooomInitialAdLayout.restore(cached:offData,bundled:data) == .off)
}
check("Web surface rejects untrusted URLs and dual SDK/Web bottom reservations") {
 for url in ["https://rooom-test2.web.app/ad.html", "https://example.com", RooomTabletWebBanner.approvedURL+"?x=1"] {
  var c=RooomAdConfig(version:1,enabled:true,fixed:true,archive:false,slots:[left,lower])
  c.tabletPortraitWebBanner=RooomTabletWebBanner(version:1,url:url)
  do { _ = try c.validated(); fatalError("bad URL accepted") } catch {}
 }
 var c=config
 c.tabletPortraitWebBanner=RooomTabletWebBanner(version:1,url:RooomTabletWebBanner.approvedURL)
 do { _ = try c.validated(); fatalError("dual bottom accepted") } catch {}
 c.slots.forEach { assert($0.mediaId != "597834") }
}
print("ALL \(count) POLICY TESTS PASSED; UIKit/SDK runtime NOT tested")
