import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/game/types';

type FixtureKind = 'progression' | 'quests' | 'custody' | 'heist';
const name = 'Alex Meridian';
const pageErrors = new WeakMap<Page, string[]>();

async function savedGame(page: Page): Promise<GameState> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('blackline.save.v1');
    if (!raw) throw new Error('The current story was not persisted.');
    const parsed = JSON.parse(raw);
    return parsed.state ?? parsed;
  });
}

async function installFixture(page: Page, kind: FixtureKind): Promise<void> {
  await page.evaluate(async ({ fixture, playerName }) => {
    const enginePath = '/src/game/engine.ts';
    const storagePath = '/src/services/storage.ts';
    const catalogPath = '/src/data/index.ts';
    const [engine, storage, catalog] = await Promise.all([
      import(enginePath), import(storagePath), import(catalogPath),
    ]);
    const state = engine.createGame(playerName, 'fixer', 1);
    Object.assign(state.stats, { cash: 150000, reputation: 800, heat: 0, health: 100, energy: 100 });
    for (const skill of catalog.skillKeys) state.skills[skill] = 8;
    state.player.portrait = '/assets/crew-3.webp';
    state.flags = ['intro-event-seen'];
    if (fixture === 'quests') {
      state.day = 3;
      state.counters.jobsSucceeded = 3;
      state.counters.jobsAttempted = 3;
    }
    if (fixture === 'custody') state.jail = { days: 2, reason: 'An unresolved court case.' };
    if (fixture === 'heist') {
      state.crew = ['cleo', 'mace', 'nika'];
      state.crewLoyalty = { cleo: 100, mace: 100, nika: 100 };
      state.crewInjured = { cleo: 0, mace: 0, nika: 0 };
      state.inventory = [...catalog.heist.requiredItems];
    }
    await storage.saveSettings({ ...storage.defaultSettings, sound: false, haptics: false, reducedMotion: true });
    await storage.saveGame(state);
  }, { fixture: kind, playerName: name });
  await page.reload();
  await page.getByRole('button', { name: 'Continue story', exact: true }).click();
  await expect(page.getByRole('button', { name: `Character profile: ${name}`, exact: true })).toBeVisible();
}

async function navigate(page: Page, screen: string): Promise<void> {
  await page.getByRole('button', { name: screen, exact: true }).last().click();
}

/** Resolve visible results and take the authored free exit from any event chain. */
async function drainBarriers(page: Page): Promise<void> {
  for (let step = 0; step < 20; step++) {
    const dialog = page.getByRole('dialog');
    const next = dialog.getByRole('button', { name: 'Continue', exact: true });
    if (await next.isVisible()) {
      await next.click();
      await expect.poll(async () => (await savedGame(page)).result === null).toBe(true);
      continue;
    }
    const state = await savedGame(page);
    if (state.result) {
      await expect(next).toBeVisible();
      continue;
    }
    if (state.pendingEvent) {
      const freeExit = dialog.locator('.event-choice').last();
      await expect(freeExit).toBeVisible();
      await expect(freeExit).toBeEnabled();
      await freeExit.click();
      await expect(next).toBeVisible();
      continue;
    }
    return;
  }
  throw new Error('The result/event chain did not provide a usable exit.');
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => { errors.push(error.message); });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New game', exact: true })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page), 'No uncaught UI exceptions during the journey').toEqual([]);
});

test('recruitment, business ownership, daily payroll and training persist through the UI', async ({ page }) => {
  await installFixture(page, 'progression');
  await navigate(page, 'Crew');
  const recruit = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Ghost', exact: true }) });
  await expect(recruit).toContainText('$1,600 signing fee');
  await recruit.getByRole('button', { name: 'Recruit', exact: true }).click();
  await expect.poll(async () => (await savedGame(page)).crew).toEqual(['cleo']);
  expect((await savedGame(page)).stats.cash).toBe(148400);
  await drainBarriers(page);
  await page.getByRole('tab', { name: /Your crew/ }).click();
  await expect(page.getByRole('heading', { name: 'Ghost', exact: true })).toBeVisible();

  await navigate(page, 'Empire');
  const cafe = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Corner Cafe', exact: true }) });
  await expect(cafe).toContainText('$1,800');
  await cafe.getByRole('button', { name: 'Acquire business', exact: true }).click();
  await expect.poll(async () => (await savedGame(page)).businesses).toEqual([{ id: 'corner-cafe', level: 1 }]);
  expect((await savedGame(page)).stats.cash).toBe(146600);
  await drainBarriers(page);
  await expect(cafe).toContainText('LEVEL 1');

  await navigate(page, 'Overview');
  await page.getByRole('button', { name: 'End day', exact: true }).click();
  const ledger = page.getByRole('dialog', { name: 'End the day', exact: true });
  // $260 base income with business skill 8 gives $315; Cleo earns $90 per day.
  await expect(ledger).toContainText('+$315');
  await expect(ledger).toContainText('−$90');
  await expect(ledger).toContainText('$225');
  await ledger.getByRole('button', { name: 'Begin day 2', exact: true }).click();
  await expect.poll(async () => (await savedGame(page)).day).toBe(2);
  expect((await savedGame(page)).stats.cash).toBe(146825);
  expect((await savedGame(page)).crewLoyalty.cleo).toBe(77);
  await drainBarriers(page);

  await page.getByRole('button', { name: `Character profile: ${name}`, exact: true }).click();
  const charisma = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Charisma', exact: true }) });
  const beforeTraining = await savedGame(page);
  await charisma.getByRole('button', { name: 'Train · $1,700', exact: true }).click();
  await expect.poll(async () => (await savedGame(page)).skills.charisma).toBe(9);
  const trained = await savedGame(page);
  expect(trained.counters.training).toBe(1);
  expect(trained.stats.cash).toBe(beforeTraining.stats.cash - 1700);
  expect(trained.stats.energy).toBe(beforeTraining.stats.energy - 20);
  await drainBarriers(page);

  await page.reload();
  await page.getByRole('button', { name: 'Continue story', exact: true }).click();
  const resumed = await savedGame(page);
  expect(resumed.crew).toEqual(['cleo']);
  expect(resumed.businesses).toEqual([{ id: 'corner-cafe', level: 1 }]);
  expect(resumed.skills.charisma).toBe(9);
});

test('main and side quest rewards survive a real exported-file import', async ({ page }, testInfo) => {
  await installFixture(page, 'quests');
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'A name on the street', exact: true }) }).click();
  const mainQuest = page.locator('article').filter({ has: page.getByRole('heading', { name: 'A name on the street', exact: true }) });
  await mainQuest.getByRole('button', { name: 'Claim reward', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Milestone complete', exact: true })).toContainText('A name on the street');
  await expect.poll(async () => (await savedGame(page)).claimedQuests).toContain('main-first-steps');
  expect((await savedGame(page)).stats.cash).toBe(150900);
  await drainBarriers(page);

  await page.getByRole('tab', { name: 'Side quests', exact: true }).click();
  const sideQuest = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Still standing', exact: true }) });
  await sideQuest.getByRole('button', { name: 'Claim reward', exact: true }).click();
  await expect.poll(async () => (await savedGame(page)).claimedQuests).toEqual(['main-first-steps', 'side-three-days']);
  expect((await savedGame(page)).stats.cash).toBe(151400);
  await drainBarriers(page);
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(sideQuest).toContainText('CLAIMED');
  await page.getByRole('tab', { name: 'Main story', exact: true }).click();
  await expect(mainQuest).toContainText('CLAIMED');

  const expected = await savedGame(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  const downloading = page.waitForEvent('download');
  await settings.getByRole('button', { name: 'Export save', exact: true }).click();
  const download = await downloading;
  const exportedPath = testInfo.outputPath('character-save.json');
  await download.saveAs(exportedPath);
  const raw = await readFile(exportedPath, 'utf8');
  expect(JSON.parse(raw).state).toEqual(expected);

  await settings.getByRole('button', { name: 'Delete local save', exact: true }).click();
  await settings.getByRole('button', { name: 'Delete local save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New game', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue story', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Import save file', { exact: true }).setInputFiles(exportedPath);
  const profile = page.getByRole('button', { name: `Character profile: ${name}`, exact: true });
  await expect(profile).toBeVisible();
  await expect(profile.getByRole('img', { name: 'Your masked character', exact: true })).toHaveAttribute('src', '/assets/crew-3.webp');
  await expect.poll(async () => (await savedGame(page)).player).toEqual(expected.player);
  expect(await savedGame(page)).toEqual(expected);
});

test('posting disclosed bail clears custody and reopens operations', async ({ page }) => {
  await installFixture(page, 'custody');
  await expect(page.locator('.jail-banner')).toContainText('In custody · 2 days remaining');
  await page.getByRole('button', { name: 'Post bail · $2,800', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Back on the street', exact: true })).toBeVisible();
  await expect.poll(async () => (await savedGame(page)).jail).toBeNull();
  expect((await savedGame(page)).stats.cash).toBe(147200);
  await drainBarriers(page);
  await expect(page.locator('.jail-banner')).toHaveCount(0);
  await page.getByRole('button', { name: 'Plan operation', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Plan operation', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await drainBarriers(page);
  expect((await savedGame(page)).pendingJob).toBeNull();
  expect((await savedGame(page)).jail).toBeNull();
});

test('crew selection and four heist stages resume after reloading midway', async ({ page }) => {
  await installFixture(page, 'heist');
  await navigate(page, 'Operations');
  await page.getByRole('button', { name: /The Meridian reserve/ }).click();
  const planning = page.getByRole('dialog', { name: 'Major heist planning', exact: true });
  await planning.getByRole('button', { name: 'Choose your crew', exact: true }).click();
  const ghost = planning.getByRole('button', { name: /Ghost/ });
  const commit = planning.getByRole('button', { name: 'Commit · $15,000', exact: true });
  await expect(ghost).toHaveAttribute('aria-pressed', 'true');
  await ghost.click();
  await expect(commit).toBeDisabled();
  await ghost.click();
  await expect(ghost).toHaveAttribute('aria-pressed', 'true');
  await expect(planning.locator('button[aria-pressed="true"]')).toHaveCount(3);
  await commit.click();
  await expect.poll(async () => (await savedGame(page)).heist?.stage).toBe(0);
  expect((await savedGame(page)).stats.cash).toBe(135000);
  await drainBarriers(page);

  const stageNames = ['Reconnaissance', 'The approach', 'The vault', 'The getaway'];
  const choices = ['Fund thorough preparation', 'Choose the patient approach', 'Deploy the protected reserve', 'Ghost route'];
  const choiceIds = ['patient-terms', 'circle-concession', 'pressure-settle', 'closing-patient'];
  const costs = [2400, 3200, 3500, 2800];
  for (let stage = 0; stage < stageNames.length; stage++) {
    const dialog = page.getByRole('dialog', { name: stageNames[stage], exact: true });
    await expect(dialog).toContainText(`STAGE ${stage + 1} OF 4`);
    const before = await savedGame(page);
    await dialog.getByRole('button', { name: new RegExp(choices[stage]) }).click();
    await expect.poll(async () => (await savedGame(page)).heist?.stage).toBe(stage + 1);
    const after = await savedGame(page);
    expect(after.heist!.choices).toEqual(choiceIds.slice(0, stage + 1));
    expect(after.heist!.successes).toBe(stage + 1);
    expect(after.heist!.crewIds).toEqual(['mace', 'nika', 'cleo']);
    expect(after.stats.energy).toBe(before.stats.energy - 8);
    if (stage < 3) expect(after.stats.cash).toBe(before.stats.cash - costs[stage]);
    else {
      expect(after.heist!.completed).toBe(true);
      expect(after.flags).toContain('heist-completed');
      expect(after.stats.cash).toBeGreaterThanOrEqual(before.stats.cash - costs[stage] + 95000);
      expect(after.stats.cash).toBeLessThanOrEqual(before.stats.cash - costs[stage] + 160000);
      await expect(page.getByRole('dialog', { name: 'The city is yours', exact: true })).toContainText('The Meridian reserve pays out');
    }
    await drainBarriers(page);
    if (stage === 1) {
      const midway = await savedGame(page);
      await page.reload();
      await page.getByRole('button', { name: 'Continue story', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'The vault', exact: true })).toBeVisible();
      expect((await savedGame(page)).heist).toEqual(midway.heist);
      expect((await savedGame(page)).stats.cash).toBe(midway.stats.cash);
    }
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const completed = await savedGame(page);
  expect(completed.stats.reputation).toBe(950);
  await page.reload();
  await page.getByRole('button', { name: 'Continue story', exact: true }).click();
  expect((await savedGame(page)).heist).toEqual(completed.heist);
  expect((await savedGame(page)).stats.cash).toBe(completed.stats.cash);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
