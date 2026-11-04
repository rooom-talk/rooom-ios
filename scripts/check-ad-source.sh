#!/bin/sh
# Read-only checks plus temporary compiler output. No signing/upload/deployment.
set -eu
cd "$(dirname "$0")/.."
node --test tests/ios-imobile-setup.test.mjs
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT HUP INT TERM
cp tests/ad-policy-main.swift "$work/main.swift"
swiftc ios/App/App/RooomImobileBanner.swift "$work/main.swift" -o "$work/ad-policy"
"$work/ad-policy"
swiftc -frontend -parse -D ROOOM_IMOBILE_ADS ios/App/App/RooomImobileBanner.swift ios/App/App/SceneDelegate.swift
printf '%s\n' 'Source/policy checks passed. NOT an Xcode SDK build or device test.'
