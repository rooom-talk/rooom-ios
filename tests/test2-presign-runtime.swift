// Credential-free runtime availability probe; never calls a signing API.
import Foundation
import Security
import Darwin
let paths=["/usr/lib/libCoreTrust.dylib","/System/Library/PrivateFrameworks/CoreTrust.framework/CoreTrust","/usr/lib/libmis.dylib","/usr/lib/libamfi.dylib","/System/Library/PrivateFrameworks/AppleMobileFileIntegrity.framework/AppleMobileFileIntegrity","/System/Library/Frameworks/Security.framework/Security"]
let symbols=["CTEvaluateProvisioningProfile","CTVerifyAmfiCertificateChain"]
for libraryPath in paths {
 if let library=dlopen(libraryPath,RTLD_NOW | RTLD_LOCAL) {
  for symbol in symbols { print("PROFILE RUNTIME: \(libraryPath) \(symbol) available=\(dlsym(library,symbol) != nil)") }
  dlclose(library)
 }else{
  let message=dlerror().map{String(cString:$0)} ?? "no detail"
  print("PROFILE RUNTIME: \(libraryPath) unavailable: \(message)")
 }
}
if let current=dlopen(nil,RTLD_NOW | RTLD_LOCAL) {
 for symbol in symbols { print("PROFILE RUNTIME: process-global \(symbol) available=\(dlsym(current,symbol) != nil)") }
 dlclose(current)
}
