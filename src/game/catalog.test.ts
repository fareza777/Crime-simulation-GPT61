import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Activity, Business, Contact, CrewMember, District, Effects, GameEvent, HeistDefinition, Item, Quest, SafehouseUpgrade } from './types';
import type { OperationDefinition, RivalDefinition, ZoneDefinition } from './strategy-types';
import { createGame, eventChoiceRequirements, eventIsEligible, gameReducer, questProgress } from './engine';

// Real JSON is checked at the boundary consumed by the game, including missing files.
function readCatalog<T>(name: string): T[] {
  const url = new URL(`../data/${name}.json`, import.meta.url);
  return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) as T[] : [];
}

const districts = readCatalog<District>('districts');
const activities = readCatalog<Activity>('activities');
const events = readCatalog<GameEvent>('events');
const crew = readCatalog<CrewMember>('crew');
const businesses = readCatalog<Business>('businesses');
const items = readCatalog<Item>('items');
const quests = readCatalog<Quest>('quests');
const contacts = readCatalog<Contact>('contacts');
const safehouseUpgrades = readCatalog<SafehouseUpgrade>('safehouse-upgrades');
const zones = readCatalog<ZoneDefinition>('zones');
const rivals = readCatalog<RivalDefinition>('rivals');
const operations = readCatalog<OperationDefinition>('operations');
const heistUrl = new URL('../data/heist.json', import.meta.url);
const heist = existsSync(heistUrl) ? JSON.parse(readFileSync(heistUrl, 'utf8')) as HeistDefinition : undefined;
const skillKeys = ['charisma', 'streetSmarts', 'combat', 'driving', 'stealth', 'business'];
const underworldEvents = events.filter(event => event.id.startsWith('uw-'));
const underworldChains = [
  ['uw-broken-link', 'uw-link-buffer', 'uw-link-shortfall', 'uw-link-reckoning'],
  ['uw-borrowed-map', 'uw-map-proof', 'uw-map-compromise', 'uw-map-verdict'],
  ['uw-second-shift', 'uw-shift-rotation', 'uw-shift-fracture', 'uw-shift-account'],
  ['uw-rival-deadline', 'uw-deadline-table', 'uw-deadline-standoff', 'uw-deadline-cost'],
  ['uw-two-landlords', 'uw-lease-review', 'uw-lease-walkout', 'uw-lease-balance'],
  ['uw-narrow-truce', 'uw-truce-guarantor', 'uw-truce-breach', 'uw-truce-signature'],
  ['uw-unfinished-plan', 'uw-plan-review', 'uw-plan-leak', 'uw-plan-aftermath'],
  ['uw-open-post', 'uw-post-roster', 'uw-post-dispute', 'uw-post-morning'],
];

describe('authored game catalogs', () => {
  it('supplies the complete playable city and progression catalogs', () => {
    expect(districts.map(d => d.id)).toEqual(['old-quarter', 'portside', 'the-strip', 'ironworks', 'crown-heights']);
    expect(activities).toHaveLength(30);
    expect(events).toHaveLength(132);
    expect(underworldEvents).toHaveLength(48);
    expect(crew).toHaveLength(11);
    expect(businesses).toHaveLength(15);
    expect(items).toHaveLength(40);
    expect(quests.filter(q => q.kind === 'main')).toHaveLength(14);
    expect(quests.filter(q => q.kind === 'side')).toHaveLength(24);
    expect(contacts).toHaveLength(6);
    expect(safehouseUpgrades).toHaveLength(4);
    expect(zones).toHaveLength(15);
    expect(rivals).toHaveLength(5);
    expect(operations).toHaveLength(3);
  });

  it('keeps all entity IDs unique so saves resolve a single record', () => {
    for (const catalog of [districts, activities, events, crew, businesses, items, quests, contacts, safehouseUpgrades, zones, rivals, operations]) {
      expect(new Set(catalog.map(entry => entry.id)).size).toBe(catalog.length);
      for (const entry of catalog) expect(entry.id).toMatch(/^[a-z0-9-]+$/);
    }
    expect(new Set(events.map(event => event.title)).size).toBe(events.length);
    expect(new Set(events.map(event => event.text)).size).toBe(events.length);
  });

  it('gives each district six jobs with valid rewards and usable requirements', () => {
    for (const district of districts) {
      expect(activities.filter(a => a.districtId === district.id)).toHaveLength(6);
    }
    expect(new Set(activities.map(a => a.category))).toEqual(new Set(['Theft', 'Burglary', 'Vehicle theft', 'Smuggling', 'Debt collection', 'Delivery', 'Protection', 'Warehouse raid', 'Heist']));
    for (const activity of activities) {
      expect(districts.some(d => d.id === activity.districtId)).toBe(true);
      expect(skillKeys).toContain(activity.skill);
      expect(activity.reward[0]).toBeGreaterThan(0);
      expect(activity.reward[1]).toBeGreaterThanOrEqual(activity.reward[0]);
      expect(activity.baseChance).toBeGreaterThan(0);
      expect(activity.baseChance).toBeLessThanOrEqual(100);
      if (activity.requiredItem) expect(items.some(i => i.id === activity.requiredItem)).toBe(true);
      if (activity.requiredCrew) expect(activity.requiredCrew).toBeLessThanOrEqual(crew.length);
    }
  });

  it('offers two to four actionable choices and resolves every story branch', () => {
    const eventIds = new Set(events.map(event => event.id));
    const authoredFlags = new Set(events.flatMap(event => event.choices.flatMap(choice => [
      ...(choice.effects.flags ?? []), ...(choice.failure?.flags ?? []),
    ])));
    // Meridian completion is emitted by the engine after its final stage.
    authoredFlags.add('heist-completed');
    authoredFlags.add('battle-won');
    authoredFlags.add('operation-completed');
    let chains = 0;
    for (const event of events) {
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
      expect(event.choices.length).toBeLessThanOrEqual(4);
      expect(event.weight).toBeGreaterThan(0);
      expect(new Set(event.choices.map(choice => choice.id)).size).toBe(event.choices.length);
      if (event.districtId) expect(districts.some(d => d.id === event.districtId)).toBe(true);
      if (event.requiredFlag) expect(authoredFlags.has(event.requiredFlag)).toBe(true);
      if (event.forbiddenFlag) expect(authoredFlags.has(event.forbiddenFlag)).toBe(true);
      for (const choice of event.choices) {
        expect(choice.label.trim().length).toBeGreaterThan(0);
        expect(choice.result.trim().length).toBeGreaterThan(0);
        expect(Object.keys(choice.effects).length).toBeGreaterThan(0);
        if (choice.chance !== undefined) {
          expect(choice.chance).toBeGreaterThan(0);
          expect(choice.chance).toBeLessThanOrEqual(100);
          expect(choice.failureResult).toBeTruthy();
          expect(choice.failure).toBeDefined();
        }
        if (choice.skill) expect(skillKeys).toContain(choice.skill);
        if (choice.requiredFlag) expect(authoredFlags.has(choice.requiredFlag)).toBe(true);
        for (const branch of [choice.followUp, choice.failureFollowUp]) {
          if (branch) { expect(eventIds.has(branch)).toBe(true); chains += 1; }
        }
      }
    }
    expect(chains).toBeGreaterThanOrEqual(10);
    expect(events.some(event => event.jailOnly)).toBe(true);
    expect(events.some(event => event.requiresBusiness)).toBe(true);
    expect(events.some(event => event.requiresCrew)).toBe(true);
    expect(events.some(event => event.minHeat !== undefined)).toBe(true);
    expect(events.some(event => event.minRep !== undefined)).toBe(true);
  });

  it('resolves item and relationship effects to actual catalog records', () => {
    const inspectEffect = (effect?: Effects) => {
      if (!effect) return;
      if (effect.item) expect(items.some(item => item.id === effect.item)).toBe(true);
      for (const contactId of Object.keys(effect.relationships ?? {})) {
        expect(contacts.some(contact => contact.id === contactId)).toBe(true);
      }
      for (const skill of Object.keys(effect.skillXp ?? {})) expect(skillKeys).toContain(skill);
    };
    for (const event of events) for (const choice of event.choices) {
      inspectEffect(choice.effects); inspectEffect(choice.failure);
    }
    for (const activity of activities) inspectEffect(activity.failure);
    for (const quest of quests) inspectEffect(quest.reward);
  });

  it('lets a broke exhausted player exit every scene without a forced continuation', () => {
    expect(events).toHaveLength(132);
    for (const event of events) {
      const available = event.choices.some(choice => {
        const outcomes = [choice.effects, choice.failure].filter((effect): effect is Effects => effect !== undefined);
        return !choice.requiredFlag && !choice.requiredCrew && !choice.followUp && !choice.failureFollowUp && outcomes.every(effect =>
          (effect.cash ?? 0) >= 0 && (effect.energy ?? 0) >= 0 && (effect.health ?? 0) >= 0,
        );
      });
      expect(available, `${event.id} needs a choice usable at cash 0, energy 0 and health 1`).toBe(true);
    }
  });

  it('keeps 48 concise Underworld scenes with distinct decisions and bounded outcomes', () => {
    expect(underworldEvents).toHaveLength(48);
    expect(new Set(underworldEvents.map(event => event.category))).toEqual(new Set([
      'Supply chain', 'Intelligence', 'Crew command', 'Rival pressure', 'Business pressure', 'Truce', 'Operation planning', 'Defense',
    ]));
    for (const event of underworldEvents) {
      expect(event.text.length, event.id).toBeLessThanOrEqual(260);
      expect(event.choices.length, event.id).toBeGreaterThanOrEqual(3);
      expect(event.weight, event.id).toBeLessThanOrEqual(8);
      expect(new Set(event.choices.map(choice => choice.description)).size, event.id).toBe(event.choices.length);
      for (const choice of event.choices) {
        expect(Object.keys(choice).filter(key => ![
          'id', 'label', 'description', 'effects', 'chance', 'skill', 'failure', 'result', 'failureResult',
          'followUp', 'failureFollowUp', 'requiredFlag', 'requiredCrew',
        ].includes(key)), `${event.id}/${choice.id} contains ignored data`).toEqual([]);
        expect(choice.label.length, `${event.id}/${choice.id}`).toBeLessThanOrEqual(38);
        expect(choice.description.length, `${event.id}/${choice.id}`).toBeLessThanOrEqual(140);
        expect(choice.result.length, `${event.id}/${choice.id}`).toBeLessThanOrEqual(220);
        for (const effect of [choice.effects, choice.failure]) {
          if (!effect) continue;
          for (const key of ['cash', 'energy', 'health', 'heat', 'reputation', 'influence', 'loyalty'] as const) {
            if (effect[key] !== undefined) expect(Number.isFinite(effect[key]), `${event.id}/${choice.id}/${key}`).toBe(true);
          }
          expect(Math.abs(effect.cash ?? 0), event.id).toBeLessThanOrEqual(3500);
          expect(Math.abs(effect.energy ?? 0), event.id).toBeLessThanOrEqual(25);
          expect(effect.jailDays, event.id).toBeUndefined();
        }
        if (choice.chance !== undefined) {
          expect(choice.chance, event.id).toBeGreaterThanOrEqual(40);
          expect(choice.chance, event.id).toBeLessThanOrEqual(85);
          expect(choice.failureResult, event.id).not.toBe(choice.result);
          expect(choice.failure, event.id).not.toEqual(choice.effects);
        }
      }
    }
  });

  it('preserves every legacy event and quest ID referenced by existing saves', () => {
    const legacyEvents = [
      'investigation-letter', 'investigation-hearing', 'witness-memory', 'street-cameras', 'rumor-column',
      'neighbor-question', 'civic-meeting', 'clean-contract', 'attention-spike', 'quiet-week',
      'crew-whisper', 'crew-verdict', 'crew-reconciliation', 'crew-empty-chair', 'missing-envelope',
      'rival-recruiter', 'old-friend-debt', 'loyalty-dinner', 'split-profit', 'confidential-note',
      'gang-truce', 'gang-terms', 'gang-third-party', 'lantern-block', 'salt-picket',
      'velvet-challenge', 'foundry-warning', 'regency-invitation', 'turf-graffiti', 'peace-table',
      'informant-nervous', 'informant-decision', 'informant-exposed', 'false-tip', 'anonymous-ledger',
      'retired-clerk', 'broker-apology', 'lost-contact', 'warehouse-offer', 'warehouse-aftermath',
      'port-sponsor', 'port-dividend', 'vacant-store', 'heirloom-claim', 'rainy-auction',
      'midnight-client', 'skyline-patron', 'quick-contract', 'crew-fall', 'exhaustion',
      'clinic-bill', 'rival-mercy', 'old-wound', 'street-collision', 'flu-week',
      'restorative-break', 'business-letter', 'business-inspection', 'business-recovery', 'cafe-feature',
      'supplier-strike', 'loyal-regular', 'surprise-bonus', 'silent-partner', 'staff-bonus',
      'power-cut', 'tax-quarter', 'business-anniversary', 'jail-arrival', 'jail-library',
      'jail-visitor', 'jail-yard', 'jail-canteen', 'jail-release-offer', 'prison-favor',
      'prison-tab', 'city-storm', 'family-message', 'small-celebration', 'anniversary-promise',
      'rooftop-look', 'lost-suitcase', 'clean-interview', 'long-evening',
    ];
    const legacyQuests = [
      'main-first-steps', 'main-build-crew', 'main-harbor', 'main-own-a-piece', 'main-bright-rooms',
      'main-iron-promise', 'main-crown', 'main-meridian', 'side-three-days', 'side-training',
      'side-equipped', 'side-clean-week', 'side-ten-jobs', 'side-reserve', 'side-team',
      'side-portfolio', 'side-districts', 'side-influence', 'side-season', 'side-legend',
    ];
    expect(events.filter(event => !event.id.startsWith('uw-')).map(event => event.id)).toEqual(legacyEvents);
    expect(quests.filter(quest => !quest.id.includes('-underworld-')).map(quest => quest.id)).toEqual(legacyQuests);
  });

  it('links eight branching aftermath chains without cycles or orphaned follow-ups', () => {
    const byId = new Map(underworldEvents.map(event => [event.id, event]));
    const incoming = new Map<string, number>();
    for (const event of underworldEvents) for (const choice of event.choices) {
      for (const branch of [choice.followUp, choice.failureFollowUp]) {
        if (!branch) continue;
        expect(byId.has(branch), `${event.id} points outside the expansion`).toBe(true);
        incoming.set(branch, (incoming.get(branch) ?? 0) + 1);
        expect(byId.get(branch)?.followUpOnly, branch).toBe(true);
      }
    }
    expect(underworldEvents.filter(event => event.followUpOnly)).toHaveLength(24);
    for (const chain of underworldChains) {
      const [rootId, successId, setbackId, endingId] = chain;
      const root = byId.get(rootId);
      expect(root, rootId).toBeDefined();
      expect(root?.followUpOnly, rootId).not.toBe(true);
      const rootBranches = root?.choices.flatMap(choice => [choice.followUp, choice.failureFollowUp]).filter(Boolean);
      expect(rootBranches, rootId).toContain(successId);
      expect(rootBranches, rootId).toContain(setbackId);
      for (const intermediateId of [successId, setbackId]) {
        const intermediate = byId.get(intermediateId);
        expect(intermediate, intermediateId).toBeDefined();
        expect(intermediate?.choices.flatMap(choice => [choice.followUp, choice.failureFollowUp]), intermediateId).toContain(endingId);
      }
      expect(byId.get(endingId), endingId).toBeDefined();
      expect(byId.get(endingId)?.choices.some(choice => choice.followUp || choice.failureFollowUp), endingId).toBe(false);
    }
    const visit = (id: string, ancestors: Set<string>) => {
      expect(ancestors.has(id), `${id} creates a repeatable story loop`).toBe(false);
      const nextAncestors = new Set([...ancestors, id]);
      for (const choice of byId.get(id)?.choices ?? []) {
        for (const branch of [choice.followUp, choice.failureFollowUp]) if (branch) visit(branch, nextAncestors);
      }
    };
    for (const event of underworldEvents) {
      if (event.followUpOnly) expect(incoming.get(event.id) ?? 0, `${event.id} is unreachable`).toBeGreaterThan(0);
      else visit(event.id, new Set());
    }
  });

  it('closes every random Underworld offer on either outcome so rewards cannot be farmed', () => {
    expect(underworldEvents).toHaveLength(48);
    for (const event of underworldEvents.filter(entry => !entry.followUpOnly)) {
      expect(event.forbiddenFlag, event.id).toBeTruthy();
      for (const choice of event.choices) {
        for (const outcome of [choice.effects, choice.failure].filter((effect): effect is Effects => effect !== undefined)) {
          expect(outcome.flags, `${event.id}/${choice.id} must close on each outcome`).toContain(event.forbiddenFlag);
          expect(outcome.removeFlags ?? [], event.id).not.toContain(event.forbiddenFlag);
        }
      }
      for (const authored of underworldEvents) for (const choice of authored.choices) {
        for (const outcome of [choice.effects, choice.failure]) expect(outcome?.removeFlags ?? [], authored.id).not.toContain(event.forbiddenFlag);
      }
    }
  });

  it('resolves every new scene escape through the real engine with depleted resources', () => {
    expect(underworldEvents).toHaveLength(48);
    for (const event of underworldEvents) {
      const escape = event.choices.find(choice => !choice.requiredFlag && !choice.requiredCrew && !choice.followUp && !choice.failureFollowUp
        && [choice.effects, choice.failure].filter((effect): effect is Effects => effect !== undefined).every(effect =>
          (effect.cash ?? 0) >= 0 && (effect.energy ?? 0) >= 0 && (effect.health ?? 0) >= 0));
      expect(escape, event.id).toBeDefined();
      const state = createGame('Catalogue', 'boss', 17);
      state.stats = { cash: 0, reputation: 850, heat: 0, health: 1, energy: 0, influence: 10 };
      state.districtId = event.districtId ?? 'old-quarter';
      state.crew = [crew[0].id]; state.crewLoyalty[crew[0].id] = 70;
      state.businesses = [{ id: businesses[0].id, level: 1 }];
      state.flags = event.requiredFlag ? [event.requiredFlag] : [];
      state.pendingEvent = { id: event.id };
      expect(eventChoiceRequirements(state, escape!), event.id).toEqual([]);
      const result = gameReducer(state, { type: 'CHOOSE_EVENT', choiceId: escape!.id });
      expect(result.pendingEvent, event.id).toBeNull();
      expect(result.result?.title, event.id).not.toBe('Unavailable');
      expect(result.result?.nextEvent, event.id).toBeUndefined();
      expect(result.stats.cash, event.id).toBeGreaterThanOrEqual(0);
      expect(result.stats.energy, event.id).toBeGreaterThanOrEqual(0);
      expect(result.stats.health, event.id).toBeGreaterThanOrEqual(1);
      expect(eventIsEligible(result, event), `${event.id} cannot immediately recur`).toBe(false);
    }
  });

  it('resolves both outcomes of new choices and carries their required flags into aftermaths', () => {
    expect(underworldEvents).toHaveLength(48);
    for (const event of underworldEvents) for (const choice of event.choices) {
      const outcomes = [{ seed: 0, success: true, effect: choice.effects, followUp: choice.followUp }];
      if (choice.chance !== undefined) outcomes.push({ seed: 1600, success: false, effect: choice.failure!, followUp: choice.failureFollowUp });
      for (const outcome of outcomes) {
        const state = createGame('Catalogue', 'boss', outcome.seed);
        state.stats = { cash: 100000, reputation: 850, heat: 0, health: 100, energy: 100, influence: 30 };
        state.skills = { charisma: 1, streetSmarts: 1, combat: 1, driving: 1, stealth: 1, business: 1 };
        state.districtId = event.districtId ?? 'old-quarter';
        state.crew = crew.slice(0, 3).map(member => member.id);
        state.crewLoyalty = Object.fromEntries(state.crew.map(id => [id, 70]));
        state.businesses = [{ id: businesses[0].id, level: 1 }];
        state.flags = [...(event.requiredFlag ? [event.requiredFlag] : []), ...(choice.requiredFlag ? [choice.requiredFlag] : [])];
        state.pendingEvent = { id: event.id };
        expect(eventChoiceRequirements(state, choice), `${event.id}/${choice.id}`).toEqual([]);
        const result = gameReducer(state, { type: 'CHOOSE_EVENT', choiceId: choice.id });
        expect(result.result?.success, `${event.id}/${choice.id}/${outcome.success}`).toBe(outcome.success);
        expect(result.result?.nextEvent, `${event.id}/${choice.id}`).toBe(outcome.followUp);
        expect(result.stats.cash, `${event.id}/${choice.id}`).toBe(100000 + (outcome.effect.cash ?? 0));
        for (const flag of outcome.effect.flags ?? []) expect(result.flags, event.id).toContain(flag);
        if (outcome.followUp) {
          const target = events.find(next => next.id === outcome.followUp)!;
          if (target.requiredFlag) expect(result.flags, `${event.id} cannot meet ${target.id}'s prerequisite`).toContain(target.requiredFlag);
          const resumed = gameReducer(result, { type: 'DISMISS_RESULT' });
          expect(resumed.pendingEvent?.id, event.id).toBe(outcome.followUp);
        }
        if (!event.followUpOnly) expect(eventIsEligible(result, event), `${event.id} should close on ${outcome.success}`).toBe(false);
      }
    }
  });

  it('makes risky crew commitments require a healthy member and applies their declared recovery consequence', () => {
    for (const [eventId, choiceId] of [
      ['uw-second-shift', 'ask'], ['uw-rival-deadline', 'firm'], ['uw-open-post', 'judgment'],
    ]) {
      const event = events.find(entry => entry.id === eventId)!;
      const choice = event.choices.find(entry => entry.id === choiceId)!;
      expect(choice.requiredCrew, eventId).toBe(1);
      expect(choice.failure?.injuredCrew, eventId).toBe(true);
      const state = createGame('Catalogue', 'boss', 1600);
      state.stats.cash = 10000; state.stats.heat = 0; state.stats.energy = 100;
      state.skills = { charisma: 1, streetSmarts: 1, combat: 1, driving: 1, stealth: 1, business: 1 };
      state.crew = crew.slice(0, 3).map(member => member.id);
      state.crewLoyalty = Object.fromEntries(state.crew.map(id => [id, 70]));
      state.pendingEvent = { id: eventId };
      const failed = gameReducer(state, { type: 'CHOOSE_EVENT', choiceId });
      expect(failed.result?.success, eventId).toBe(false);
      expect(Object.values(failed.crewInjured).filter(days => days > 0), eventId).toHaveLength(1);
      const exhaustedCrew = { ...state, crewInjured: Object.fromEntries(state.crew.map(id => [id, 2])) };
      expect(eventChoiceRequirements(exhaustedCrew, choice), eventId).toContain('Requires 1 healthy, loyal crew.');
    }
  });

  it('keeps victory and operation aftermaths out of the draw until their actual objective succeeds', () => {
    for (const [eventId, flag] of [
      ['uw-victory-bonus', 'battle-won'], ['uw-burned-reserve', 'operation-completed'], ['uw-skyline-quiet', 'heist-completed'],
    ]) {
      const event = events.find(entry => entry.id === eventId)!;
      const state = createGame('Catalogue', 'boss', 0);
      state.stats.reputation = 850; state.stats.heat = 0;
      state.crew = [crew[0].id]; state.crewLoyalty[crew[0].id] = 70;
      state.districtId = event.districtId ?? 'old-quarter';
      expect(event.requiredFlag, eventId).toBe(flag);
      expect(eventIsEligible(state, event), eventId).toBe(false);
      expect(eventIsEligible({ ...state, flags: [flag] }, event), eventId).toBe(true);
      expect(eventIsEligible({ ...state, flags: [flag, event.forbiddenFlag!] }, event), eventId).toBe(false);
    }
  });

  it('makes every conditional expansion choice reachable through an authored preceding branch', () => {
    const byId = new Map(underworldEvents.map(event => [event.id, event]));
    const reachedChoices = new Set<string>();
    const visit = (event: GameEvent, flags: Set<string>) => {
      if (event.requiredFlag) expect(flags.has(event.requiredFlag), event.id).toBe(true);
      for (const choice of event.choices) {
        if (choice.requiredFlag && !flags.has(choice.requiredFlag)) continue;
        reachedChoices.add(`${event.id}/${choice.id}`);
        for (const [effect, branch] of [[choice.effects, choice.followUp], [choice.failure, choice.failureFollowUp]] as const) {
          if (!effect || !branch) continue;
          const nextFlags = new Set([...flags, ...(effect.flags ?? [])]);
          for (const flag of effect.removeFlags ?? []) nextFlags.delete(flag);
          visit(byId.get(branch)!, nextFlags);
        }
      }
    };
    for (const root of underworldEvents.filter(event => !event.followUpOnly)) visit(root, new Set(root.requiredFlag ? [root.requiredFlag] : []));
    for (const event of underworldEvents) for (const choice of event.choices) {
      expect(reachedChoices.has(`${event.id}/${choice.id}`), `${event.id}/${choice.id} never becomes available`).toBe(true);
    }
  });

  it('requires measurable strategy objectives for the new main and side milestones', () => {
    const newMain = quests.filter(quest => quest.kind === 'main' && quest.id.startsWith('main-underworld-'));
    const newSide = quests.filter(quest => quest.kind === 'side' && quest.id.startsWith('side-underworld-'));
    expect(newMain).toHaveLength(6);
    expect(newSide).toHaveLength(12);
    expect(newMain[0]?.prerequisite).toBe('main-meridian');
    expect(new Set(newMain.map(quest => quest.metric))).toEqual(new Set(['zones', 'battles', 'operations']));
    const strategies = [...newMain, ...newSide].filter(quest => ['zones', 'battles', 'operations'].includes(quest.metric));
    expect(strategies).toHaveLength(15);
    for (const quest of strategies) {
      expect(Number.isInteger(quest.target), quest.id).toBe(true);
      expect(quest.target, quest.id).toBeGreaterThanOrEqual(quest.metric === 'zones' ? 2 : 1);
      expect(quest.target, quest.id).toBeLessThanOrEqual(quest.metric === 'zones' ? 15 : 12);
      expect(quest.reward.cash ?? 0, quest.id).toBeGreaterThan(0);
      expect(quest.reward.cash ?? 0, quest.id).toBeLessThanOrEqual(20000);
      expect(quest.description.toLowerCase(), quest.id).toContain(quest.metric === 'zones' ? 'zone' : quest.metric === 'battles' ? 'battle' : 'operation');
    }
    const seen = new Set<string>();
    for (const quest of quests) {
      if (quest.prerequisite) expect(seen.has(quest.prerequisite), `${quest.id} must follow its prerequisite`).toBe(true);
      seen.add(quest.id);
    }
  });

  it('awards authored strategy milestones only after the measured ownership, victories or completions exist', () => {
    const measured = quests.filter(quest => quest.id.includes('-underworld-') && ['zones', 'battles', 'operations'].includes(quest.metric));
    expect(measured).toHaveLength(15);
    for (const quest of measured) {
      const state = createGame('Catalogue', 'boss', 0);
      state.stats.reputation = 850;
      state.claimedQuests = quest.prerequisite ? [quest.prerequisite] : [];
      state.strategy!.counters.zonesCaptured = 15;
      state.strategy!.counters.battlesFought = 20;
      expect(questProgress(state, quest), quest.id).toBe(quest.metric === 'zones' ? 1 : 0);
      const rejected = gameReducer(state, { type: 'CLAIM_QUEST', id: quest.id });
      expect(rejected.claimedQuests, quest.id).not.toContain(quest.id);
      expect(rejected.stats.cash, quest.id).toBe(state.stats.cash);

      const achieved = structuredClone(state);
      if (quest.metric === 'zones') {
        for (const zone of zones.slice(0, quest.target)) Object.assign(achieved.strategy!.zones[zone.id], { owner: 'player', control: 100 });
      } else if (quest.metric === 'battles') achieved.strategy!.counters.battlesWon = quest.target;
      else achieved.strategy!.counters.operationsCompleted = quest.target;
      expect(questProgress(achieved, quest), quest.id).toBe(quest.target);
      const claimed = gameReducer(achieved, { type: 'CLAIM_QUEST', id: quest.id });
      expect(claimed.claimedQuests, quest.id).toContain(quest.id);
      expect(claimed.stats.cash, quest.id).toBe(achieved.stats.cash + (quest.reward.cash ?? 0));
      const repeated = gameReducer(gameReducer(claimed, { type: 'DISMISS_RESULT' }), { type: 'CLAIM_QUEST', id: quest.id });
      expect(repeated.stats.cash, `${quest.id} must grant once`).toBe(claimed.stats.cash);
      if (quest.prerequisite) expect(questProgress({ ...achieved, claimedQuests: [] }, quest), `${quest.id} needs its preceding reward`).toBe(0);
    }
  });

  it('keeps an affordable opening and advances through an unbroken main story', () => {
    const startingCash = 6800;
    const earlyCrew = crew.filter(c => c.requiredRep <= 75 && c.cost >= 1600 && c.cost <= 3500);
    const earlyBusiness = businesses.filter(b => b.requiredRep <= 75 && b.cost >= 1600 && b.cost <= 3500);
    expect(earlyCrew.length).toBeGreaterThanOrEqual(2);
    expect(earlyBusiness.length).toBeGreaterThanOrEqual(1);
    expect(Math.min(...earlyCrew.map(c => c.cost)) + Math.min(...earlyBusiness.map(b => b.cost))).toBeLessThanOrEqual(startingCash);
    expect(districts.map(d => d.requiredRep)).toEqual([0, 100, 200, 350, 550]);
    for (const member of crew) {
      expect(member.rating).toBeGreaterThanOrEqual(1);
      expect(member.rating).toBeLessThanOrEqual(10);
      expect(skillKeys).toContain(member.skill);
    }
    const main = quests.filter(q => q.kind === 'main');
    expect(main[0]?.prerequisite).toBeUndefined();
    for (let index = 1; index < main.length; index += 1) expect(main[index].prerequisite).toBe(main[index - 1].id);
    for (const quest of quests) {
      if (quest.prerequisite) expect(quests.some(q => q.id === quest.prerequisite)).toBe(true);
      expect(contacts.some(contact => contact.id === quest.contact)).toBe(true);
      expect(quest.target).toBeGreaterThan(0);
    }
  });

  it('provides a four-stage major heist with valid required equipment', () => {
    expect(heist).toBeDefined();
    expect(heist?.stages).toHaveLength(4);
    expect(heist?.requiredRep).toBe(550);
    expect(heist?.requiredCrew).toBe(3);
    expect(heist?.cost).toBe(15000);
    expect(heist?.reward).toEqual([95000, 160000]);
    for (const itemId of heist?.requiredItems ?? []) expect(items.some(item => item.id === itemId)).toBe(true);
    for (const stage of heist?.stages ?? []) {
      expect(skillKeys).toContain(stage.skill);
      expect(stage.choices.length).toBeGreaterThanOrEqual(2);
      expect(stage.choices.length).toBeLessThanOrEqual(4);
      expect(new Set(stage.choices.map(choice => choice.id)).size).toBe(stage.choices.length);
    }
  });

  it('connects every strategy zone to the starting base with valid neighboring and rival references', () => {
    expect(zones).toHaveLength(15);
    const byId = new Map(zones.map(zone => [zone.id, zone]));
    expect(byId.has('market-street')).toBe(true);
    const reached = new Set<string>();
    const pending = ['market-street'];
    while (pending.length) {
      const id = pending.pop()!;
      if (reached.has(id)) continue;
      reached.add(id);
      pending.push(...(byId.get(id)?.neighbors ?? []));
    }
    expect(reached.size).toBe(15);
    for (const district of districts) expect(zones.filter(zone => zone.districtId === district.id)).toHaveLength(3);
    for (const zone of zones) {
      const district = districts.find(entry => entry.id === zone.districtId);
      const rival = rivals.find(entry => entry.id === zone.rivalId);
      expect(district, zone.id).toBeDefined();
      expect(rival?.districtId, zone.id).toBe(zone.districtId);
      expect(zone.requiredRep, zone.id).toBeGreaterThanOrEqual(district!.requiredRep);
      expect(zone.x, zone.id).toBeGreaterThanOrEqual(0); expect(zone.x, zone.id).toBeLessThanOrEqual(100);
      expect(zone.y, zone.id).toBeGreaterThanOrEqual(0); expect(zone.y, zone.id).toBeLessThanOrEqual(100);
      expect(zone.upkeep, zone.id).toBeGreaterThanOrEqual(0);
      expect(zone.income, zone.id).toBeGreaterThanOrEqual(zone.upkeep);
      expect(zone.defense, zone.id).toBeGreaterThan(0);
      expect(new Set(zone.neighbors).size, zone.id).toBe(zone.neighbors.length);
      for (const neighborId of zone.neighbors) {
        expect(neighborId, zone.id).not.toBe(zone.id);
        expect(byId.get(neighborId)?.neighbors, `${zone.id}/${neighborId} must be reciprocal`).toContain(zone.id);
      }
    }
    for (const rival of rivals) {
      expect(districts.some(district => district.id === rival.districtId), rival.id).toBe(true);
      expect(rival.strength, rival.id).toBeGreaterThan(0); expect(rival.strength, rival.id).toBeLessThanOrEqual(100);
      expect(rival.hostility, rival.id).toBeGreaterThanOrEqual(0); expect(rival.hostility, rival.id).toBeLessThanOrEqual(100);
    }
  });

  it('gives major operations valid crew, equipment and complete paths without mandatory stage cash', () => {
    expect(operations).toHaveLength(3);
    for (const operation of operations) {
      expect(districts.some(district => district.id === operation.districtId), operation.id).toBe(true);
      expect(operation.requiredCrew, operation.id).toBeGreaterThanOrEqual(2);
      expect(operation.requiredCrew, operation.id).toBeLessThanOrEqual(crew.length);
      expect(crew.filter(member => member.requiredRep <= operation.requiredRep).length, operation.id).toBeGreaterThanOrEqual(operation.requiredCrew);
      for (const itemId of operation.requiredItems) expect(items.some(item => item.id === itemId && item.requiredRep <= operation.requiredRep), operation.id).toBe(true);
      expect(operation.stages, operation.id).toHaveLength(3);
      expect(new Set(operation.stages.map(stage => stage.id)).size, operation.id).toBe(operation.stages.length);
      expect(operation.cost, operation.id).toBeGreaterThan(0);
      expect(operation.energy, operation.id).toBeGreaterThan(0);
      expect(operation.cooldown, operation.id).toBeGreaterThanOrEqual(1);
      expect(operation.reward[0], operation.id).toBeGreaterThan(operation.cost);
      expect(operation.reward[1], operation.id).toBeGreaterThanOrEqual(operation.reward[0]);
      let noCashProgress = 0; let noCashEnergy = operation.energy;
      for (const stage of operation.stages) {
        expect(skillKeys, stage.id).toContain(stage.skill);
        expect(stage.choices.length, stage.id).toBeGreaterThanOrEqual(2); expect(stage.choices.length, stage.id).toBeLessThanOrEqual(4);
        expect(new Set(stage.choices.map(choice => choice.id)).size, stage.id).toBe(stage.choices.length);
        const careful = stage.choices.find(choice => choice.cost === 0 && choice.suspicion <= 8);
        expect(careful, `${stage.id} needs a patient path without cash`).toBeDefined();
        noCashProgress += careful!.progress; noCashEnergy += careful!.energy;
        for (const choice of stage.choices) {
          expect(Number.isInteger(choice.cost), choice.id).toBe(true); expect(choice.cost, choice.id).toBeGreaterThanOrEqual(0);
          expect(choice.energy, choice.id).toBeGreaterThan(0); expect(choice.energy, choice.id).toBeLessThanOrEqual(20);
          expect(choice.progress, choice.id).toBeGreaterThan(0); expect(choice.progress, choice.id).toBeLessThanOrEqual(60);
          expect(choice.injuryChance, choice.id).toBeGreaterThanOrEqual(0); expect(choice.injuryChance, choice.id).toBeLessThanOrEqual(100);
          expect(Math.abs(choice.chanceBonus), choice.id).toBeLessThanOrEqual(30);
          expect(Math.abs(choice.suspicion), choice.id).toBeLessThanOrEqual(40);
        }
      }
      expect(noCashProgress, operation.id).toBeGreaterThanOrEqual(100);
      expect(noCashEnergy, operation.id).toBeLessThanOrEqual(100);
    }
  });

  it('uses only bundled art so catalogs are available offline', () => {
    const art = [
      ...districts.map(d => d.image), ...activities.map(a => a.image), ...events.map(e => e.image),
      ...crew.map(c => c.portrait), ...businesses.map(b => b.image), ...items.map(i => i.image),
      ...quests.map(q => q.image), ...contacts.map(c => c.portrait), ...(heist ? [heist.image] : []),
      ...rivals.map(rival => rival.image), ...operations.map(operation => operation.image),
    ];
    for (const path of art) {
      expect(path).toMatch(/^\/assets\/[a-z0-9-]+\.webp$/);
      expect(existsSync(new URL(`../../public${path}`,import.meta.url)),`${path} must be bundled`).toBe(true);
    }
    expect(new Set(items.map(item=>item.image)).size).toBe(items.length);
  });
});
