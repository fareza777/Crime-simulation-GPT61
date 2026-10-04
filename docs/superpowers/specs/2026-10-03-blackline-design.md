# BLACKLINE — Rise from the Shadows

Build an original portrait, offline crime life simulator for Android, with an equally playable browser preview. Gameplay is turn based, text and card driven. No backend, AI service, live map or real-time combat.

## Identity and interaction

All game copy defaults to English. Charcoal interface, champagne gold calls to action, cinematic illustrated noir city art. All characters wear opaque full-face masks, closed visors or deep hoods: no faces, eyes or skin visible. No animals or uncovered living faces. Audio contains only natural rain/wind/city ambience and mechanical noise SFX, never music, instruments, melodies or tonal drones. Outfit body text, Oswald condensed display headings, IBM Plex Mono numbers. Mobile uses a compact top bar and fixed five-tab navigation; desktop expands to a sidebar, main dashboard and contextual city intelligence panel. Every catalog uses pagination rather than endless vertical scroll. All content remains usable at 360px width. Settings, onboarding, character creation, share, rate and About are real flows.

## Content and rules

At least 5 districts, 70 distinct random events, 30 activities, 11 recruitable crew, 15 businesses, 40 items, 8 main quests, 12 side quests and one multi-stage heist. Catalogs are JSON, validated by tests, and separate from the engine and UI. Branches disclose costs, chance modifiers and effects. Resolution uses a persisted seeded RNG, skill/equipment/crew bonuses, district risk and heat. Preparation trades money or crew support for safer outcomes. Heat drives investigations, injury, confiscation and jail. Salaries, business income, loyalty, rival pressure and jail sentences advance on explicit game days. No wall clock income exploit.

## Persistence and Android

Versioned local save with validation and backup fallback. Preferences on Android and localStorage in the browser. Export/import save in settings. Fully bundled fonts, art and sounds; no remote assets. Capacitor Android host, portrait orientation, native back, native share, adaptive icon and splash. Ad service abstraction disabled by default, with rewarded/interstitial placement contracts for future AdMob integration. Rewards only granted after confirmed completion. No ads or purchases needed for progression.

## Verification

Test catalog quantities/references, deterministic probabilities, resource gating, no replayed events, daily economy, jail, quests, heist and corrupted save recovery. Verify onboarding, creation, activity choice, results, recruitment, businesses, travel, settings and reload in a browser. Build an Android debug APK and unsigned release AAB when SDK is available. Play upload requires the owner's signing identity and Play Console.
