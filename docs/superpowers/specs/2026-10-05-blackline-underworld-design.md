# BLACKLINE 1.1 — Underworld expansion

## Intent and constraints

The owner requests a substantially deeper, more challenging crime management RPG, attacks against rivals, a zoned map, new original art where useful, AdMob banner/interstitial/rewarded integration, and a US$4.99 Remove Ads purchase. The owner delegates creative design and explicitly selects Google's test ad IDs for this delivery. This is an architectural expansion of the existing offline game. The work proceeds under that delegation without adding repeated approval stages.

All game text stays English. Preserve portrait Android layout, readable phone text, concise cards, short pages, charcoal/champagne gold styling, fully opaque masks without eyes or faces, natural ambience and mechanical SFX without music. Battles are turn-based menu decisions, never real-time movement. Core play and local saves remain entirely offline. Existing saves and the Meridian heist must remain playable.

## Interconnected strategy loop

Blackwater retains five districts with three named zones each. An interactive vector map overlays original atmosphere art; tapping a zone selects it and exposes a compact action panel. District reputation gates still apply. Zone control, intel, fortifications, connected supply, rival alert and garrison assignments affect risks and returns. A starting foothold allows early scouting and negotiation without requiring a late-game crew. Gaining distant territory costs upkeep and exposes weak links.

Five rivals retain strength, hostility and temporary truces. They react on game days: they contest weak zones, pressure businesses and recover after setbacks. Fortifications and a healthy loyal lieutenant help hold ground. Negotiation is a viable alternative to repeated attacks. Each choice discloses cash, energy, chance and its principal consequence.

Attacks commit selected healthy loyal crew and an approach, then run a short tactical encounter. Three round choices trade momentum, morale, exposure and injury risk. Retreat remains possible and has a clear cost. No graphic violence or practical real-world attack instructions. Commitments lock conflicting actions until resolved. Injury, crew fatigue, compromised intel, rival retaliation and upkeep make victory consequential.

Three repeatable major operations add planning and stage decisions to the existing Meridian heist. Select appropriate crew, obtain required equipment and resolve entry, objective and extraction choices. Progress and suspicion compound; partial setbacks can be recovered from, excessive exposure or retreat ends the attempt. Daily state, results and pending stages persist across restarts.

Three challenge settings (Standard, Hard, Ruthless) and organization agendas (Balanced, Profit, Silent, War) change disclosed risk, rival pressure and costs. Career paths retain their strengths. New zone, battle and operation milestones extend the main quest and side quests. Daily accounts show business income, payroll, zone returns and upkeep separately. Health and cash depletion must allow recovery rather than lock the save.

## Content and presentation

Add at least 36 individually authored events with branching consequences, including conflict, logistics, business pressure, trust and tactical aftermath chains. Extend quests with strategy metrics. Reuse existing opaque portraits and the established equipment library. New atmosphere art comprises a clean overhead city planning background, a covered rival confrontation and an operation scene. Map zones, labels, interaction and legend are code-rendered for accessibility and accuracy.

City screen has Map / Districts / Rivals views. Operations has Jobs / Major Ops views. Map defaults to the current district; a district carousel and a focused zone inspector avoid a long scrolling catalogue. Tactical encounters and operation stages use one decision card at a time. Organization agenda and difficulty are accessible in the command view; lieutenant assignments are accessible from owned-zone details. Help provides concise playable explanations.

## Persistence and engine boundaries

Keep `GameState.version: 1` and the current save keys to preserve installed saves. Add a validated strategy subtree, migrate older states by supplying defaults without overwriting money or progression. Validation must reject unknown content references, invalid stage indices, forged negative costs, impossible active crews, nonfinite values, conflicting pending activities and unsafe object keys. New rules use the seeded RNG and immutable reducer; UI consumes the same preview selectors as resolution.

`src/game/strategy-types.ts` owns strategy data/state/actions. `src/game/strategy.ts` owns selectors and turn rules. `src/data/zones.json`, `rivals.json` and `operations.json` own expandable definitions. Engine exports remain compatible. Strategy helpers expose `getStrategy`, `zoneView`, `zoneActionInfo`, `battlePreview`, `operationRequirements`, `operationChoiceInfo`, `strategySummary`, and definition arrays. The engine owner publishes exact interfaces before UI integration.

## Monetization

Implement an Android Capacitor bridge using Google's official Mobile Ads and UMP SDKs and Play Billing. Use official Google test App/Unit IDs in both supplied builds. Banner occupies dedicated native space below navigation and is hidden during menus, dialogs and encounters; visible height is reflected in phone layout. Interstitials only follow completed day transitions after three gameplay days and a timed cooldown, never a choice or app launch. Rewarded is explicitly optional, gives the advertised capped supply/energy reward only from the earned-reward callback, and cannot double-grant on dismissal, retry or resume. No connection or no fill never stops play.

`remove_ads` is a non-consumable one-time in-app product with US$4.99 as the requested US base price. Display Google's localized product price when available. Purchases are granted only in PURCHASED state after verification/acknowledgement; PENDING and cancelled payments grant nothing. Restore existing purchases, recheck on resume, cache established entitlement for offline use and do not export it in game saves. Remove Ads removes all three ad formats. A capped daily supply claim preserves the ordinary rewarded benefit for purchasers without an ad. No simulated successful purchase in browser or debug builds. Actual pricing and license testing require the product in the owner's Play Console; this delivery configures the ID and complete client integration.

Request UMP consent when initializing on a foreground screen, offer privacy options when required, mute ad video audio, fail closed when ads cannot be requested. Do not promise control over third-party creative content. Update About/privacy copy because optional Google services use network/device information. No backend or runtime LLM is introduced.

`src/services/monetization.ts` exports a subscribable controller: `getSnapshot`, `subscribe`, `initialize`, `setBannerVisible`, `showRewarded`, `onDayEnd`, `buyRemoveAds`, `restorePurchases`, `openPrivacy`. Snapshot provides native support, entitlement, localized price, ad readiness, actual banner height, privacy requirement and busy status. Existing `ads.ts` facade stays compatible. UI owns dialogs, placement and visible status.

## Acceptance

- Meaningful automated tests for multi-round attacks, return/upkeep, rivalry/truces, connected zones, seeded determinism, locked actions, stage operations, daily reward limits and migration/invalid saves.
- Preserve all existing meaningful gameplay and storage tests, update intentional catalogue totals only.
- Browser journeys exercise a zone action, attack/retreat, selected crew, operation stage, challenge/agenda and monetization unavailable behavior; 393px and 360px portrait layouts do not overflow horizontally and avoid long feeds.
- Android builds compile the official native SDK integrations, launch offline and retain new strategy progress after relaunch. Test ads may require connectivity and consent/no-fill must be graceful. No real charge is attempted.
- Deliver refreshed APK/AAB, content/monetization release documentation, new screenshots and evidence of executed checks. Publication to Google Play is not part of this request.
