import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Activity, Business, Contact, CrewMember, District, Effects, GameEvent, HeistDefinition, Item, Quest, SafehouseUpgrade } from './types';

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
const heistUrl = new URL('../data/heist.json', import.meta.url);
const heist = existsSync(heistUrl) ? JSON.parse(readFileSync(heistUrl, 'utf8')) as HeistDefinition : undefined;
const skillKeys = ['charisma', 'streetSmarts', 'combat', 'driving', 'stealth', 'business'];

describe('authored game catalogs', () => {
  it('supplies the complete playable city and progression catalogs', () => {
    expect(districts.map(d => d.id)).toEqual(['old-quarter', 'portside', 'the-strip', 'ironworks', 'crown-heights']);
    expect(activities).toHaveLength(30);
    expect(events.length).toBeGreaterThanOrEqual(78);
    expect(crew).toHaveLength(11);
    expect(businesses).toHaveLength(15);
    expect(items).toHaveLength(40);
    expect(quests.filter(q => q.kind === 'main')).toHaveLength(8);
    expect(quests.filter(q => q.kind === 'side')).toHaveLength(12);
    expect(contacts).toHaveLength(6);
    expect(safehouseUpgrades).toHaveLength(4);
  });

  it('keeps all entity IDs unique so saves resolve a single record', () => {
    for (const catalog of [districts, activities, events, crew, businesses, items, quests, contacts, safehouseUpgrades]) {
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
    expect(events.length).toBeGreaterThanOrEqual(78);
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

  it('uses only bundled art so catalogs are available offline', () => {
    const art = [
      ...districts.map(d => d.image), ...activities.map(a => a.image), ...events.map(e => e.image),
      ...crew.map(c => c.portrait), ...businesses.map(b => b.image), ...items.map(i => i.image),
      ...quests.map(q => q.image), ...contacts.map(c => c.portrait), ...(heist ? [heist.image] : []),
    ];
    for (const path of art) {
      expect(path).toMatch(/^\/assets\/[a-z0-9-]+\.webp$/);
      expect(existsSync(new URL(`../../public${path}`,import.meta.url)),`${path} must be bundled`).toBe(true);
    }
    expect(new Set(items.map(item=>item.image)).size).toBe(items.length);
  });
});
