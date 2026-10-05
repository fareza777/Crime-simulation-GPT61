# Adding content to BLACKLINE

The engine reads typed JSON catalogues at build time. Most additional jobs, events, portraits, businesses and quests require only data and an asset, without changing the engine. Rebuild/sync the Android project after editing content.

## Files and identifiers

Use unique stable IDs in `src/data`. Existing saves refer to those IDs, so do not rename/remove shipped entries without a save migration. Images must be local `/assets/name.webp` references with matching files in `public/assets`. Add a portrait with a completely opaque mask/visor/hood; never expose living facial features. Empty environments and inanimate props avoid incidental faces. Do not add musical instruments or music.

The interfaces in `src/game/types.ts` and `src/game/strategy-types.ts` are the content contract. `src/data/index.ts` loads the files and catalogue/strategy tests check references and assets. Count assertions deliberately flag accidental removals; update expected counts when intentionally expanding the catalogue.

## Activities

Add an entry to `activities.json`, referencing an existing district and skill. Set cost, energy, base chance, difficulty, reward range, Heat, Reputation unlock and the success/failure text. Optional item/crew requirements are supported. Failures use the same `Effects` contract as events.

Job chances combine the base chance, skill/equipment bonuses, available crew, district risk, current Heat and the selected preparation. The shared selectors in `engine.ts` supply both the UI and the reducer, so the preview and charge stay consistent. Preparation/energy costs are spent on both success and failure. Heat can cause a subsequent police arrest, in addition to listed job penalties.

## Branching events

Every event has 2–4 concise choices. Define a guaranteed outcome with `effects`/`result`, or a risk with `chance`, optional `skill`, `failure` and `failureResult`. Give each branch a meaningful difference in money, risk, time, loyalty, trust, Heat, items or later opportunities.

```json
{
  "id": "an-empty-loading-bay",
  "title": "An empty loading bay",
  "category": "Opportunity",
  "text": "Your contact offers a last-minute opening before the shift changes.",
  "image": "/assets/district-portside.webp",
  "weight": 4,
  "districtId": "portside",
  "minRep": 100,
  "choices": [
    {
      "id": "pay-for-time",
      "label": "Buy more time",
      "description": "Spend $500 for a safer opportunity.",
      "chance": 82,
      "skill": "streetSmarts",
      "effects": {"cash": 2500, "energy": -12, "heat": 4},
      "failure": {"cash": -500, "energy": -12, "heat": 6},
      "result": "The opening lasts long enough. Your contact keeps their word.",
      "failureResult": "The shift changes early. The fee and your time are lost."
    },
    {
      "id": "decline",
      "label": "Pass on the offer",
      "description": "Keep your cash and energy.",
      "effects": {},
      "result": "You leave the offer for another night."
    }
  ]
}
```

Event effects are net changes, not separate upfront charges; write the description to match both outcomes. The example's success net cash already includes the fee. Resource gating considers all costs on either outcome. Always include an unconditional choice that is available with zero cash/energy and low health, so a mandatory event cannot trap the player.

Eligibility supports min/max Heat, minimum Reputation, district, business/crew ownership, required/forbidden flags, custody and follow-up-only entries. `followUp` and `failureFollowUp` refer to another event ID. Chain-specific entries use `followUpOnly: true`. Persisted flags support story state; `removeFlags` closes a chain. Recent-event history limits immediate repetition. Custody events must use `jailOnly: true`, and chains must preserve their custody context.

## Other catalogues

- Crew: portrait, primary skill/rating, specialty/trait, salary, recruitment cost, loyalty and Reputation threshold. IDs work automatically in recruitment, payroll, injuries and heist selection.
- Businesses: district, legal/illegal type, purchase cost, income, Heat, maximum level and Reputation threshold. Daily income/Heat scale with levels and relevant player bonuses.
- Items: category, cost, Reputation and additive bonuses. Supported bonuses are the six skills, Heat reduction, Health and Energy. Consumables apply Health/Energy immediately; permanent equipment stays in inventory.
- Quests: main/side kind, supported metric, target, reward and optional predecessor. Rewards are claimed once. Use the existing metric union unless adding a genuinely new engine capability.
- Contacts: portrait, unlock threshold and initial relationship. Generic gifts work automatically; a new specialist favor needs its effect added to the contact selector.
- Safehouse upgrades: new entries use the generic level/cost flow, but a new mechanical bonus needs its implementation in the relevant selector.
- Heist: `heist.json` retains the single four-stage Meridian story heist. Add repeatable multi-stage scores to `operations.json`; they use a separate generic state machine.

## Zones, rivals and major operations

`zones.json` defines 15 territories across five districts. Each entry has a stable ID, district and rival references, concise description, map coordinates `x` / `y` between 0 and 100, neighboring zone IDs, income, upkeep, defense and Reputation requirement. The map derives its tappable polygon cells from the coordinates. Use distinct sites and reciprocal neighbors; preserve a route from the Market Street starting foothold to expandable ground. Coordinates describe the planning illustration, not a real-time world.

`rivals.json` supplies names, covered images, home districts, descriptions, starting strength and hostility. The generic daily turn updates alert, truces, territorial pressure and business interference. `zoneActionInfo`, `battlePreview` and `rivalTruceInfo` expose the same checks/costs used by the reducer. Do not duplicate those calculations in UI code.

`operations.json` is the generic catalogue for repeatable multi-stage operations. Define Reputation, selected crew count, required item IDs, entry cash/energy, reward range and cooldown in game days. Each stage supplies a skill and distinct choices with costs, chance bonus, progress, suspicion and injury chance. Stage IDs and choice IDs must be stable. Include an affordable slower approach, and keep the generic withdrawal available when resources run out. Completion requires 85+ progress and suspicion below 80; suspicion at 90 ends a run early. These are fictional resource decisions, not real-world instructions.

The shipped examples are **Harbor Ledger**, **Velvet Exchange** and **Foundry Reserve**. Add another operation by following their data shape; planning, crew selection, resolution, cooldown and persistence use the catalogue automatically. New mechanical effect types or battle tactics require explicit typed rule support and tests.

The strategy quest metrics are `zones` (currently held territory), `battles` (victories) and `operations` (completed repeatable operations). The Meridian quest remains on its existing metric. New event chains use ordinary requirements and flags; battle/operation success flags must be earned through their actual outcomes. Close story roots with forbidden completion flags to prevent repeatedly farming a chain reward.

## Save compatibility

The v1 envelope, save keys and original content IDs remain unchanged. Saves without the optional strategy subtree receive a starting foothold and defaults on import/load while preserving player statistics, inventory, quests, pending events and Meridian progress. Saves with strategy validate every referenced zone/rival/crew/operation ID, choice history and active stage. A battle, operation, job, story decision or custody cannot occupy incompatible parallel flows.

New stable catalogue entries use the generic rules. Adding shipped zone/rival IDs requires a tested save migration to initialize those new entries; the current strategy validator requires the complete current map. Do not rename/remove entries or change stored mechanical meaning without migration. Verify fixtures from the previous release and exported saves before shipping a structural change. Ad ownership lives in private native preferences and never in the game save; importing a story cannot create a purchase entitlement.

## Art and verification

The final source illustrations are in `art/source`. `scripts/art-sources.json` points to portable project paths. Run `node scripts/prepare-art.mjs` to crop/optimize the original atlases, `node scripts/prepare-underworld-art.mjs` for the three expansion illustrations, then `node scripts/prepare-android-art.mjs` after changing the icon/splash. There are 40 distinct item illustrations, 12 covered portrait cells (11 crew + player), five district cards, six business environments and event/heist/strategy artwork. Businesses may share their matching environment category.

Run `npm test` after a data edit and `npm run test:e2e` after changing a player flow. Check concise text, large phone type, image crops and paginated cards at 320–412px widths. Rebuild and use the offline verification before delivering a new Android build. Incompatible save shapes require a new version and tested migration; additive optional fields need a tested normalization path. Keep existing saves recoverable.
