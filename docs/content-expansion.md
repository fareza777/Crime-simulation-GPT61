# Adding content to BLACKLINE

The engine reads typed JSON catalogues at build time. Most additional jobs, events, portraits, businesses and quests require only data and an asset, without changing the engine. Rebuild/sync the Android project after editing content.

## Files and identifiers

Use unique stable IDs in `src/data`. Existing saves refer to those IDs, so do not rename/remove shipped entries without a save migration. Images must be local `/assets/name.webp` references with matching files in `public/assets`. Add a portrait with a completely opaque mask/visor/hood; never expose living facial features. Empty environments and inanimate props avoid incidental faces. Do not add musical instruments or music.

The interfaces in `src/game/types.ts` are the content contract. `src/data/index.ts` loads the files and `src/game/catalog.test.ts` checks references and assets. The MVP count assertions deliberately flag accidental removals; update the expected counts when intentionally expanding the catalogue.

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
- Heist: the current save format supports one four-stage major operation. Choice prose/costs/skills/Heat and stages are data; adding multiple independent heists requires a versioned save/engine extension.

## Art and verification

The final source illustrations are in `art/source`. `scripts/art-sources.json` points to portable project paths. Run `node scripts/prepare-art.mjs` to crop/optimize the atlases, then `node scripts/prepare-android-art.mjs` after changing the icon/splash. There are 40 distinct item illustrations, 12 covered portrait cells (11 crew + player), five district cards, six business environments and event/heist artwork. Businesses may share their matching environment category.

Run `npm test` after a data edit and `npm run test:e2e` after changing a player flow. Check concise text, large phone type, image crops and two-card pages at 320–412px widths. Rebuild and use the offline verification before delivering a new Android build. Changes to save shape require a new version and migration; keep existing saves recoverable.
