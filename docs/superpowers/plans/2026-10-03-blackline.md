# BLACKLINE Implementation Plan

**Goal:** Deliver a playable, polished, data-driven offline portrait crime RPG and Android build.

**Architecture:** Typed pure game engine consumes JSON catalogs and returns immutable state. React renders cards and modal decisions. Local persistence, sound and platform capabilities stay outside the rules engine.

**Tech Stack:** React, TypeScript, Vite, Motion, Phosphor icons, Capacitor Android, Vitest, Playwright.

**Spec:** ../specs/2026-10-03-blackline-design.md

## Global constraints

Offline assets, portrait mobile, no backend, no live combat. Five districts, 70+ events, 30 activities, 11 crew, 15 businesses, 40 items. Seeded chance calculations and day-based passive income. JSON content expansion without rewriting the engine.

## Review focus

Corrupt/imported saves cannot create non-finite stats. Double tapping a decision cannot pay twice. Crew wages can reduce loyalty without breaking the state. Locked activities and heists reject insufficient requirements. Android back closes overlays before exiting.

## Tasks

- [x] Define typed catalog/state/action interfaces in src/game/types.ts and scaffold the build.
- [x] Write JSON catalogs and reference/count tests in src/data and src/game/catalog.test.ts. Each event has 2–4 meaningful choices, actual risk/effect differences and contextual eligibility.
- [x] Implement and test seeded rules in src/game/engine.ts and src/game/engine.test.ts: job planning, events, skill XP, police/jail, economy, recruiting, items, businesses, safehouse, influence, contacts, quests and staged heist.
- [x] Generate original city, district, crew, business, equipment and icon art. Copy and optimize every final asset into public/assets. Bundle fonts and subtle locally generated sound.
- [x] Build dashboard, city, operations, empire, crew, profile, journal, overlays and intro flows in src/ui. Mobile navigation and desktop layout share the same underlying game.
- [x] Implement validated save/import/export and platform capabilities in src/services. Verify save recovery and no rewards from disabled ads.
- [x] Run UI journeys with Playwright at mobile and desktop sizes, fix runtime/layout failures, verify offline reload and capture screenshots.
- [x] Add Capacitor Android, portrait manifest, native icon/splash/back/share and build APK/AAB. Save install and release instructions with verified limitations.

Completed with 220 unit checks, 15 browser journeys, production offline reload,
Android airplane-mode play and force-stop save/settings recovery. Delivered a
development APK and unsigned release bundle; owner signing/publication remain
release steps documented in docs/android-release.md.
