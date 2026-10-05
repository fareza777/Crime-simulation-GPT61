# BLACKLINE Underworld Implementation Plan

> For agentic workers: use superpowers:executing-plans with independently owned gameplay, content and monetization domains. Integration and UI remain with the primary agent.

**Goal:** Deepen BLACKLINE with zoned territory, tactical rival conflict, compounding operations and real Android ad/purchase services while preserving simple portrait controls and offline play.

**Architecture:** Extend the seeded engine with a validated strategy subtree and data-driven rules. Add independent native monetization behind a tested service controller. Existing React card screens consume shared previews and expose one focused decision at a time.

**Tech Stack:** Existing React/TypeScript/Vite/Capacitor 8, Java 21/Android API 36, official Google Mobile Ads/UMP/Play Billing, Vitest and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-blackline-underworld-design.md`.

## Global constraints

- English copy, opaque masks, charcoal/gold, readable portrait phone UI, no music.
- Local offline gameplay, seeded immutable engine, existing saves migrate losslessly.
- User explicitly requests official Google test IDs; product ID `remove_ads`, US base price US$4.99 configured in Play Console.
- Do not edit another domain's files without coordination. Do not push until implementation and verification finish.

## Review focus

Invalid selections, parallel action locks and depleted resources must not bypass costs or trap encounters. Older saves and pending stories must resume. Network/consent/no-fill and pending/cancelled payments must never give a false reward or block offline play. Banner height must reserve actual space. Native callbacks must be safe across disposal/resume and never fulfill a reward twice.

## Task 1 — Strategy rules and migration

**Own:** `src/game/strategy-types.ts`, `strategy.ts`, `strategy.test.ts`, `types.ts`, `engine.ts`, `src/services/storage.ts` and strategy validation tests, `src/data/zones.json`, `rivals.json`, `operations.json`, definition exports.

- [x] Publish exact selector/action/state contracts for UI and content.
- [x] Write failing rule tests for 15 zones, supply connectivity, attack choices/withdrawal and costs.
- [x] Implement the smallest coherent zone/rival/battle/operation rules satisfying those cases.
- [x] Write failing tests for agendas/difficulty, daily rival turns, committed crew locks, upkeep, capped ad reward claims and old-save migration.
- [x] Integrate reducer/persistence and validate hostile/corrupt saves.
- [x] Execute engine/storage suites and report actual results.

Core API sketch: `zoneActionInfo(state, zoneId, mode)` returns cost, energy, chance and unmet requirements; dispatch `{type:'ZONE_ACTION',zoneId,mode}`. Battles use `START_BATTLE` with selected crew and `BATTLE_CHOICE`. Major operations use `START_OPERATION`, `OPERATION_CHOICE`, `ABORT_OPERATION`. `CLAIM_AD_REWARD` remains a bounded trusted UI callback action.

## Task 2 — Authored expansion content

**Own:** `src/data/events.json`, `quests.json`, optional story files and `src/game/catalog.test.ts`; coordinate new metrics with engine owner.

- [x] Add at least 36 distinctive branching events and several linked aftermath chains.
- [x] Extend main/side milestones around strategy without replacing existing quest IDs.
- [x] Add meaningful catalogue tests for valid references, achievable branches, chance/cost ranges and progression links.
- [x] Update only explicit old total assertions; execute catalogue suite.

Example proof: every follow-up ID resolves, each event provides an affordable escape/decline path, no exposed-face artwork references, each new main quest's prerequisite exists, strategy rewards require a completed measurable objective.

## Task 3 — Android monetization

**Own:** `src/services/monetization.ts`, monetization tests, compatible `ads.ts`, Android native ad/billing plugin classes, native Gradle/manifest/MainActivity registration, monetization documentation. Do not edit root UI or game engine.

- [x] Verify current Google APIs and dependency versions in primary documentation.
- [x] Write failing controller tests for rewarded completion, duplicate actions, unavailable browser, cooldown and purchased entitlement.
- [x] Implement native consent, adaptive banner, preloaded interstitial/rewarded, mute audio and safe cleanup.
- [x] Implement non-consumable purchase, pending/cancelled behavior, acknowledgement, restore/resume and entitlement cache.
- [x] Implement test-ID configuration and a release configuration guide with production switching and US$4.99 product setup.
- [x] Execute service tests and compile native Java code; report SDK versions and limitations truthfully.

Controller methods and snapshot fields must be communicated before integration. No fake web payment, no rewarded true on dismiss alone, no all-screen interstitial.

## Task 4 — Focused mobile UI and illustration

**Own:** primary agent owns React UI/App/styles, art assets/prompts/scripts, browser tests, root docs/version and output artifacts.

- [x] Add failing browser journeys for map/action, battle selection/retreat, operation and monetization fallback.
- [x] Generate original city planning, confrontation and operation art with covered faces; save assets/prompts in project.
- [x] Add Map/Districts/Rivals, zone inspector and clear costs/consequences. Retain accessible keyboard/click labels.
- [x] Add tactical and operation dialogs using engine previews, crew selection, agenda/difficulty and short help.
- [x] Integrate monetization lifecycle, banner spacing, supply action, Remove Ads dialog, restoration and privacy options.
- [x] Check 393px/360px phone layouts and short-viewport dialog behavior visually.

## Task 5 — Integration and delivery

- [x] Run fresh complete unit tests, meaningful browser journeys and production offline test.
- [x] Audit new calculations, migration, callback handling and mobile display; repair demonstrated issues.
- [x] Build/sync Android APK and AAB, verify native first launch and restart retention using an isolated emulator if available.
- [x] Refresh verification, content expansion, monetization docs, screenshots and artifact hashes.
- [x] Commit reviewed work and deliver concrete files with remaining Play Console setup clearly identified.
