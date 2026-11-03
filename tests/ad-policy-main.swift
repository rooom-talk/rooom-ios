import Foundation
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
check("short window suppresses lower rectangle") {
 let l=RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:CGSize(width:1024,height:430))
 assert(l.placements.count==1 && l.placements[0].slot.key=="l")
}
check("no fill no reserved space") { assert(RooomAdPolicy.fixedLayout(config:config,device:"phone",bounds:CGSize(width:390,height:844),readyKeys:[]).reserved.bottom==0) }
check("one ready landscape ad keeps width, never doubles rail") {
 assert(RooomAdPolicy.fixedLayout(config:config,device:"tablet",bounds:CGSize(width:1024,height:768),readyKeys:["l2"]).reserved.left==316)
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
