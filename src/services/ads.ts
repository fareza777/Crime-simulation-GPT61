import { monetization, type RewardedPlacement } from './monetization';
export type { RewardedPlacement } from './monetization';
export type InterstitialPlacement = 'day-end';
export interface AdsService {
  isAvailable(): boolean;
  showRewarded(placement: RewardedPlacement): Promise<boolean>;
  showInterstitial(placement: InterstitialPlacement): Promise<boolean>;
}
export class DisabledAdsService implements AdsService {
  isAvailable(): boolean { return false; }
  async showRewarded(_placement: RewardedPlacement): Promise<boolean> { return false; }
  async showInterstitial(_placement: InterstitialPlacement): Promise<boolean> { return false; }
}

let activeService: AdsService = {
  isAvailable: () => monetization.getSnapshot().canRequestAds,
  showRewarded: placement => monetization.showRewarded(placement),
  // Old callers have no completed day number. They cannot bypass the day-end policy.
  showInterstitial: async () => false,
};

/** A stable facade keeps existing callers connected when a published build installs an SDK. */
export const ads: AdsService = {
  isAvailable: () => activeService.isAvailable(),
  showRewarded: placement => activeService.showRewarded(placement),
  showInterstitial: placement => activeService.showInterstitial(placement),
};

/** Only a verified, successfully completed rewarded ad may resolve true. */
export function setAdsService(service: AdsService): void { activeService = service; }
