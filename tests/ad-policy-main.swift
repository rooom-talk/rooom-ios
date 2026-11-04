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
print("ALL \(count) POLICY TESTS PASSED; UIKit/SDK runtime NOT tested")
