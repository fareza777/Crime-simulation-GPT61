import {_android as android} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const pkg='com.blackline.crimelife';
const serial=process.env.BLACKLINE_QA_DEVICE ?? 'emulator-5658';
const adbPath=path.join(process.env.ANDROID_HOME ?? path.join(process.env.LOCALAPPDATA,'Android','Sdk'),'platform-tools','adb.exe');
const adb=(...args)=>execFileSync(adbPath,['-s',serial,...args],{timeout:15000,encoding:'utf8'});
const capture=async name=>{await page.waitForTimeout(450);adb('shell','screencap','-p','/sdcard/blackline-qa.png');adb('pull','/sdcard/blackline-qa.png',`output/screenshots/${name}.png`);};
console.log('Android: waking QA device');
adb('shell','input','keyevent','KEYCODE_WAKEUP');
adb('shell','wm','dismiss-keyguard');
adb('shell','settings','put','system','screen_off_timeout','1800000');
adb('shell','am','force-stop',pkg);
adb('shell','am','start',`${pkg}/.MainActivity`);
const device=(await android.devices()).find(device=>device.serial()===serial);
if(!device)throw new Error(`Android QA device ${serial} is not running`);
device.setDefaultTimeout(20000);
await fs.mkdir('output/screenshots',{recursive:true});
let page=await(await device.webView({pkg})).page();
page.setDefaultTimeout(20000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.getByRole('button',{name:'New game',exact:true}).waitFor();
// Android WebView can report navigator.onLine=true without any connected network.
// Check Android's actual default network instead of that browser heuristic.
assert.match(adb('shell','dumpsys','connectivity'),/Active default network: none/,'QA requires airplane mode with both mobile data and Wi-Fi disabled');
for(const button of await page.locator('.menu-content button').all()){
  const box=await button.boundingBox();
  assert.ok(box.x>=0&&box.x+box.width<=await page.evaluate(()=>innerWidth),'Menu action is clipped');
}
await capture('android-menu');
console.log('Android: offline menu and bounds verified');
await page.getByRole('button',{name:'New game',exact:true}).click();
await page.getByRole('button',{name:'Skip introduction'}).click();
await page.getByLabel('Your name').fill('Android Vale');
await page.getByRole('button',{name:'Enter Blackwater'}).click();
await page.getByRole('button',{name:'Character profile: Android Vale',exact:true}).waitFor();
await capture('android-overview');
console.log('Android: character created');
for(const name of ['City','Operations','Empire','Crew','Overview']){
  await page.getByRole('button',{name,exact:true}).last().click();
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} overflows`);
  assert.equal(await page.evaluate(()=>Array.from(document.querySelectorAll('img')).every(img=>img.complete&&img.naturalWidth>0)),true,`${name} art is missing`);
}
await page.getByRole('button',{name:'Plan operation',exact:true}).click();
await capture('android-decision');
console.log('Android: navigation and bundled art verified');
await page.getByRole('button',{name:/Pay an informant/}).click();
await page.getByRole('button',{name:'Continue',exact:true}).waitFor();
await page.getByRole('button',{name:'Continue',exact:true}).click();
if(await page.getByRole('dialog').isVisible()){
  await page.getByRole('dialog').getByRole('button').last().click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
}
await page.getByRole('button',{name:'Settings',exact:true}).first().click();
if(await page.getByRole('switch',{name:'Sound effects'}).getAttribute('aria-checked')==='true')await page.getByRole('switch',{name:'Sound effects'}).click();
adb('shell','input','keyevent','KEYCODE_BACK');
await page.getByRole('dialog').waitFor({state:'hidden'});
await page.getByRole('button',{name:'City',exact:true}).last().click();
adb('shell','input','keyevent','KEYCODE_BACK');
await page.getByRole('button',{name:'Plan operation',exact:true}).waitFor();
await page.waitForTimeout(900);
assert.deepEqual(errors,[]);
await fs.writeFile('output/android/native-expect.json',JSON.stringify({stats:await page.locator('.stat-card>strong').allTextContents(),vitals:await page.locator('.mobile-vitals strong').allTextContents()}));
adb('shell','am','force-stop',pkg);
await device.close();
// A new inspector process avoids Playwright retaining the terminated WebView's
// connection. It also proves persistence across a genuinely fresh app process.
console.log(execFileSync(process.execPath,['scripts/verify-android-resume.mjs'],{encoding:'utf8',timeout:45000}));
