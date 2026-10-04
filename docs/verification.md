# Verification record — BLACKLINE 1.0.0

Verified on 3–4 October 2026. The report describes the local MVP, without claiming a published store release or testing on every physical phone.

## Automated game checks

`npm test`: **220 passed**, across five suites. Coverage includes the real catalogue quantities/references, unique items/assets, events with usable resource-free exits, deterministic job/event outcomes, costs, skill progression, crew payroll/loyalty/injuries, passive income, Heat/police/custody, contacts, territory, safehouse, once-only quest rewards and the staged heist.

Save validation tests cover finite/ranged values, unknown catalogue references, checksum corruption, backup recovery, bad settings, import size limits, serialized concurrent saves, raw v1 migration, incompatible pending flows, custody/heist consistency and no overwrite from rejected imports. Disabled ads never report completion or create rewards. Audio tests check noise based sources and ambient/background cleanup.

## Browser gameplay

`npm run test:e2e`: **15 passed, 1 expected skip**. The skipped desktop copy of the phone-only width test is intentional. Projects use a 1440 × 1000 desktop and a Pixel 7 style 393 × 851 phone viewport.

Verified journeys: creation → prepared job → event → reload/continue; recovery from damaged settings; five navigation screens; persistent settings; recruitment and loyalty; business purchase/day income/payroll; skill training; main/side quest claims; a real downloaded-save deletion/import round trip; disclosed bail and custody exit; selected crew and all four Meridian stages with a reload midway and once-only payout.

Additional menu regression checks cover widths 320, 360, 393 and 412 pixels. Every menu action and the actual title text stay inside the viewport. Dashboard text/button sizing, accessible journal shortcut and primary action placement are asserted. Screenshots show the dashboard uses exactly 851px document height at 393 × 851, with no horizontal overflow. Shorter displays may require a modest vertical scroll; lists use pagination rather than full catalogue stacks.

## Production offline browser

`npm run build` succeeds. `npm run test:offline` against the production server on port 5188 passes: completed service-worker installation, disconnected network, page reload, resume story, all five screens and bundled images, then job resolution. The game precaches 83 resources, including its scripts, styles, fonts and images. Browser offline use requires one initial connected load; Android first launch uses bundled assets directly.

An initial offline check exposed conflicting duplicate icon precache entries. The manifest icons are now excluded from the asset glob and included once with their revisions; offline reload was verified after the correction. A phone menu margin inherited from desktop also caused clipping and was removed, with width regression coverage.

## Android builds

`assembleDebug` and `bundleRelease` succeed with Java 21 and Android SDK 36. Package metadata confirms `com.blackline.crimelife`, version 1.0.0/code 1, minimum SDK 24, target SDK 36 and portrait orientation. The APK is development signed. The AAB is unsigned. Both include the complete game, original icon/splash, local fonts and third-party license notices.

The build has no backend, LLM, account, tracking or active ad SDK. Internet permission exists for optional future integrations and platform sharing; core play and saves require no network.

## Android runtime

The installed APK was exercised on an isolated Android 16/API 36 emulator at 1080 × 2400 pixels (412 × 842 WebView viewport). Airplane mode was enabled, Wi-Fi/mobile data were disabled and Android reported no active default network before first launch. Creation, five screens and their images, prepared job/event decisions, Android Back navigation and native Preferences were exercised without a network. After force-stop/relaunch, the saved character, all six player statistics and the sound setting matched the prior session. The native dashboard document height equals its 842px viewport height. `output/android/native-qa.json` records the result and Android screenshots are in `output/screenshots`.

## Visual and audio review

Final character art uses fully opaque masks, helmets, closed visors and covered heads. District/business artwork is unoccupied, without incidental exposed faces, figurative portraits, statues or musical instruments. Equipment uses 40 distinct inanimate object/vehicle illustrations. The event's distant figures are seen only from behind, without visible faces.

The palette is charcoal/champagne with restrained copper risk accents. Body text is 15px on phones; decision descriptions are 15px, choice labels 15px, primary buttons 14–16px and primary touch targets at least 44px. Optional noise based rain/wind ambience and mechanical cues contain no oscillators, music or instruments. Their perceived loudness and tactile feel still need real-device listening, as emulator audio is disabled.

## Release boundaries

The source, APK, unsigned bundle, original assets and release guide are delivered locally. The owner's signing identity, Google Play listing, store submission and live Rate URL are pending. Native share/export chooser behavior, cutouts, larger system font preferences and older Android/WebView versions should receive physical-phone QA before production publication.
