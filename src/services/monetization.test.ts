import { afterEach, describe, expect, it, vi } from 'vitest';
import { MonetizationController, type NativeMonetizationBridge, type MonetizationSnapshot, type RewardedResult } from './monetization';

function snapshot(overrides: Partial<MonetizationSnapshot> = {}): MonetizationSnapshot {
  return {
    nativeSupported: true, initialized: true, removeAds: false, price: null,
    canRequestAds: true, bannerHeight: 0, bannerVisible: false,
    rewardedReady: true, interstitialReady: true, privacyRequired: false, busy: false, error: null,
    ...overrides,
  };
}

/** Only the slow Android boundary is replaced; policy and completion handling are real. */
function platform(initial = snapshot()) {
  let state = initial;
  let listener: ((value: MonetizationSnapshot) => void) | undefined;
  let resolveReward: ((value: RewardedResult) => void) | undefined;
  let rewardRequest = '';
  let requestedDay: number | undefined;
  const bridge: NativeMonetizationBridge = {
    addListener: async (_event, callback) => { listener = callback; return { remove: async () => { listener = undefined; } }; },
    initialize: async () => state,
    getSnapshot: async () => state,
    setBannerVisible: async ({ visible }) => {
      state = snapshot({ ...state, bannerVisible: visible, bannerHeight: visible ? 54 : 0 });
      return state;
    },
    showRewarded: ({ requestId }) => {
      rewardRequest = requestId;
      return new Promise(resolve => { resolveReward = resolve; });
    },
    onDayEnd: async ({ day }) => { requestedDay = day; return { shown: true, snapshot: state }; },
    buyRemoveAds: async () => ({ purchased: false, snapshot: state }),
    restorePurchases: async () => ({ purchased: state.removeAds, snapshot: state }),
    openPrivacy: async () => state,
  };
  return {
    bridge,
    emit(value: MonetizationSnapshot) { state = value; listener?.(value); },
    completeReward(earned: boolean, dismissed: boolean, requestId = rewardRequest) {
      resolveReward?.({ earned, dismissed, requestId, snapshot: state });
    },
    day: () => requestedDay,
  };
}

afterEach(() => { vi.useRealTimers(); });

describe('native monetization controller', () => {
  it('keeps browser play available without a simulated reward or purchase', async () => {
    const service = new MonetizationController(null);
    await service.initialize();
    await service.setBannerVisible(true);
    expect(service.getSnapshot()).toMatchObject({ nativeSupported: false, initialized: true, removeAds: false, bannerHeight: 0 });
    expect(await service.showRewarded('energy')).toBe(false);
    expect(await service.buyRemoveAds()).toBe(false);
    expect(await service.restorePurchases()).toBe(false);
    expect(await service.onDayEnd(100)).toBe(false);
  });

  it('settles only after an earned reward and safe dismissal', async () => {
    const native = platform();
    const service = new MonetizationController(native.bridge);
    await service.initialize();
    const reward = service.showRewarded('energy');
    expect(service.getSnapshot().busy).toBe(true);
    native.completeReward(true, true);
    expect(await reward).toBe(true);
    expect(service.getSnapshot().busy).toBe(false);
  });

  it.each([[false, true], [true, false], [false, false]])('never grants for earned=%s and dismissed=%s', async (earned, dismissed) => {
    const native = platform();
    const service = new MonetizationController(native.bridge);
    await service.initialize();
    const reward = service.showRewarded('cash');
    native.completeReward(earned, dismissed);
    expect(await reward).toBe(false);
  });

  it('rejects stale request callbacks and excludes parallel fullscreen requests', async () => {
    const native = platform();
    let time = 200_000;
    const service = new MonetizationController(native.bridge, () => time);
    await service.initialize();
    time += 120_000;
    const first = service.showRewarded('energy');
    expect(await service.showRewarded('cash')).toBe(false);
    expect(await service.onDayEnd(4)).toBe(false);
    native.completeReward(true, true, 'an-old-request');
    expect(await first).toBe(false);
  });

  it('uses consent and readiness as a fail-closed ad gate', async () => {
    const native = platform(snapshot({ canRequestAds: false, rewardedReady: false }));
    const service = new MonetizationController(native.bridge);
    await service.initialize();
    await service.setBannerVisible(true);
    expect(service.getSnapshot().bannerVisible).toBe(false);
    expect(await service.showRewarded('energy')).toBe(false);
  });

  it('does not block offline launch while native initialization is unavailable', async () => {
    vi.useFakeTimers();
    const native = platform();
    native.bridge.initialize = () => new Promise(() => {});
    const service = new MonetizationController(native.bridge);
    const start = service.initialize();
    await vi.advanceTimersByTimeAsync(5_001);
    await start;
    expect(service.getSnapshot()).toMatchObject({ initialized: true, busy: false, canRequestAds: false });
    expect(await service.showRewarded('energy')).toBe(false);
  });

  it('handles no-fill and rejected native calls without blocking play', async () => {
    const native = platform();
    native.bridge.showRewarded = async () => { throw new Error('offline'); };
    const service = new MonetizationController(native.bridge);
    await service.initialize();
    expect(await service.showRewarded('energy')).toBe(false);
    expect(service.getSnapshot().busy).toBe(false);
    expect(service.getSnapshot().error).toBeTruthy();
  });

  it('requires day 4, a first-session grace, three-day intervals and two minutes between interstitials', async () => {
    const native = platform();
    let time = 0;
    const service = new MonetizationController(native.bridge, () => time);
    await service.initialize();
    await service.setBannerVisible(true);
    expect(await service.onDayEnd(4)).toBe(false);
    time = 120_000;
    expect(await service.onDayEnd(3)).toBe(false);
    expect(await service.onDayEnd(5)).toBe(true);
    expect(native.day()).toBe(5);
    time = 240_000;
    expect(await service.onDayEnd(5)).toBe(false);
    expect(await service.onDayEnd(7)).toBe(false);
    expect(await service.onDayEnd(8)).toBe(true);
    time = 359_999;
    expect(await service.onDayEnd(11)).toBe(false);
    time = 360_000;
    expect(await service.onDayEnd(12)).toBe(true);
    expect(await service.onDayEnd(12)).toBe(false);
  });

  it('does not replay a missed day-end ad later on resume or a repeated day', async () => {
    const native = platform(snapshot({ interstitialReady: false }));
    let time = 0;
    const service = new MonetizationController(native.bridge, () => time);
    await service.initialize();
    await service.setBannerVisible(true);
    time = 180_000;
    expect(await service.onDayEnd(4)).toBe(false);
    native.emit(snapshot());
    expect(await service.onDayEnd(4)).toBe(false);
    expect(await service.onDayEnd(5)).toBe(true);
  });

  it('never shows an interstitial while gameplay is obscured by a menu or decision', async () => {
    const native = platform();
    let time = 0;
    const service = new MonetizationController(native.bridge, () => time);
    await service.initialize();
    time = 180_000;
    expect(await service.onDayEnd(4)).toBe(false);
    await service.setBannerVisible(true);
    expect(await service.onDayEnd(5)).toBe(true);
    await service.setBannerVisible(false);
    time = 360_000;
    expect(await service.onDayEnd(8)).toBe(false);
  });

  it('removes every ad format immediately when native ownership changes', async () => {
    const native = platform();
    const service = new MonetizationController(native.bridge);
    await service.initialize();
    await service.setBannerVisible(true);
    expect(service.getSnapshot().bannerHeight).toBe(54);
    native.emit(snapshot({ removeAds: true, price: '$4.99', bannerVisible: true, bannerHeight: 54 }));
    expect(service.getSnapshot()).toMatchObject({ removeAds: true, canRequestAds: false, rewardedReady: false, interstitialReady: false, bannerVisible: false, bannerHeight: 0 });
    expect(await service.showRewarded('energy')).toBe(false);
    expect(await service.onDayEnd(100)).toBe(false);
  });

  it('never infers ownership from successful billing launch, pending or cancellation', async () => {
    const native = platform();
    native.bridge.buyRemoveAds = async () => ({ purchased: true, snapshot: snapshot({ removeAds: false }) });
    const service = new MonetizationController(native.bridge);
    await service.initialize();
    expect(await service.buyRemoveAds()).toBe(false);
    expect(service.getSnapshot().removeAds).toBe(false);
  });

  it('restores established native ownership and accepts authoritative revocation', async () => {
    const native = platform(snapshot({ removeAds: true }));
    const service = new MonetizationController(native.bridge);
    await service.initialize();
    expect(await service.restorePurchases()).toBe(true);
    native.emit(snapshot({ removeAds: false }));
    expect(service.getSnapshot().removeAds).toBe(false);
  });

  it('publishes stable snapshots and removes subscription callbacks', async () => {
    const native = platform();
    const service = new MonetizationController(native.bridge);
    let notifications = 0;
    const unsubscribe = service.subscribe(() => { notifications++; });
    await service.initialize();
    const stable = service.getSnapshot();
    expect(service.getSnapshot()).toBe(stable);
    const before = notifications;
    native.emit(snapshot({ privacyRequired: true, bannerHeight: 54, bannerVisible: true }));
    expect(notifications).toBe(before + 1);
    expect(service.getSnapshot().bannerHeight).toBe(54);
    unsubscribe();
    native.emit(snapshot());
    expect(notifications).toBe(before + 1);
  });
});
