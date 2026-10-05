import { expect, test, type Page } from '@playwright/test';

async function veteran(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New game', exact: true }).waitFor();
  await page.evaluate(async () => {
    const enginePath = '/src/game/engine.ts', storagePath = '/src/services/storage.ts', catalogPath = '/src/data/index.ts';
    const [engine, storage, catalog] = await Promise.all([import(enginePath), import(storagePath), import(catalogPath)]);
    const state = engine.createGame('Noir Vale', 'leader', 207);
    Object.assign(state.stats, { cash: 175000, reputation: 900, heat: 12, energy: 100 });
    state.crew = ['cleo', 'mace', 'nika', 'jin'];
    state.crewLoyalty = { cleo: 95, mace: 95, nika: 95, jin: 95 };
    state.crewInjured = { cleo: 0, mace: 0, nika: 0, jin: 0 };
    state.inventory = [...new Set(catalog.operations.flatMap((operation: { requiredItems: string[] }) => operation.requiredItems))];
    for (const skill of catalog.skillKeys) state.skills[skill] = 8;
    state.flags = ['intro-event-seen'];
    state.strategy.zones['foundry-row'].owner = 'player';
    state.strategy.zones['foundry-row'].control = 55;
    await storage.saveSettings({ ...storage.defaultSettings, sound: false, haptics: false, reducedMotion: true });
    await storage.saveGame(state);
  });
  await page.reload();
  await page.getByRole('button', { name: 'Continue story', exact: true }).click();
}

test('interactive zoning map selects territory without a long phone feed', async ({ page }) => {
  await veteran(page);
  await page.getByRole('button', { name: 'City', exact: true }).last().click();
  await expect(page.getByRole('tab', { name: 'Map', exact: true })).toHaveAttribute('aria-selected', 'true');
  const map = page.getByTestId('zone-map');
  await expect(map).toBeVisible();
  await expect(map.locator('[data-zone-id]')).toHaveCount(15);
  await map.locator('[data-zone-id]').nth(1).click();
  await expect(page.getByRole('button', { name: 'Zone actions', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zone actions', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Zone command' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Scout zone/ })).toBeEnabled();
  await page.getByRole('button', { name: /Scout zone/ }).click();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('committed crew and tactical rounds resume and allow a disclosed retreat', async ({ page }) => {
  await veteran(page);
  await page.getByRole('button', { name: 'City', exact: true }).last().click();
  await page.getByTestId('zone-map').locator('[data-zone-id="lantern-walk"] circle').first().click();
  await page.getByRole('button', { name: 'Plan attack', exact: true }).click();
  const planning = page.getByRole('dialog', { name: 'Plan zone attack' });
  await planning.getByRole('button', { name: 'Select Ghost', exact: true }).click();
  await planning.getByRole('button', { name: 'Select Mace', exact: true }).click();
  await planning.getByRole('button', { name: 'Commit to attack', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Territory battle' })).toBeVisible();
  await page.locator('.battle-choice').first().click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Territory battle' })).toContainText('ROUND 2 / 3');
  await page.reload();
  await page.getByRole('button', { name: 'Continue story', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Territory battle' })).toContainText('ROUND 2 / 3');
  await page.getByRole('button', { name: 'Withdraw crew', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('blackline.save.v1')!).state.strategy.battle)).toBeNull();
});

test('three major-operation stages retain progress after restarting', async ({ page }) => {
  await veteran(page);
  await page.getByRole('button', { name: 'Operations', exact: true }).last().click();
  await page.getByRole('tab', { name: 'Major ops', exact: true }).click();
  await page.locator('.major-operation-card').first().getByRole('button', { name: 'Plan major operation', exact: true }).click();
  const planning = page.getByRole('dialog', { name: 'Plan major operation' });
  await planning.getByRole('button', { name: 'Select Ghost', exact: true }).click();
  await planning.getByRole('button', { name: 'Select Drift', exact: true }).click();
  await planning.getByRole('button', { name: 'Commit operation', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Major operation stage' })).toBeVisible();
  await page.locator('.operation-stage-choices .strategy-choice').first().click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Continue story', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Major operation stage' })).toBeVisible();
  for (let stage = 0; stage < 2; stage++) {
    await page.locator('.operation-stage-choices .strategy-choice').first().click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('blackline.save.v1')!).state.strategy.counters.operationsCompleted)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('owned zones let the player restore weakened control', async ({ page }) => {
  await veteran(page);
  await page.getByRole('button', { name: 'City', exact: true }).last().click();
  await page.getByTestId('zone-map').locator('[data-zone-id="foundry-row"]').click();
  await page.getByRole('button', { name: 'Zone actions', exact: true }).click();
  await expect(page.getByRole('button', { name: /Restore control/ })).toBeEnabled();
  await page.getByRole('button', { name: /Restore control/ }).click();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('blackline.save.v1')!).state);
  expect(saved.strategy.zones['foundry-row'].control).toBeGreaterThan(55);
});

test('command choices explain difficulty and organization priorities', async ({ page }) => {
  await veteran(page);
  await page.getByRole('button', { name: 'Command centre', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Command centre' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Silent', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Silent', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('Remove Ads uses a clear store flow and never fakes a browser payment', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await page.getByRole('button', { name: 'Remove ads', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove ads' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/\$4\.99/).first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Buy|Google Play/ }).first()).toBeDisabled();
  await expect(dialog.getByText(/Android|Google Play/).first()).toBeVisible();
});
