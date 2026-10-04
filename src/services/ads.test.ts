import { afterEach, describe, expect, it } from 'vitest';
import { ads, DisabledAdsService, setAdsService, type AdsService } from './ads';

afterEach(() => { setAdsService(new DisabledAdsService()); });

describe('optional advertising', () => {
  it('never grants a reward when advertising is disabled', async () => {
    let earned = 0;
    const disabled = new DisabledAdsService();
    if (await disabled.showRewarded('energy')) earned += 20;
    if (await disabled.showRewarded('cash')) earned += 100;
    expect(disabled.isAvailable()).toBe(false);
    expect(earned).toBe(0);
    expect(await disabled.showInterstitial('day-end')).toBe(false);
  });

  it('uses the disabled service for the default app integration', async () => {
    expect(ads.isAvailable()).toBe(false);
    expect(await ads.showRewarded('energy')).toBe(false);
  });

  it('delegates completion results when a real service is explicitly installed', async () => {
    const completed: string[] = [];
    const service: AdsService = {
      isAvailable: () => true,
      showRewarded: async placement => { completed.push(placement); return placement === 'energy'; },
      showInterstitial: async () => false,
    };
    setAdsService(service);
    expect(ads.isAvailable()).toBe(true);
    expect(await ads.showRewarded('energy')).toBe(true);
    expect(await ads.showRewarded('cash')).toBe(false);
    expect(completed).toEqual(['energy', 'cash']);
  });
});
