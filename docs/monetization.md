# BLACKLINE monetization and Play setup

The October 5, 2026 delivery integrates Google's official Android SDKs through the custom Capacitor plugin `BlacklineMonetization`. Core gameplay and game saves stay offline. Network service initialization is asynchronous and never a launch prerequisite. Browser builds do not simulate ads, earned rewards, or successful payments.

## SDKs and delivered configuration

| Dependency | Pinned version | Primary reference |
| --- | --- | --- |
| Google Mobile Ads (supported Legacy SDK) | `25.5.0` | [SDK release notes](https://developers.google.com/admob/android/rel-notes) |
| Google User Messaging Platform | `4.0.0` | [UMP setup](https://developers.google.com/admob/android/privacy) |
| Google Play Billing | `9.1.0` | [Billing release notes](https://developer.android.com/google/play/billing/release-notes) |
| Java API compatibility on Android API 24/25 | `desugar_jdk_libs:2.1.5` | [Google library changelog](https://github.com/google/desugar_jdk_libs/blob/master/CHANGELOG.md) |

The stable Legacy Mobile Ads SDK remains supported; Google's Next-Gen SDK is the preferred migration path for future work. This integration deliberately uses the supported stable API. No community ad/billing npm plugin, runtime LLM, backend, analytics application, or mediation adapters are added.

`android/app/monetization.properties` supplies both debug and release builds. Both delivered APK and AAB configurations use **official Google demo IDs**, as requested:

| Format | Delivered ID |
| --- | --- |
| AdMob application | `ca-app-pub-3940256099942544~3347511713` |
| Anchored adaptive banner | `ca-app-pub-3940256099942544/9214589741` |
| Interstitial | `ca-app-pub-3940256099942544/1033173712` |
| Rewarded | `ca-app-pub-3940256099942544/5224354917` |

These are Google's [demo units](https://developers.google.com/admob/android/test-ads); they are unrelated to the owner's AdMob account. The app ID is the [official Android sample application ID](https://developers.google.com/admob/android/quick-start). There is no automatic production-ID switch for release builds.

The owner AdMob account now also contains the Android app **Blackline: Crime Simulation** (`com.blackline.crimelife`). Its registered production App ID is `ca-app-pub-6279186647593327~6204605758`, with prepared production units for Banner (`ca-app-pub-6279186647593327/1679037380`), Interstitial (`ca-app-pub-6279186647593327/2800547369`), and Rewarded (`ca-app-pub-6279186647593327/2608975670`). The closed-test build intentionally continues using the demo IDs above. The matching publisher declaration is live at [`app-ads.txt`](https://fareza777.github.io/Crime-simulation-GPT61/app-ads.txt).

## UI contract

`src/services/monetization.ts` exports `monetization`:

```ts
getSnapshot(): MonetizationSnapshot
subscribe(listener: () => void): () => void
initialize(): Promise<void>
setBannerVisible(visible: boolean): Promise<void>
showRewarded(placement: 'energy' | 'cash'): Promise<boolean>
onDayEnd(day: number): Promise<boolean>
buyRemoveAds(): Promise<boolean>
restorePurchases(): Promise<boolean>
openPrivacy(): Promise<void>
```

The immutable, stable snapshot is suitable for React `useSyncExternalStore`. It contains `nativeSupported`, `initialized`, `removeAds`, `price: string | null`, `canRequestAds`, `bannerHeight`, `bannerVisible`, `rewardedReady`, `interstitialReady`, `privacyRequired`, `busy`, and `error: string | null`.

Call `initialize()` without blocking the game. Call `setBannerVisible(true)` only while active gameplay and navigation are unobscured. Set it false on the title screen, menus, help, purchase/restore dialogs, story choices, battle decisions, operation stages, and any other modal. The native plugin remembers the requested placement while consent/loading is pending and enforces its own visibility gate.

The banner uses the standard current-orientation anchored adaptive size at the measured WebView width, preserving more space for portrait gameplay. It is a **native sibling below a weighted WebView**, never a layer over the game. The WebView physically shrinks when the loaded banner becomes visible. `bannerHeight` is the actual measured native container height in CSS pixels/dp, including its system navigation-bar padding, and is zero while hidden or unfilled. **Do not also add this height as CSS padding to the WebView.** That would reserve the same area twice. Native layout changes publish updated height, and pause hides the banner.

Call `onDayEnd(newDay)` only after a completed gameplay day, when the resulting state has no pending decision or modal. Do not call it at app startup, restore, resume, or individual decisions. It requires day 4 or later, at least 3 game days since the previous displayed interstitial, and at least 120 seconds since session start or the previous fullscreen ad. The native layer also enforces these limits with a monotonic clock and preserves the last interstitial day across launches. A missed/no-fill/obscured day-end opportunity is never queued. Rewarded ads reset the timed cooldown too.

`showRewarded()` is an explicit optional action. It returns true only for the matching native request after both Google's earned callback and fullscreen dismissal. Dismissal alone, lifecycle resume/destruction, no fill, missing consent, a timeout, and SDK errors return false. A consumed native ad/session cannot resolve twice. Only one fullscreen request can be active. The UI grants the advertised reward through the engine's capped daily claim action after a true result. Purchased players use the same capped engine claim directly; the service never pretends they watched an ad.

Daily supplies share **one total claim per game day**, choosing **+20 Energy or +$500 Cash**. Taking either closes both choices until **End day**. Remove Ads uses the same allowance without a video. Restarting/restoring a save retains the spent allowance; valid older saves with multiple already-consumed claims remain readable and receive no further supply that day. Full energy and incomplete/unavailable videos do not consume a claim.

The legacy `ads.ts` facade retains its public types and optional service injection. Rewarded calls use this controller by default. Its old interstitial method lacks a day number and always returns false; new UI must use `monetization.onDayEnd(day)`.

## Consent and audio

UMP requests updated consent information on each app launch, presents required forms only while foreground, and gates every ad request through `canRequestAds()`. Errors never fabricate consent. Valid prior-session consent may be used when UMP permits it. If required, the UI must expose the visible **Privacy options** action using `privacyRequired`; `openPrivacy()` opens Google's current options form and discards previously loaded ads before reloading under the new consent state. [Google's UMP workflow](https://developers.google.com/admob/android/privacy) describes these requirements.

If a fresh offline launch leaves consent unavailable, foreground resume retries the update after at least **30 seconds** since its previous attempt, measured with Android's monotonic clock. Opening an eligible gameplay placement with `setBannerVisible(false)` followed by `true` can request the same bounded retry. Repeated `true` updates do not trigger it. Valid consent needs no resume retry, only one update may be in flight, and an active consent form suppresses another update. These requests stay asynchronous; offline gameplay remains available without fabricated consent or rewards.

Demo IDs may have no privacy message configured, so they do not prove a production consent form works. Configure the owner's AdMob Privacy & messaging settings before release. Use UMP's documented test-device/geography settings only in a temporary development configuration to exercise EEA and non-EEA flows; do not force geography or reset production users' consent.

The plugin first initializes Mobile Ads asynchronously, then applies `MobileAds.setAppMuted(true)` and `setAppVolume(0f)` in its guarded completion callback before any ad load or display. SDK 25.5 requires this ordering. Fullscreen display reapplies both settings only after successful initialization. Optional initialization, audio-setting, loading, display, and banner lifecycle SDK failures are caught; initialization failure waits 60 seconds before another attempt, while gameplay continues. Google's [volume settings](https://developers.google.com/admob/android/global-settings) control SDK ad audio eligibility; creative content and user controls remain Google's responsibility. The game does not add music. Network/no-fill errors are non-blocking; unavailable ads give no reward.

## Remove Ads product and payment handling

The product is **`remove_ads`**, an **INAPP non-consumable one-time permanent purchase**. The requested **US base price is US$4.99** is configured and active in the owner's Play Console, with regional prices supplied by Google Play. The UI displays the eligible permanent buy offer's localized `ProductDetails` formatted price when available. Price is null when Play cannot return the product. Product details and ownership are fetched afresh before launching a purchase.

`playBillingPublicKey` in `android/app/monetization.properties` contains this app's Base64-encoded public RSA licensing key from Play Console. It is a public verification key; no service account or private key is included. Google's [client integration guide](https://developer.android.com/google/play/billing/integrate) defines the purchase and acknowledgement flow.

The native plugin checks the package, product, nonempty purchase token, `PURCHASED` state, and the purchase JSON's RSA signature with the configured public key. It grants ownership only after an already acknowledged purchase or successful SDK acknowledgement. It never consumes this product. `PENDING`, cancellation, unverifiable receipts, connection failures, and successful billing-sheet launch alone grant nothing. Pending completion is recovered through purchase updates and subsequent ownership queries.

Established ownership is stored in the app-private native preferences alongside the signed receipt/signature and revalidated on launch. It is excluded from exported/imported game saves and unaffected by starting a new game. Android backup is disabled and explicit backup/device-transfer rules exclude the native entitlement file. A successful current ownership query with no valid owned product clears the entitlement; a network failure preserves established ownership for offline play. Purchases are queried at startup and resume. Removing entitlement through a refund/revocation is reflected after Play returns its current owned-product list.

This is a **client-only verification architecture**. It cannot offer server-strength anti-tamper protection, cross-account entitlement tracking independent of Play, instant offline refund detection, Play Developer API validation, or real-time developer notifications. Rooted/modified clients and delayed Play cache updates are outside its trust boundary. For a production backend, use the [Play verification and fraud guidance](https://developer.android.com/google/play/billing/security), server purchase-token validation and real-time notifications. No backend was requested for this offline game.

## Play Console and license testing

1. Create the Play app with package `com.blackline.crimelife`, configure its signing/upload keys, and upload an appropriately signed internal-testing build. The local release artifact is not a published store app.
2. Verify the active one-time product `remove_ads` with its permanent **buy** purchase option, US base price **US$4.99**, regional prices/tax treatment, and intended test countries.
3. The app's public licensing RSA key is configured in `playBillingPublicKey`; the closed-test build keeps Google's demo ad IDs during testing.
4. Add tester Google accounts to Play Console **License testing** and the internal test track, accept the opt-in link, and install through the test distribution using the licensed account. License testers can also sideload a matching-package debug build once this Play app and product exist. Confirm the payment sheet identifies a test purchase; test-track membership alone does not prevent real charges. See [Google's Billing test guide](https://developer.android.com/google/play/billing/test).
5. Test approved and declined test cards, cancellation/back, pending-payment success and cancellation, acknowledgement, repeat/owned purchase, reinstall/restore, network loss before/after payment, and resume after payment completion. Verify no entitlement while pending, all formats disappear once purchased, and daily supply stays capped.
6. Refund/revoke a test order, reconnect, and resume/restore to verify ownership is removed after Play reflects revocation. Then test established ownership offline; importing a game save must never create ownership.

No charge was attempted during local verification. A sideloaded debug APK with no configured store product/key cannot establish that billing, pricing, account eligibility, signed receipts, or refunds work end to end. JVM/controller tests prove local policy and signature rejection; compilation proves SDK API compatibility. Store-backed scenarios above require the owner's Play Console and license tester.

## Production ID switch and release checklist

Publication is outside this delivery. Before a separately authorized production release, replace all four demo IDs in `android/app/monetization.properties` with the matching owner's AdMob app/banner/interstitial/rewarded IDs, configure the app's UMP messages, and rebuild both variants. Keep development devices registered as test devices when testing live-looking owner units. Review the merged release manifest and generated BuildConfig to verify the intended IDs.

Complete Play's Data safety, ads declaration, target audience/content rating, and privacy policy using Google's current [Mobile Ads disclosure guide](https://developers.google.com/admob/android/privacy/play-data-disclosure). The game uses optional Google ad/consent and payment services that can process device/network and transaction information. Core game progress stays local. Do not retain the former blanket “no network/no data” claim for the Android monetized build. Privacy choices must remain accessible whenever UMP requires them.

Verify portrait placement on physical phones at the smallest supported viewport, status/navigation insets, keyboard, consent forms, pause/resume, screen recreation, offline startup, each ad format, and all licensed payment states. Account setup, console pricing and consent-message validation are owner-controlled release steps, not simulated by the client.

## Local service verification

On October 5, 2026, `npm test -- src/services/monetization.test.ts src/services/ads.test.ts` passed **19/19** tests. These exercise the unavailable browser, consent/no-fill failure, earned plus dismissed completion, stale/parallel reward requests, first-session/day/time interstitial limits, obscured screens, stable subscriptions, native ownership removal of all formats, pending/cancelled ownership rejection, and restore/revocation updates.

`MonetizationPolicyTest` passed **6/6** native JVM tests with Java 21/JUnit, covering bounded consent recovery without duplicate in-flight requests, mandatory launch consent checking with no redundant valid-consent resume retry, cooldown/missed-day policy, reward completion once, valid RSA key/signature verification and tampered/missing key/signature rejection. Final sequential web sync, debug APK, release AAB, Android lint and JVM test tasks completed successfully. Lint reports zero errors. Generated release BuildConfig and merged manifest contain the same official Google test IDs.

The delivered 1.1.0 APK was then exercised on the isolated Android 16 emulator. All three official test formats loaded; the adaptive banner reserved **64dp** below the WebView. A native eligible-day protocol probe displayed and dismissed an interstitial through the SDK. The real Daily supplies UI displayed a muted rewarded sample; the SDK's earned/dismissed callbacks increased energy from **68 to 88**, consumed exactly one daily claim and left cash unchanged. `output/android/ad-qa.json` records the evidence. The sample shows Google's “Test Ad” and “Reward granted” labels. No promotional install button or store payment was clicked.

This verifies local policy, SDK compatibility and test-ad display/callbacks. It does not establish production ad fill, a publisher's configured UMP message or a licensed Play transaction. Offline first launch, native save recovery and v1.0-to-v1.1 upgrade also passed; details and artifact hashes are in the general verification/build reports. No store charge was attempted.
