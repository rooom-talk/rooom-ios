// No SDK, credentials, network, device preferences or deployed pages are used.
// Node exercises the shipped JavaScript template. macOS also compiles the real
// policy/seed/installer and executes documentStart in an actual WKWebView.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp from 'node:child_process';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../ios/App/App/RooomImobileBanner.swift', import.meta.url), 'utf8');
const foundation = source.slice(0, source.indexOf('#if ROOOM_IMOBILE_ADS'));
const seed = source.slice(source.indexOf('enum RooomPhoneSurfaceBootstrap {')).trim();
assert.ok(seed.startsWith('enum RooomPhoneSurfaceBootstrap {'));
const markerLiteral = seed.match(/static let marker = ("(?:[^"\\]|\\.)*")/);
assert.ok(markerLiteral, 'Actual Swift seed marker must be extracted');
const marker = JSON.parse(markerLiteral[1]);
const template = seed.match(/return marker \+ """\r?\n([\s\S]*?)\r?\n\s*"""/);
assert.ok(template, 'Actual Swift multiline JavaScript must be extracted');
assert.deepEqual([...template[1].matchAll(/\\\(([^)]*)\)/g)].map(m => m[1]), ['height', 'height']);
const script = height => marker + template[1].replaceAll('\\(height)', String(height));

function block(text, signature) {
  const begin = text.indexOf(signature);
  assert.ok(begin >= 0, `Actual method is missing: ${signature}`);
  const start = text.indexOf('{', begin);
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) return text.slice(begin, i + 1);
  }
  throw Error(`Unclosed actual method: ${signature}`);
}
const install = block(source, 'func installPhoneSurfaceSeed(_ config: RooomAdConfig)');

function execute({ height = 50, origin = 'https://rooom-talk.com', pathname = '/', main = true, rootPresent = true } = {}) {
  const attributes = new Map(), styles = new Map(), observers = [];
  const root = { setAttribute: (key, value) => attributes.set(key, value), style: { setProperty: (key, value) => styles.set(key, value) } };
  const document = { documentElement: rootPresent ? root : null };
  const window = {};
  window.top = main ? window : {};
  class MutationObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(target, options) { assert.equal(target, document); assert.equal(options.childList, true); this.observing = true; }
    disconnect() { this.disconnected = true; }
  }
  vm.runInNewContext(script(height), { window, location: { origin, pathname }, document, MutationObserver }, { timeout: 1000 });
  return { attributes, styles, observers, attachRoot() { document.documentElement = root; observers.forEach(item => item.callback()); } };
}

test('shipped seed sets full canvas and geometry before any Web module or CSS exists', () => {
  for (const [pathname, page] of [['/', 'home'], ['/index.html', 'home'], ['/room.html', 'room']]) {
    for (const height of [0, 50, 100, 137]) {
      const result = execute({ pathname, height });
      assert.equal(result.attributes.get('data-rooom-phone-full-canvas'), page);
      assert.equal(result.attributes.get('data-rooom-phone-ad-overlay'), height > 0 ? page : undefined);
      assert.equal(result.styles.get('--rooom-phone-ad-occupied-bottom'), height > 0 ? `calc(${height}px + var(--rooom-safe-bottom, env(safe-area-inset-bottom, 0px)))` : undefined);
      assert.equal(result.observers.length, 0);
    }
  }
});

test('shipped documentStart script handles a missing root and disconnects after its first creation', () => {
  const result = execute({ height: 75, pathname: '/room.html', rootPresent: false });
  assert.equal(result.attributes.size, 0);
  assert.equal(result.observers.length, 1);
  assert.equal(result.observers[0].observing, true);
  result.observers[0].callback();
  assert.equal(result.observers[0].disconnected, false);
  result.attachRoot();
  assert.equal(result.attributes.get('data-rooom-phone-full-canvas'), 'room');
  assert.match(result.styles.get('--rooom-phone-ad-occupied-bottom'), /^calc\(75px /);
  assert.equal(result.observers[0].disconnected, true);
});

test('shipped seed does not affect other origins, other routes, or even same-origin child frames', () => {
  for (const options of [
    { origin: 'https://example.com' }, { origin: 'http://rooom-talk.com' },
    { origin: 'https://rooom-talk.com:444' }, { origin: 'https://rooom-talk.com.evil.test' },
    { origin: 'null' }, { pathname: '/help.html' }, { pathname: '/room.html/' },
    { main: false }, { main: false, origin: 'https://example.com', rootPresent: false }
  ]) {
    const result = execute(options);
    assert.equal(result.attributes.size, 0, JSON.stringify(options));
    assert.equal(result.styles.size, 0, JSON.stringify(options));
    assert.equal(result.observers.length, 0, JSON.stringify(options));
  }
});

test('actual installer is main-frame documentStart and seed generation validates the complete config', () => {
  assert.match(install, /UIDevice\.current\.userInterfaceIdiom == \.phone/);
  assert.match(install, /WKUserScript\(source: source, injectionTime: \.atDocumentStart, forMainFrameOnly: true\)/);
  assert.match(seed, /let valid = \(try\? config\.validated\(\)\) \?\? \.off/);
  assert.match(seed, /valid\.enabled && valid\.fixed/);
  assert.match(seed, /\$0\.device == "phone" && \$0\.role == "phone\.bottom"/);
  assert.match(seed, /\(valid\.presentation \?\? \.standard\)\.bottomGap/);
  assert.doesNotMatch(seed, /fetch\(|XMLHttpRequest|import\(|postMessage|localStorage|UserDefaults|ImobileSdkAds/);
});

const harness = fs.readFileSync(new URL('./wk-phone-surface-main.swift', import.meta.url), 'utf8');
const program = foundation + '\n' + seed + String.raw`
import Cocoa
import WebKit
enum TestIdiom { case phone, pad }
final class UIDevice { static let current = UIDevice(); var userInterfaceIdiom = TestIdiom.phone }
final class SurfaceBridge { let webView: WKWebView?; init(_ web: WKWebView) { webView = web } }
final class SurfaceController {
    var bridge: SurfaceBridge?
    init(_ web: WKWebView) { bridge = SurfaceBridge(web) }
` + install + '\n}\n' + harness;

test('actual Swift enum and installer: WK documentStart, delayed CSS, ON/OFF, navigation, script identity, frame boundaries', {
  skip: process.platform !== 'darwin' ? 'Requires macOS Swift and real WKWebView; Node template boundaries run on all platforms' : false,
  timeout: 120000
}, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rooom-phone-full-canvas-'));
  try {
    const input = path.join(directory, 'main.swift'), executable = path.join(directory, 'phone-surface');
    fs.writeFileSync(input, program);
    for (const [label, command, args] of [['compile', 'swiftc', [input, '-o', executable]], ['real-wk', executable, []]]) {
      const started = Date.now();
      console.log(`PHONE SURFACE ${label} START ${JSON.stringify({ command, args, platform: process.platform, arch: process.arch })}`);
      const result = cp.spawnSync(command, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 });
      const diagnostic = {
        label, command, args, pid: result.pid, status: result.status, signal: result.signal,
        elapsedMs: Date.now() - started,
        error: result.error ? { name: result.error.name, message: result.error.message, code: result.error.code, errno: result.error.errno, syscall: result.error.syscall } : null
      };
      console.log(`PHONE SURFACE ${label} END ${JSON.stringify(diagnostic)}`);
      if (result.stdout) console.log(result.stdout.trim());
      if (result.stderr) console.error(result.stderr.trim());
      assert.equal(result.status, 0, `${JSON.stringify(diagnostic)}\nstdout:\n${result.stdout || '(empty)'}\nstderr:\n${result.stderr || '(empty)'}`);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
