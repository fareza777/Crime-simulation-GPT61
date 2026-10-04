import { describe, expect, it } from 'vitest';
import { activities, businesses, contacts as contactData, crew, events, heist, items, quests, safehouseUpgrades as safehouseData } from '../data';
import { createGame, gameReducer, jobChance, jobFailureEffects, heatGain, jobRequirements, questProgress, dailyIncome, crewSalary, heistRequirements, rankFor, skillLabels, trainingCost, bailCost, businessUpgradeCost, safehouseUpgradeCost, influenceCost, influenceChance, contactCost, heistChance, eventChance, eventChoiceRequirements, eventIsEligible, layLowCost } from './engine';
import type { Activity, CareerPath, EventChoice, GameEvent, GameState, Quest } from './types';
const warehouse = activities.find(activity => activity.id === 'old-warehouse')!;

const job: Activity = {
  id: 'test-job', name: 'Trial run', category: 'Theft', districtId: 'old-quarter',
  description: '', image: '', difficulty: 2, cost: 500, energy: 20, baseChance: 55,
  reward: [1000, 2000], heat: 8, rep: 15, requiredRep: 0, skill: 'stealth',
  successText: 'The package is secure.', failureText: 'The package is lost.', failure: { health: -10 },
};

function ready(seed = 42): GameState {
  return createGame('Morgan', 'thief', seed);
}

function alter(state: GameState, patch: Partial<GameState['stats']>): GameState {
  return { ...state, stats: { ...state.stats, ...patch } };
}

describe('new careers and requirements', () => {
  it('creates a playable offline state with path strengths and a reproducible seed', () => {
    const thief = ready(123);
    expect(thief.stats).toMatchObject({ cash: 6800, reputation: 75, heat: 18, health: 100, energy: 85, influence: 5 });
    expect(thief.skills.stealth).toBeGreaterThan(thief.skills.business);
    expect(thief.day).toBe(1);
    expect(thief.player.portrait).toBe('/assets/player.webp');
    expect(thief.crew).toEqual([]);
    expect(thief.businesses).toEqual([]);
    expect(ready(123)).toEqual(thief);
  });

  it('gives all career paths legal skill levels and some distinct advantages', () => {
    const paths: CareerPath[] = ['thief', 'smuggler', 'leader', 'fixer', 'businessman', 'boss'];
    const starts = paths.map(path => createGame('Casey', path, 1));
    expect(new Set(starts.map(state => JSON.stringify([state.stats, state.skills]))).size).toBe(6);
    for (const state of starts) for (const level of Object.values(state.skills)) expect(level).toBeGreaterThanOrEqual(1);
    expect(Object.keys(skillLabels)).toHaveLength(6);
    expect(rankFor(700)).not.toBe(rankFor(75));
  });

  it('discloses all cash, energy, reputation, item, district and crew locks', () => {
    const state = alter(ready(), { cash: 10, energy: 1, reputation: 1, health: 15 });
    const requirements = jobRequirements(state, { ...job, districtId: 'crown-heights', requiredRep: 550, requiredItem: 'executive-pass', requiredCrew: 3 });
    expect(requirements.some(text => /cash|\$|funds/i.test(text))).toBe(true);
    expect(requirements.some(text => /energy/i.test(text))).toBe(true);
    expect(requirements.some(text => /reputation/i.test(text))).toBe(true);
    expect(requirements.some(text => /pass|item|equipment/i.test(text))).toBe(true);
    expect(requirements.some(text => /crew/i.test(text))).toBe(true);
    expect(requirements.some(text => /district|travel|heights/i.test(text))).toBe(true);
    expect(requirements.some(text => /health/i.test(text))).toBe(true);
  });

  it('heat lowers success and trained skills improve success with explicit approach bonuses', () => {
    const state = ready();
    const highHeat = alter(state, { heat: 90 });
    const skilled = { ...state, skills: { ...state.skills, stealth: 10 } };
    expect(jobChance(highHeat, job)).toBeLessThan(jobChance(state, job));
    expect(jobChance(skilled, job)).toBeGreaterThan(jobChance(state, job));
    expect(jobChance(state, job, 'informant') - jobChance(state, job, 'rush')).toBe(12);
    expect(jobChance(state, job, 'scout') - jobChance(state, job, 'rush')).toBe(18);
    expect(jobChance(state, job, 'leave')).toBe(0);
    expect(jobChance(highHeat, { ...job, baseChance: -100 })).toBeGreaterThanOrEqual(0);
    expect(jobChance(skilled, { ...job, baseChance: 500 })).toBeLessThanOrEqual(100);
  });
});

describe('immutable safety and quest accounting', () => {
  it('ignores unresolved job decisions and unknown purchases without charging the player', () => {
    const state = ready();
    expect(gameReducer(state, { type: 'RESOLVE_JOB', approach: 'rush' })).toEqual(state);
    const after = gameReducer(state, { type: 'BUY_ITEM', id: 'does-not-exist' });
    expect(after.stats).toEqual(state.stats);
    expect(state.result).toBeNull();
  });

  it('progress measures the target without letting a future quest bypass its prerequisite', () => {
    const state = ready();
    const quest: Quest = { id: 'future', name: 'Future', description: '', kind: 'main', prerequisite: 'previous', target: 3, metric: 'jobsSucceeded', reward: { cash: 10 }, contact: '', image: '' };
    const accomplished = { ...state, counters: { ...state.counters, jobsSucceeded: 10 } };
    expect(questProgress(accomplished, quest)).toBe(0);
    expect(questProgress({ ...accomplished, claimedQuests: ['previous'] }, quest)).toBe(3);
  });

  it('has no passive income or salaries before an empire is purchased', () => {
    expect(dailyIncome(ready())).toBe(0);
    expect(crewSalary(ready())).toBe(0);
    expect(heistRequirements(ready()).length).toBeGreaterThan(0);
  });
});

describe('personal recovery and daily turns', () => {
  it('recovers from laying low once and ignores a repeated action while its outcome is open', () => {
    const state = alter(ready(), { health: 60, heat: 8, energy: 25 });
    const after = gameReducer(state, { type: 'LAY_LOW' });
    expect(after.stats).toMatchObject({ heat: 0, health: 65, energy: 5 });
    expect(state.stats).toMatchObject({ heat: 8, health: 60, energy: 25 });
    expect(gameReducer(after, { type: 'LAY_LOW' })).toEqual(after);
    expect(gameReducer(after, { type: 'DISMISS_RESULT' }).stats).toEqual(after.stats);
  });

  it('rejects unaffordable medical care and caps paid healing at full health', () => {
    const poor = alter(ready(), { cash: 499, health: 20 });
    expect(gameReducer(poor, { type: 'HEAL' }).stats).toEqual(poor.stats);
    const wealthy = alter(ready(), { cash: 700, health: 90 });
    expect(gameReducer(wealthy, { type: 'HEAL' }).stats).toMatchObject({ cash: 200, health: 100 });
  });

  it('training spends its disclosed cost and energy, awards a level, and respects level ten', () => {
    const state = ready();
    expect(trainingCost(state, 'combat')).toBe(800);
    const trained = gameReducer(state, { type: 'TRAIN', skill: 'combat' });
    expect(trained.stats.cash).toBe(6000);
    expect(trained.stats.energy).toBe(65);
    expect(trained.skills.combat).toBe(3);
    expect(trained.counters.training).toBe(1);
    const maxed = { ...state, skills: { ...state.skills, combat: 10 } };
    expect(gameReducer(maxed, { type: 'TRAIN', skill: 'combat' }).stats).toEqual(maxed.stats);
  });

  it('advances only an explicit day and recovers health, energy, and heat', () => {
    const state = alter(ready(), { health: 50, energy: 0, heat: 20 });
    const after = gameReducer(state, { type: 'NEXT_DAY' });
    expect(after.day).toBe(2);
    expect(after.stats).toMatchObject({ cash: 6800, health: 65, energy: 100, heat: 14 });
    expect(state.day).toBe(1);
    expect(gameReducer(after, { type: 'NEXT_DAY' })).toEqual(after);
  });

  it('counts down jail sentences on game days and makes bail a one-time purchase', () => {
    const prisoner: GameState = { ...ready(), jail: { days: 2, reason: 'An investigation' } };
    const after = gameReducer(prisoner, { type: 'NEXT_DAY' });
    expect(after.jail?.days).toBe(1);
    expect(after.day).toBe(2);
    expect(gameReducer(prisoner, { type: 'START_JOB', id: 'old-warehouse' }).stats).toEqual(prisoner.stats);
    expect(bailCost(prisoner)).toBe(2800);
    const released = gameReducer(prisoner, { type: 'BAIL' });
    expect(released.jail).toBeNull();
    expect(released.stats.cash).toBe(4000);
    expect(gameReducer(released, { type: 'BAIL' })).toEqual(released);
  });

  it('high police attention can cause a seeded arrest with penalties instead of negative cash', () => {
    const state = alter(ready(0), { cash: 120, heat: 100 });
    const after = gameReducer(state, { type: 'NEXT_DAY' });
    expect(after.jail).not.toBeNull();
    expect(after.stats.cash).toBe(0);
    expect(after.stats.heat).toBeLessThan(state.stats.heat);
    expect(after.result?.text.toLowerCase()).toMatch(/arrest|custody|jail/);
  });
});

describe('job preparation and resolution', () => {
  it('starts a decision without spending resources or allowing a second job to overwrite it', () => {
    const state = ready();
    const prepared = gameReducer(state, { type: 'START_JOB', id: warehouse.id });
    expect(prepared.pendingJob).toEqual({ activityId: warehouse.id });
    expect(prepared.stats).toEqual(state.stats);
    expect(prepared.seed).toBe(state.seed);
    expect(gameReducer(prepared, { type: 'START_JOB', id: activities[1].id })).toEqual(prepared);
    const left = gameReducer(prepared, { type: 'RESOLVE_JOB', approach: 'leave' });
    expect(left.pendingJob).toBeNull();
    expect(left.stats).toEqual(state.stats);
    expect(left.counters.jobsAttempted).toBe(0);
  });

  it('uses persisted randomness, spends job plus preparation once and cannot replay the outcome', () => {
    const state = ready(1);
    const prepared = gameReducer(state, { type: 'START_JOB', id: warehouse.id });
    const action = { type: 'RESOLVE_JOB', approach: 'informant' } as const;
    const after = gameReducer(prepared, action);
    expect(after).toEqual(gameReducer(prepared, action));
    expect(after.seed).not.toBe(state.seed);
    expect(after.pendingJob).toBeNull();
    expect(after.counters.jobsAttempted).toBe(1);
    expect(after.counters.jobsSucceeded).toBe(1);
    expect(after.stats.cash).toBeGreaterThanOrEqual(6800 - 700 - 420 + 8000);
    expect(after.stats.cash).toBeLessThanOrEqual(6800 - 700 - 420 + 18000);
    expect(after.stats.energy).toBe(65);
    expect(prepared.stats).toEqual(state.stats);
    expect(gameReducer(after, action)).toEqual(after);
    const dismissed = gameReducer(after, { type: 'DISMISS_RESULT' });
    expect(gameReducer(dismissed, action)).toEqual(dismissed);
    expect(dismissed.stats).toEqual(after.stats);
  });

  it('prevents an unaffordable informant and unavailable scouting from spending any resources', () => {
    const state = alter(ready(), { cash: 700 });
    const prepared = gameReducer(state, { type: 'START_JOB', id: warehouse.id });
    const denied = gameReducer(prepared, { type: 'RESOLVE_JOB', approach: 'informant' });
    expect(denied.stats).toEqual(state.stats);
    expect(denied.pendingJob).not.toBeNull();
    const scouts = gameReducer(gameReducer(denied, { type: 'DISMISS_RESULT' }), { type: 'RESOLVE_JOB', approach: 'scout' });
    expect(scouts.stats).toEqual(state.stats);
    expect(scouts.counters.jobsAttempted).toBe(0);
    expect(scouts.result?.text).toMatch(/crew/i);
  });

  it('rejects every locked job without consuming its entry cost', () => {
    const state = alter(ready(), { cash: 0, energy: 0, reputation: 0, health: 10 });
    const denied = gameReducer(state, { type: 'START_JOB', id: warehouse.id });
    expect(denied.pendingJob).toBeNull();
    expect(denied.stats).toEqual(state.stats);
    expect(denied.result?.text).toMatch(/energy/i);
  });

  it('equipment and a healthy loyal specialist improve chance while injured or disloyal crew do not', () => {
    const member = crew.find(candidate => candidate.skill === warehouse.skill) ?? crew[0];
    const state = { ...ready(), crew: [member.id], crewLoyalty: { [member.id]: 85 }, crewInjured: { [member.id]: 0 } };
    expect(jobChance(state, warehouse)).toBeGreaterThan(jobChance(ready(), warehouse));
    expect(jobChance({ ...state, crewInjured: { [member.id]: 2 } }, warehouse)).toBe(jobChance(ready(), warehouse));
    expect(jobChance({ ...state, crewLoyalty: { [member.id]: 0 } }, warehouse)).toBe(jobChance(ready(), warehouse));
  });
});

describe('empire purchases and income', () => {
  it('recruits a crew member once, charges recruitment now and wages on the next game day', () => {
    const member = crew.find(candidate => candidate.requiredRep <= 75)!;
    const state = ready();
    const hired = gameReducer(state, { type: 'RECRUIT', id: member.id });
    expect(hired.crew).toEqual([member.id]);
    expect(hired.stats.cash).toBe(6800 - member.cost);
    expect(hired.crewLoyalty[member.id]).toBe(member.loyalty);
    const dismissed = gameReducer(hired, { type: 'DISMISS_RESULT' });
    const duplicate = gameReducer(dismissed, { type: 'RECRUIT', id: member.id });
    expect(duplicate.stats.cash).toBe(hired.stats.cash);
    expect(crewSalary(dismissed)).toBe(member.salary);
    const nextDay = gameReducer(dismissed, { type: 'NEXT_DAY' });
    expect(nextDay.stats.cash).toBe(hired.stats.cash - member.salary);
  });

  it('buys a business without paying passive income until the next day', () => {
    const business = businesses.find(candidate => candidate.requiredRep <= 75)!;
    const state = alter(ready(), { cash: 100000 });
    const bought = gameReducer(state, { type: 'BUY_BUSINESS', id: business.id });
    expect(bought.businesses).toEqual([{ id: business.id, level: 1 }]);
    expect(bought.stats.cash).toBe(100000 - business.cost);
    const settled = gameReducer(bought, { type: 'DISMISS_RESULT' });
    const nextDay = gameReducer(settled, { type: 'NEXT_DAY' });
    expect(nextDay.stats.cash).toBeGreaterThan(settled.stats.cash);
    expect(nextDay.stats.cash - settled.stats.cash).toBe(dailyIncome(settled));
    expect(gameReducer(nextDay, { type: 'NEXT_DAY' })).toEqual(nextDay);
  });

  it('unpaid wages reduce loyalty and injured crew heal as days pass', () => {
    const member = crew[0];
    const state = { ...alter(ready(), { cash: 0 }), crew: [member.id], crewLoyalty: { [member.id]: 50 }, crewInjured: { [member.id]: 3 } };
    const nextDay = gameReducer(state, { type: 'NEXT_DAY' });
    expect(nextDay.stats.cash).toBe(0);
    expect(nextDay.crewLoyalty[member.id]).toBe(42);
    expect(nextDay.crewInjured[member.id]).toBe(2);
  });

  it('reports low-heat quest completion when heat reaches the stated maximum', () => {
    const quest: Quest = { id: 'quiet', name: 'Quiet', description: '', kind: 'side', target: 20, metric: 'lowHeat', reward: {}, contact: '', image: '' };
    expect(questProgress(alter(ready(), { heat: 20 }), quest)).toBe(20);
    expect(questProgress(alter(ready(), { heat: 21 }), quest)).toBeLessThan(20);
  });
});

describe('equipment, upgrades and the city', () => {
  it('equipment must be unlocked and owned once, with its skill bonus affecting jobs', () => {
    const item = items.find(candidate => (candidate.bonuses[warehouse.skill] ?? 0) > 0)!;
    const state = alter(ready(), { cash: 100000, reputation: 1000 });
    const bought = gameReducer(state, { type: 'BUY_ITEM', id: item.id });
    expect(bought.inventory).toContain(item.id);
    expect(bought.stats.cash).toBe(state.stats.cash - item.cost);
    expect(jobChance(bought, warehouse)).toBeGreaterThan(jobChance(state, warehouse));
    const duplicate = gameReducer(gameReducer(bought, { type: 'DISMISS_RESULT' }), { type: 'BUY_ITEM', id: item.id });
    expect(duplicate.stats).toEqual(bought.stats);
    const poor = alter(state, { cash: 0 });
    expect(gameReducer(poor, { type: 'BUY_ITEM', id: item.id }).inventory).not.toContain(item.id);
    const locked = alter(state, { reputation: 0 });
    const advanced = items.find(candidate => candidate.requiredRep > 0)!;
    expect(gameReducer(locked, { type: 'BUY_ITEM', id: advanced.id }).stats).toEqual(locked.stats);
  });

  it('a purchased recovery consumable applies immediately and is not permanently stacked as equipment', () => {
    const medicine = items.find(candidate => candidate.consumable && candidate.bonuses.health)!;
    const state = alter(ready(), { health: 20, cash: 100000, reputation: 1000 });
    const treated = gameReducer(state, { type: 'BUY_ITEM', id: medicine.id });
    expect(treated.stats.health).toBe(Math.min(100, 20 + medicine.bonuses.health!));
    expect(treated.stats.cash).toBe(state.stats.cash - medicine.cost);
    expect(treated.inventory).not.toContain(medicine.id);
  });

  it('business upgrades use the disclosed cost and stop at the catalog maximum', () => {
    const business = businesses[0];
    const state: GameState = { ...alter(ready(), { cash: 100000, reputation: 1000 }), businesses: [{ id: business.id, level: 1 }] };
    expect(businessUpgradeCost(state, business.id)).toBe(Math.round(business.cost * .65));
    const after = gameReducer(state, { type: 'UPGRADE_BUSINESS', id: business.id });
    expect(after.businesses[0].level).toBe(2);
    expect(after.stats.cash).toBe(state.stats.cash - businessUpgradeCost(state, business.id));
    expect(dailyIncome(after)).toBeGreaterThan(dailyIncome(state));
    const maximum = { ...state, businesses: [{ id: business.id, level: business.maxLevel }] };
    expect(gameReducer(maximum, { type: 'UPGRADE_BUSINESS', id: business.id }).stats.cash).toBe(state.stats.cash);
    expect(gameReducer({ ...state, businesses: [] }, { type: 'UPGRADE_BUSINESS', id: business.id }).businesses).toEqual([]);
  });

  it('safehouse upgrades cost more by level and make their documented recovery improvement', () => {
    const upgrade = safehouseData.find(entry => entry.id === 'bedroom')!;
    const state = ready();
    expect(safehouseUpgradeCost(state, upgrade.id)).toBe(upgrade.cost);
    const after = gameReducer(state, { type: 'UPGRADE_SAFEHOUSE', id: upgrade.id });
    expect(after.safehouse[upgrade.id]).toBe(1);
    expect(safehouseUpgradeCost(after, upgrade.id)).toBe(upgrade.cost * 2);
    const rested = gameReducer(gameReducer(after, { type: 'DISMISS_RESULT' }), { type: 'LAY_LOW' });
    expect(rested.stats.energy).toBe(69);
  });

  it('travel requires district reputation and records a visit without earning cash', () => {
    const state = ready();
    const denied = gameReducer(state, { type: 'TRAVEL', id: 'portside' });
    expect(denied.districtId).toBe('old-quarter');
    expect(denied.stats).toEqual(state.stats);
    const unlocked = alter(state, { reputation: 100 });
    const travelled = gameReducer(unlocked, { type: 'TRAVEL', id: 'portside' });
    expect(travelled.districtId).toBe('portside');
    expect(travelled.counters.districts).toContain('portside');
    expect(travelled.stats.cash).toBe(unlocked.stats.cash);
  });

  it('negotiations and pressure have different real territory, cost, heat and influence effects', () => {
    const state = alter(ready(1), { cash: 100000, reputation: 1000, heat: 0 });
    expect(influenceCost(state, 'negotiate')).toBe(1000);
    expect(influenceCost(state, 'pressure')).toBe(500);
    const negotiated = gameReducer(state, { type: 'INFLUENCE', districtId: 'old-quarter', mode: 'negotiate' });
    const pressured = gameReducer(state, { type: 'INFLUENCE', districtId: 'old-quarter', mode: 'pressure' });
    expect(negotiated.territories['old-quarter']).toBe(12);
    expect(pressured.territories['old-quarter']).toBe(18);
    expect(negotiated.stats.influence).toBe(9);
    expect(pressured.stats.heat).toBe(9);
    expect(pressured.stats.cash).toBe(state.stats.cash - 500);
    expect(negotiated.stats.energy).toBe(70);
    expect(pressured.stats.energy).toBe(60);
    const poor = alter(state, { cash: 0 });
    expect(gameReducer(poor, { type: 'INFLUENCE', districtId: 'old-quarter', mode: 'pressure' }).territories).toEqual({});
  });

  it('a gift improves a relationship while a civic favor reduces attention and uses energy', () => {
    const contact = contactData.find(entry => entry.id === 'vale')!;
    const state = ready();
    expect(contactCost(state, contact.id, 'gift')).toBe(500);
    const gift = gameReducer(state, { type: 'CONTACT', id: contact.id, mode: 'gift' });
    const favor = gameReducer(state, { type: 'CONTACT', id: contact.id, mode: 'favor' });
    expect(gift.relationships[contact.id]).toBe(contact.initialRelationship + 18);
    expect(gift.stats.cash).toBe(6300);
    expect(favor.stats.cash).toBe(6800);
    expect(favor.stats.heat).toBe(8);
    expect(favor.stats.energy).toBe(70);
    expect(favor.relationships[contact.id]).toBe(contact.initialRelationship + 10);
  });
});

describe('quest rewards and the major heist', () => {
  it('claims an accomplished quest only once and cannot bypass a main quest prerequisite', () => {
    const quest = quests.find(candidate => candidate.metric === 'jobsSucceeded' && !candidate.prerequisite)!;
    const state = { ...ready(), counters: { ...ready().counters, jobsSucceeded: quest.target } };
    const claimed = gameReducer(state, { type: 'CLAIM_QUEST', id: quest.id });
    expect(claimed.claimedQuests).toContain(quest.id);
    expect(claimed.stats.cash).toBe(state.stats.cash + (quest.reward.cash ?? 0));
    const dismissed = gameReducer(claimed, { type: 'DISMISS_RESULT' });
    expect(gameReducer(dismissed, { type: 'CLAIM_QUEST', id: quest.id }).stats).toEqual(claimed.stats);
    const future = quests.find(candidate => candidate.prerequisite)!;
    const locked = alter(state, { reputation: 999999, cash: 999999 });
    expect(gameReducer(locked, { type: 'CLAIM_QUEST', id: future.id }).claimedQuests).not.toContain(future.id);
  });

  it('checks all heist gates and rejects duplicate, unowned, injured, or disloyal selected crew', () => {
    const crewIds = crew.slice(0, heist.requiredCrew).map(member => member.id);
    const state: GameState = { ...alter(ready(), { cash: 100000, reputation: 1000 }), crew: crewIds, inventory: [...heist.requiredItems], crewLoyalty: Object.fromEntries(crewIds.map(id => [id, 90])), crewInjured: {} };
    expect(heistRequirements(state)).toEqual([]);
    expect(heistRequirements(ready()).join(' ')).toMatch(/reputation/);
    expect(heistRequirements(ready()).join(' ')).toMatch(/cash|\$/i);
    for (const bad of [[crewIds[0], crewIds[0], crewIds[1]], [...crewIds.slice(0, 2), 'outsider']]) {
      const denied = gameReducer(state, { type: 'START_HEIST', crewIds: bad });
      expect(denied.heist).toBeNull();
      expect(denied.stats).toEqual(state.stats);
    }
    const injured = { ...state, crewInjured: { [crewIds[0]]: 2 } };
    expect(gameReducer(injured, { type: 'START_HEIST', crewIds }).heist).toBeNull();
    const disloyal = { ...state, crewLoyalty: { ...state.crewLoyalty, [crewIds[0]]: 0 } };
    expect(gameReducer(disloyal, { type: 'START_HEIST', crewIds }).heist).toBeNull();
    const prepared = gameReducer(state, { type: 'START_HEIST', crewIds });
    expect(prepared.heist?.stage).toBe(0);
    expect(prepared.stats.cash).toBe(state.stats.cash - heist.cost);
    expect(prepared.heist?.completed).toBe(false);
  });

  it('resolves one heist stage at a time, charging choices once and pays only on final success', () => {
    const crewIds = crew.slice(0, heist.requiredCrew).map(member => member.id);
    let state: GameState = { ...alter(ready(1), { cash: 100000, reputation: 1000, heat: 0 }), crew: crewIds, inventory: [...heist.requiredItems], crewLoyalty: Object.fromEntries(crewIds.map(id => [id, 95])), crewInjured: {}, skills: { charisma: 10, streetSmarts: 10, combat: 10, driving: 10, stealth: 10, business: 10 } };
    state = gameReducer(state, { type: 'START_HEIST', crewIds });
    state = gameReducer(state, { type: 'DISMISS_RESULT' });
    for (let index = 0; index < heist.stages.length; index += 1) {
      const choice = heist.stages[index].choices[0];
      expect(heistChance(state, choice.id)).toBeGreaterThan(80);
      const before = state;
      state = gameReducer(state, { type: 'HEIST_CHOICE', choiceId: choice.id });
      expect(gameReducer(state, { type: 'HEIST_CHOICE', choiceId: choice.id })).toEqual(state);
      expect(state.heist?.stage).toBe(index + 1);
      if (index < heist.stages.length - 1) {
        expect(state.stats.cash).toBe(before.stats.cash - choice.cost);
        expect(state.heist?.completed).toBe(false);
      }
      state = gameReducer(state, { type: 'DISMISS_RESULT' });
    }
    expect(state.heist?.completed).toBe(true);
    expect(state.stats.cash).toBeGreaterThan(100000);
    const duplicate = gameReducer(state, { type: 'HEIST_CHOICE', choiceId: heist.stages.at(-1)!.choices[0].id });
    expect(duplicate.stats).toEqual(state.stats);
  });

  it('aborting an active heist imposes a penalty and allows a future restart', () => {
    const crewIds = crew.slice(0, heist.requiredCrew).map(member => member.id);
    const state: GameState = { ...alter(ready(), { cash: 100000, reputation: 1000 }), crew: crewIds, inventory: [...heist.requiredItems], crewLoyalty: Object.fromEntries(crewIds.map(id => [id, 90])), crewInjured: {} };
    const started = gameReducer(state, { type: 'START_HEIST', crewIds });
    const aborted = gameReducer(gameReducer(started, { type: 'DISMISS_RESULT' }), { type: 'ABORT_HEIST' });
    expect(aborted.heist).toBeNull();
    expect(aborted.stats.reputation).toBeLessThan(started.stats.reputation);
    const restarted = gameReducer(gameReducer(aborted, { type: 'DISMISS_RESULT' }), { type: 'START_HEIST', crewIds });
    expect(restarted.heist?.stage).toBe(0);
  });
});

describe('choice disclosure and boundary safety', () => {
  it('shows an event chance based on the exact skill and equipment that will resolve it', () => {
    const choice: EventChoice = { id: 'persuade', label: 'Persuade', description: '', effects: { cash: 800 }, chance: 45, skill: 'charisma', result: 'They agree.' };
    const state = ready();
    expect(eventChance(state, choice)).toBeGreaterThan(45);
    expect(eventChance({ ...state, skills: { ...state.skills, charisma: 10 } }, choice)).toBeGreaterThan(eventChance(state, choice));
    expect(eventChance(state, { ...choice, chance: undefined })).toBe(100);
    expect(eventChance(state, { ...choice, chance: 0, skill: undefined })).toBe(0);
  });

  it('discloses costs on either possible event branch along with required flags and healthy crew', () => {
    const choice: EventChoice = { id: 'gamble', label: 'Gamble', description: '', effects: { cash: -500, energy: -5 }, failure: { cash: -1000, energy: -20 }, chance: 50, requiredCrew: 1, requiredFlag: 'promised', result: 'Done.' };
    const state = alter(ready(), { cash: 900, energy: 10 });
    const requirements = eventChoiceRequirements(state, choice).join(' ');
    expect(requirements).toMatch(/1,000|1000/);
    expect(requirements).toMatch(/20 energy/);
    expect(requirements).toMatch(/crew/i);
    expect(requirements).toMatch(/promised/i);
    expect(layLowCost({ ...state, safehouse: { bedroom: 4 } })).toBe(4);
  });

  it('allows a mixed recovery pack when either health or energy can improve', () => {
    const item = items.find(candidate => candidate.consumable && candidate.bonuses.health && candidate.bonuses.energy)!;
    const state = alter(ready(), { cash: 10000, health: 100, energy: 5 });
    const after = gameReducer(state, { type: 'BUY_ITEM', id: item.id });
    expect(after.stats.health).toBe(100);
    expect(after.stats.energy).toBe(5 + item.bonuses.energy!);
    expect(after.stats.cash).toBe(state.stats.cash - item.cost);
    expect(Object.values(after.result!.effects)).not.toContain(undefined);
  });

  it('uses an existing XP remainder when a successful job levels a skill', () => {
    const state = { ...ready(1), skillXp: { ...ready().skillXp, [warehouse.skill]: 90 } };
    const after = gameReducer(gameReducer(state, { type: 'START_JOB', id: warehouse.id }), { type: 'RESOLVE_JOB', approach: 'rush' });
    expect(after.skills[warehouse.skill]).toBe(state.skills[warehouse.skill] + 1);
    expect(after.skillXp[warehouse.skill]).toBe(20);
  });

  it('does not permit ordinary city actions to interrupt and repay an active heist', () => {
    const ids = crew.slice(0, 3).map(member => member.id);
    const state: GameState = { ...alter(ready(), { cash: 100000, reputation: 1000 }), crew: ids, inventory: [...heist.requiredItems], crewLoyalty: Object.fromEntries(ids.map(id => [id, 90])) };
    const started = gameReducer(gameReducer(state, { type: 'START_HEIST', crewIds: ids }), { type: 'DISMISS_RESULT' });
    expect(gameReducer(started, { type: 'START_HEIST', crewIds: ids })).toEqual(started);
    expect(gameReducer(started, { type: 'NEXT_DAY' })).toEqual(started);
    expect(gameReducer(started, { type: 'START_JOB', id: warehouse.id })).toEqual(started);
  });

  it('a failed multi-stage attempt never sets completion or awards a reserve payout', () => {
    const ids = crew.slice(0, 3).map(member => member.id);
    let state: GameState = { ...alter(ready(1000), { cash: 100000, reputation: 1000, heat: 60 }), crew: ids, inventory: [...heist.requiredItems], crewLoyalty: Object.fromEntries(ids.map(id => [id, 40])), skills: { charisma: 1, streetSmarts: 1, combat: 1, driving: 1, stealth: 1, business: 1 } };
    state = gameReducer(gameReducer(state, { type: 'START_HEIST', crewIds: ids }), { type: 'DISMISS_RESULT' });
    for (let index = 0; index < heist.stages.length && state.heist; index += 1) {
      const stage = heist.stages[state.heist.stage];
      const choice = stage.choices.find(candidate => candidate.cost === 0)!;
      state = gameReducer(state, { type: 'HEIST_CHOICE', choiceId: choice.id });
      expect(state.flags).not.toContain('heist-completed');
      state = gameReducer(state, { type: 'DISMISS_RESULT' });
    }
    expect(state.heist).toBeNull();
    expect(state.stats.cash).toBeLessThanOrEqual(100000 - heist.cost);
    expect(Object.values(state.crewInjured).some(days => days > 0)).toBe(true);
  });

  it('can arrest a player after a risky job without letting its resolution repeat', () => {
    const state = alter(ready(2), { heat: 99 });
    const planned = gameReducer(state, { type: 'START_JOB', id: warehouse.id });
    const after = gameReducer(planned, { type: 'RESOLVE_JOB', approach: 'rush' });
    expect(after.jail).not.toBeNull();
    expect(after.stats.cash).toBeGreaterThanOrEqual(0);
    expect(after.stats.heat).toBeLessThan(99);
    expect(gameReducer(after, { type: 'RESOLVE_JOB', approach: 'rush' })).toEqual(after);
  });
});

describe('contextual events and daily pressure', () => {
  it('world and jail events respect their location, reputation, heat, flags and owned empire', () => {
    const event: GameEvent = { id: 'context', title: 'Context', category: 'City', text: '', image: '', choices: [], weight: 1, minRep: 100, minHeat: 30, maxHeat: 70, districtId: 'portside', requiredFlag: 'introduced', forbiddenFlag: 'rejected', requiresCrew: true, requiresBusiness: true };
    expect(eventIsEligible(ready(), event)).toBe(false);
    const state: GameState = { ...alter(ready(), { reputation: 100, heat: 50 }), districtId: 'portside', flags: ['introduced'], crew: [crew[0].id], businesses: [{ id: businesses[0].id, level: 1 }] };
    expect(eventIsEligible(state, event)).toBe(true);
    expect(eventIsEligible({ ...state, flags: ['introduced', 'rejected'] }, event)).toBe(false);
    expect(eventIsEligible(state, { ...event, followUpOnly: true })).toBe(false);
    expect(eventIsEligible({ ...state, jail: { days: 2, reason: 'Case' } }, event)).toBe(false);
    expect(eventIsEligible({ ...state, jail: { days: 2, reason: 'Case' } }, { ...event, jailOnly: true })).toBe(true);
    expect(eventIsEligible(state, { ...event, jailOnly: true })).toBe(false);
  });

  it('an illegal business can be raided while a legitimate portfolio has safer income', () => {
    const illegal = businesses.find(candidate => candidate.type === 'illegal')!;
    const state: GameState = { ...alter(ready(0), { cash: 100000, heat: 65 }), businesses: [{ id: illegal.id, level: 2 }] };
    const after = gameReducer(state, { type: 'NEXT_DAY' });
    expect(after.result?.text).toMatch(/raid/i);
    expect(after.businesses[0].level).toBe(1);
    expect(after.stats.cash - state.stats.cash).toBeLessThan(dailyIncome(state));
    const safe: GameState = { ...state, businesses: [{ id: businesses.find(candidate => candidate.type === 'legitimate')!.id, level: 2 }] };
    const settled = gameReducer(safe, { type: 'NEXT_DAY' });
    expect(settled.stats.cash - safe.stats.cash).toBe(dailyIncome(safe));
    expect(settled.businesses[0].level).toBe(2);
  });

  it('rival gangs can contest claimed territory on the next explicit day', () => {
    const state = { ...ready(0), territories: { 'old-quarter': 30 } };
    const after = gameReducer(state, { type: 'NEXT_DAY' });
    expect(after.territories['old-quarter']).toBeLessThan(30);
    expect(after.result?.text).toMatch(/rival|Lanterns/i);
    expect(state.territories['old-quarter']).toBe(30);
  });

  it('requires enough energy to reach every heist stage before accepting the entry fee', () => {
    const ids = crew.slice(0, 3).map(member => member.id);
    const state: GameState = { ...alter(ready(), { cash: 100000, reputation: 1000, energy: 20 }), crew: ids, inventory: [...heist.requiredItems], crewLoyalty: Object.fromEntries(ids.map(id => [id, 90])) };
    const denied = gameReducer(state, { type: 'START_HEIST', crewIds: ids });
    expect(denied.heist).toBeNull();
    expect(denied.stats.cash).toBe(state.stats.cash);
    expect(heistRequirements(state).join(' ')).toMatch(/52 energy/);
  });
});

describe('event scheduling and follow-up delivery', () => {
  it('guarantees the first eligible warehouse opportunity after a resolved turn', () => {
    const afterDay = gameReducer(ready(), { type: 'NEXT_DAY' });
    expect(afterDay.result?.nextEvent).toBe('warehouse-offer');
    const started = gameReducer(ready(1), { type: 'START_JOB', id: warehouse.id });
    const afterJob = gameReducer(started, { type: 'RESOLVE_JOB', approach: 'rush' });
    expect(afterJob.result?.nextEvent).toBe('warehouse-offer');
    expect(afterJob.pendingJob).toBeNull();
  });

  it('delivers a follow-up only when the result is dismissed and never reapplies its reward', () => {
    const state: GameState = { ...ready(), result: { title: 'Already paid', text: 'Paid', success: true, effects: { cash: 8000 }, image: '', nextEvent: 'warehouse-aftermath' } };
    const dismissed = gameReducer(state, { type: 'DISMISS_RESULT' });
    expect(dismissed.pendingEvent?.id).toBe('warehouse-aftermath');
    expect(dismissed.result).toBeNull();
    expect(dismissed.stats.cash).toBe(6800);
    expect(gameReducer(dismissed, { type: 'DISMISS_RESULT' })).toEqual(dismissed);
  });

  it('routes a seeded arrest into a jail arrival event after the arrest result', () => {
    const state = alter(ready(0), { cash: 120, heat: 100 });
    const after = gameReducer(state, { type: 'NEXT_DAY' });
    expect(after.result?.nextEvent).toBe('jail-arrival');
    const dismissed = gameReducer(after, { type: 'DISMISS_RESULT' });
    expect(dismissed.pendingEvent?.id).toBe('jail-arrival');
    expect(dismissed.jail).not.toBeNull();
  });

  it('draws about thirty percent of ordinary turns after the introductory event', () => {
    let draws = 0;
    for (let index = 0; index < 1000; index += 1) {
      const state = { ...ready(Math.imul(index, 2654435761) >>> 0), flags: ['intro-event-seen'] };
      if (gameReducer(state, { type: 'NEXT_DAY' }).result?.nextEvent) draws += 1;
    }
    expect(draws).toBeGreaterThanOrEqual(260);
    expect(draws).toBeLessThanOrEqual(340);
  });

  it('never redraws any of the five most recent eligible events', () => {
    const recent: string[] = [];
    let flags = ['intro-event-seen'];
    let draws = 0;
    for (let index = 0; index < 1000; index += 1) {
      const state = { ...ready(Math.imul(index, 2654435761) >>> 0), flags };
      const after = gameReducer(state, { type: 'NEXT_DAY' });
      const id = after.result?.nextEvent;
      if (!id) continue;
      expect(recent).not.toContain(id);
      recent.push(id);
      if (recent.length > 5) recent.shift();
      flags = after.flags;
      draws += 1;
    }
    expect(draws).toBeGreaterThan(150);
  });
});

describe('authored event choices', () => {
  it('pays the selected branch once, removes the pending event and delivers its actual follow-up', () => {
    const state = { ...ready(), pendingEvent: { id: 'warehouse-offer' } };
    const committed = gameReducer(state, { type: 'CHOOSE_EVENT', choiceId: 'stake' });
    expect(committed.stats.cash).toBe(6200);
    expect(committed.stats.energy).toBe(77);
    expect(committed.flags).toContain('warehouse-backed');
    expect(committed.pendingEvent).toBeNull();
    expect(committed.result?.nextEvent).toBe('warehouse-aftermath');
    expect(gameReducer(committed, { type: 'CHOOSE_EVENT', choiceId: 'stake' })).toEqual(committed);
    const followUp = gameReducer(committed, { type: 'DISMISS_RESULT' });
    expect(followUp.pendingEvent?.id).toBe('warehouse-aftermath');
    expect(followUp.stats.cash).toBe(6200);
    const settled = gameReducer(followUp, { type: 'CHOOSE_EVENT', choiceId: 'settle' });
    expect(settled.stats.cash).toBe(7100);
    expect(settled.flags).not.toContain('warehouse-backed');
    const dismissed = gameReducer(settled, { type: 'DISMISS_RESULT' });
    expect(gameReducer(dismissed, { type: 'CHOOSE_EVENT', choiceId: 'settle' })).toEqual(dismissed);
  });

  it('retains an event on an unavailable choice and cannot spend below zero on either branch', () => {
    const state = { ...alter(ready(), { cash: 599 }), pendingEvent: { id: 'warehouse-offer' } };
    const denied = gameReducer(state, { type: 'CHOOSE_EVENT', choiceId: 'stake' });
    expect(denied.stats).toEqual(state.stats);
    expect(denied.pendingEvent?.id).toBe('warehouse-offer');
    expect(denied.result?.success).toBe(false);
    const risky = { ...alter(ready(), { cash: 499 }), pendingEvent: { id: 'warehouse-aftermath' } };
    const blocked = gameReducer(risky, { type: 'CHOOSE_EVENT', choiceId: 'hold' });
    expect(blocked.stats).toEqual(risky.stats);
    expect(blocked.pendingEvent?.id).toBe('warehouse-aftermath');
  });

  it('resolves the success or failure effects using the probability displayed by its helper', () => {
    const success = { ...ready(1), pendingEvent: { id: 'warehouse-aftermath' } };
    const failure = { ...ready(1500), pendingEvent: { id: 'warehouse-aftermath' } };
    const choice = events.find(event => event.id === 'warehouse-aftermath')!.choices.find(option => option.id === 'hold')!;
    expect(eventChance(success, choice)).toBe(71);
    const won = gameReducer(success, { type: 'CHOOSE_EVENT', choiceId: 'hold' });
    const lost = gameReducer(failure, { type: 'CHOOSE_EVENT', choiceId: 'hold' });
    expect(won.result?.success).toBe(true);
    expect(won.stats.cash).toBe(11600);
    expect(lost.result?.success).toBe(false);
    expect(lost.stats.cash).toBe(6300);
    expect(lost.stats.health).toBe(91);
    expect(won).toEqual(gameReducer(success, { type: 'CHOOSE_EVENT', choiceId: 'hold' }));
  });

  it('follows the failure branch instead of the success continuation on a failed crew review', () => {
    const state: GameState = { ...ready(1500), pendingEvent: { id: 'crew-verdict' }, crew: [crew[0].id], crewLoyalty: { [crew[0].id]: 60 } };
    const reviewed = gameReducer(state, { type: 'CHOOSE_EVENT', choiceId: 'audit' });
    expect(reviewed.result?.success).toBe(false);
    expect(reviewed.result?.nextEvent).toBe('crew-empty-chair');
    expect(reviewed.crewLoyalty[crew[0].id]).toBe(55);
    expect(gameReducer(reviewed, { type: 'DISMISS_RESULT' }).pendingEvent?.id).toBe('crew-empty-chair');
  });

  it('lets a jail event shorten the sentence and never schedules a jail-only event once released', () => {
    const state: GameState = { ...ready(1), jail: { days: 2, reason: 'A case' }, pendingEvent: { id: 'jail-release-offer' } };
    const released = gameReducer(state, { type: 'CHOOSE_EVENT', choiceId: 'apply' });
    expect(released.jail).toBeNull();
    expect(released.stats.cash).toBe(5700);
    expect(released.pendingEvent).toBeNull();
    const fakeFollowUp = { ...released, result: { ...released.result!, nextEvent: 'jail-arrival' } };
    expect(gameReducer(fakeFollowUp, { type: 'DISMISS_RESULT' }).pendingEvent).toBeNull();
  });

  it('ignores a nonexistent choice and prevents city actions from skipping a pending event', () => {
    const state = { ...ready(), pendingEvent: { id: 'warehouse-offer' } };
    expect(gameReducer(state, { type: 'CHOOSE_EVENT', choiceId: 'bogus' })).toEqual(state);
    expect(gameReducer(state, { type: 'START_JOB', id: warehouse.id })).toEqual(state);
    expect(gameReducer(state, { type: 'NEXT_DAY' })).toEqual(state);
  });

  it('does not require money for a failure branch when the disclosed chance is certain', () => {
    const choice: EventChoice = { id: 'certain', label: 'Certain', description: '', chance: 100, effects: { cash: -500 }, failure: { cash: -1000 }, result: 'Done.' };
    expect(eventChoiceRequirements(alter(ready(), { cash: 600 }), choice)).toEqual([]);
  });

  it('keeps every forced or follow-up event escapable with no remaining cash or energy', () => {
    for (const event of events.filter(candidate => candidate.followUpOnly || candidate.id === 'jail-arrival')) {
      const state: GameState = { ...alter(ready(), { cash: 0, energy: 0, health: 1 }), pendingEvent: { id: event.id }, jail: event.jailOnly ? { days: 3, reason: 'Case' } : null };
      const choice = event.choices.find(option => eventChoiceRequirements(state, option).length === 0);
      expect(choice, `${event.id} needs a zero-resource way forward`).toBeDefined();
      const resolved = gameReducer(state, { type: 'CHOOSE_EVENT', choiceId: choice!.id });
      expect(resolved.pendingEvent).toBeNull();
      expect(resolved.result).not.toBeNull();
      expect(resolved.stats.cash).toBeGreaterThanOrEqual(0);
      expect(resolved.stats.energy).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('a playable early career', () => {
  it('earns enough cash and reputation to leave the Quarter while keeping all turns immutable and bounded', () => {
    const early = activities.find(activity => activity.id === 'old-envelope')!;
    let state = ready(342);
    for (let turn = 0; turn < 180; turn += 1) {
      const previous = state;
      const snapshot = structuredClone(previous);
      if (state.result) state = gameReducer(state, { type: 'DISMISS_RESULT' });
      else if (state.pendingEvent) {
        const event = events.find(candidate => candidate.id === state.pendingEvent!.id)!;
        const choices = event.choices.filter(choice => eventChoiceRequirements(state, choice).length === 0);
        const safe = choices.find(choice => choice.chance === undefined && (choice.effects.cash ?? 0) >= 0 && (choice.effects.energy ?? 0) >= 0) ?? choices[0];
        expect(safe, `${event.id} must remain playable`).toBeDefined();
        state = gameReducer(state, { type: 'CHOOSE_EVENT', choiceId: safe.id });
      } else if (state.jail || state.stats.energy < early.energy + 8) state = gameReducer(state, { type: 'NEXT_DAY' });
      else if (state.stats.health < 30) state = gameReducer(state, { type: 'HEAL' });
      else if (state.pendingJob) state = gameReducer(state, { type: 'RESOLVE_JOB', approach: 'rush' });
      else state = gameReducer(state, { type: 'START_JOB', id: early.id });
      expect(previous).toEqual(snapshot);
      expect(state.stats.cash).toBeGreaterThanOrEqual(0);
      expect(state.stats.reputation).toBeGreaterThanOrEqual(0);
      for (const stat of ['heat', 'health', 'energy', 'influence'] as const) {
        expect(state.stats[stat]).toBeGreaterThanOrEqual(0);
        expect(state.stats[stat]).toBeLessThanOrEqual(100);
      }
      for (const skill of Object.values(state.skills)) {
        expect(skill).toBeGreaterThanOrEqual(1);
        expect(skill).toBeLessThanOrEqual(10);
      }
    }
    expect(state.counters.jobsSucceeded).toBeGreaterThan(8);
    expect(state.stats.cash).toBeGreaterThan(6800);
    expect(state.stats.reputation).toBeGreaterThanOrEqual(100);
  });
});

describe('committed heist crew and district risk', () => {
  it.each([90, 35])('injures a participating crew member on a failed heist stage and leaves off-duty crew healthy at %i loyalty', loyalty => {
    const owned = crew.slice(0, 4).map(member => member.id);
    const committed = owned.slice(0, 3);
    const state: GameState = { ...alter(ready(965), { cash: 100000, reputation: 1000, heat: 0 }), crew: owned, inventory: [...heist.requiredItems], crewLoyalty: Object.fromEntries(owned.map(id => [id, loyalty])), crewInjured: Object.fromEntries(owned.map(id => [id, 0])), skills: { charisma: 1, streetSmarts: 1, combat: 1, driving: 1, stealth: 1, business: 1 } };
    const begun = gameReducer(gameReducer(state, { type: 'START_HEIST', crewIds: committed }), { type: 'DISMISS_RESULT' });
    const failed = gameReducer(begun, { type: 'HEIST_CHOICE', choiceId: 'trusted-terms' });
    expect(failed.result?.success).toBe(false);
    expect(failed.crewInjured[owned[3]]).toBe(0);
    expect(committed.filter(id => failed.crewInjured[id] === 2)).toHaveLength(1);
    expect(state.crewInjured).toEqual(Object.fromEntries(owned.map(id => [id, 0])));
  });

  it('keeps an injury scoped to committed crew even when the second failure ends the heist', () => {
    const owned = crew.slice(0, 4).map(member => member.id);
    const committed = owned.slice(0, 3);
    const state: GameState = { ...alter(ready(965), { cash: 85000, reputation: 1000, heat: 6, health: 88, energy: 57 }), crew: owned, inventory: [...heist.requiredItems], crewLoyalty: Object.fromEntries(owned.map(id => [id, 86])), crewInjured: { [committed[0]]: 2 }, heist: { stage: 1, crewIds: committed, successes: 0, choices: ['trusted-terms'], completed: false }, skills: { charisma: 1, streetSmarts: 1, combat: 1, driving: 1, stealth: 1, business: 1 } };
    const failed = gameReducer(state, { type: 'HEIST_CHOICE', choiceId: 'circle-promise' });
    expect(failed.heist).toBeNull();
    expect(failed.result?.success).toBe(false);
    expect(failed.crewInjured[owned[3]] ?? 0).toBe(0);
    expect(committed.filter(id => failed.crewInjured[id] === 2)).toHaveLength(2);
  });

  it('discloses the target district risk while pressure still requires travelling there', () => {
    const state = ready();
    expect(influenceChance(state, 'pressure')).toBe(63);
    expect(influenceChance(state, 'pressure', 'crown-heights')).toBe(60);
    expect(influenceChance({ ...state, districtId: 'crown-heights' }, 'pressure')).toBe(60);
    const unlocked = alter(state, { reputation: 1000 });
    const denied = gameReducer(unlocked, { type: 'INFLUENCE', districtId: 'crown-heights', mode: 'pressure' });
    expect(denied.stats).toEqual(unlocked.stats);
    expect(denied.territories).toEqual({});
    expect(denied.result?.text).toMatch(/visit to Crown Heights/);
  });
});

describe('operation risk disclosure', () => {
  it.each([
    { approach: 'rush' as const, cash: -1400, energy: -20 },
    { approach: 'informant' as const, cash: -1820, energy: -20 },
    { approach: 'scout' as const, cash: -1400, energy: -25 },
  ])('matches a real failed operation to its disclosed $approach cash and energy commitment', ({ approach, cash, energy }) => {
    const scout = crew[0].id;
    const state: GameState = { ...alter(ready(1500), { cash: 10000, reputation: 100, heat: 30, energy: 100 }), inventory: ['encrypted-radio', 'street-coat'], crew: [scout], crewLoyalty: { [scout]: 90 }, crewInjured: { [scout]: 0 } };
    const disclosed = jobFailureEffects(state, warehouse, approach);
    expect(disclosed).toEqual({ cash, energy, reputation: -5, heat: 18, health: -14, skillXp: { streetSmarts: 18 } });
    const planned = gameReducer(state, { type: 'START_JOB', id: warehouse.id });
    const failed = gameReducer(planned, { type: 'RESOLVE_JOB', approach });
    expect(failed.result?.success).toBe(false);
    expect(failed.jail).toBeNull();
    expect(failed.result?.effects).toEqual(disclosed);
    expect(failed.stats.cash).toBe(10000 + cash);
    expect(failed.stats.energy).toBe(100 + energy);
    expect(failed.stats.heat).toBe(48);
  });

  it('includes fallback reputation and extra energy losses without charging a walk-away', () => {
    const activity: Activity = { ...job, cost: 100, energy: 10, heat: 3, rep: 15, failure: { health: -7, energy: -4, cash: -50, heat: 1 } };
    const state = { ...ready(), inventory: ['encrypted-radio'] };
    expect(jobFailureEffects(state, activity)).toEqual({ cash: -150, energy: -14, health: -7, heat: 2, reputation: -4, skillXp: { stealth: 18 } });
    expect(jobFailureEffects(state, activity, 'informant').cash).toBe(-400);
    expect(jobFailureEffects(state, activity, 'scout').energy).toBe(-19);
    expect(jobFailureEffects(state, activity, 'leave')).toEqual({});
  });

  it('discloses equipment-adjusted heat and matches both successful jobs and heist choices', () => {
    const state = { ...ready(1), inventory: ['encrypted-radio', 'street-coat'] };
    expect(heatGain(state, 8)).toBe(6);
    expect(heatGain(state, 1)).toBe(0);
    expect(heatGain(ready(), 8)).toBe(8);
    const worked = gameReducer(gameReducer(state, { type: 'START_JOB', id: warehouse.id }), { type: 'RESOLVE_JOB', approach: 'rush' });
    expect(worked.result?.success).toBe(true);
    expect(worked.result?.effects.heat).toBe(10);
    expect(worked.result?.effects.heat).toBe(heatGain(state, warehouse.heat));
    const ids = crew.slice(0, 3).map(member => member.id);
    const prepared: GameState = { ...alter(state, { cash: 100000, reputation: 1000, heat: 0 }), inventory: [...state.inventory, ...heist.requiredItems.filter(id => !state.inventory.includes(id))], crew: ids, crewLoyalty: Object.fromEntries(ids.map(id => [id, 90])), skills: { charisma: 10, streetSmarts: 10, combat: 10, driving: 10, stealth: 10, business: 10 } };
    const started = gameReducer(gameReducer(prepared, { type: 'START_HEIST', crewIds: ids }), { type: 'DISMISS_RESULT' });
    const choice = heist.stages[0].choices[0];
    const stage = gameReducer(started, { type: 'HEIST_CHOICE', choiceId: choice.id });
    expect(stage.result?.success).toBe(true);
    expect(stage.result?.effects.heat).toBe(0);
    expect(stage.result?.effects.heat).toBe(heatGain(started, choice.heat));
  });
});
