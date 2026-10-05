import { chromium, devices } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// A seeded, fictional veteran makes the advanced screens reproducible.
const browser = await chromium.launch({ headless: true });
await fs.mkdir('output/screenshots', { recursive: true });
await fs.mkdir('output/android', { recursive: true });
const measurements = [];
const mapOnly = process.argv.includes('--map-only');
for (const [label, options] of [
  ['underworld-mobile', { ...devices['Pixel 7'], viewport: { width: 393, height: 851 } }],
  ['underworld-compact', { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } }],
  ['underworld-desktop', { viewport: { width: 1440, height: 1000 } }],
]) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'New game', exact: true }).waitFor();
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await page.getByRole('button', { name: 'Skip introduction' }).click();
  await page.screenshot({ path: `output/screenshots/${label}-creation.png` });
  const fixture = await page.evaluate(async () => {
    const [engine, storage, catalog] = await Promise.all([
      import('/src/game/engine.ts'), import('/src/services/storage.ts'), import('/src/data/index.ts'),
    ]);
    const state = engine.createGame('Noir Vale', 'leader', 207);
    Object.assign(state.stats, { cash: 175000, reputation: 900, heat: 12, energy: 100 });
    state.crew = ['cleo', 'mace', 'nika', 'jin'];
    state.crewLoyalty = { cleo: 95, mace: 95, nika: 95, jin: 95 };
    state.crewInjured = { cleo: 0, mace: 0, nika: 0, jin: 0 };
    state.inventory = [...new Set(catalog.operations.flatMap(operation => operation.requiredItems))];
    for (const skill of catalog.skillKeys) state.skills[skill] = 8;
    state.flags = ['intro-event-seen'];
    state.strategy.zones['foundry-row'].owner = 'player';
    state.strategy.zones['foundry-row'].control = 55;
    await storage.saveGame(state);
    await storage.saveSettings({ ...storage.defaultSettings, sound: false, haptics: false, reducedMotion: true });
    return { save: localStorage.getItem('blackline.save.v1'), settings: localStorage.getItem('blackline.settings.v1') };
  });
  if (label === 'underworld-mobile') await fs.writeFile('output/android/qa-underworld-save.json', JSON.stringify(fixture));
  const resume = async () => {
    await page.evaluate(({ save, settings }) => {
      localStorage.setItem('blackline.save.v1', save);
      localStorage.removeItem('blackline.save.backup.v1');
      localStorage.setItem('blackline.settings.v1', settings);
    }, fixture);
    await page.reload();
    await page.getByRole('button', { name: 'Continue story', exact: true }).click();
  };
  const capture = async name => {
    await page.waitForTimeout(220);
    const bounds = await page.evaluate(() => ({
      width: innerWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
      dialog: document.querySelector('.modal-inner') ? {
        content: document.querySelector('.modal-inner').scrollHeight,
        viewport: document.querySelector('.modal-inner').clientHeight,
      } : null,
    }));
    assert.equal(bounds.overflow, false, `${label} ${name} overflows`);
    measurements.push({ label, screen: name, ...bounds });
    await page.screenshot({ path: `output/screenshots/${label}-${name}.png` });
  };
  await resume();
  await page.getByRole('button', { name: 'Command centre', exact: true }).click();
  await capture('command');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'City', exact: true }).last().click();
  await page.getByTestId('zone-map').locator('[data-zone-id="lantern-walk"] circle').first().click();
  await capture('map');
  if (mapOnly) { assert.deepEqual(errors, []); await context.close(); continue; }
  await page.getByRole('button', { name: 'Plan attack', exact: true }).click();
  await page.getByRole('button', { name: 'Select Ghost', exact: true }).click();
  await page.getByRole('button', { name: 'Select Mace', exact: true }).click();
  await capture('battle-plan');
  await page.getByRole('button', { name: 'Commit to attack', exact: true }).click();
  await capture('battle');
  await resume();
  await page.getByRole('button', { name: 'Operations', exact: true }).last().click();
  await page.getByRole('tab', { name: 'Major ops', exact: true }).click();
  await capture('operations');
  await page.locator('.major-operation-card').first().getByRole('button', { name: 'Plan major operation', exact: true }).click();
  await page.getByRole('button', { name: 'Select Ghost', exact: true }).click();
  await page.getByRole('button', { name: 'Select Drift', exact: true }).click();
  await page.getByRole('button', { name: 'Commit operation', exact: true }).click();
  await capture('operation-stage');
  await resume();
  await page.getByRole('button', { name: 'City', exact: true }).last().click();
  await page.getByRole('tab', { name: 'Rivals', exact: true }).click();
  await capture('rivals');
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await page.getByRole('button', { name: 'Remove ads', exact: true }).click();
  await capture('store');
  assert.deepEqual(errors, [], `${label} has UI exceptions`);
  await context.close();
}
await fs.writeFile(`output/screenshots/${mapOnly ? 'underworld-map-layout' : 'underworld-layout'}.json`, JSON.stringify(measurements, null, 2));
await browser.close();
console.log(`Underworld: ${measurements.length} views captured without horizontal overflow.`);
