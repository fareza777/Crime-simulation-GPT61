# BLACKLINE — Rise from the Shadows

An original portrait crime RPG and management simulator. The 1.1 **Underworld** expansion adds a zoned city, rival campaigns, tactical encounters and repeatable major operations. Every decision uses illustrated menus and cards. All game copy is English; gameplay runs offline without a backend or LLM.

## Play on Android

Install `output/android/BLACKLINE-1.1.0-debug.apk` on an Android phone. This build is signed with the development key and is intended for testing. Android may ask you to allow installation from the app used to open the APK.

The project also includes `output/android/BLACKLINE-1.1.0-release-unsigned.aab`. It needs the owner's upload signing key and Google Play Console setup before store publication. See [Android release instructions](docs/android-release.md).

## Included

| Content | Amount |
| --- | ---: |
| Illustrated districts | 5 |
| Interactive territory zones / rival organizations | 15 / 5 |
| Crime activities | 30 |
| Authored branching events | 132 |
| Recruitable crew | 11 |
| Businesses | 15 |
| Equipment, vehicles and special items | 40 |
| Main quests / side quests | 14 / 24 |
| Contacts / safehouse upgrades | 6 / 4 |
| Major operations | 3 repeatable operations with three stages each |
| Meridian story heist | 1, with four stages |
| Starting career paths | 6 |
| Challenge settings / organizational agendas | 3 / 4 |

Cash, Reputation, Heat, Health, Energy and Influence all affect progression. Six skills advance through training and activity XP. Higher Heat brings investigations, confiscation, injury, raids and jail. Jail has bail, sentence days, contacts and its own decisions. Crew have specialties, loyalty, salaries and injuries. Businesses earn income on game days; rivals and payroll can erode that income. Equipment, safehouse upgrades, contacts and territory change the odds. The Meridian reserve requires a selected crew, equipment, preparation and an escape decision.

The zoned map exposes ownership, connected supply routes, intelligence, fortifications and daily net income. Scout, negotiate, disrupt or attack rivals in three-round encounters. Committed crew cannot work elsewhere; fatigue, loyalty and injuries influence their readiness. Assigned lieutenants defend ground while rivals counterattack or squeeze businesses each day. Truces buy a limited breathing space. Weakened control can be restored and isolated territory earns less.

Choose Balanced, Profit, Silent or War priorities. Standard, Hard and Ruthless settings change the costs and pressure; new characters default to Hard and can adjust it in Command. Three major operations compound progress and suspicion across planning, entry and extraction, with selected crew, equipment, distinct choices, withdrawal and replay cooldowns. Eight new story chains provide aftermath decisions, while the original content and save IDs remain intact.

The app includes the original icon and splash, onboarding, character creation, continue/new game, settings, About, sharing, save export/import and a rate action. The Rate button explains that the listing is pending; set its URL after publication.

Android now includes native adaptive banner, guarded day-end interstitial and optional rewarded ads using **official Google test IDs in both builds**. Unavailable ads never block offline play or fabricate rewards. Daily supplies allow **one total claim per game day**: choose +20 Energy or +$500 Cash. The allowance resets after **End day** and remains spent across restarts. The non-consumable `remove_ads` integration removes all three formats and grants that same capped supply without a video. The requested **US$4.99** price, product and public verification key require the owner's Play Console setup; browser previews cannot make purchases. See [monetization setup](docs/monetization.md).

## Presentation

A complete English store campaign is available in [output/playstore](output/playstore): a new non-human vault icon, 1024 × 500 feature graphic, eight genuine gameplay screenshots and 36-second portrait/landscape trailers with original non-musical ambience and SFX. The editable Remotion project is in [promotional-video](promotional-video); see [the campaign handoff](docs/playstore-campaign.md) for previews, provenance and upload instructions.

Charcoal and champagne gold, illustrated city backgrounds, completely masked portraits, custom item art, animated statistics and gentle transitions. Characters have no visible eyes, skin or facial features. Environments contain no exposed faces. Audio uses quiet noise based rain/wind ambience and short mechanical SFX, with no music, melodies or instruments. Effects, ambience, haptics and reduced motion have independent controls.

Phone screens use readable text, large touch targets, fixed bottom navigation and small pages of cards. The principal dashboard fits a 393 × 851 viewport without vertical scrolling. Narrower/shorter phones retain readable text and may use a short scroll; catalogues use pagination. Portrait orientation is enforced on Android.

## First few turns

1. Choose a career and a covered portrait. Read the job's reward range, Heat, energy, cost and success chance.
2. Decide whether to act now, pay an informant, scout with an available crew member or walk away.
3. Resolve the event that follows, then claim ready main/side quest rewards in the journal (bell icon).
4. Recruit carefully, buy useful equipment, train and save toward a business.
5. End the day to recover energy, settle salaries and receive income. Manage Heat before it overwhelms the operation.
6. Scout adjacent zones, defend connected ground and manage rival hostility. Choose a lieutenant or commit rested crew to an attack.
7. Assemble the required specialists and equipment for major operations, then prepare the Meridian reserve.

Progress saves after every change. Time and income advance when you end a game day, rather than using the phone clock. Export a save before uninstalling or moving devices; imported saves are validated and a previous local backup is retained.

## Development

Requires Node 22.12+ and npm. Android additionally requires Java 21 and the Android SDK with platform/build tools 36. Dependencies and versions are locked in `package-lock.json`.

```powershell
npm ci
npm run dev
npm test
npm run test:e2e
npm run build
```

The development preview uses port 5173. For a production/offline preview use `npx vite preview --host 127.0.0.1 --port 5188 --strictPort`, then run `node scripts/verify-offline.mjs`. The browser preview caches the complete game on its first connected visit. The APK includes the complete game and works offline from first launch.

```powershell
npm run android:debug
npm run android:bundle
```

Set `JAVA_HOME` to Java 21 and create your own `android/local.properties` with `sdk.dir` if necessary. That machine specific file and all signing keys are ignored.

## Project layout

| Path | Responsibility |
| --- | --- |
| `src/data/*.json` | Districts, zones, rivals, operations, jobs, events, crew, items, businesses, quests, contacts, upgrades and the heist |
| `src/game/engine.ts` | Seeded, pure, immutable turn rules and shared cost/chance selectors |
| `src/game/strategy.ts` | Territory, supply, rival turns, tactical encounters, agendas and major operations |
| `src/game/types.ts` | Content, save, action and outcome contracts |
| `src/ui` | Cards, screens, short pagination, choices and dialogs |
| `src/services/storage.ts` | Versioned save envelope, checksum, backup, validation and migration |
| `src/services/platform.ts` | Noise SFX, natural ambience, native Back/share/haptics and app lifecycle |
| `src/services/monetization.ts` | Native ad/purchase controller, request correlation, cooldowns and browser fallback |
| `android/app/src/main/java/com/blackline/crimelife` | Google ads/consent/billing plugin and signed receipt policy |
| `public/assets` | Bundled optimized art; no remote image dependencies |
| `art/source` | Final original illustration sources |
| `android` | Capacitor native portrait Android project |
| `tests` | Browser gameplay, progression and layout journeys |
| `output` | APK/AAB, build metadata and screenshots |

See [content expansion](docs/content-expansion.md), [verification](docs/verification.md) and the recorded prompts in `docs/art-prompts.json` / `docs/underworld-art-prompts.json`. Fonts and runtime license notices are bundled in `public/licenses`; refresh them with `node scripts/prepare-notices.mjs` after updating dependencies. A Google Play release has not been published.
