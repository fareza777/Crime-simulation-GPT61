# Verification record — BLACKLINE 1.1.0

Verified on 5 October 2026. This records the delivered local build, not a published Play release or a claim that every physical phone has been tested.

## Game rules and saves

`npm test`: **307 passed**, across **10 suites**. These cover the catalogue (5 districts, 15 zones, 5 rival organizations, 30 activities, 132 events, 11 crew, 15 businesses, 40 items and 38 quests), existing jobs/Heat/police/jail/progression, the four-stage Meridian heist, and three repeatable three-stage operations.

Strategy cases exercise attack previews and resource costs, three tactical rounds, morale/exposure/injury/fatigue, retreat, committed crew locks, operation planning and setbacks, equipment and skill requirements, rival retaliation, supply connectivity, lieutenants, fortification, truces, agendas, difficulty, daily income/upkeep and capped supply claims. Validation rejects forged, malformed or conflicting pending states. Old v1 saves without strategy migrate without losing their story. New catalogue zone/rival IDs still require an explicit migration; see the expansion guide.

The independent audit also explored 46,656 operation combinations and checked the UI against the real selectors. Demonstrated issues were repaired: restoring owned-zone control became accessible, map ownership rings stopped covering labels, and the Force approach now describes its actual momentum benefit. Encounter choices expose energy, momentum/progress, morale/exposure/suspicion and injury implications, with concise optional setback/withdrawal help.

Native cache migration tests cover retiring a legacy worker, preserving unrelated storage, blocking cached application scripts during deferred cleanup, reloading despite a controller that disappears during cleanup, clean installs, and a recoverable retry screen even before an HTML element exists. Preferences, game saves, settings and purchase ownership are never cleared by that migration.

## Browser journeys and phone layout

`npm run test:e2e`: **29 passed, 1 intentional desktop skip**. Desktop uses 1440 × 1000; phone uses 393 × 851. The skip is the desktop duplicate of a phone-only width test. Both layouts verify that a consumed daily supply closes both reward choices after restarting.

Journeys exercise creation/job/event/reload, damaged settings, all five screens, crew and business income/payroll, training, main/side quest claims, actual save download/delete/import, custody and bail, all four Meridian stages, zone selection/scouting, restoring owned control, attack crew commitment/retreat/reload, all three operation stages with a restart, difficulty/agendas, and the truthful unavailable browser purchase flow.

Menu regression checks cover 320/360/393/412px widths. Additional screenshots inspect the map, creation, Command, tactical planning/rounds, operation planning/stages, rivals and store at 360 × 800, 393 × 851 and desktop. Maps have no document overflow at both phone sizes. Primary tactical controls fit at 360 × 800 with optional help collapsed; operation dialogs use a short internal scroll. Catalogue lists use pagination. Screenshots and measured bounds are in `output/screenshots/underworld-*`.

## Production offline browser

`npm run build` and `node scripts/verify-offline.mjs` pass. The production build precaches **87 resources** including scripts, styles, fonts and original illustrations. Verification waits for installation/control, disconnects the browser, reloads, resumes the story, navigates all five screens with loaded artwork and resolves a job.

PWA registration is restricted to browsers. Android uses bundled APK assets directly; a native document-start bootstrap retires any v1.0 worker before its old application scripts can run. A real APK upgrade exposed stale cached v1.0 HTML despite an installed v1.1 package. The correction was exercised against the old APK and preserves save/setting data. Browser offline use requires one initial connected visit; Android first launch does not.

## Android build and runtime

Sequential web sync followed by `:app:assembleDebug :app:bundleRelease :app:lintDebug :app:testDebugUnitTest` produces the APK and AAB using Java 21/SDK 36. Package: `com.blackline.crimelife`, version **1.1.0/code 2**, minimum API **24**, target API **36**, portrait. The APK is development signed; the AAB is unsigned. Artifact sizes and SHA-256 hashes are in `output/android/build-report.json`.

Native JVM policy tests pass **6/6**, covering consent retry bounds, interstitial grace/day/time limits, missed opportunities, reward completion once, and signed receipt verification/rejection. Android lint has no errors; remaining warnings include dependency/style/manifest suggestions. The compact anchored banner API compiles with an SDK deprecation note.

Runtime uses only the isolated `blackline_underworld_qa` Android 16/API 36 emulator (1080 × 2400, 412px WebView). Offline testing explicitly checks airplane mode, disabled Wi-Fi/mobile data and no active Android default network. Scripts exercise native creation/navigation/art/job/event/Back, Preferences, and statistics/settings across force-stop/relaunch. Upgrade testing installs v1.0 then v1.1 without clearing the existing save and verifies automatic worker retirement, migrated strategy and the 15-zone map. Reports: `native-qa.json`, `upgrade-qa.json`.

## Ads and purchases

Both build variants intentionally use the official Google **test** app ID and banner/interstitial/rewarded unit IDs requested by the user. Real Android services include Mobile Ads **25.5.0**, UMP **4.0.0** and Play Billing **9.1.0**. Consent gates requests; no-fill/network failures leave offline gameplay available. The sibling banner resizes the WebView rather than covering navigation. Ads are muted only after SDK initialization, and game ambience is suspended during full-screen services. A demonstrated pre-initialization mute crash was repaired and its online launch repeated.

Nineteen controller/facade tests cover genuine earned-plus-dismissed reward confirmation, duplicate/stale requests, unavailable browser, subscriptions, interstitial limits and ownership changes. Three further day-opportunity tests prevent delayed interstitials after obstructing events. Rewarded supplies now share **one total claim per game day**: **+20 Energy or +$500 Cash**, including the video-free Remove Ads allowance. Regression tests cover either first choice, repeated/cross-kind claims, save restoration, the next-day reset and previously valid multi-claim saves.

Native test-format display and SDK callback results are recorded separately in `ad-qa.json`; an SDK protocol probe is distinguished from the browser's day-end flow. The actual banner reserves 64dp, and a completed rewarded sample increased energy from 68 to 88 and consumed exactly one daily claim. No fake ad completion or purchase receipt is used. The separate inspection file records SDK availability/loading snapshots.

The subsequent one-claim adjustment changes the shared TypeScript game/UI policy. Its updated web and Android bundles use the same native SDK integration. The native display/callback and offline-upgrade reports above precede this policy adjustment; the cap and restart behavior have fresh unit and desktop/phone browser coverage.

The permanent `remove_ads` product removes all formats and permits the same capped supplies without videos. The US **$4.99** price must be configured in Play Console; available regional prices come from Google ProductDetails. A blank public licensing key or unconfigured product prevents payment launch. No charge or licensed store transaction was attempted. Store-backed purchase, cancellation, pending payment, acknowledgement, restore and refund tests require the owner's Console and license tester. See `docs/monetization.md`.

## Art, audio and release boundaries

Three new original illustrations depict the city strategy board, masked confrontation and operation planning. Portraits keep opaque masks/helmets/closed visors; no exposed faces or eyes were added. Locations and objects remain free of figurative decorations and instruments. The palette stays charcoal/champagne with copper risk accents, readable phone text and large touch controls. Noise-based rain/wind/street ambience and mechanical SFX contain no music or instruments.

Emulator audio is disabled, so perceived sound quality still needs physical-device listening. Physical phone cutouts/font scaling, native share/export chooser, older Android/WebView versions, production consent messages, publisher signing, Play listing/submission and live Rate URL remain owner/device release steps. Core gameplay, progression and saves require no backend, LLM or connection; optional Google advertising/payment services do use the network.
