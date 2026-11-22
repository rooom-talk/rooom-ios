import Foundation
import Security
// Inspection only: never grants signing eligibility or reads a PKCS12 identity.
func inspectSigner(_ data: Data, anchors: [SecCertificate], now: Date) throws -> [String] {
    try require(!data.isEmpty && data.count <= 4_194_304, .cms)
    var raw: CMSDecoder?;try require(CMSDecoderCreate(&raw) == errSecSuccess,.cms)
    guard let decoder=raw else {throw GateError.cms}
    let update=data.withUnsafeBytes{CMSDecoderUpdateMessage(decoder,$0.baseAddress!,$0.count)}
    try require(update == errSecSuccess,.cms);try require(CMSDecoderFinalizeMessage(decoder) == errSecSuccess,.cms)
    var count=0;try require(CMSDecoderGetNumSigners(decoder,&count) == errSecSuccess && count == 1,.cms)
    var status=CMSSignerStatus(rawValue:0)!;var trust:SecTrust?
    try require(CMSDecoderCopySignerStatus(decoder,0,SecPolicyCreateBasicX509(),false,&status,&trust,nil) == errSecSuccess && status == .valid,.cms)
    guard let trust else {throw GateError.cms}
    try evaluate(trust,anchors:anchors,codeSigning:false,now:now)
    var signer:SecCertificate?;try require(CMSDecoderCopySignerCert(decoder,0,&signer) == errSecSuccess,.cms)
    guard let signer, let chain=SecTrustCopyCertificateChain(trust) as? [SecCertificate], !chain.isEmpty else {throw GateError.cms}
    try require(SecCertificateCopyData(signer) as Data == SecCertificateCopyData(chain[0]) as Data,.cms)
    _ = try CertificateFacts.read(SecCertificateCopyData(signer) as Data)
    return chain.map{(SecCertificateCopyData($0) as Data).base64EncodedString()}
}
#if ROOOM_CMS_INSPECTION
@main struct InspectMain {
 static func main(){do{
    try require(CommandLine.arguments.count == 1,.input)
    guard ProcessInfo.processInfo.environment["TARGET_ENV"] == "test2",let encoded=ProcessInfo.processInfo.environment["PROVISIONING_PROFILE_BASE64"] else {throw GateError.context}
    let profile=try base64(encoded), now=Date(), root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath)
    let anchors=try loadAppleRoots(root.appendingPathComponent("scripts/presign-apple-roots"))
    let payload=try verifiedCMS(profile,anchors:anchors,now:now,layer:.outer)
    guard let p=try PropertyListSerialization.propertyList(from:payload,format:nil) as? [String:Any], let inner=p["DER-Encoded-Profile"] as? Data else {throw GateError.profile}
    let evidence=["outer":try inspectSigner(profile,anchors:anchors,now:now),"inner":try inspectSigner(inner,anchors:anchors,now:now)]
    let data=try JSONSerialization.data(withJSONObject:evidence,options:[.sortedKeys])
    // Private pipe to the encryption parent only. Never a workflow console.
    FileHandle.standardOutput.write(data)
 }catch{FileHandle.standardError.write(Data("CMS INSPECTION STOP\n".utf8));exit(1)}}
}
#endif
