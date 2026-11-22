// macOS-only release validation. Never signs code or exports a private key.
import Foundation
import Security
import CryptoKit

enum GateError: String, Error { case input, der, certificate, identity, trust, cms, profile, entitlement, context, staging }
func require(_ condition: Bool, _ error: GateError) throws { if !condition { throw error } }
func base64(_ value: String) throws -> Data {
    let compact = value.components(separatedBy: .whitespacesAndNewlines).joined()
    guard compact.count <= 6_000_000, let bytes = Data(base64Encoded: compact), !bytes.isEmpty, bytes.base64EncodedString() == compact else { throw GateError.input }; return bytes
}
func sha256(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
func bool(_ value: Any?) -> Bool? {
    guard let n = value as? NSNumber, CFGetTypeID(n) == CFBooleanGetTypeID() else { return nil }; return n.boolValue
}

// Bounded, definite-length DER only. Unsupported encodings stop the release.
struct DER {
    let tag: UInt8
    let bytes: Data
    let children: [DER]
    static func decode(_ data: Data) throws -> DER {
        try require(!data.isEmpty && data.count <= 4_194_304, .der)
        let a = [UInt8](data); var i = 0; var count = 0
        func read(_ end: Int, _ depth: Int) throws -> DER {
            count += 1; try require(depth < 32 && count <= 20_000 && i + 2 <= end, .der)
            let tag = a[i]; i += 1; try require(tag & 31 != 31, .der)
            var n = Int(a[i]); i += 1
            if n >= 128 {
                let width = n & 127; try require(width > 0 && width <= 3 && i + width <= end && a[i] != 0, .der)
                n = 0; for _ in 0..<width { n = n * 256 + Int(a[i]); i += 1 }; try require(n >= 128, .der)
            }
            try require(n <= end - i, .der); let finish = i + n; let bytes = Data(a[i..<finish]); var children = [DER]()
            if tag & 32 != 0 { while i < finish { children.append(try read(finish, depth + 1)) } } else { i = finish }
            return DER(tag: tag, bytes: bytes, children: children)
        }
        let result = try read(a.count, 0); try require(i == a.count, .der); return result
    }
    func string() throws -> String {
        try require([UInt8(12), 19, 22].contains(tag), .der)
        guard let s = String(data: bytes, encoding: .utf8), Data(s.utf8) == bytes else { throw GateError.der }
        if tag != 12 { try require(bytes.allSatisfy { $0 < 128 }, .der) }; return s
    }
    func integer() throws -> Int {
        let a = [UInt8](bytes); try require(tag == 2 && !a.isEmpty && a.count <= 7 && a[0] < 128, .der)
        try require(a.count == 1 || a[0] != 0 || a[1] >= 128, .der)
        return a.reduce(0) { $0 * 256 + Int($1) }
    }
    func oid() throws -> String {
        try require(tag == 6 && !bytes.isEmpty, .der); var parts = [Int](); var v = 0
        for b in bytes { try require(v < 1_000_000_000, .der); v = v * 128 + Int(b & 127); if b & 128 == 0 { parts.append(v); v = 0 } }
        try require(bytes.last! & 128 == 0 && !parts.isEmpty, .der)
        let first = parts.removeFirst(); return ([min(first / 40, 2), first < 80 ? first % 40 : first - 80] + parts).map(String.init).joined(separator: ".")
    }
    func date() throws -> Date {
        try require(tag == 23 || tag == 24, .der)
        guard let s = String(data: bytes, encoding: .ascii) else { throw GateError.der }
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(secondsFromGMT: 0); f.isLenient = false
        var value = s
        if tag == 23 {
            try require(s.count == 13 && s.hasSuffix("Z"), .der)
            guard let year = Int(s.prefix(2)) else { throw GateError.der }; value = (year >= 50 ? "19" : "20") + s
        }
        try require(value.count == 15 && value.hasSuffix("Z"), .der); f.dateFormat = "yyyyMMddHHmmss'Z'"
        guard let d = f.date(from: value), f.string(from: d) == value else { throw GateError.der }; return d
    }
    func dictionary() throws -> [String: Any] {
        try require(tag == 49 || tag == 176, .der); var result = [String: Any]()
        for pair in children {
            try require(pair.tag == 48 && pair.children.count == 2, .der); let key = try pair.children[0].string()
            try require(result[key] == nil && !key.isEmpty, .der); result[key] = try pair.children[1].value()
        }; return result
    }
    func value() throws -> Any {
        switch tag {
        case 1: try require(bytes == Data([0]) || bytes == Data([255]), .der); return bytes[0] == 255
        case 2: return try integer()
        case 4: return bytes
        case 12, 19, 22: return try string()
        case 23, 24: return try date()
        case 48: return try children.map { try $0.value() }
        case 49, 176: return try dictionary()
        case 112:
            try require(children.count == 2 && children[1].tag == 176, .der)
            let version = try children[0].integer(); try require(version == 1, .der)
            return try children[1].dictionary()
        default: throw GateError.der
        }
    }
}

struct CertificateFacts {
    let notBefore: Date; let notAfter: Date; let team: String; let commonName: String
    let digitalSignature: Bool; let ca: Bool; let codeSigning: Bool; let iosSubmission: Bool
    static func read(_ data: Data) throws -> CertificateFacts {
        let root = try DER.decode(data); try require(root.tag == 48 && root.children.count == 3, .certificate)
        let tbs = root.children[0]; let offset = tbs.children.first?.tag == 160 ? 1 : 0
        try require(tbs.tag == 48 && tbs.children.count >= 6 + offset, .certificate)
        let validity = tbs.children[3 + offset]; try require(validity.children.count == 2, .certificate)
        var names = [String: String]()
        for rdn in tbs.children[4 + offset].children { for pair in rdn.children {
            try require(pair.children.count == 2, .certificate); let oid = try pair.children[0].oid()
            if oid == "2.5.4.11" || oid == "2.5.4.3" { try require(names[oid] == nil, .certificate); names[oid] = try pair.children[1].string() }
        } }
        var extensions = [String: DER](); var critical = Set<String>()
        let groups = tbs.children.filter { $0.tag == 163 }; try require(groups.count == 1 && groups[0].children.count == 1, .certificate)
        for item in groups[0].children[0].children {
            try require(item.tag == 48 && (item.children.count == 2 || item.children.count == 3), .certificate)
            let oid = try item.children[0].oid(); try require(extensions[oid] == nil && item.children.last!.tag == 4, .certificate)
            if item.children.count == 3 { try require(item.children[1].tag == 1 && item.children[1].bytes == Data([255]), .certificate); critical.insert(oid) }
            extensions[oid] = try DER.decode(item.children.last!.bytes)
        }
        guard let usage = extensions["2.5.29.15"], let basic = extensions["2.5.29.19"] else { throw GateError.certificate }
        try require(usage.tag == 3 && usage.bytes.count >= 2 && usage.bytes[0] <= 7 && basic.tag == 48, .certificate)
        var isCA = false
        if !basic.children.isEmpty { try require(basic.children.count == 1 && basic.children[0].tag == 1, .certificate); isCA = bool(try basic.children[0].value()) == true }
        let eku = try extensions["2.5.29.37"]?.children.map { try $0.oid() } ?? []
        return CertificateFacts(notBefore: try validity.children[0].date(), notAfter: try validity.children[1].date(), team: names["2.5.4.11"] ?? "", commonName: names["2.5.4.3"] ?? "", digitalSignature: usage.bytes[1] & 128 != 0 && usage.bytes[1] & 4 == 0, ca: isCA, codeSigning: eku.contains("1.3.6.1.5.5.7.3.3"), iosSubmission: extensions["1.2.840.113635.100.6.1.4"] != nil && critical.contains("1.2.840.113635.100.6.1.4"))
    }
    func validate(team expected: String, now: Date) throws {
        try require(notBefore <= now && now < notAfter && notBefore < notAfter, .certificate)
        try require(team == expected && digitalSignature && !ca && codeSigning && iosSubmission, .certificate)
        try require(commonName.hasPrefix("Apple Distribution:") || commonName.hasPrefix("iPhone Distribution:"), .certificate)
    }
}

let appleRoots = [
    "AppleIncRootCertificate.cer": "b0b1730ecbc7ff4505142c49f1295e6eda6bcaed7e2c68c5be91b5a11001f024",
    "AppleRootCA-G2.cer": "c2b9b042dd57830e7d117dac55ac8ae19407d38e41d88f3215bc3a890444a050",
    "AppleRootCA-G3.cer": "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179"
]
func loadAppleRoots(_ folder: URL) throws -> [SecCertificate] {
    try appleRoots.sorted { $0.key < $1.key }.map { name, hash in
        let data = try Data(contentsOf: folder.appendingPathComponent(name)); try require(sha256(data) == hash, .trust)
        guard let c = SecCertificateCreateWithData(nil, data as CFData) else { throw GateError.trust }; return c
    }
}
func evaluate(_ trust: SecTrust, anchors: [SecCertificate], codeSigning: Bool, now: Date, revocation: Bool = true) throws {
    var policies = [SecPolicyCreateBasicX509()]
    if codeSigning { guard let p = SecPolicyCreateWithProperties(kSecPolicyAppleCodeSigning, nil) else { throw GateError.trust }; policies.append(p) }
    if revocation { guard let p = SecPolicyCreateRevocation(kSecRevocationUseAnyAvailableMethod | kSecRevocationRequirePositiveResponse) else { throw GateError.trust }; policies.append(p) }
    try require(SecTrustSetPolicies(trust, policies as CFArray) == errSecSuccess, .trust)
    try require(SecTrustSetAnchorCertificates(trust, anchors as CFArray) == errSecSuccess && SecTrustSetAnchorCertificatesOnly(trust, true) == errSecSuccess, .trust)
    try require(SecTrustSetVerifyDate(trust, now as CFDate) == errSecSuccess && SecTrustSetNetworkFetchAllowed(trust, revocation) == errSecSuccess, .trust)
    var error: CFError?; let accepted = SecTrustEvaluateWithError(trust, &error)
#if ROOOM_PRESIGN_TESTS
    if !accepted { FileHandle.standardError.write(Data("SYNTHETIC trust result: \(error.map { CFErrorGetCode($0) } ?? 0)\n".utf8)) }
#endif
    try require(accepted, .trust)
}
func verifiedCMS(_ data: Data, anchors: [SecCertificate], now: Date, revocation: Bool = true) throws -> Data {
    try require(!data.isEmpty && data.count <= 4_194_304, .cms)
    var raw: CMSDecoder?; try require(CMSDecoderCreate(&raw) == errSecSuccess, .cms); guard let decoder = raw else { throw GateError.cms }
    let update = data.withUnsafeBytes { CMSDecoderUpdateMessage(decoder, $0.baseAddress!, $0.count) }
    try require(update == errSecSuccess && CMSDecoderFinalizeMessage(decoder) == errSecSuccess, .cms)
    var count = 0; try require(CMSDecoderGetNumSigners(decoder, &count) == errSecSuccess && count == 1, .cms)
    var status = CMSSignerStatus(rawValue: 0)!; var trust: SecTrust?
    try require(CMSDecoderCopySignerStatus(decoder, 0, SecPolicyCreateBasicX509(), false, &status, &trust, nil) == errSecSuccess && status == .valid, .cms)
    guard let signerTrust = trust else { throw GateError.cms }; try evaluate(signerTrust, anchors: anchors, codeSigning: false, now: now, revocation: revocation)
    var signer: SecCertificate?; try require(CMSDecoderCopySignerCert(decoder, 0, &signer) == errSecSuccess, .cms)
    guard let signer else { throw GateError.cms }
    let facts = try CertificateFacts.read(SecCertificateCopyData(signer) as Data)
    try require(facts.commonName == "Apple iPhone OS Provisioning Profile Signing" && facts.digitalSignature && !facts.ca && !facts.iosSubmission, .cms)
    var content: CFData?; try require(CMSDecoderCopyContent(decoder, &content) == errSecSuccess, .cms)
    guard let content, CFDataGetLength(content) > 0 else { throw GateError.cms }; return content as Data
}

func validateProfile(_ p: [String: Any], der: [String: Any], leaf: Data, team: String, now: Date, requested: [String: Any]) throws -> String {
    let mandatory = ["UUID", "CreationDate", "ExpirationDate", "Platform", "TeamIdentifier", "ApplicationIdentifierPrefix", "Entitlements"]
    for key in mandatory { guard let a = p[key], let b = der[key] else { throw GateError.profile }; try require(NSDictionary(dictionary: [key: a]).isEqual(to: [key: b]), .profile) }
    for key in ["ProvisionedDevices", "ProvisionsAllDevices"] {
        try require(p[key] == nil && der[key] == nil, .profile)
    }
    guard let uuid = p["UUID"] as? String, uuid.range(of: "^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$", options: .regularExpression) != nil,
          let start = p["CreationDate"] as? Date, let end = p["ExpirationDate"] as? Date,
          let platforms = p["Platform"] as? [String], let teams = p["TeamIdentifier"] as? [String],
          let prefixes = p["ApplicationIdentifierPrefix"] as? [String], prefixes.count == 1,
          let entitlement = p["Entitlements"] as? [String: Any], let innerEntitlement = der["Entitlements"] as? [String: Any],
          let certificates = p["DeveloperCertificates"] as? [Data], certificates.count == 1,
          let checksums = der["DeveloperCertificates"] as? [Data], checksums.count == 1 else { throw GateError.profile }
    try require(start <= now && now < end && start < end && platforms == ["iOS"] && teams == [team], .profile)
    try require(prefixes[0].range(of: "^[A-Z0-9]{10}$", options: .regularExpression) != nil, .profile)
    try require(certificates[0] == leaf && checksums[0] == Data(SHA256.hash(data: leaf)), .identity)
    try require(entitlement["application-identifier"] as? String == prefixes[0] + ".com.rooom.talk" && entitlement["com.apple.developer.team-identifier"] as? String == team, .entitlement)
    try require(bool(entitlement["get-task-allow"]) == false && bool(entitlement["beta-reports-active"]) == true && entitlement["aps-environment"] as? String == "production", .entitlement)
    try require(bool(innerEntitlement["get-task-allow"]) == false && bool(innerEntitlement["beta-reports-active"]) == true, .entitlement)
    // The checked-in app currently claims only APNs production. Unknown claims
    // require an intentional review; do not silently broaden the release.
    try require(requested.count == 1 && requested["aps-environment"] as? String == "production", .entitlement)
    return uuid
}

@available(macOS 15.0, *)
func importIdentity(_ p12: Data, password: String) throws -> (SecCertificate, [SecCertificate]) {
    var items: CFArray?
    let options = [kSecImportExportPassphrase as String: password, kSecImportToMemoryOnly as String: true] as [String: Any]
    try require(SecPKCS12Import(p12 as CFData, options as CFDictionary, &items) == errSecSuccess, .identity)
    guard let list = items as? [[String: Any]], list.count == 1,
          let identity = list[0][kSecImportItemIdentity as String] else { throw GateError.identity }
    try require(CFGetTypeID(identity as CFTypeRef) == SecIdentityGetTypeID(), .identity)
    let id = identity as! SecIdentity; var certificate: SecCertificate?; var key: SecKey?
    try require(SecIdentityCopyCertificate(id, &certificate) == errSecSuccess && SecIdentityCopyPrivateKey(id, &key) == errSecSuccess, .identity)
    guard let certificate, let key, let publicKey = SecKeyCopyPublicKey(key), let certPublic = SecCertificateCopyKey(certificate),
          let a = SecKeyCopyExternalRepresentation(publicKey, nil), let b = SecKeyCopyExternalRepresentation(certPublic, nil), CFEqual(a, b),
          let chain = list[0][kSecImportItemCertChain as String] as? [SecCertificate], !chain.isEmpty else { throw GateError.identity }
    try require(SecCertificateCopyData(chain[0]) as Data == SecCertificateCopyData(certificate) as Data, .identity)
    return (certificate, chain)
}

@available(macOS 15.0, *)
func runGate(_ env: [String: String], root: URL) throws {
    try require(env["TARGET_ENV"] == "test2" && env["ROOOM_TESTFLIGHT_BUILD_NUMBER"].flatMap(Int.init).map { $0 > 100079 } == true && env["ROOOM_MARKETING_VERSION"] == "1.6.2", .context)
    try require(env["ROOOM_INTERNAL_ONLY"] == "<key>testFlightInternalTestingOnly</key><true/>" && env["ROOOM_BUILD_CONDITIONS"] == "$(inherited) ROOOM_IMOBILE_ADS ROOOM_TEST2_RAIL", .context)
    guard let team = env["APPLE_TEAM_ID"], team.range(of: "^[A-Z0-9]{10}$", options: .regularExpression) != nil,
          let password = env["CERTIFICATE_PASSWORD"], !password.isEmpty,
          let encoded = env["CERTIFICATE_BASE64"],
          let profileEncoded = env["PROVISIONING_PROFILE_BASE64"],
          let temp = env["RUNNER_TEMP"], let githubEnv = env["GITHUB_ENV"] else { throw GateError.input }
    let p12 = try base64(encoded), profile = try base64(profileEncoded)
    try require(p12.count < 4_194_304 && profile.count < 4_194_304, .input)
    let now = Date(); let anchors = try loadAppleRoots(root.appendingPathComponent("scripts/presign-apple-roots"))
    let (certificate, chain) = try importIdentity(p12, password: password); let leaf = SecCertificateCopyData(certificate) as Data
    try CertificateFacts.read(leaf).validate(team: team, now: now)
    var trust: SecTrust?; try require(SecTrustCreateWithCertificates(chain as CFArray, SecPolicyCreateBasicX509(), &trust) == errSecSuccess, .trust)
    guard let trust else { throw GateError.trust }; try evaluate(trust, anchors: anchors, codeSigning: true, now: now)
    let payload = try verifiedCMS(profile, anchors: anchors, now: now)
    guard let p = try PropertyListSerialization.propertyList(from: payload, format: nil) as? [String: Any], let inner = p["DER-Encoded-Profile"] as? Data else { throw GateError.profile }
    let innerPayload = try verifiedCMS(inner, anchors: anchors, now: now)
    let der = try DER.decode(innerPayload).dictionary()
    let entitlementData = try Data(contentsOf: root.appendingPathComponent("ios/App/App/App.entitlements"))
    guard let requested = try PropertyListSerialization.propertyList(from: entitlementData, format: nil) as? [String: Any] else { throw GateError.entitlement }
    let uuid = try validateProfile(p, der: der, leaf: leaf, team: team, now: now, requested: requested)
    // Stage only after every check passes. No private-key PEM is ever written.
    let dir = URL(fileURLWithPath: temp).appendingPathComponent("rooom-test2-presign-" + UUID().uuidString)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
    var committed = false; defer { if !committed { try? FileManager.default.removeItem(at: dir) } }
    for (name, bytes) in [("identity.p12", p12), ("profile.mobileprovision", profile)] {
        let file = dir.appendingPathComponent(name); try bytes.write(to: file); try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
    }
    let sha1 = Insecure.SHA1.hash(data: leaf).map { String(format: "%02X", $0) }.joined()
    let expires = min(try CertificateFacts.read(leaf).notAfter, p["ExpirationDate"] as! Date)
    let output = "ROOOM_TEST2_PRESIGN_OK=1\nROOOM_TEST2_IDENTITY_SHA1=\(sha1)\nROOOM_TEST2_PROFILE_UUID=\(uuid)\nROOOM_TEST2_SIGNING_DIR=\(dir.path)\nROOOM_TEST2_P12_SHA256=\(sha256(p12))\nROOOM_TEST2_PROFILE_SHA256=\(sha256(profile))\nROOOM_TEST2_SIGNING_EXPIRES=\(Int(expires.timeIntervalSince1970))\n"
    try require(!dir.path.contains("\n") && !dir.path.contains("\r"), .staging)
    let handle = try FileHandle(forWritingTo: URL(fileURLWithPath: githubEnv)); defer { try? handle.close() }; try handle.seekToEnd(); try handle.write(contentsOf: Data(output.utf8)); committed = true
    print("TEST2 PRESIGN PASS: identity, Apple trust/revocation, CMS/DER, profile and entitlement checks passed; no app signing.")
}

#if !ROOOM_PRESIGN_TESTS
@main struct Main {
    static func main() {
        do {
            try require(CommandLine.arguments.count == 1, .input)
            guard #available(macOS 15.0, *) else { throw GateError.context }
            try runGate(ProcessInfo.processInfo.environment, root: URL(fileURLWithPath: FileManager.default.currentDirectoryPath))
        } catch {
            // Never print underlying CFErrors, subject names, passwords or paths.
            let code = (error as? GateError)?.rawValue ?? "input"
            FileHandle.standardError.write(Data("TEST2 PRESIGN STOP: \(code)\n".utf8)); exit(1)
        }
    }
}
#endif
