# TEST2 upload train repair

Run 44895171239 archived, signed and exported successfully but Apple rejected marketing version 1.6 (90186/90062). This is independent of the advertisement rail implementation.

TEST2 now selects fresh candidate 1.6.1 after Apple GET verification. The same value feeds MARKETING_VERSION and archived plist verification. Production retains fallback1.6; committed project version, Native generation, advertisement code, signing, increasing build numbers and internal-only export are unchanged.

The conservative guard requires the candidate above every registered iOS App Store version (including drafts) and absent from existing iOS prerelease trains. Existing candidate trains are not automatically reused. Ambiguous records, pagination failures or Apple errors stop before signing. This is a current-record check, not a guarantee of Apple's later upload acceptance; upload repeats it because Apple state can change.

Manual `main.yml` confirmation CHECK_TEST2_VERSION with target_environment=test2 performs only Apple GETs after exact canonical SHA verification. It has no archive/sign/upload path. PR CI executes unit tests without Apple credentials. Production build confirmation and archive defaults are unchanged.

Independent technical agent audit of 6200aac: PASS, 6 unit cases and actual Windows PowerShell entry with mocked I/O PASS. Findings about unsupported prerelease filters and automatic PR secret exposure were fixed. Final fixed canonical Apple read result and command checks are delivered separately; no automatic upload retry is performed.

API references: https://developer.apple.com/documentation/appstoreconnectapi/get-v1-apps-_id_-appstoreversions and https://developer.apple.com/documentation/appstoreconnectapi/get-v1-apps-_id_-prereleaseversions .

## Subsequent TEST2 1.6.2 build preparation (2026-11-22)

After accepted TestFlight1.6.2(100079), a subsequent build must reuse the same prerelease train rather than treating its existence as a closed Store version. PR30 retains candidate1.6.2 and still requires it above every registered iOS App Store version, including drafts. An existing matching iOS prerelease record requires a valid ID/type/platform/version and uniqueness; all pages/errors are checked. The existing independent global build-number maximum check still requires a new number before certificate import. Apple eligibility is re-read on execution; local fixtures and unsigned archives do not establish live Apple acceptance. Old100079-only export-declaration approval is not extended to the new build.

Reference: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/ describes association by bundle/version and unique build string.
