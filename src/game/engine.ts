import { activities, businesses, contacts, crew, districts, events, heist, items, quests, safehouseUpgrades } from '../data';
import type { Activity, CareerPath, Effects, EventChoice, GameAction, GameEvent, GameState, Outcome, Quest, SkillKey, StatKey } from './types';

export const skillLabels: Record<SkillKey, string> = { charisma: 'Charisma', streetSmarts: 'Street smarts', combat: 'Combat', driving: 'Driving', stealth: 'Stealth', business: 'Business' };
const skillKeys = Object.keys(skillLabels) as SkillKey[];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const activeCrew = (state: GameState) => state.crew.filter(id => (state.crewInjured[id] ?? 0) === 0 && (state.crewLoyalty[id] ?? 0) >= 35);
const itemBonus = (state: GameState, key: SkillKey | 'heatReduction') => state.inventory.reduce((sum, id) => sum + (items.find(item => item.id === id)?.bonuses[key] ?? 0), 0);

function random(state: GameState): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function applyEffects(state: GameState, effects: Effects, injuryCrewIds?: readonly string[]): Effects {
  const injuryCandidates = effects.injuredCrew
    ? injuryCrewIds
      ? injuryCrewIds.filter(id => state.crew.includes(id) && (state.crewInjured[id] ?? 0) === 0)
      : activeCrew(state)
    : [];
  const actual = Object.fromEntries(Object.entries(effects).filter(([, value]) => value !== undefined)) as Effects;
  for (const key of ['cash', 'reputation', 'heat', 'health', 'energy', 'influence'] as StatKey[]) {
    if (effects[key] === undefined) continue;
    const before = state.stats[key];
    state.stats[key] = Math.round(clamp(before + effects[key]!, 0, key === 'cash' ? 1e12 : key === 'reputation' ? 1e9 : 100));
    actual[key] = state.stats[key] - before;
  }
  if ((actual.cash ?? 0) > 0) state.counters.totalEarned = clamp(state.counters.totalEarned + actual.cash!, 0, 1e12);
  for (const skill of skillKeys) {
    state.skillXp[skill] += Math.max(0, effects.skillXp?.[skill] ?? 0);
    while (state.skillXp[skill] >= 100 && state.skills[skill] < 10) {
      state.skillXp[skill] -= 100;
      state.skills[skill] += 1;
    }
    if (state.skills[skill] >= 10) state.skillXp[skill] = 0;
  }
  if (effects.loyalty) for (const id of state.crew) state.crewLoyalty[id] = clamp((state.crewLoyalty[id] ?? 50) + effects.loyalty, 0, 100);
  if (effects.relationships) for (const [id, change] of Object.entries(effects.relationships)) {
    const contact = contacts.find(entry => entry.id === id);
    if (contact) state.relationships[id] = clamp((state.relationships[id] ?? contact.initialRelationship) + change, 0, 100);
  }
  if (effects.flags) state.flags = [...new Set([...state.flags, ...effects.flags])];
  if (effects.removeFlags) state.flags = state.flags.filter(flag => !effects.removeFlags!.includes(flag));
  if (effects.item && items.some(item => item.id === effects.item) && !state.inventory.includes(effects.item)) state.inventory.push(effects.item);
  if (effects.influenceDistrict) state.territories[state.districtId] = clamp((state.territories[state.districtId] ?? 0) + effects.influenceDistrict, 0, 100);
  if (effects.injuredCrew) {
    if (injuryCandidates.length) state.crewInjured[injuryCandidates[Math.floor(random(state) * injuryCandidates.length)]] = 2;
  }
  if (effects.jailDays) {
    const days = Math.max(0, (state.jail?.days ?? 0) + effects.jailDays);
    state.jail = days > 0 ? { days, reason: state.jail?.reason ?? 'The authorities opened a case.' } : null;
  }
  return actual;
}

function record(state: GameState, outcome: Outcome): GameState {
  if (outcome.nextEvent) rememberEvent(state, outcome.nextEvent);
  state.result = outcome;
  state.log = [{ day: state.day, title: outcome.title, text: outcome.text, good: outcome.success }, ...state.log].slice(0, 80);
  return state;
}

function rememberEvent(state: GameState, id: string): void {
  const prefix = 'recent-event:';
  const recent = state.flags.filter(flag => flag.startsWith(prefix)).filter(flag => flag !== `${prefix}${id}`);
  state.flags = [...state.flags.filter(flag => !flag.startsWith(prefix)), ...[...recent, `${prefix}${id}`].slice(-5)];
  if (id === 'warehouse-offer' && !state.flags.includes('intro-event-seen')) state.flags.push('intro-event-seen');
}

function drawEvent(state: GameState): string | undefined {
  const intro = events.find(event => event.id === 'warehouse-offer');
  if (!state.flags.includes('intro-event-seen') && intro && eventIsEligible(state, intro)) return intro.id;
  if (random(state) >= .3) return undefined;
  const pool = events.filter(event => eventIsEligible(state, event)
    && !state.flags.includes(`recent-event:${event.id}`)
    && event.choices.some(choice => eventChoiceRequirements(state, choice).length === 0));
  if (!pool.length) return undefined;
  const total = pool.reduce((sum, event) => sum + event.weight, 0);
  let ticket = random(state) * total;
  for (const event of pool) {
    ticket -= event.weight;
    if (ticket < 0) return event.id;
  }
  return pool.at(-1)!.id;
}

function afterTurn(state: GameState, outcome: Outcome, forcedEvent?: string): GameState {
  const id = forcedEvent ?? drawEvent(state);
  if (id && events.some(event => event.id === id)) outcome.nextEvent = id;
  return record(state, outcome);
}

function resolve(state: GameState, title: string, text: string, success: boolean, effects: Effects, image = '/assets/city.webp'): GameState {
  return record(state, { title, text, success, effects: applyEffects(state, effects), image });
}

function reject(state: GameState, text: string): GameState {
  return record(state, { title: 'Unavailable', text, success: false, effects: {}, image: '/assets/city.webp' });
}

function checkPolice(state: GameState, reason: string): { effects: Effects; text: string } | null {
  if (state.jail || state.stats.heat <= 65 || random(state) >= (state.stats.heat - 65) * .012) return null;
  const days = 2 + Math.floor(random(state) * 3);
  const effects = applyEffects(state, { cash: -Math.min(state.stats.cash, 1500 + state.stats.heat * 20), reputation: -20, heat: -35, jailDays: days });
  state.jail = { days, reason };
  state.pendingJob = null;
  state.pendingEvent = null;
  if (state.heist && !state.heist.completed) state.heist = null;
  return { effects, text: `A police investigation led to an arrest. Cash was confiscated and you entered custody for ${days} days. You can serve the sentence or post bail.` };
}

function mergeEffects(first: Effects, second: Effects): Effects {
  const merged = { ...first, ...second };
  for (const key of ['cash', 'reputation', 'heat', 'health', 'energy', 'influence', 'loyalty', 'jailDays', 'influenceDistrict'] as const) {
    if (first[key] !== undefined || second[key] !== undefined) merged[key] = (first[key] ?? 0) + (second[key] ?? 0);
  }
  return merged;
}

export function createGame(name: string, path: CareerPath, seed = 1): GameState {
  const skills = { charisma: 2, streetSmarts: 2, combat: 2, driving: 2, stealth: 2, business: 2 };
  const cashBonus: Record<CareerPath, number> = { thief: 0, smuggler: 400, leader: 0, fixer: 200, businessman: 1700, boss: 700 };
  const strengths: Record<CareerPath, Partial<Record<SkillKey, number>>> = {
    thief: { stealth: 5, streetSmarts: 3 }, smuggler: { driving: 5, streetSmarts: 3 },
    leader: { charisma: 5, combat: 3 }, fixer: { streetSmarts: 5, charisma: 3 },
    businessman: { business: 5, charisma: 3 }, boss: { charisma: 4, business: 4, combat: 3 },
  };
  Object.assign(skills, strengths[path]);
  return {
    version: 1, player: { name: name.trim().slice(0, 24) || 'Morgan', path, portrait: '/assets/player.webp' },
    day: 1, stats: { cash: 6800 + cashBonus[path], reputation: 75, heat: 18, health: 100, energy: 85, influence: 5 },
    skills, skillXp: { charisma: 0, streetSmarts: 0, combat: 0, driving: 0, stealth: 0, business: 0 },
    districtId: 'old-quarter', crew: [], crewLoyalty: {}, crewInjured: {}, businesses: [], inventory: [], safehouse: {}, territories: {},
    relationships: Object.fromEntries(contacts.map(contact => [contact.id, contact.initialRelationship])), flags: [], claimedQuests: [],
    counters: { jobsSucceeded: 0, jobsAttempted: 0, totalEarned: 0, training: 0, districts: ['old-quarter'] },
    pendingJob: null, pendingEvent: null, result: null, jail: null, heist: null,
    log: [{ day: 1, title: 'A new name in the city', text: `${name.trim() || 'Morgan'} arrived in Old Quarter. Every choice leaves a mark.`, good: true }],
    seed: Number.isFinite(seed) ? seed >>> 0 : 1,
  };
}
export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === 'DISMISS_RESULT') {
    if (!state.result) return state;
    const followUp = events.find(event => event.id === state.result?.nextEvent);
    return { ...state, result: null, pendingEvent: followUp && Boolean(followUp.jailOnly) === Boolean(state.jail) ? { id: followUp.id } : state.pendingEvent };
  }
  if (state.result) return state;
  if ((state.pendingJob && action.type !== 'RESOLVE_JOB') || (state.pendingEvent && !['BAIL', 'CHOOSE_EVENT'].includes(action.type))) return state;
  const next = structuredClone(state);
  if (state.jail && !['NEXT_DAY', 'BAIL', 'CONTACT', 'CHOOSE_EVENT'].includes(action.type)) return reject(next, 'Serve your sentence or post bail before returning to the city.');
  if (state.heist && !state.heist.completed && !['HEIST_CHOICE', 'ABORT_HEIST'].includes(action.type)) return state;
  switch (action.type) {
    case 'CHOOSE_EVENT': {
      if (!state.pendingEvent) return state;
      const event = events.find(entry => entry.id === state.pendingEvent!.id);
      if (!event || Boolean(event.jailOnly) !== Boolean(state.jail)) return { ...next, pendingEvent: null };
      const choice = event.choices.find(entry => entry.id === action.choiceId);
      if (!choice) return state;
      const requirements = eventChoiceRequirements(state, choice);
      if (requirements.length) return reject(next, requirements.join(' '));
      next.pendingEvent = null;
      const success = choice.chance === undefined || random(next) * 100 < eventChance(state, choice);
      const effects = applyEffects(next, success ? choice.effects : choice.failure ?? {});
      const arrest = checkPolice(next, 'The consequences of a recent decision drew police attention.');
      const outcome: Outcome = { title: arrest ? 'Taken into custody' : event.title, text: `${success ? choice.result : choice.failureResult ?? 'Your choice does not work out as hoped.'}${arrest ? ` ${arrest.text}` : ''}`, success: success && !arrest, effects: arrest ? mergeEffects(effects, arrest.effects) : effects, image: event.image };
      const followUp = arrest || (next.jail && !state.jail) ? 'jail-arrival' : success ? choice.followUp : choice.failureFollowUp;
      if (followUp && events.some(entry => entry.id === followUp && Boolean(entry.jailOnly) === Boolean(next.jail))) outcome.nextEvent = followUp;
      return record(next, outcome);
    }
    case 'START_JOB': {
      const activity = activities.find(entry => entry.id === action.id);
      if (!activity) return state;
      const requirements = jobRequirements(state, activity);
      if (requirements.length) return reject(next, requirements.join(' '));
      next.pendingJob = { activityId: activity.id };
      return next;
    }
    case 'RESOLVE_JOB': {
      if (!state.pendingJob) return state;
      const activity = activities.find(entry => entry.id === state.pendingJob!.activityId);
      if (!activity) return { ...next, pendingJob: null };
      if (!['rush', 'informant', 'scout', 'leave'].includes(action.approach)) return state;
      if (action.approach === 'leave') {
        next.pendingJob = null;
        return resolve(next, 'Walked away', 'You leave the opportunity for someone else. No resources were spent.', true, {}, activity.image);
      }
      const requirements = jobRequirements(state, activity);
      const prepCost = action.approach === 'informant' ? Math.max(250, Math.round(activity.cost * .6)) : 0;
      const prepEnergy = action.approach === 'scout' ? 5 : 0;
      if (state.stats.cash < activity.cost + prepCost) requirements.push(`The informant requires an additional $${prepCost.toLocaleString('en-US')} cash.`);
      if (state.stats.energy < activity.energy + prepEnergy) requirements.push(`This approach requires ${activity.energy + prepEnergy} energy.`);
      if (action.approach === 'scout' && activeCrew(state).length < 1) requirements.push('Scouting requires one healthy, loyal crew member.');
      if (requirements.length) return reject(next, requirements.join(' '));
      next.pendingJob = null;
      next.counters.jobsAttempted += 1;
      const success = random(next) * 100 < jobChance(state, activity, action.approach);
      const payout = success ? activity.reward[0] + Math.floor(random(next) * (activity.reward[1] - activity.reward[0] + 1)) : 0;
      if (success) next.counters.jobsSucceeded += 1;
      const cost = activity.cost + prepCost;
      const energy = activity.energy + prepEnergy;
      const effects = applyEffects(next, success
        ? { cash: payout - cost, reputation: activity.rep, heat: heatGain(state, activity.heat), energy: -energy, skillXp: { [activity.skill]: 30 }, loyalty: 1 }
        : jobFailureEffects(state, activity, action.approach));
      const arrest = checkPolice(next, `Investigators connected you to ${activity.name.toLowerCase()}.`);
      return afterTurn(next, { title: arrest ? 'Taken into custody' : success ? 'Opportunity secured' : 'The job went sideways', text: `${success ? activity.successText : activity.failureText}${arrest ? ` ${arrest.text}` : ''}`, success: success && !arrest, effects: arrest ? mergeEffects(effects, arrest.effects) : effects, image: activity.image }, arrest ? 'jail-arrival' : undefined);
    }
    case 'RECRUIT': {
      const member = crew.find(entry => entry.id === action.id);
      if (!member) return state;
      if (state.crew.includes(member.id)) return reject(next, `${member.name} is already in your crew.`);
      if (state.stats.cash < member.cost || state.stats.reputation < member.requiredRep) return reject(next, `Recruitment requires $${member.cost.toLocaleString('en-US')} cash and ${member.requiredRep} reputation.`);
      next.crew.push(member.id);
      next.crewLoyalty[member.id] = member.loyalty;
      next.crewInjured[member.id] = 0;
      return resolve(next, 'Crew expanded', `${member.name} joins the crew. Their daily salary is $${member.salary.toLocaleString('en-US')}.`, true, { cash: -member.cost }, member.portrait);
    }
    case 'BUY_BUSINESS': {
      const business = businesses.find(entry => entry.id === action.id);
      if (!business) return state;
      if (state.businesses.some(entry => entry.id === business.id)) return reject(next, 'You already own this business. Upgrade it to grow its income.');
      const requiredRep = Math.max(business.requiredRep, districts.find(entry => entry.id === business.districtId)?.requiredRep ?? 0);
      if (state.stats.cash < business.cost || state.stats.reputation < requiredRep) return reject(next, `This business requires $${business.cost.toLocaleString('en-US')} cash and ${requiredRep} reputation.`);
      next.businesses.push({ id: business.id, level: 1 });
      return resolve(next, 'A new income stream', `${business.name} is yours. Income accrues when you advance the day.${business.type === 'illegal' ? ' Its operations attract police attention each day.' : ''}`, true, { cash: -business.cost }, business.image);
    }
    case 'BUY_ITEM': {
      const item = items.find(entry => entry.id === action.id);
      if (!item) return state;
      if (!item.consumable && state.inventory.includes(item.id)) return reject(next, 'You already own this item. Its bonuses are active.');
      if (state.stats.cash < item.cost || state.stats.reputation < item.requiredRep) return reject(next, `This item requires $${item.cost.toLocaleString('en-US')} cash and ${item.requiredRep} reputation.`);
      if (item.consumable) {
        if (!(item.bonuses.health && state.stats.health < 100) && !(item.bonuses.energy && state.stats.energy < 100)) return reject(next, 'You are already fully recovered for this item.');
        return resolve(next, 'Recovery supplied', `${item.name} is used immediately.`, true, { cash: -item.cost, health: item.bonuses.health, energy: item.bonuses.energy }, item.image);
      }
      next.inventory.push(item.id);
      return resolve(next, 'Added to your kit', `${item.name} is now available on every relevant opportunity.`, true, { cash: -item.cost, item: item.id }, item.image);
    }
    case 'UPGRADE_BUSINESS': {
      const business = businesses.find(entry => entry.id === action.id);
      const owned = next.businesses.find(entry => entry.id === action.id);
      if (!business || !owned) return reject(next, 'Purchase this business before upgrading it.');
      if (owned.level >= business.maxLevel) return reject(next, 'This business has reached its maximum level.');
      const cost = businessUpgradeCost(state, business.id);
      if (state.stats.cash < cost) return reject(next, `The upgrade requires $${cost.toLocaleString('en-US')} cash.`);
      owned.level += 1;
      return resolve(next, 'Business expanded', `${business.name} reached level ${owned.level}. Its daily income has increased.`, true, { cash: -cost }, business.image);
    }
    case 'UPGRADE_SAFEHOUSE': {
      const upgrade = safehouseUpgrades.find(entry => entry.id === action.id);
      if (!upgrade) return state;
      if ((state.safehouse[upgrade.id] ?? 0) >= upgrade.maxLevel) return reject(next, 'This room has reached its maximum level.');
      const cost = safehouseUpgradeCost(state, upgrade.id);
      if (state.stats.cash < cost) return reject(next, `This improvement requires $${cost.toLocaleString('en-US')} cash.`);
      next.safehouse[upgrade.id] = (state.safehouse[upgrade.id] ?? 0) + 1;
      return resolve(next, 'A place of your own', `${upgrade.name} reached level ${next.safehouse[upgrade.id]}. ${upgrade.bonus}.`, true, { cash: -cost });
    }
    case 'TRAVEL': {
      const district = districts.find(entry => entry.id === action.id);
      if (!district || district.id === state.districtId) return state;
      if (state.stats.reputation < district.requiredRep || state.stats.energy < 5) return reject(next, `Travel to ${district.name} requires ${district.requiredRep} reputation and 5 energy.`);
      next.districtId = district.id;
      if (!next.counters.districts.includes(district.id)) next.counters.districts.push(district.id);
      return resolve(next, `Arrived in ${district.name}`, district.description, true, { energy: -5 }, district.image);
    }
    case 'INFLUENCE': {
      const district = districts.find(entry => entry.id === action.districtId);
      if (!district || !['negotiate', 'pressure'].includes(action.mode)) return state;
      const cost = influenceCost(state, action.mode);
      const energy = action.mode === 'negotiate' ? 15 : 25;
      if (state.stats.cash < cost || state.stats.energy < energy || state.stats.reputation < district.requiredRep || state.districtId !== district.id) return reject(next, `Influence requires $${cost.toLocaleString('en-US')} cash, ${energy} energy, ${district.requiredRep} reputation and a visit to ${district.name}.`);
      if ((state.territories[district.id] ?? 0) >= 100) return reject(next, 'Your influence already covers this district.');
      const success = action.mode === 'negotiate' || random(next) * 100 < influenceChance(state, action.mode, district.id);
      const effects: Effects = success
        ? { cash: -cost, energy: -energy, heat: action.mode === 'negotiate' ? -2 : 9, reputation: action.mode === 'negotiate' ? 8 : 12, influence: action.mode === 'negotiate' ? 4 : 6, influenceDistrict: action.mode === 'negotiate' ? 12 : 18, skillXp: { [action.mode === 'negotiate' ? 'charisma' : 'combat']: 25 }, loyalty: 2 }
        : { cash: -cost, energy: -energy, heat: 9, reputation: -5, health: -12, influenceDistrict: -5, injuredCrew: true, loyalty: -3 };
      return resolve(next, success ? 'Ground gained' : 'The rivals push back', success ? `Your ${action.mode === 'negotiate' ? 'agreements' : 'show of force'} weaken ${district.gang}'s hold. Local business income benefits from your territory.` : `${district.gang} refuses to yield. Your people retreat with injuries and lost ground.`, success, effects, district.image);
    }
    case 'CONTACT': {
      const contact = contacts.find(entry => entry.id === action.id);
      if (!contact || !['gift', 'favor'].includes(action.mode)) return state;
      const cost = contactCost(state, contact.id, action.mode);
      if (state.jail && !['vale', 'mara'].includes(contact.id)) return reject(next, 'Only your civic liaison or neighborhood fixer can reach you in custody.');
      if (state.stats.cash < cost || state.stats.reputation < contact.requiredRep || (action.mode === 'favor' && state.stats.energy < 15)) return reject(next, `This meeting requires $${cost.toLocaleString('en-US')} cash, ${contact.requiredRep} reputation${action.mode === 'favor' ? ' and 15 energy' : ''}.`);
      return resolve(next, action.mode === 'gift' ? 'A remembered gesture' : 'A favor returned', `${contact.name} ${action.mode === 'gift' ? 'appreciates your generosity. Trust and influence grow.' : 'recognizes the time you put into the relationship. Their connections change your position.'}`, true, contactEffects(state, contact.id, action.mode), contact.portrait);
    }
    case 'CLAIM_QUEST': {
      const quest = quests.find(entry => entry.id === action.id);
      if (!quest) return state;
      if (state.claimedQuests.includes(quest.id)) return reject(next, 'This milestone has already been rewarded.');
      if ((quest.prerequisite && !state.claimedQuests.includes(quest.prerequisite)) || questProgress(state, quest) < quest.target) return reject(next, 'Complete this milestone and its preceding chapter before claiming its reward.');
      next.claimedQuests.push(quest.id);
      return resolve(next, 'Milestone complete', `${quest.name}. ${contacts.find(contact => contact.id === quest.contact)?.name ?? quest.contact} recognizes what you have achieved.`, true, quest.reward, quest.image);
    }
    case 'START_HEIST': {
      const requirements = heistRequirements(state);
      const chosen = [...new Set(action.crewIds)];
      if (chosen.length !== action.crewIds.length || chosen.length !== heist.requiredCrew) requirements.push(`Choose ${heist.requiredCrew} different crew members.`);
      if (chosen.some(id => !activeCrew(state).includes(id))) requirements.push('Every chosen crew member must be owned, healthy and loyal.');
      if (requirements.length) return reject(next, requirements.join(' '));
      next.heist = { stage: 0, crewIds: chosen, successes: 0, choices: [], completed: false };
      return resolve(next, 'The crew is committed', `${heist.name} begins. The entry cost is paid; each stage has its own disclosed choice.`, true, { cash: -heist.cost, energy: -20 }, heist.image);
    }
    case 'HEIST_CHOICE': {
      if (!state.heist || state.heist.completed) return state;
      const stage = heist.stages[state.heist.stage];
      const choice = stage?.choices.find(entry => entry.id === action.choiceId);
      if (!stage || !choice) return state;
      if (state.stats.cash < choice.cost || state.stats.energy < 8) return reject(next, `This stage requires $${choice.cost.toLocaleString('en-US')} cash and 8 energy. You can abandon the heist if you cannot continue.`);
      const success = random(next) * 100 < heistChance(state, choice.id);
      next.heist!.stage += 1;
      next.heist!.choices.push(choice.id);
      if (success) next.heist!.successes += 1;
      const effects: Effects = { cash: -choice.cost, energy: -8, heat: heatGain(state, choice.heat), health: success ? 0 : -12, skillXp: { [stage.skill]: success ? 40 : 20 }, injuredCrew: !success, loyalty: success ? 1 : -4 };
      const completed = next.heist!.stage >= heist.stages.length;
      const tooManyFailures = next.heist!.stage - next.heist!.successes > Math.floor(heist.stages.length / 4);
      const finalSuccess = completed && !tooManyFailures;
      if (finalSuccess) {
        effects.cash = (effects.cash ?? 0) + heist.reward[0] + Math.floor(random(next) * (heist.reward[1] - heist.reward[0] + 1));
        effects.reputation = 150;
        effects.influence = 20;
        effects.flags = ['heist-completed'];
        next.heist!.completed = true;
      } else if (completed || tooManyFailures) {
        effects.reputation = -25;
        next.heist = null;
      }
      const actual = applyEffects(next, effects, state.heist.crewIds);
      const arrest = checkPolice(next, 'The Meridian settlement drew a police investigation.');
      if (arrest && finalSuccess) next.heist = { ...state.heist, stage: heist.stages.length, successes: state.heist.successes + (success ? 1 : 0), choices: [...state.heist.choices, choice.id], completed: true };
      return record(next, { title: arrest ? 'Taken into custody' : finalSuccess ? 'The city is yours' : completed || tooManyFailures ? 'The settlement collapses' : success ? `${stage.name}: secured` : `${stage.name}: a setback`, text: `${finalSuccess ? 'Your crew closes the claim. The Meridian reserve pays out, and your name becomes part of the city.' : completed || tooManyFailures ? 'Too many terms fell apart. The heist ended without a payout. Your entry and stage costs remain spent; you can prepare for a new attempt.' : success ? 'Your choice holds. The crew advances to the next stage.' : 'The opposition finds a weakness. Your crew takes a loss, but may still recover.'}${arrest ? ` ${arrest.text}` : ''}`, success: (finalSuccess || success) && !tooManyFailures && !arrest, effects: arrest ? mergeEffects(actual, arrest.effects) : actual, image: heist.image });
    }
    case 'ABORT_HEIST':
      if (!state.heist || state.heist.completed) return state;
      next.heist = null;
      return resolve(next, 'The crew stands down', 'You abandon the claim. Entry and stage costs remain spent, and the crew loses some trust. You can attempt the heist again when ready.', false, { reputation: -15, heat: 8, loyalty: -8 }, heist.image);
    case 'LAY_LOW': {
      const energy = layLowCost(state);
      if (state.stats.energy < energy) return reject(next, `Laying low requires ${energy} energy.`);
      return resolve(next, 'Off the radar', 'You let the city move without you. Attention fades and you recover a little.', true, { energy: -energy, heat: -12, health: 5 });
    }
    case 'HEAL':
      if (state.stats.cash < 500) return reject(next, 'Professional medical care requires $500 cash.');
      if (state.stats.health >= 100) return reject(next, 'Your health is already full.');
      return resolve(next, 'Patched up', 'A discreet clinic treats your injuries.', true, { cash: -500, health: 35 });
    case 'TRAIN': {
      if (!skillKeys.includes(action.skill)) return state;
      if (state.skills[action.skill] >= 10) return reject(next, 'You have mastered this skill.');
      const cost = trainingCost(state, action.skill);
      if (state.stats.cash < cost || state.stats.energy < 20) return reject(next, `Training requires $${cost.toLocaleString('en-US')} cash and 20 energy.`);
      next.counters.training += 1;
      return resolve(next, 'Practice pays', `Focused training improved ${skillLabels[action.skill].toLowerCase()}.`, true, { cash: -cost, energy: -20, skillXp: { [action.skill]: 100 } });
    }
    case 'BAIL': {
      if (!state.jail) return state;
      const cost = bailCost(state);
      if (state.stats.cash < cost) return reject(next, `Bail requires $${cost.toLocaleString('en-US')} cash. You can still serve your remaining sentence.`);
      next.jail = null;
      next.pendingEvent = null;
      return resolve(next, 'Back on the street', 'Your release is approved. The city remembers the case, but your sentence is over.', true, { cash: -cost, heat: -10 });
    }
    case 'NEXT_DAY': {
      next.day += 1;
      const income = dailyIncome(state);
      const salaries = crewSalary(state);
      const paid = state.stats.cash + income >= salaries;
      const illegalHeat = state.businesses.reduce((total, owned) => total + (businesses.find(entry => entry.id === owned.id)?.heat ?? 0) * owned.level, 0);
      let effects = applyEffects(next, { cash: income - salaries, health: 15 + (state.safehouse.infirmary ?? 0) * 5, energy: 100 - state.stats.energy, heat: illegalHeat - 6 - (state.safehouse.security ?? 0) * 2, loyalty: paid ? 1 : -8 });
      for (const id of state.crew) next.crewInjured[id] = Math.max(0, (next.crewInjured[id] ?? 0) - 1 - Math.floor((state.safehouse.infirmary ?? 0) / 2));
      if (state.jail) {
        next.jail = state.jail.days <= 1 ? null : { ...state.jail, days: state.jail.days - 1 };
        return afterTurn(next, { title: next.jail ? 'Another day inside' : 'Sentence served', text: next.jail ? `Your sentence has ${next.jail.days} day${next.jail.days === 1 ? '' : 's'} remaining. The crew handles daily accounts.` : 'The gates open. Your sentence is complete and the city is yours to face again.', success: !next.jail, effects, image: '/assets/city.webp' });
      }
      const pressure: string[] = [];
      const illegal = next.businesses.filter(owned => businesses.find(entry => entry.id === owned.id)?.type === 'illegal');
      const raidRisk = clamp((next.stats.heat - 40) * .012 + illegal.reduce((sum, owned) => sum + owned.level * .04, 0), 0, .55);
      if (illegal.length && next.stats.heat >= 40 && random(next) < raidRisk) {
        const owned = illegal[Math.floor(random(next) * illegal.length)];
        const business = businesses.find(entry => entry.id === owned.id)!;
        owned.level = Math.max(1, owned.level - 1);
        effects = mergeEffects(effects, applyEffects(next, { cash: -Math.min(next.stats.cash, 1500 + Math.round(income / 2)), heat: 6, loyalty: -3 }));
        pressure.push(`A raid disrupted ${business.name}. Proceeds were confiscated${owned.level < state.businesses.find(entry => entry.id === owned.id)!.level ? ' and its level fell' : ''}.`);
      }
      for (const [id, territory] of Object.entries(next.territories)) {
        const district = districts.find(entry => entry.id === id);
        if (!district || territory <= 0 || random(next) >= .2 + district.risk * .025 - activeCrew(next).length * .01) continue;
        const lost = Math.min(territory, 3 + Math.floor(random(next) * 4));
        next.territories[id] -= lost;
        effects = mergeEffects(effects, applyEffects(next, { influence: -1 }));
        pressure.push(`Rival pressure from ${district.gang} cost ${lost} territory in ${district.name}.`);
      }
      const arrest = checkPolice(next, 'High police attention brought investigators to your door.');
      if (arrest) return afterTurn(next, { title: 'Taken into custody', text: `${pressure.join(' ')} ${arrest.text}`.trim(), success: false, effects: mergeEffects(effects, arrest.effects), image: '/assets/city.webp' }, 'jail-arrival');
      return afterTurn(next, { title: `Day ${next.day}`, text: `The city wakes. Businesses earned $${income.toLocaleString('en-US')}; crew salaries were $${salaries.toLocaleString('en-US')}.${paid ? '' : ' You could not cover every salary. Loyalty suffered.'}${pressure.length ? ` ${pressure.join(' ')}` : ''}`, success: paid && !pressure.length, effects, image: '/assets/city.webp' });
    }
    default: return state;
  }
}
export function jobChance(state: GameState, activity: Activity, approach: 'rush' | 'informant' | 'scout' | 'leave' = 'rush'): number {
  if (approach === 'leave') return 0;
  const prep = approach === 'informant' ? 12 : approach === 'scout' ? 18 : 0;
  const crewBonus = activeCrew(state).reduce((bonus, id) => {
    const member = crew.find(entry => entry.id === id);
    return bonus + (member ? (member.skill === activity.skill ? member.rating : member.rating * .35) * (state.crewLoyalty[id] ?? 50) / 100 : 0);
  }, 0);
  const districtRisk = districts.find(entry => entry.id === activity.districtId)?.risk ?? 0;
  return Math.round(clamp(activity.baseChance + (state.skills[activity.skill] - 1) * 3 + itemBonus(state, activity.skill) * 3 - activity.difficulty * 2 - state.stats.heat * .3 - districtRisk * .4 + Math.min(14, crewBonus) + (state.safehouse.workshop ?? 0) * 2 + prep, 5, 95));
}
export function jobFailureEffects(state: GameState, activity: Activity, approach: 'rush' | 'informant' | 'scout' | 'leave' = 'rush'): Effects {
  if (approach === 'leave') return {};
  const prepCost = approach === 'informant' ? Math.max(250, Math.round(activity.cost * .6)) : 0;
  const prepEnergy = approach === 'scout' ? 5 : 0;
  return {
    ...activity.failure,
    cash: (activity.failure.cash ?? 0) - activity.cost - prepCost,
    energy: (activity.failure.energy ?? 0) - activity.energy - prepEnergy,
    reputation: activity.failure.reputation ?? -Math.max(3, Math.round(activity.rep / 4)),
    heat: heatGain(state, (activity.failure.heat ?? 0) + Math.ceil(activity.heat / 2)),
    skillXp: { [activity.skill]: 18 },
  };
}
export function heatGain(state: GameState, baseHeat: number): number { return Math.max(0, baseHeat - itemBonus(state, 'heatReduction')); }
export function jobRequirements(state: GameState, activity: Activity): string[] {
  const required: string[] = [];
  if (state.jail) required.push('Serve your sentence or post bail first.');
  if (state.stats.cash < activity.cost) required.push(`Requires $${activity.cost.toLocaleString('en-US')} cash.`);
  if (state.stats.energy < activity.energy) required.push(`Requires ${activity.energy} energy.`);
  if (state.stats.health < 30) required.push('Requires at least 30 health.');
  const requiredRep = Math.max(activity.requiredRep, districts.find(entry => entry.id === activity.districtId)?.requiredRep ?? 0);
  if (state.stats.reputation < requiredRep) required.push(`Requires ${requiredRep} reputation.`);
  if (state.districtId !== activity.districtId) required.push(`Travel to ${districts.find(district => district.id === activity.districtId)?.name ?? 'this district'} first.`);
  if (activity.requiredItem && !state.inventory.includes(activity.requiredItem)) required.push(`Requires ${items.find(item => item.id === activity.requiredItem)?.name ?? activity.requiredItem}.`);
  if (activity.requiredCrew && activeCrew(state).length < activity.requiredCrew) required.push(`Requires ${activity.requiredCrew} healthy, loyal crew.`);
  return required;
}
export function questProgress(state: GameState, quest: Quest): number {
  if (quest.prerequisite && !state.claimedQuests.includes(quest.prerequisite)) return 0;
  const metrics: Record<Quest['metric'], number> = {
    jobsSucceeded: state.counters.jobsSucceeded, cash: state.stats.cash, reputation: state.stats.reputation,
    crew: state.crew.length, businesses: state.businesses.length, influence: state.stats.influence,
    items: state.inventory.length, heist: state.heist?.completed ? 1 : 0, days: state.day,
    districts: state.counters.districts.length, training: state.counters.training,
    lowHeat: state.stats.heat <= quest.target ? quest.target : 0,
  };
  return clamp(metrics[quest.metric], 0, quest.target);
}
export function dailyIncome(state: GameState): number {
  return state.businesses.reduce((total, owned) => {
    const business = businesses.find(entry => entry.id === owned.id);
    return total + (business ? Math.round(business.income * owned.level * (1 + (state.skills.business - 1) * .03 + (state.territories[business.districtId] ?? 0) * .002)) : 0);
  }, 0);
}
export function crewSalary(state: GameState): number { return state.crew.reduce((total, id) => total + (crew.find(member => member.id === id)?.salary ?? 0), 0); }
export function heistRequirements(state: GameState): string[] {
  const requirements: string[] = [];
  if (state.jail) requirements.push('Serve your sentence or post bail first.');
  if (state.heist?.completed || state.flags.includes('heist-completed')) requirements.push('The major heist has already been completed.');
  if (state.stats.reputation < heist.requiredRep) requirements.push(`Requires ${heist.requiredRep} reputation.`);
  if (state.stats.cash < heist.cost) requirements.push(`Requires $${heist.cost.toLocaleString('en-US')} cash.`);
  const requiredEnergy = 20 + heist.stages.length * 8;
  if (state.stats.energy < requiredEnergy) requirements.push(`Requires ${requiredEnergy} energy for the whole operation: 20 to assemble the crew, then 8 per stage.`);
  if (state.stats.health < 50) requirements.push('Requires at least 50 health.');
  if (activeCrew(state).length < heist.requiredCrew) requirements.push(`Requires ${heist.requiredCrew} healthy, loyal crew.`);
  for (const id of heist.requiredItems) if (!state.inventory.includes(id)) requirements.push(`Requires ${items.find(item => item.id === id)?.name ?? id}.`);
  return requirements;
}
export function rankFor(reputation: number): string {
  if (reputation >= 1000) return 'City legend';
  if (reputation >= 550) return 'Kingpin';
  if (reputation >= 300) return 'Underboss';
  if (reputation >= 150) return 'Operator';
  return 'Street prospect';
}
export function trainingCost(state: GameState, skill: SkillKey): number { return 500 + state.skills[skill] * 150; }
export function bailCost(state: GameState): number { return state.jail ? 1500 + state.jail.days * 650 : 0; }
export function businessUpgradeCost(state: GameState, id: string): number { return Math.round((businesses.find(entry => entry.id === id)?.cost ?? 0) * .65 * (state.businesses.find(entry => entry.id === id)?.level ?? 0)); }
export function safehouseUpgradeCost(state: GameState, id: string): number { return (safehouseUpgrades.find(entry => entry.id === id)?.cost ?? 0) * ((state.safehouse[id] ?? 0) + 1); }
export function influenceCost(_state: GameState, mode: 'negotiate' | 'pressure'): number { return mode === 'negotiate' ? 1000 : 500; }
export function contactCost(_state: GameState, _id: string, mode: 'favor' | 'gift'): number { return mode === 'gift' ? 500 : 0; }
export function influenceChance(state: GameState, mode: 'negotiate' | 'pressure', districtId = state.districtId): number { return mode === 'negotiate' ? 100 : Math.round(clamp(65 + (state.skills.combat - 1) * 3 + activeCrew(state).length * 3 - state.stats.heat * .2 - (districts.find(district => district.id === districtId)?.risk ?? 0) * .5, 20, 95)); }
export function contactEffects(state: GameState, id: string, mode: 'favor' | 'gift'): Effects {
  if (mode === 'gift') return { cash: -500, relationships: { [id]: 18 }, influence: 1, ...(state.jail && id === 'mara' ? { jailDays: -1 } : {}) };
  const favors: Record<string, Effects> = {
    vale: { heat: -10, reputation: 5, influence: 1, ...(state.jail ? { jailDays: -1 } : {}) },
    mara: { cash: 650, heat: 3, reputation: 8, influence: 2 },
    rafe: { cash: 900, heat: 4, reputation: 10 },
    ivo: { cash: 600, reputation: 10, influence: 3 },
    lin: { heat: -5, reputation: 10, influence: 4, loyalty: 3 },
    selene: { cash: 1200, heat: 3, reputation: 15, influence: 4 },
  };
  return { ...favors[id], energy: -15, relationships: { [id]: 10 }, skillXp: { charisma: 15 } };
}
export function heistChance(state: GameState, choiceId: string): number {
  if (!state.heist || state.heist.completed) return 0;
  const stage = heist.stages[state.heist.stage];
  const choice = stage?.choices.find(entry => entry.id === choiceId);
  if (!stage || !choice) return 0;
  const crewBonus = state.heist.crewIds.reduce((sum, id) => {
    const member = crew.find(entry => entry.id === id);
    return sum + (member && activeCrew(state).includes(id) ? member.rating * (member.skill === stage.skill ? 1.5 : .6) * (state.crewLoyalty[id] ?? 0) / 100 : 0);
  }, 0);
  return Math.round(clamp(48 + (state.skills[stage.skill] - 1) * 3 + itemBonus(state, stage.skill) * 3 + Math.min(15, crewBonus) + choice.chanceBonus - state.stats.heat * .25 + state.heist.successes * 2 - (state.heist.stage - state.heist.successes) * 6, 10, 95));
}
export function eventChance(state: GameState, choice: EventChoice): number {
  if (choice.chance === undefined) return 100;
  const skill = choice.skill;
  return Math.round(clamp(choice.chance + (skill ? (state.skills[skill] - 1) * 3 + itemBonus(state, skill) * 3 : 0), 0, 100));
}
export function eventChoiceRequirements(state: GameState, choice: EventChoice): string[] {
  const requirements: string[] = [];
  const mayFail = eventChance(state, choice) < 100;
  const cash = Math.max(0, -(choice.effects.cash ?? 0), mayFail ? -(choice.failure?.cash ?? 0) : 0);
  const energy = Math.max(0, -(choice.effects.energy ?? 0), mayFail ? -(choice.failure?.energy ?? 0) : 0);
  if (state.stats.cash < cash) requirements.push(`Requires $${cash.toLocaleString('en-US')} cash to cover either outcome.`);
  if (state.stats.energy < energy) requirements.push(`Requires ${energy} energy.`);
  if (choice.requiredFlag && !state.flags.includes(choice.requiredFlag)) requirements.push(`Requires ${choice.requiredFlag.replaceAll('-', ' ')}.`);
  if (choice.requiredCrew && activeCrew(state).length < choice.requiredCrew) requirements.push(`Requires ${choice.requiredCrew} healthy, loyal crew.`);
  return requirements;
}
export function layLowCost(state: GameState): number { return Math.max(4, 20 - (state.safehouse.bedroom ?? 0) * 4); }
export function eventIsEligible(state: GameState, event: GameEvent): boolean {
  return !event.followUpOnly
    && Boolean(state.jail) === Boolean(event.jailOnly)
    && state.stats.reputation >= (event.minRep ?? 0)
    && state.stats.heat >= (event.minHeat ?? 0)
    && state.stats.heat <= (event.maxHeat ?? 100)
    && (!event.districtId || event.districtId === state.districtId)
    && (!event.requiredFlag || state.flags.includes(event.requiredFlag))
    && (!event.forbiddenFlag || !state.flags.includes(event.forbiddenFlag))
    && (!event.requiresBusiness || state.businesses.length > 0)
    && (!event.requiresCrew || state.crew.length > 0);
}
