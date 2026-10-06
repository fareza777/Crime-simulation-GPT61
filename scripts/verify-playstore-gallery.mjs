import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('http://127.0.0.1:5173/output/playstore/gallery.html');
  assert.equal(response.status(), 200);
  await page.evaluate(async () => { for (const image of document.images) image.loading = 'eager'; await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
  assert.equal(await page.locator('a.screen').count(), 8);
  await page.waitForFunction(() => document.querySelector('video').readyState >= 1);
  const portrait = await page.locator('video').evaluate(video => ({ width: video.videoWidth, height: video.videoHeight, seconds: video.duration }));
  assert.equal(portrait.width, 1080); assert.equal(portrait.height, 1920); assert.ok(Math.abs(portrait.seconds - 36) < .05);
  await page.screenshot({ path: 'output/playstore/review/gallery-desktop.jpg', type: 'jpeg', quality: 92 });
  await page.getByRole('button', { name: 'Landscape · 16:9', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('video').readyState >= 1 && document.querySelector('video').videoWidth === 1920);
  const landscape = await page.locator('video').evaluate(video => ({ width: video.videoWidth, height: video.videoHeight, seconds: video.duration }));
  assert.equal(landscape.width, 1920); assert.equal(landscape.height, 1080); assert.ok(Math.abs(landscape.seconds - 36) < .05);
  assert.equal(await page.getByRole('button', { name: 'Landscape · 16:9', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.locator('video').evaluate(async video => { video.muted = true; video.currentTime = 34.8; await video.play(); });
  await page.waitForFunction(() => document.querySelector('video').currentTime > 35.1);
  await page.locator('video').evaluate(video => video.pause());
  await page.setViewportSize({ width: 393, height: 851 });
  const mobile = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, language: document.documentElement.lang, imagesLoaded: [...document.images].every(image => image.complete && image.naturalWidth > 0) }));
  assert.ok(mobile.scrollWidth <= mobile.width); assert.equal(mobile.language, 'en'); assert.equal(mobile.imagesLoaded, true);
  await page.screenshot({ path: 'output/playstore/review/gallery-mobile.jpg', type: 'jpeg', quality: 92 });
  // The handoff gallery also works directly from disk, with no web server or network.
  const local = await context.newPage();
  local.on('pageerror', error => errors.push(error.message));
  await local.route('http://**/*', route => route.abort());
  await local.route('https://**/*', route => route.abort());
  await local.goto(new URL('../output/playstore/gallery.html', import.meta.url).href);
  await local.evaluate(async () => { for (const image of document.images) image.loading = 'eager'; await Promise.all([...document.images].map(image => image.decode())); });
  await local.waitForFunction(() => document.querySelector('video').readyState >= 1);
  assert.equal(await local.locator('a.screen').count(), 8);
  assert.equal(errors.length, 0, errors.join('\n'));
  await fs.writeFile('output/playstore/review/gallery-validation.json', JSON.stringify({ portrait, landscape, mobile, localFileOffline: true, screenshotLinks: 8, javascriptErrors: errors }, null, 2));
  process.stdout.write('Gallery PASS: eight screenshots, both playable videos, readable phone layout and offline local-file playback.\n');
} finally { await browser.close(); }
