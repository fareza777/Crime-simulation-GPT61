import { _android as android } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const serial = process.env.BLACKLINE_QA_DEVICE ?? 'emulator-5658';
const adbPath = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8', timeout: 15000 });
assert.match(adb('emu', 'avd', 'name'), /blackline_underworld_qa/, 'Only the isolated BLACKLINE QA emulator may be used');
adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
adb('shell', 'wm', 'dismiss-keyguard');
adb('shell', 'settings', 'put', 'system', 'screen_off_timeout', '1800000');
adb('shell', 'am', 'start', '-n', 'com.blackline.crimelife/.MainActivity');
const device = (await android.devices()).find(device => device.serial() === serial);
const firstPage = await (await device.webView({ pkg: 'com.blackline.crimelife' })).page();
// Google ads add their own WebView targets in the same process.
const page = firstPage.context().pages().find(candidate => candidate.url().startsWith('https://localhost/'));
assert.ok(page, 'The game WebView must be selected, rather than an SDK creative');
page.setDefaultTimeout(20000);
await page.waitForFunction(() => Boolean(document.querySelector('.main-menu, .game-shell')));
if (await page.getByRole('button', { name: 'Continue story', exact: true }).isVisible()) {
  await page.getByRole('button', { name: 'Continue story', exact: true }).click();
} else if (await page.getByRole('button', { name: 'New game', exact: true }).isVisible()) {
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await page.getByRole('button', { name: 'Skip introduction' }).click();
  await page.getByRole('button', { name: 'Enter Blackwater' }).click();
}
const snapshots = [];
for (let attempt = 0; attempt < 30; attempt++) {
  const snapshot = await page.evaluate(() => window.Capacitor.Plugins.BlacklineMonetization.getSnapshot());
  snapshots.push(snapshot);
  console.log(JSON.stringify(snapshot));
  if (snapshot.bannerVisible && snapshot.rewardedReady && snapshot.interstitialReady) break;
  await page.waitForTimeout(3500);
}
await fs.mkdir('output/android', { recursive: true });
await fs.writeFile('output/android/ad-inspection.json', JSON.stringify(snapshots, null, 2));
adb('shell', 'screencap', '-p', '/sdcard/blackline-ad-qa.png');
adb('pull', '/sdcard/blackline-ad-qa.png', 'output/screenshots/android-test-banner.png');
await device.close();
