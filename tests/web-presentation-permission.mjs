// Scratch audit harness. Extracts actual product Swift; does not edit it.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync}from 'node:child_process';
const source=fs.readFileSync(new URL('../ios/App/App/RooomImobileBanner.swift',import.meta.url),'utf8');
const start=source.indexOf('    struct WebPresentationPermission {');
const end=source.indexOf('    // End pure document permission.',start);
if(start<0||end<0)throw Error('Permission extraction boundary changed');
const actual=source.slice(start,end);
const harness=String.raw`
func check(_ value: Bool, _ label: String) { precondition(value, label) }
var p = WebPresentationPermission()
let doc = p.documentId
check(p.sequence == 0 && !p.allowed && !p.committed, "initial deny")
check(!p.commit(document: doc, sequence: 0), "cannot commit initial deny")
check(!p.set(document: "old", sequence: 1, allowed: true), "wrong document")
for value in [-1, 0, 1_000_000_000, Int.max] {
    check(!p.set(document: doc, sequence: value, allowed: true), "invalid sequence")
}
check(p.sequence == 0 && !p.allowed && !p.committed, "rejects do not mutate")
check(p.set(document: doc, sequence: 1, allowed: true), "stage new sequence")
check(p.allowed && !p.committed, "stage cannot start SDK")
check(!p.set(document: doc, sequence: 1, allowed: false), "duplicate cannot revoke newer state")
check(!p.commit(document: doc, sequence: 0), "old commit rejected")
check(p.commit(document: doc, sequence: 1), "matching commit")
check(p.allowed && p.committed, "committed permission")
check(p.set(document: doc, sequence: 2, allowed: true) && !p.committed, "new stage resets committed")
check(!p.matches(doc, 1), "old lease cannot match staged sequence")
check(!p.commit(document: doc, sequence: 1), "stale commit after restage")
check(p.set(document: doc, sequence: 3, allowed: false), "explicit deny")
check(!p.commit(document: doc, sequence: 3) && !p.allowed && !p.committed, "deny cannot commit")
p.reset()
check(p.documentId != doc && p.sequence == 0 && !p.allowed && !p.committed, "navigation resets permission")
check(!p.set(document: doc, sequence: 999, allowed: true), "old page cannot grant after navigation")
check(!p.commit(document: doc, sequence: 3), "old page cannot commit after navigation")
print("Independent actual Swift permission assertions PASS; pure state only, not UIKit/device acceptance")
`;
const output=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'rooom-web-presentation-')),'main.swift');
fs.writeFileSync(output,'import Foundation\n'+actual+'\n'+harness);
if(process.platform==='darwin'){execFileSync('swift',[output],{stdio:'inherit'});}else console.log('Swift state fixture generated; execution requires macOS');
