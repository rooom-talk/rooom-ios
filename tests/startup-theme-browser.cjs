// Real WebKit + shipped bootstrap/CSS; Native color application is NOT emulated
// as proof of UIKit. No remote pages, SDK requests or account data are loaded.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {webkit}=require(process.env.ROOOM_PLAYWRIGHT_MODULE||'playwright');
const swift=fs.readFileSync('ios/App/App/RooomImobileBanner.swift','utf8');
const body=swift.slice(swift.indexOf('enum RooomAdBootstrap')).match(/return """\r?\n([\s\S]*?)\r?\n\s*"""/)[1];
const css=fs.readFileSync(path.join(process.env.ROOOM_WEB_CHECKOUT,'home.css'),'utf8');
function script(tablet){return body.replaceAll('\\(isTablet ? "true" : "false")',String(tablet)).replaceAll('\\\\','\\');}
(async()=>{
 const browser=await webkit.launch({headless:true});
 try {
  const report=[];
  for(const [pathname,tablet,origin] of [['/',true,'https://rooom-talk.com'],['/room.html',true,'https://rooom-talk.com'],['/',false,'https://rooom-talk.com'],['/',true,'https://example.com']]){
   const context=await browser.newContext({viewport:{width:768,height:1024}});
   await context.addInitScript(()=>{window.colorCalls=[];window.webkit={messageHandlers:{rooomMonetization:{postMessage:async m=>{if(m.op==='background')window.colorCalls.push(m.rgb);return {};}}}};});
   await context.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.pathname==='/home.css')return route.fulfill({contentType:'text/css',body:css});
    if(u.pathname.endsWith('native-ipad-modern-room.mjs'))return route.fulfill({contentType:'text/javascript',body:'export async function installNativeIpadModernRoom(){return false}'});
    if(u.pathname.endsWith('page-ad-runtime.mjs'))return route.fulfill({contentType:'text/javascript',body:'export function pageAdvertising(){}'});
    if(u.pathname===pathname)return route.fulfill({contentType:'text/html',body:'<!doctype html><link rel="stylesheet" href="/home.css"><body><main>RoooM</main></body>'});
    return route.abort();
   });
   const page=await context.newPage();await page.goto(origin+pathname);
   await page.evaluate(script(tablet));
   const active=tablet&&origin==='https://rooom-talk.com';
   if(active){
    await page.waitForFunction(()=>colorCalls.length>0);
    assert.deepEqual(await page.evaluate(()=>colorCalls.at(-1)),[239,239,239]);
    await page.evaluate(()=>document.documentElement.classList.add('rooom-dark-theme'));
    await page.waitForFunction(()=>colorCalls.at(-1)?.[0]===23);
    assert.deepEqual(await page.evaluate(()=>colorCalls.at(-1)),[23,23,23]);
    await page.setViewportSize({width:1024,height:768});
    await page.setViewportSize({width:768,height:1024});
    await page.evaluate(()=>document.body.classList.add('rooom-keyboard-open'));
    await page.evaluate(()=>document.documentElement.classList.remove('rooom-dark-theme'));
    await page.waitForFunction(()=>colorCalls.at(-1)?.[0]===239);
    await page.evaluate(script(tablet)); // existing one-owner marker prevents duplicate listeners
    assert.equal(await page.evaluate(()=>window.__rooomNativeRailBackgroundSync),true);
   }else assert.deepEqual(await page.evaluate(()=>colorCalls),[]);
   report.push({pathname,tablet,origin,pass:true});await context.close();
  }
  console.log(JSON.stringify({kind:'Web color protocol only; not UIKit launch/rotation',report},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
