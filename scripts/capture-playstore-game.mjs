import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const directory = 'promotional-video/public/game';
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
const captures = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto('http://127.0.0.1:5173');
await page.getByRole('button', { name: 'New game', exact: true }).waitFor();
const fixture = await page.evaluate(async () => {
  const [engine, storage, catalog] = await Promise.all([import('/src/game/engine.ts'), import('/src/services/storage.ts'), import('/src/data/index.ts')]);
  let state = engine.createGame('Noir Vale', 'leader', 207);
  state.day = 24;
  Object.assign(state.stats, { cash: 175000, reputation: 900, heat: 34, health: 92, energy: 100, influence: 68 });
  state.crew = ['cleo', 'mace', 'nika', 'jin'];
  state.crewLoyalty = { cleo: 92, mace: 88, nika: 94, jin: 85 };
  state.crewInjured = { cleo: 0, mace: 0, nika: 0, jin: 0 };
  state.businesses = ['corner-cafe', 'night-laundry', 'freight-office'].map(id => ({ id, level: 1 }));
  state.inventory = [...new Set(catalog.operations.flatMap(operation => operation.requiredItems))];
  for (const skill of catalog.skillKeys) state.skills[skill] = 6;
  state.counters.jobsAttempted = 46;
  state.counters.jobsSucceeded = 34;
  state.flags = ['intro-event-seen'];
  state.strategy.difficulty = 'hard';
  state.strategy.rewardClaims = { day: 24, energy: 0, cash: 0 };
  Object.assign(state.strategy.zones['foundry-row'], { owner: 'player', control: 85, intel: 90 });
  state.strategy.zones['lantern-walk'].intel = 75;
  state.strategy.counters.zonesCaptured = 1;
  for (const quest of catalog.quests.filter(quest => quest.kind === 'main')) {
    if ((!quest.prerequisite || state.claimedQuests.includes(quest.prerequisite)) && engine.questProgress(state, quest) >= quest.target) {
      state = engine.gameReducer(state, { type: 'CLAIM_QUEST', id: quest.id });
      state = engine.gameReducer(state, { type: 'DISMISS_RESULT' });
    }
  }
  await storage.saveGame(state);
  await storage.saveSettings({ ...storage.defaultSettings, sound: false, music: false, haptics: false, reducedMotion: true });
  return { save: localStorage.getItem('blackline.save.v1'), settings: localStorage.getItem('blackline.settings.v1') };
});
const resume = async () => {
  await page.evaluate(({ save, settings }) => { localStorage.setItem('blackline.save.v1', save); localStorage.removeItem('blackline.save.backup.v1'); localStorage.setItem('blackline.settings.v1', settings); }, fixture);
  await page.reload();
  await page.getByRole('button', { name: 'Continue story', exact: true }).click();
};
const capture = async (name, description) => {
  await page.waitForTimeout(650);
  await page.evaluate(() => document.fonts.ready);
  const measurements = await page.evaluate(() => { const state = JSON.parse(localStorage.getItem('blackline.save.v1')).state; return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, imagesLoaded: [...document.images].every(image => image.complete && image.naturalWidth > 0), stats: state.stats, resultTitle: state.result?.title ?? null, resultEffects: state.result?.effects ?? null }; });
  assert.ok(measurements.scrollWidth <= measurements.width, `${name} has horizontal overflow`);
  assert.equal(measurements.imagesLoaded, true, `${name} has an unloaded image`);
  await page.screenshot({ path: `${directory}/${name}.png` });
  captures.push({ name, description, ...measurements, source: 'actual BLACKLINE UI; isolated fictional progressed save' });
  console.log(`Captured ${name}`);
};

await resume();
await capture('overview', 'Overview with six player statistics and the warehouse opportunity.');
await page.getByRole('button', { name: 'Plan operation', exact: true }).click();
await capture('decision', 'Warehouse operation with real approaches, preparation costs and risk.');
await page.getByRole('button', { name: /Pay an informant/ }).click();
await capture('outcome', 'The actual seeded warehouse outcome after paying for information.');

await resume();
await page.getByRole('button', { name: 'City', exact: true }).last().click();
await page.getByTestId('zone-map').locator('[data-zone-id="lantern-walk"] circle').first().click();
await capture('map', 'All fifteen connected city zones and the selected rival territory.');
await page.getByRole('button', { name: 'Plan attack', exact: true }).click();
await page.getByRole('button', { name: 'Select Ghost', exact: true }).click();
await page.getByRole('button', { name: 'Select Mace', exact: true }).click();
await page.getByRole('button', { name: 'Commit to attack', exact: true }).click();
await capture('battle', 'A real three-round territory battle with momentum, morale and exposure.');

await resume();
await page.getByRole('button', { name: 'Crew', exact: true }).last().click();
await capture('crew', 'Masked crew specialists with loyalty, salary and condition.');
await page.getByRole('button', { name: 'Empire', exact: true }).last().click();
await capture('business', 'Owned businesses and income after payroll.');
await page.getByRole('button', { name: 'Operations', exact: true }).last().click();
await page.getByRole('tab', { name: 'Major ops', exact: true }).click();
await capture('operations', 'The repeatable major operations available for planning.');
await page.locator('.major-operation-card').first().getByRole('button', { name: 'Plan major operation', exact: true }).click();
await page.getByRole('button', { name: 'Select Ghost', exact: true }).click();
await page.getByRole('button', { name: 'Select Drift', exact: true }).click();
await capture('heist-plan', 'Major-operation planning with selected crew and equipment requirements.');
await page.getByRole('button', { name: 'Commit operation', exact: true }).click();
await capture('heist', 'The first Harbor Ledger stage with three meaningful choices.');

await resume();
await page.getByRole('button', { name: 'Quest journal', exact: true }).last().click();
await capture('journal', 'Main story quests, progress and rewards.');
await page.getByRole('tab', { name: 'Side quests', exact: true }).click();
await capture('side-quests', 'The separate side-quest progression path.');
await resume();
await page.getByRole('button', { name: 'Character profile: Noir Vale', exact: true }).click();
await capture('character', 'The fully masked player and six skill progression systems.');

assert.deepEqual(errors, [], 'The reviewed game must not produce JavaScript errors');
await fs.writeFile('output/playstore/game-review.json', JSON.stringify({ game: 'BLACKLINE 1.1.0', createdAt: new Date().toISOString(), viewport: { width: 432, height: 768, deviceScaleFactor: 2.5 }, captures, javascriptErrors: errors }, null, 2) + '\n');
await browser.close();
console.log(`Game review PASS: ${captures.length} genuine screens, loaded artwork and no UI errors.`);
