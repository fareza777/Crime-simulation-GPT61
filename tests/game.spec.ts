import { test, expect } from '@playwright/test';

test('phone menus keep every action inside the screen at small and large widths', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile', 'Phone layout coverage');
  for (const size of [{width:320,height:640},{width:360,height:800},{width:393,height:851},{width:412,height:915}]) {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.getByRole('button', {name:'New game',exact:true}).waitFor();
    for (const button of await page.locator('.menu-content button').all()) {
      const box = await button.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x+box!.width).toBeLessThanOrEqual(size.width);
    }
    const headingRight = await page.locator('.menu-content h1').evaluate(el => {
      const range = document.createRange();range.selectNodeContents(el);
      return range.getBoundingClientRect().right;
    });
    expect(headingRight).toBeLessThanOrEqual(size.width);
  }
});

test('a new character can resolve an operation and resume the local save', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await page.getByRole('button', { name: 'Skip introduction' }).click();
  await page.getByLabel('Your name').fill('Alex Vale');
  await page.getByRole('button', { name: 'Enter Blackwater' }).click();
  await expect(page.getByRole('button', { name: 'Character profile: Alex Vale', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Plan operation', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /Pay an informant/ }).click();
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const event = page.getByRole('dialog');
  if (await event.isVisible()) {
    await event.getByRole('button').last().click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await page.reload();
  await page.getByRole('button', { name: 'Continue story', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Character profile: Alex Vale', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('damaged settings recover without hiding an intact saved story', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await page.getByRole('button', { name: 'Skip introduction' }).click();
  await page.getByRole('button', { name: 'Enter Blackwater' }).click();
  await page.waitForFunction(() => Boolean(localStorage.getItem('blackline.save.v1')));
  await page.evaluate(() => localStorage.setItem('blackline.settings.v1', 'damaged settings'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue story', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue story', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Character profile: Alex Vale', exact: true })).toBeVisible();
});

test('all screens fit the viewport and settings persist', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await page.getByRole('button', { name: 'Skip introduction' }).click();
  await page.getByRole('button', { name: 'Enter Blackwater' }).click();
  for (const nav of ['City', 'Operations', 'Empire', 'Crew', 'Overview']) {
    await page.getByRole('button', { name: nav, exact: true }).last().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(page.getByRole('button', { name: 'Quest journal', exact: true }).last()).toBeVisible();
  if (test.info().project.name === 'mobile') {
    expect(await page.locator('.featured-body > .button').evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(13);
    const bounds = await page.locator('.quick-actions').boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 851) - 65);
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await page.getByRole('switch', { name: 'Sound effects' }).click();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await expect(page.getByRole('switch', { name: 'Sound effects' })).toHaveAttribute('aria-checked', 'false');
});
