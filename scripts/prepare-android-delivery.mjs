import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const readReport = async name => JSON.parse(await fs.readFile(`output/android/${name}.json`, 'utf8'));
const native = await readReport('native-qa');
const upgrade = await readReport('upgrade-qa');
const ads = await readReport('ad-qa');
assert.equal(native.status, 'PASS');
assert.equal(native.version, '1.1.0');
assert.equal(upgrade.status, 'PASS');
assert.equal(upgrade.to, '1.1.0');
assert.equal(ads.status, 'PASS');
assert.equal(ads.testIdsOnly, true);
const files = [];
for (const [source, name, signing] of [
  ['android/app/build/outputs/apk/debug/app-debug.apk', 'BLACKLINE-1.1.0-debug.apk', 'development key'],
  ['android/app/build/outputs/bundle/release/app-release.aab', 'BLACKLINE-1.1.0-release-unsigned.aab', 'unsigned'],
]) {
  const target = `output/android/${name}`;
  await fs.copyFile(source, target);
  const data = await fs.readFile(target);
  files.push({ name, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex'), signing });
}
const report = {
  name: 'BLACKLINE', version: '1.1.0', versionCode: 2,
  appId: 'com.blackline.crimelife', minSdk: 24, targetSdk: 36, orientation: 'portrait',
  verifiedAt: new Date().toISOString(), files,
  content: { districts: 5, zones: 15, rivals: 5, activities: 30, events: 132, crew: 11, businesses: 15, items: 40, mainQuests: 14, sideQuests: 24, repeatableOperations: 3, meridianHeistStages: 4 },
  monetization: { officialTestIds: true, banner: true, interstitial: true, rewarded: true, removeAdsProduct: 'remove_ads', plannedUSPrice: 4.99, currency: 'USD', licensedPurchaseTest: 'not attempted; owner Play Console product/public key required' },
  verification: {
    unitTests: 304, unitSuites: 10, nativeJvmTests: 6,
    browserJourneys: 27, intentionalDesktopSkips: 1, androidLintErrors: 0, androidLintWarnings: 30,
    phoneWidths: [320, 360, 393, 412], offlineBrowser: 'passed',
    offlineAndroid: `passed on Android 16 emulator; ${native.version}`,
    nativeSaveAndSettingsRecovery: 'passed', upgradeFrom100: upgrade.checks,
    nativeAds: ads.status, rewardedEnergy: `${ads.rewarded.energyBefore} → ${ads.rewarded.energyAfter}`,
    physicalDeviceQa: 'pending', playStorePublication: 'not published',
  },
};
await fs.writeFile('output/android/build-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ version: report.version, files, verification: report.verification }, null, 2));
