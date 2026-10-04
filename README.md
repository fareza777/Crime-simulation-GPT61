# BLACKLINE — Rise from the Shadows

A complete playable MVP of an original portrait crime life simulator. Build a life in Blackwater through illustrated cards, branching decisions, a crew, businesses and district influence. All game copy is English. The game runs offline with no backend or LLM.

## Play on Android

Install `output/android/BLACKLINE-1.0.0-debug.apk` on an Android phone. This build is signed with the development key and is intended for testing. Android may ask you to allow installation from the app used to open the APK.

The project also includes `output/android/BLACKLINE-1.0.0-release-unsigned.aab`. It needs the owner's upload signing key and Google Play Console setup before store publication. See [Android release instructions](docs/android-release.md).

## Included

| Content | Amount |
| --- | ---: |
| Illustrated districts | 5 |
| Crime activities | 30 |
| Authored branching events | 84 |
| Recruitable crew | 11 |
| Businesses | 15 |
| Equipment, vehicles and special items | 40 |
| Main quests / side quests | 8 / 12 |
| Contacts / safehouse upgrades | 6 / 4 |
| Major heist | 1, with four stages |
| Starting career paths | 6 |

Cash, Reputation, Heat, Health, Energy and Influence all affect progression. Six skills advance through training and activity XP. Higher Heat brings investigations, confiscation, injury, raids and jail. Jail has bail, sentence days, contacts and its own decisions. Crew have specialties, loyalty, salaries and injuries. Businesses earn income on game days; rivals and payroll can erode that income. Equipment, safehouse upgrades, contacts and territory change the odds. The Meridian reserve requires a selected crew, equipment, preparation and an escape decision.

The app includes the original icon and splash screen, onboarding, character creation, continue/new game, settings, About, sharing, save export/import and a rate action. The rate action explains that the listing is pending; set its URL after publication. Ads are disabled, with a service contract prepared for rewarded and interstitial integration.

## Presentation

Charcoal and champagne gold, illustrated city backgrounds, completely masked portraits, custom item art, animated statistics and gentle transitions. Characters have no visible eyes, skin or facial features. Environments contain no exposed faces. Audio uses quiet noise based rain/wind ambience and short mechanical SFX, with no music, melodies or instruments. Effects, ambience, haptics and reduced motion have independent controls.

Phone screens use readable text, large touch targets, fixed bottom navigation and small pages of cards. The principal dashboard fits a 393 × 851 viewport without vertical scrolling. Narrower/shorter phones retain readable text and may use a short scroll; catalogues use pagination. Portrait orientation is enforced on Android.

## First few turns

1. Choose a career and a covered portrait. Read the job's reward range, Heat, energy, cost and success chance.
2. Decide whether to act now, pay an informant, scout with an available crew member or walk away.
3. Resolve the event that follows, then claim ready main/side quest rewards in the journal (bell icon).
4. Recruit carefully, buy useful equipment, train and save toward a business.
5. End the day to recover energy, settle salaries and receive income. Manage Heat before it overwhelms the operation.
6. Unlock districts, develop relationships and influence, then prepare the Meridian reserve.

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
| `src/data/*.json` | Districts, jobs, events, crew, items, businesses, quests, contacts, upgrades and the heist |
| `src/game/engine.ts` | Seeded, pure, immutable turn rules and shared cost/chance selectors |
| `src/game/types.ts` | Content, save, action and outcome contracts |
| `src/ui` | Cards, screens, short pagination, choices and dialogs |
| `src/services/storage.ts` | Versioned save envelope, checksum, backup, validation and migration |
| `src/services/platform.ts` | Noise SFX, natural ambience, native Back/share/haptics and app lifecycle |
| `src/services/ads.ts` | Disabled ad service and future SDK boundary |
| `public/assets` | Bundled optimized art; no remote image dependencies |
| `art/source` | Final original illustration sources |
| `android` | Capacitor native portrait Android project |
| `tests` | Browser gameplay, progression and layout journeys |
| `output` | APK/AAB, build metadata and screenshots |

See [content expansion](docs/content-expansion.md), [verification](docs/verification.md) and the recorded art prompts in `docs/art-prompts.json`. Fonts and runtime license notices are bundled in `public/licenses`; refresh them with `node scripts/prepare-notices.mjs` after updating dependencies. A Google Play release has not been published.
