import Foundation
import Security
import CryptoKit
import Darwin

@main struct PresignTests {
    static func main() throws {
        setbuf(stdout, nil)
        var count = 0
        func check(_ operation: () throws -> Void) throws { try operation(); count += 1 }
        func rejects(_ operation: () throws -> Void) throws {
            do { try operation() } catch { count += 1; return }; fatalError("Expected rejection")
        }
        try check { try require(SecPolicyCreateWithProperties(kSecPolicyAppleCodeSigning,nil) != nil,.trust) }
        try check { try require(SecPolicyCreateRevocation(kSecRevocationUseAnyAvailableMethod | kSecRevocationRequirePositiveResponse) != nil,.trust) }
        let now = Date(), team = "ABC123DE45", prefix = "OLD123AB45", leaf = Data("synthetic public certificate".utf8)
        let ent: [String: Any] = ["application-identifier":prefix+".com.rooom.talk","com.apple.developer.team-identifier":team,"get-task-allow":false,"beta-reports-active":true,"aps-environment":"production"]
        let p: [String: Any] = ["UUID":"12345678-1234-1234-1234-123456789012","CreationDate":now.addingTimeInterval(-600),"ExpirationDate":now.addingTimeInterval(3600),"Platform":["iOS"],"TeamIdentifier":[team],"ApplicationIdentifierPrefix":[prefix],"Entitlements":ent,"DeveloperCertificates":[leaf]]
        var d = p; d["DeveloperCertificates"] = [Data(SHA256.hash(data: leaf))]
        let requested: [String: Any] = ["aps-environment":"production"]
        func profile(_ p: [String: Any], _ d: [String: Any], _ requested: [String: Any] = ["aps-environment":"production"]) throws { _ = try validateProfile(p, der:d, leaf:leaf, team:team, now:now, requested:requested) }
        try check { try profile(p,d,requested) } // Legacy prefix is deliberately not Team ID.
        for key in ["UUID","CreationDate","ExpirationDate","Platform","TeamIdentifier","ApplicationIdentifierPrefix","Entitlements","DeveloperCertificates"] {
            try rejects { var bad=p; bad.removeValue(forKey:key); try profile(bad,d) }
            try rejects { var bad=d; bad.removeValue(forKey:key); try profile(p,bad) }
        }
        let profileMutations: [(String, Any)] = [("ExpirationDate",now), ("CreationDate",now.addingTimeInterval(1)), ("Platform",["OSX"]), ("TeamIdentifier",["OTHER12345"]), ("ApplicationIdentifierPrefix",["*"]), ("DeveloperCertificates",[Data("wrong".utf8)]), ("UUID","bad\nvalue")]
        for pair in profileMutations {
            try rejects { var a=p,b=d; a[pair.0]=pair.1; b[pair.0]=pair.1; try profile(a,b) }
        }
        for key in ["ProvisionedDevices","ProvisionsAllDevices"] {
            try rejects { var a=p; a[key] = key=="ProvisionedDevices" ? ([] as Any) : (false as Any); try profile(a,d) }
            try rejects { var b=d; b[key] = key=="ProvisionedDevices" ? [] : false; try profile(p,b) }
        }
        let entitlementMutations: [(String, Any)] = [("application-identifier",prefix+".*"),("application-identifier",team+".other.app"),("com.apple.developer.team-identifier","OTHER12345"),("get-task-allow",true),("get-task-allow",0),("beta-reports-active",false),("beta-reports-active",1),("aps-environment","development")]
        for pair in entitlementMutations {
            try rejects { var e=ent;e[pair.0]=pair.1;var a=p,b=d;a["Entitlements"]=e;b["Entitlements"]=e;try profile(a,b) }
        }
        for key in ["get-task-allow", "beta-reports-active"] { try rejects { var b=d,e=ent;e[key]=key=="get-task-allow" ? 0 : 1;b["Entitlements"]=e;try profile(p,b) } }
        try rejects { var b=d; b["ExpirationDate"]=now.addingTimeInterval(7200);try profile(p,b) }
        try rejects { var b=d; b["DeveloperCertificates"]=[Data(repeating:0,count:32)];try profile(p,b) }
        try rejects { try profile(p,d,["aps-environment":"production","unknown-entitlement":true]) }
        try rejects { try profile(p,d,["aps-environment":"development"]) }
        func facts(_ mode: String) -> CertificateFacts {
            CertificateFacts(notBefore:now.addingTimeInterval(mode=="future" ? 60 : -60),notAfter:now.addingTimeInterval(mode=="expired" ? -1 : 600),team:mode=="team" ? "OTHER12345":team,commonName:mode=="cn" ? "Apple Development: fixture":"Apple Distribution: fixture",digitalSignature:mode != "usage",ca:mode=="ca",codeSigning:mode != "eku",iosSubmission:mode != "purpose")
        }
        try check { try facts("valid").validate(team:team,now:now) }
        for mode in ["future","expired","team","cn","usage","ca","eku","purpose"] { try rejects { try facts(mode).validate(team:team,now:now) } }
        try check { try require(base64("YQ==\n") == Data([97]),.input) }
        for value in ["", "%%%", "YQ==secret", "YR=="] { try rejects { _ = try base64(value) } }

        // Actual DER parser, including Apple's application[16]/context[16] form.
        func der(_ tag: UInt8, _ bytes: [UInt8]) -> [UInt8] { precondition(bytes.count<128);return [tag,UInt8(bytes.count)]+bytes }
        func text(_ s: String)->[UInt8]{der(12,Array(s.utf8))}
        let dictionary=der(49,der(48,text("flag")+der(1,[255])))
        try check { try require(bool(try DER.decode(Data(dictionary)).dictionary()["flag"]) == true,.der) }
        let entDictionary=der(112,der(2,[1])+der(176,der(48,text("flag")+der(1,[0]))))
        try check { let v=try DER.decode(Data(entDictionary)).value() as! [String:Any];try require(bool(v["flag"]) == false,.der) }
        let malformed: [[UInt8]] = [[],[49,128,0,0],dictionary+[0],[49,129,0],[49,1,0],der(49,der(48,text("x")+der(1,[1]))),der(49,der(48,text("x")+der(1,[0]))+der(48,text("x")+der(1,[255]))),der(49,der(48,text("x")+der(5,[]))),der(49,der(48,text("x")+der(112,der(2,[2])+der(176,[]))))]
        for bytes in malformed { try rejects { _ = try DER.decode(Data(bytes)).dictionary() } }

        // Real Security.framework/PKCS12/CMS/trust boundary with disposable
        // synthetic CA only. Never uses the RoooM signing secrets or codesign.
        guard CommandLine.arguments.count == 2 else { fatalError("fixture directory") }
        let folder=URL(fileURLWithPath:CommandLine.arguments[1])
        func bytes(_ name:String)throws->Data{try Data(contentsOf:folder.appendingPathComponent(name))}
        let ca=SecCertificateCreateWithData(nil,try bytes("ca.der") as CFData)!
        print("SYNTHETIC phase: P12")
        let (cert,chain)=try importIdentity(try bytes("identity.p12"),password:"fixture-only-password")
        try check { try CertificateFacts.read(SecCertificateCopyData(cert) as Data).validate(team:team,now:now) }
        guard let differentKey = SecKeyCreateRandomKey([kSecAttrKeyType as String:kSecAttrKeyTypeRSA,kSecAttrKeySizeInBits as String:2048,kSecPrivateKeyAttrs as String:[kSecAttrIsPermanent as String:false]] as CFDictionary,nil) else { throw GateError.identity }
        try rejects { try validatePrivateKey(differentKey,certificate:cert) }
        try rejects { _ = try importIdentity(try bytes("identity.p12"),password:"wrong-fixture-password") }
        try rejects { _ = try importIdentity(try bytes("cert-only.p12"),password:"fixture-only-password") }
        try rejects { _ = try importIdentity(Data([0,1,2]),password:"fixture-only-password") }
        let basicLeaf=SecCertificateCreateWithData(nil,try bytes("signer.der") as CFData)!
        var trust:SecTrust?;try require(SecTrustCreateWithCertificates([basicLeaf,ca] as CFArray,SecPolicyCreateBasicX509(),&trust)==errSecSuccess,.trust)
        print("SYNTHETIC phase: basic chain")
        try check { try evaluate(trust!,anchors:[ca],codeSigning:false,now:now,revocation:false) }
        let roots=try loadAppleRoots(URL(fileURLWithPath:FileManager.default.currentDirectoryPath).appendingPathComponent("scripts/presign-apple-roots"))
        try rejects { try evaluate(trust!,anchors:roots,codeSigning:true,now:now) }
        try rejects { try evaluate(trust!,anchors:[ca],codeSigning:false,now:now,revocation:true) }
        print("SYNTHETIC phase: CMS")
        let cms=try bytes("profile.cms"), expected=try bytes("payload.plist")
        try check { try require(verifiedCMS(cms,anchors:[ca],now:now,revocation:false)==expected,.cms) }
        try rejects { _ = try verifiedCMS(cms,anchors:roots,now:now) }
        try rejects { _ = try verifiedCMS(try bytes("wrong-signer.cms"),anchors:[ca],now:now,revocation:false) }
        for layer in [CMSLayer.outer, .inner] {
            for stage in CMSStage.allCases {
                do { try cmsStep(layer, stage) { throw GateError.input }; fatalError("Expected CMS diagnostic") }
                catch let fault as CMSFault { try check { try require(fault.layer == layer && fault.stage == stage, .cms) } }
            }
            do { _ = try verifiedCMS(try bytes("wrong-name.cms"), anchors:[ca], now:now, revocation:false, layer:layer); fatalError("Expected name rejection") }
            catch let fault as CMSFault { try check { try require(fault.layer == layer && fault.stage == .name_match, .cms) } }
            do { _ = try verifiedCMS(Data("not CMS".utf8), anchors:[ca], now:now, revocation:false, layer:layer); fatalError("Expected decode rejection") }
            catch let fault as CMSFault { try check { try require(fault.layer == layer && [.update,.finalize].contains(fault.stage), .cms) } }
        }
        guard let payloadRange=cms.range(of:Data("Synthetic".utf8)) else { fatalError("Synthetic CMS payload not embedded") }
        try rejects { var bad=cms;bad[payloadRange.lowerBound] ^= 1;_ = try verifiedCMS(bad,anchors:[ca],now:now,revocation:false) }
        try rejects { _ = try verifiedCMS(Data("not CMS".utf8),anchors:[ca],now:now,revocation:false) }
        try rejects { _ = try runGate(["TARGET_ENV":"production"],root:folder) }
        print("TEST2 PRESIGN SWIFT TESTS PASS: \(count) checks; synthetic identities/CMS only; no app signing or upload.")
    }
}
