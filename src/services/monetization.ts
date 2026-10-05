import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type RewardedPlacement = 'energy' | 'cash';
export interface MonetizationSnapshot {
  nativeSupported: boolean; initialized: boolean; removeAds: boolean; price: string | null;
  canRequestAds: boolean; bannerHeight: number; bannerVisible: boolean;
  rewardedReady: boolean; interstitialReady: boolean; privacyRequired: boolean; busy: boolean; error: string | null;
}
export interface RewardedResult { earned: boolean; dismissed: boolean; requestId: string; snapshot: MonetizationSnapshot }
export interface PurchaseResult { purchased: boolean; snapshot: MonetizationSnapshot }
export interface NativeMonetizationBridge {
  addListener(event: 'stateChanged', listener: (snapshot: MonetizationSnapshot) => void): Promise<PluginListenerHandle>;
  initialize(): Promise<MonetizationSnapshot>;
  getSnapshot(): Promise<MonetizationSnapshot>;
  setBannerVisible(options: { visible: boolean }): Promise<MonetizationSnapshot>;
  showRewarded(options: { placement: RewardedPlacement; requestId: string }): Promise<RewardedResult>;
  onDayEnd(options: { day: number }): Promise<{ shown: boolean; snapshot: MonetizationSnapshot }>;
  buyRemoveAds(): Promise<PurchaseResult>;
  restorePurchases(): Promise<PurchaseResult>;
  openPrivacy(): Promise<MonetizationSnapshot>;
}
const disabled: MonetizationSnapshot = { nativeSupported: false, initialized: false, removeAds: false, price: null, canRequestAds: false, bannerHeight: 0, bannerVisible: false, rewardedReady: false, interstitialReady: false, privacyRequired: false, busy: false, error: null };
const COOLDOWN_MS = 120_000;

async function bounded<T>(work: Promise<T>, duration = 5_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Service timeout')), duration);
    })]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Network services never own the game reducer or its saved entitlement. */
export class MonetizationController {
  private snapshot: MonetizationSnapshot;
  private nativeSnapshot: MonetizationSnapshot;
  private readonly listeners = new Set<() => void>();
  private initialization: Promise<void> | null = null;
  private operation = false;
  private requestSequence = 0;
  private seenDay = 0;
  private lastInterstitialDay: number | null = null;
  private lastFullscreenAt: number;
  private desiredBanner = false;

  constructor(private readonly bridge: NativeMonetizationBridge | null, private readonly now: () => number = Date.now) {
    this.snapshot = Object.freeze({ ...disabled, nativeSupported: bridge !== null });
    this.nativeSnapshot = this.snapshot;
    this.lastFullscreenAt = now();
  }

  getSnapshot = (): MonetizationSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(value: MonetizationSnapshot): void {
    this.nativeSnapshot = value;
    const removeAds = value.removeAds === true;
    const allowed = this.bridge !== null && value.canRequestAds === true && !removeAds;
    const bannerVisible = allowed && value.bannerVisible === true && !this.operation && value.busy !== true;
    const next: MonetizationSnapshot = Object.freeze({
      nativeSupported: this.bridge !== null,
      initialized: value.initialized === true,
      removeAds,
      price: typeof value.price === 'string' && value.price.length > 0 ? value.price : null,
      canRequestAds: allowed,
      bannerVisible,
      bannerHeight: bannerVisible && Number.isFinite(value.bannerHeight) && value.bannerHeight > 0 ? value.bannerHeight : 0,
      rewardedReady: allowed && value.rewardedReady === true,
      interstitialReady: allowed && value.interstitialReady === true,
      privacyRequired: value.privacyRequired === true,
      busy: this.operation || value.busy === true,
      error: typeof value.error === 'string' ? value.error : null,
    });
    if (Object.keys(next).every(key => next[key as keyof MonetizationSnapshot] === this.snapshot[key as keyof MonetizationSnapshot])) return;
    this.snapshot = next;
    this.listeners.forEach(listener => listener());
  }

  initialize(): Promise<void> {
    if (this.initialization) return this.initialization;
    this.initialization = this.start();
    return this.initialization;
  }

  private async start(): Promise<void> {
    if (!this.bridge) { this.publish({ ...disabled, initialized: true }); return; }
    try {
      // The singleton subscribes for the lifetime of the WebView. Android releases
      // the listener and SDK resources when that WebView is destroyed.
      await bounded(this.bridge.addListener('stateChanged', value => { this.publish(value); }));
      this.publish(await bounded(this.bridge.initialize()));
      if (this.desiredBanner) void this.setBannerVisible(true);
    } catch {
      this.publish({ ...this.nativeSnapshot, initialized: true, canRequestAds: false, busy: false, error: 'Optional Google services are unavailable. You can keep playing offline.' });
    }
  }

  async setBannerVisible(visible: boolean): Promise<void> {
    this.desiredBanner = visible;
    if (!this.bridge || !this.snapshot.initialized) return;
    try {
      // Native remembers the placement intention while consent/network loading
      // is pending and independently enforces eligibility before showing it.
      this.publish(await bounded(this.bridge.setBannerVisible({ visible })));
    } catch {
      this.publish({ ...this.nativeSnapshot, bannerVisible: false, bannerHeight: 0 });
    }
  }

  private begin(): boolean {
    if (!this.bridge || !this.snapshot.initialized || this.snapshot.busy) return false;
    this.operation = true;
    this.publish({ ...this.nativeSnapshot, error: null });
    return true;
  }

  private finish(): void {
    this.operation = false;
    this.publish(this.nativeSnapshot);
  }

  async showRewarded(placement: RewardedPlacement): Promise<boolean> {
    if ((placement !== 'energy' && placement !== 'cash') || !this.snapshot.canRequestAds || !this.snapshot.rewardedReady || !this.begin()) return false;
    const requestId = `reward-${this.now()}-${++this.requestSequence}`;
    try {
      const result = await bounded(this.bridge!.showRewarded({ placement, requestId }), 180_000);
      this.publish(result.snapshot);
      this.lastFullscreenAt = this.now();
      return result.requestId === requestId && result.earned === true && result.dismissed === true && !this.snapshot.removeAds;
    } catch {
      this.publish({ ...this.nativeSnapshot, error: 'The ad was unavailable or did not complete. No reward was claimed.' });
      return false;
    } finally { this.finish(); }
  }

  /** Call only once after a completed gameplay day; misses are never queued. */
  async onDayEnd(day: number): Promise<boolean> {
    if (!Number.isSafeInteger(day) || day <= this.seenDay) return false;
    this.seenDay = day;
    if (day < 4 || this.now() - this.lastFullscreenAt < COOLDOWN_MS || (this.lastInterstitialDay !== null && day - this.lastInterstitialDay < 3)
      || !this.snapshot.canRequestAds || !this.snapshot.interstitialReady || !this.desiredBanner || !this.begin()) return false;
    try {
      const result = await bounded(this.bridge!.onDayEnd({ day }), 180_000);
      this.publish(result.snapshot);
      if (result.shown === true) {
        this.lastInterstitialDay = day;
        this.lastFullscreenAt = this.now();
        return true;
      }
      return false;
    } catch { return false; }
    finally { this.finish(); }
  }

  async buyRemoveAds(): Promise<boolean> { return this.purchase(false); }
  async restorePurchases(): Promise<boolean> { return this.purchase(true); }

  private async purchase(restore: boolean): Promise<boolean> {
    if (!this.begin()) return false;
    try {
      const result = await bounded(restore ? this.bridge!.restorePurchases() : this.bridge!.buyRemoveAds(), restore ? 15_000 : 180_000);
      this.publish(result.snapshot);
      return result.purchased === true && this.snapshot.removeAds;
    } catch {
      this.publish({ ...this.nativeSnapshot, error: restore ? 'Google Play could not check purchases. Existing offline ownership is preserved.' : 'Google Play did not confirm ownership. Restore purchases when connected.' });
      return false;
    } finally { this.finish(); }
  }

  async openPrivacy(): Promise<void> {
    if (!this.snapshot.privacyRequired || !this.begin()) return;
    try { this.publish(await bounded(this.bridge!.openPrivacy(), 180_000)); }
    catch { this.publish({ ...this.nativeSnapshot, error: 'Privacy options could not load. Please try again when connected.' }); }
    finally { this.finish(); }
  }
}

const android = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('BlacklineMonetization');
export const monetization = new MonetizationController(android ? registerPlugin<NativeMonetizationBridge>('BlacklineMonetization') : null);
