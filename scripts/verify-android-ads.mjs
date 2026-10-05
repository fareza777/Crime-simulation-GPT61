import { _android as android } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const serial = process.env.BLACKLINE_QA_DEVICE ?? 'emulator-5658';
const adbPath = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8', timeout: 15000 });
assert.match(adb('emu', 'avd', 'name'), /^blackline_underworld_qa/, 'Only the isolated BLACKLINE emulator may be used');
const device = (await android.devices()).find(candidate => candidate.serial() === serial);
assert.ok(device);
const first = await (await device.webView({ pkg: 'com.blackline.crimelife' })).page();
const page = first.context().pages().find(candidate => candidate.url().startsWith('https://localhost/'));
assert.ok(page, 'Select game, not an ad creative');
page.setDefaultTimeout(20000);
const snapshot = () => page.evaluate(() => window.Capacitor.Plugins.BlacklineMonetization.getSnapshot());
const capture = async name => {
  adb('shell', 'screencap', '-p', '/sdcard/blackline-ad-qa.png');
  const temporary = `output/raw/${name}-${Date.now()}.png`;
  adb('pull', '/sdcard/blackline-ad-qa.png', temporary);
  await fs.copyFile(temporary, `output/screenshots/${name}.png`);
};
const closeAd = async captureName => {
  // Tap only a close/dismiss control observed in the actual native hierarchy.
  // Never click the creative's install, buy or promotional call to action.
  for (let attempt = 0; attempt < 35; attempt++) {
    adb('shell', 'uiautomator', 'dump', '/sdcard/blackline-ad-ui.xml');
    const xml = adb('shell', 'cat', '/sdcard/blackline-ad-ui.xml');
    const nodes = xml.match(/<node\b[^>]+>/g) ?? [];
    const tutorial = nodes.find(node => /resource-id="com.android.systemui:id\/ok"/.test(node) && /text="Got it"/.test(node));
    const close = nodes.find(node => /(?:content-desc|text)="(?:Close ad|Close|Dismiss|close ad|close)"/.test(node)
      && /enabled="true"/.test(node));
    const control = tutorial ?? close;
    if (control) {
      const bounds = control.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      assert.ok(bounds);
      if (!tutorial) await capture(captureName);
      adb('shell', 'input', 'tap', String(Math.round((+bounds[1] + +bounds[3]) / 2)), String(Math.round((+bounds[2] + +bounds[4]) / 2)));
      if (tutorial) { await page.waitForTimeout(600); continue; }
      return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('No enabled ad close control appeared. No promotional control was tapped.');
};
await fs.mkdir('output/raw', { recursive: true });
if (await page.getByRole('button', { name: 'Continue story', exact: true }).isVisible()) {
  await page.getByRole('button', { name: 'Continue story', exact: true }).click();
}
let ready;
for (let attempt = 0; attempt < 60; attempt++) {
  ready = await snapshot();
  if (ready.bannerVisible && ready.rewardedReady && ready.interstitialReady) break;
  if (attempt % 5 === 0) console.log(`Native ads: loading ${JSON.stringify(ready)}`);
  await page.waitForTimeout(3000);
}
assert.ok(ready.bannerVisible && ready.rewardedReady && ready.interstitialReady, 'All official test ad formats must really be ready');
assert.ok(ready.bannerHeight > 0 && ready.bannerHeight <= 90, 'Use a compact anchored adaptive banner, including system inset');
await capture('android-test-banner');
console.log('Native ads: all three test formats loaded and compact banner displayed');
while (await page.evaluate(() => Date.now() - performance.timeOrigin < 122000)) {
  await page.waitForTimeout(3000);
}

// This deliberately probes the native SDK protocol at an eligible day boundary.
// Browser/engine tests independently exercise the real NEXT_DAY eligibility path.
// A rerun may resume the genuine callback retained in this same WebView session.
let interstitial = await page.evaluate(() => window.__blacklineAdProbe?.interstitial);
if (!interstitial?.shown) {
  await page.evaluate(() => {
    window.__blacklineAdProbe = {};
    window.Capacitor.Plugins.BlacklineMonetization.onDayEnd({ day: 4 }).then(result => { window.__blacklineAdProbe.interstitial = result; });
  });
  await page.waitForTimeout(1400);
  assert.match(adb('shell', 'dumpsys', 'activity', 'activities'), /AdActivity/, 'SDK interstitial activity must exist');
  await closeAd('android-test-interstitial');
  await page.waitForFunction(() => window.__blacklineAdProbe.interstitial !== undefined);
  interstitial = await page.evaluate(() => window.__blacklineAdProbe.interstitial);
}
assert.equal(interstitial.shown, true, 'Actual SDK shown/dismissed callback required');
console.log('Native ads: interstitial displayed and dismissed through the SDK');

await page.getByRole('button', { name: 'Command centre', exact: true }).click();
await page.getByRole('button', { name: 'Daily supplies', exact: true }).click();
const readState = () => page.evaluate(async () => JSON.parse((await window.Capacitor.Plugins.Preferences.get({ key: 'blackline.save.v1' })).value).state);
const before = await readState();
assert.ok(before.stats.energy <= 80, 'QA story must have room for +20 energy');
await page.getByRole('button', { name: 'Watch & claim' }).first().click();
await page.waitForTimeout(1400);
assert.match(adb('shell', 'dumpsys', 'activity', 'activities'), /AdActivity/, 'SDK rewarded activity must exist');
await capture('android-test-rewarded');
// Let the official sample's video complete; closing early should grant nothing.
await page.waitForTimeout(35000);
await closeAd('android-test-rewarded');
let after;
for (let attempt = 0; attempt < 40; attempt++) {
  after = await readState();
  if (after.stats.energy === before.stats.energy + 20) break;
  await page.waitForTimeout(500);
}
assert.equal(after.stats.energy, before.stats.energy + 20);
assert.equal(after.strategy.rewardClaims.energy, before.strategy.rewardClaims.energy + 1);
assert.equal(after.stats.cash, before.stats.cash);
// Close the outcome and the supply panel it returns to.
for (let attempt = 0; attempt < 3; attempt++) {
  const close = page.getByRole('button', { name: 'Close dialog', exact: true });
  if (!await close.isVisible()) break;
  await close.click();
  await page.waitForTimeout(400);
}
await page.getByRole('dialog').waitFor({ state: 'hidden' });
await page.waitForTimeout(1500);
await capture('android-test-reward-claimed');
const report = {
  status: 'PASS', serial, testIdsOnly: true, ready,
  interstitial: { shown: interstitial.shown, method: 'native SDK eligible-day protocol probe; actual display and dismissal' },
  rewarded: { method: 'Daily supplies UI; actual SDK earned and dismissed callbacks', energyBefore: before.stats.energy, energyAfter: after.stats.energy, claimsBefore: before.strategy.rewardClaims.energy, claimsAfter: after.strategy.rewardClaims.energy },
  purchases: 'No purchase attempted. Play Console product/key and a licensed tester are required.',
};
await fs.writeFile('output/android/ad-qa.json', JSON.stringify(report, null, 2) + '\n');
await fs.writeFile('output/android/ad-inspection.json', JSON.stringify([ready, interstitial.snapshot, await snapshot()], null, 2) + '\n');
console.log(JSON.stringify(report));
await device.close();
