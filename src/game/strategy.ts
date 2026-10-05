import { businesses, crew, districts, items, operations, rivals, zones } from '../data';
import type { Effects, GameState, SkillKey } from './types';
import type { BattleApproach, BattleChoiceId, BattleChoiceInfo, BattlePreview, CommandInfo, OperationChoiceInfo, OperationDefinition, StrategyAction, StrategyContext, StrategyState, ZoneActionMode, ZoneView } from './strategy-types';

export const difficulties = ['standard', 'hard', 'ruthless'] as const;
export const agendas = ['balanced', 'profit', 'silent', 'war'] as const;
export const battleChoices: { id: BattleChoiceId; label: string; description: string }[] = [
  { id: 'advance', label: 'Advance the claim', description: 'Build momentum at the cost of exposure and crew risk.' },
  { id: 'flank', label: 'Find another opening', description: 'Use a specialist and current intel for a quieter advance.' },
  { id: 'cover', label: 'Protect the crew', description: 'Reduce exposure and injury risk; make a smaller advance.' },
  { id: 'rally', label: 'Restore composure', description: 'Recover morale and reduce exposure, with little progress.' },
  { id: 'retreat', label: 'Retreat', description: 'Withdraw without extra cash or energy. Entry costs stay spent; lose 8 reputation and 15 zone intel. Selected crew loses 5 loyalty and gains 25 fatigue.' },
];
const clamp = (value: number, min = 0, max = 100) => Math.round(Math.min(max, Math.max(min, value)));
const money = (value: number) => `$${value.toLocaleString('en-US')}`;
const modes: ZoneActionMode[] = ['scout', 'negotiate', 'disrupt', 'fortify'];
const approaches: BattleApproach[] = ['silent', 'balanced', 'force'];

export function createStrategy(day = 1): StrategyState {
  return {
    difficulty: 'standard', agenda: 'balanced',
    zones: Object.fromEntries(zones.map(zone => [zone.id, { owner: zone.id === 'market-street' ? 'player' : zone.rivalId, control: zone.id === 'market-street' ? 100 : 0, intel: zone.id === 'market-street' ? 100 : 0, fortification: 0, lieutenantId: null, disruptedUntil: 0 }])),
    rivals: Object.fromEntries(rivals.map(rival => [rival.id, { strength: rival.strength, hostility: rival.hostility, alert: 0, truceUntil: 0 }])),
    crewFatigue: {}, battle: null, operation: null,
    counters: { battlesWon: 0, battlesFought: 0, operationsCompleted: 0, zonesCaptured: 0 },
    operationCooldowns: {}, rewardClaims: { day, energy: 0, cash: 0 }, lastDaily: null,
  };
}
/** Legacy source callers can preview without mutating their state. Persistence supplies the subtree. */
export function getStrategy(state: GameState): StrategyState { return state.strategy ?? createStrategy(state.day); }
export function strategyRiskPenalty(state: GameState): number { return { standard: 0, hard: 8, ruthless: 16 }[getStrategy(state).difficulty]; }
function price(state: GameState, cost: number): number { return Math.ceil(cost * ({ standard: 1, hard: 1.15, ruthless: 1.3 }[getStrategy(state).difficulty])); }
function bonus(state: GameState, skill: SkillKey): number { return state.inventory.reduce((sum, id) => sum + (items.find(item => item.id === id)?.bonuses[skill] ?? 0), 0); }
function idleRequirements(state: GameState): string[] {
  const requirements: string[] = [];
  if (state.jail) requirements.push('Serve your sentence or post bail first.');
  if (state.pendingEvent || state.pendingJob || (state.heist && !state.heist.completed) || getStrategy(state).battle || getStrategy(state).operation) requirements.push('Finish the current commitment first.');
  return requirements;
}
function resourceRequirements(state: GameState, cost: number, energy: number): string[] {
  const requirements: string[] = [];
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(energy) || energy < 0) return ['This content has an invalid cost.'];
  if (state.stats.cash < cost) requirements.push(`Requires ${money(cost)} cash.`);
  if (state.stats.energy < energy) requirements.push(`Requires ${energy} energy.`);
  return requirements;
}
export function strategyAvailableCrew(state: GameState): string[] {
  const strategy = getStrategy(state);
  const assigned = Object.values(strategy.zones).flatMap(zone => zone.lieutenantId ? [zone.lieutenantId] : []);
  return state.crew.filter(id => (state.crewInjured[id] ?? 0) === 0 && (state.crewLoyalty[id] ?? 0) >= 35 && (strategy.crewFatigue[id] ?? 0) < 70 && !assigned.includes(id));
}
function selectionRequirements(state: GameState, ids: string[], minimum: number, maximum = minimum): string[] {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.length < minimum || ids.length > maximum) return [`Choose ${minimum === maximum ? minimum : `${minimum}–${maximum}`} different crew members.`];
  return ids.every(id => strategyAvailableCrew(state).includes(id)) ? [] : ['Selected crew must be owned, healthy, loyal, rested and free of lieutenant duties.'];
}
export function connectedZoneIds(state: GameState): string[] {
  const strategy = getStrategy(state);
  const connected = new Set<string>();
  const pending = ['market-street'];
  while (pending.length) {
    const id = pending.pop()!;
    if (connected.has(id) || strategy.zones[id]?.owner !== 'player') continue;
    connected.add(id);
    for (const neighbor of zones.find(zone => zone.id === id)?.neighbors ?? []) pending.push(neighbor);
  }
  return [...connected];
}
export function zoneView(state: GameState, zoneId: string): ZoneView | null {
  const definition = zones.find(zone => zone.id === zoneId);
  if (!definition) return null;
  const strategy = getStrategy(state);
  const zone = strategy.zones[zoneId];
  if (!zone) return null;
  const owned = zone.owner === 'player';
  const connected = connectedZoneIds(state).includes(zoneId);
  const adjacent = definition.neighbors.some(id => connectedZoneIds(state).includes(id));
  const lieutenant = zone.lieutenantId && state.crewInjured[zone.lieutenantId] === 0 && state.crewLoyalty[zone.lieutenantId] >= 35 ? crew.find(member => member.id === zone.lieutenantId) : undefined;
  const income = owned ? Math.round(definition.income * (connected ? 1 : .3) * (.5 + zone.control / 200) * (strategy.agenda === 'profit' ? 1.25 : 1) * (zone.disruptedUntil > state.day ? .5 : 1)) : 0;
  const upkeep = owned ? Math.ceil((definition.upkeep + (definition.upkeep ? zone.fortification * 35 : 0)) * (connected ? 1 : 1.4) * ({ standard: 1, hard: 1.2, ruthless: 1.45 }[strategy.difficulty]) * (strategy.agenda === 'war' ? 1.2 : strategy.agenda === 'profit' ? 1.15 : 1)) : 0;
  const defense = owned ? clamp(zone.control * .45 + zone.fortification * 15 + (lieutenant ? lieutenant.rating * 4 * state.crewLoyalty[lieutenant.id] / 100 : 0) + (connected ? 12 : -10), 0, 150)
    : clamp(definition.defense + strategy.rivals[definition.rivalId].strength * .25 + strategy.rivals[definition.rivalId].alert * .2 - zone.intel * .12 - (zone.disruptedUntil > state.day ? 18 : 0), 0, 150);
  return { definition, state: zone, owned, connected, adjacent, unlocked: state.stats.reputation >= Math.max(definition.requiredRep, districts.find(d => d.id === definition.districtId)?.requiredRep ?? 0), rival: rivals.find(rival => rival.id === definition.rivalId) ?? null, income, upkeep, defense };
}
export function zoneActionInfo(state: GameState, zoneId: string, mode: ZoneActionMode): CommandInfo {
  const view = zoneView(state, zoneId);
  if (!view || !modes.includes(mode)) return { cost: 0, energy: 0, chance: 0, requirements: ['Unknown zone or command.'], consequence: '' };
  const strategy = getStrategy(state);
  const rival = strategy.rivals[view.definition.rivalId];
  const cost = price(state, mode === 'scout' ? 180 + view.definition.defense * 4 : mode === 'fortify' ? 550 + view.definition.defense * 8 + view.state.fortification * 450 : mode === 'negotiate' ? 1000 + view.definition.defense * 18 : 650 + view.definition.defense * 9);
  const energy = { scout: 12, negotiate: 15, disrupt: 20, fortify: 15 }[mode];
  const requirements = [...idleRequirements(state), ...resourceRequirements(state, cost, energy)];
  if (!view.unlocked) requirements.push(`Requires ${Math.max(view.definition.requiredRep, districts.find(d => d.id === view.definition.districtId)?.requiredRep ?? 0)} reputation.`);
  if (state.districtId !== view.definition.districtId) requirements.push(`Travel to ${districts.find(d => d.id === view.definition.districtId)?.name} first.`);
  if (mode === 'fortify' && !view.owned) requirements.push('Control this zone before fortifying it.');
  if (mode === 'fortify' && view.state.fortification >= 3) requirements.push('Fortifications are already at level 3.');
  if (mode === 'scout' && view.state.intel >= 100) requirements.push('Intel is already complete.');
  if (mode === 'disrupt' && view.owned) requirements.push('Disruption targets rival zones.');
  if (mode === 'disrupt' && view.state.disruptedUntil > state.day) requirements.push('This zone is already disrupted.');
  if (mode === 'disrupt' && strategyAvailableCrew(state).length < 1) requirements.push('Requires one healthy, loyal, rested crew member.');
  if ((mode === 'negotiate' || mode === 'disrupt') && !view.owned && !view.adjacent) requirements.push('Requires a neighboring zone connected to your base.');
  if (mode === 'negotiate' && view.owned && view.state.control >= 100) requirements.push('Control is already secure.');
  if (mode === 'disrupt' && rival.truceUntil > state.day) requirements.push(`A truce protects this rival until day ${rival.truceUntil}.`);
  if (state.stats.health < 30 && mode === 'disrupt') requirements.push('Requires at least 30 health.');
  const chance = mode === 'scout' || mode === 'fortify' || (mode === 'negotiate' && view.owned) ? 100 : clamp((mode === 'negotiate' ? 40 + state.skills.charisma * 4 + state.skills.business * 2 + bonus(state, 'charisma') * 3 + (['leader', 'fixer', 'boss'].includes(state.player.path) ? 6 : 0) : 43 + state.skills.stealth * 4 + state.skills.streetSmarts * 2 + bonus(state, 'stealth') * 3) + view.state.intel * .25 - rival.strength * .25 - rival.hostility * .12 - strategyRiskPenalty(state) + (strategy.agenda === 'silent' ? 6 : 0), 10, 95);
  const consequence = mode === 'scout' ? 'Gain 35 intel. Intel lowers rival defense and improves negotiated terms; it fades each day.' : mode === 'fortify' ? 'Add one fortification level and 15 defense. Developed zones cost $35 more upkeep per level before modifiers.' : mode === 'negotiate' ? view.owned ? 'Restore 25 control, keeping daily income and defense strong.' : 'Success adds 40 control; 80 control secures the zone peacefully and grants a two-day truce. Failure raises rival alert.' : 'Success weakens this rival and zone defense for two days. Both outcomes raise hostility; failure risks a crew injury.';
  return { cost, energy, chance, requirements, consequence };
}
export function rivalTruceInfo(state: GameState, rivalId: string): CommandInfo & { duration: number } {
  const definition = rivals.find(rival => rival.id === rivalId);
  const strategy = getStrategy(state);
  if (!definition) return { cost: 0, energy: 0, chance: 0, duration: 0, requirements: ['Unknown rival.'], consequence: '' };
  const rival = strategy.rivals[rivalId];
  const cost = price(state, 650 + rival.strength * 14 + rival.hostility * 8);
  const energy = 10;
  const duration = strategy.difficulty === 'standard' ? 3 : 2;
  const requirements = [...idleRequirements(state), ...resourceRequirements(state, cost, energy)];
  if (rival.truceUntil > state.day) requirements.push(`A truce already lasts until day ${rival.truceUntil}.`);
  if (state.stats.reputation < (districts.find(d => d.id === definition.districtId)?.requiredRep ?? 0)) requirements.push('Build enough reputation to open talks in this district.');
  return { cost, energy, chance: 100, duration, requirements, consequence: `Prevent this rival's zone retaliation and business pressure for ${duration} game days. Hostile actions are unavailable until the truce expires.` };
}
function battlePower(state: GameState, ids: string[], approach: BattleApproach): number {
  const strategy = getStrategy(state);
  const skill = approach === 'silent' ? 'stealth' : 'combat';
  const team = ids.reduce((sum, id) => { const member = crew.find(entry => entry.id === id); return sum + (member ? member.rating * (member.skill === skill ? 4 : 2.5) * (state.crewLoyalty[id] ?? 0) / 100 * (1 - (strategy.crewFatigue[id] ?? 0) / 160) : 0); }, 0);
  return Math.round(20 + state.skills[skill] * 4 + state.skills.streetSmarts * 2 + bonus(state, skill) * 3 + team + (strategy.agenda === 'war' ? 9 : strategy.agenda === 'profit' ? -5 : strategy.agenda === 'silent' && approach === 'silent' ? 7 : 0) + (approach === 'force' ? 6 : 0) - strategyRiskPenalty(state));
}
export function battlePreview(state: GameState, zoneId: string, crewIds: string[] = [], approach: BattleApproach = 'balanced'): BattlePreview {
  const view = zoneView(state, zoneId);
  if (!view || !approaches.includes(approach)) return { cost: 0, energy: 0, chance: 0, power: 0, defense: 0, requirements: ['Unknown zone or approach.'], consequence: '' };
  const cost = price(state, 600 + view.definition.defense * 15 + (approach === 'silent' ? 250 : 0));
  const energy = approach === 'force' ? 26 : 20;
  const requirements = [...idleRequirements(state), ...resourceRequirements(state, cost, energy + 18), ...selectionRequirements(state, crewIds, 1, 3)];
  if (view.owned) requirements.push('You already control this zone.');
  if (!view.unlocked) requirements.push(`Requires ${view.definition.requiredRep} reputation.`);
  if (state.districtId !== view.definition.districtId) requirements.push(`Travel to ${districts.find(d => d.id === view.definition.districtId)?.name} first.`);
  if (!view.adjacent) requirements.push('Requires a neighboring zone connected to your base.');
  if (getStrategy(state).rivals[view.definition.rivalId].truceUntil > state.day) requirements.push(`A truce protects this rival until day ${getStrategy(state).rivals[view.definition.rivalId].truceUntil}.`);
  if (state.stats.health < 40) requirements.push('Requires at least 40 health.');
  const power = battlePower(state, Array.isArray(crewIds) ? crewIds : [], approach);
  const chance = clamp(55 + (power - view.defense) * .65 + view.state.intel * .12 - state.stats.heat * .16, 10, 95);
  return { cost, energy, chance, power, defense: view.defense, requirements, consequence: `Commit the chosen crew for three rounds. Entry uses ${energy} energy; reserve 18 for choices. Silent starts with less exposure; Force starts with more momentum. Win with at least 30 momentum, morale above 15 and exposure below 85. Defeat compromises 25 intel; retreat forfeits entry costs and 15 intel.` };
}
export function battleChoiceInfo(state: GameState, choiceId: string): BattleChoiceInfo {
  const battle = getStrategy(state).battle;
  const choice = battleChoices.find(entry => entry.id === choiceId);
  const fallback = { cost: 0, energy: 0, chance: 0, requirements: ['No active encounter or unknown choice.'], consequence: '', label: choice?.label ?? '', description: choice?.description ?? '', momentum: 0, exposure: 0, morale: 0, injuryChance: 0 };
  if (!battle || !choice) return fallback;
  if (choiceId === 'retreat') return { ...fallback, chance: 100, requirements: [], consequence: choice.description };
  const values = { advance: [23, 14, -4, 18, 0], flank: [20, 6, -3, 12, -5], cover: [7, -14, 6, 4, 10], rally: [3, -8, 20, 2, 15] }[choiceId as Exclude<BattleChoiceId, 'retreat'>];
  const view = zoneView(state, battle.zoneId)!;
  const power = battlePower(state, battle.crewIds.filter(id => !battle.woundedCrewIds.includes(id)), battle.approach);
  const stealthTeam = battle.crewIds.some(id => crew.find(member => member.id === id)?.skill === 'stealth') ? 8 : 0;
  const chance = clamp(55 + (power - view.defense) * .65 + view.state.intel * .12 - state.stats.heat * .16 + battle.momentum * .1 + (battle.morale - 70) * .16 - battle.exposure * .14 + values[4] + (choiceId === 'flank' ? stealthTeam : 0), 10, 95);
  const injuryChance = clamp(values[3] + strategyRiskPenalty(state) * .5 + battle.exposure * .1 - (getStrategy(state).agenda === 'silent' ? 3 : 0), 1, 55);
  return { cost: 0, energy: 6, chance, requirements: resourceRequirements(state, 0, 6), consequence: 'Success grants the listed momentum; setback loses 8 momentum and 12 morale, adds 8 extra exposure, and can injure only committed crew.', label: choice.label, description: choice.description, momentum: values[0], exposure: values[1], morale: values[2], injuryChance };
}
export function operationRequirements(state: GameState, definition: string | OperationDefinition, crewIds: string[] = []): string[] {
  const operation = operations.find(entry => entry.id === (typeof definition === 'string' ? definition : definition?.id));
  if (!operation) return ['Unknown operation.'];
  const cost = price(state, operation.cost);
  const minimumEnergy = operation.energy + operation.stages.reduce((total, stage) => total + Math.min(...stage.choices.map(choice => choice.energy)), 0);
  const requirements = [...idleRequirements(state), ...resourceRequirements(state, cost, minimumEnergy), ...selectionRequirements(state, crewIds, operation.requiredCrew)];
  if (state.stats.reputation < operation.requiredRep) requirements.push(`Requires ${operation.requiredRep} reputation.`);
  if (state.stats.health < 50) requirements.push('Requires at least 50 health.');
  if ((getStrategy(state).operationCooldowns[operation.id] ?? 0) > state.day) requirements.push(`Available again on day ${getStrategy(state).operationCooldowns[operation.id]}.`);
  for (const id of operation.requiredItems) if (!state.inventory.includes(id)) requirements.push(`Requires ${items.find(item => item.id === id)?.name ?? id}.`);
  return requirements;
}
export function operationEntryInfo(state: GameState, definition: string | OperationDefinition, crewIds: string[] = []): CommandInfo {
  const operation = operations.find(entry => entry.id === (typeof definition === 'string' ? definition : definition?.id));
  if (!operation) return { cost: 0, energy: 0, chance: 0, requirements: ['Unknown operation.'], consequence: '' };
  const reserved = operation.stages.reduce((sum, stage) => sum + Math.min(...stage.choices.map(choice => choice.energy)), 0);
  return { cost: price(state, operation.cost), energy: operation.energy, chance: 100, requirements: operationRequirements(state, operation, crewIds), consequence: `Entry commits the selected crew and ${operation.energy} energy; reserve at least ${reserved} energy for three stages. Finish with 85 progress and suspicion below 80. Successful operations return after ${operation.cooldown} days; aborting always remains free of cash and energy costs.` };
}
export function operationChoiceInfo(state: GameState, choiceId: string): OperationChoiceInfo {
  const progress = getStrategy(state).operation;
  const operation = operations.find(entry => entry.id === progress?.operationId);
  const stage = progress && operation?.stages[progress.stage];
  const choice = stage && stage.choices.find(entry => entry.id === choiceId);
  if (!progress || !stage || !choice) return { cost: 0, energy: 0, chance: 0, requirements: ['No active stage or unknown choice.'], consequence: '', progress: 0, suspicion: 0, injuryChance: 0 };
  const strategy = getStrategy(state);
  const team = progress.crewIds.reduce((sum, id) => { const member = crew.find(entry => entry.id === id); return sum + (member && state.crewInjured[id] === 0 ? member.rating * (member.skill === stage.skill ? 1.7 : .65) * state.crewLoyalty[id] / 100 * (1 - (strategy.crewFatigue[id] ?? 0) / 160) : 0); }, 0);
  const connected = connectedZoneIds(state).some(id => zones.find(zone => zone.id === id)?.districtId === operation!.districtId);
  const chance = clamp(48 + (state.skills[stage.skill] - 1) * 4 + bonus(state, stage.skill) * 3 + Math.min(22, team) + choice.chanceBonus + progress.progress * .04 - progress.suspicion * .25 - state.stats.heat * .15 - strategyRiskPenalty(state) - operations.indexOf(operation!) * 5 + (strategy.agenda === 'silent' ? 6 : 0) + (connected ? 5 : 0), 10, 95);
  const suspicion = choice.suspicion + (strategy.agenda === 'silent' ? -3 : strategy.agenda === 'profit' ? 3 : 0);
  return { cost: price(state, choice.cost), energy: choice.energy, chance, requirements: resourceRequirements(state, price(state, choice.cost), choice.energy), progress: choice.progress, suspicion, injuryChance: clamp(choice.injuryChance + strategyRiskPenalty(state) * .5), consequence: 'Success earns the listed progress. A setback earns 10 progress, adds 18 extra suspicion and risks a crew injury. Finish with 85 progress and suspicion below 80 to receive the payout; suspicion of 90 ends the attempt.' };
}
export function dailySupplyRemaining(state: GameState): number {
  const claims = getStrategy(state).rewardClaims;
  return claims.day === state.day ? Math.max(0, 1 - claims.energy - claims.cash) : 1;
}
export function strategySummary(state: GameState) {
  const strategy = getStrategy(state);
  const owned = zones.map(zone => zoneView(state, zone.id)!).filter(zone => zone.owned);
  const remaining = dailySupplyRemaining(state);
  return { ownedZones: owned.length, connectedZones: connectedZoneIds(state).length, zoneIncome: owned.reduce((sum, zone) => sum + zone.income, 0), zoneUpkeep: owned.reduce((sum, zone) => sum + zone.upkeep, 0), battlesWon: strategy.counters.battlesWon, operationsCompleted: strategy.counters.operationsCompleted, activeCrewIds: strategyAvailableCrew(state), rewardEnergyRemaining: remaining, rewardCashRemaining: remaining };
}
/** Accounts are calculated from yesterday's holdings; retaliation determines tomorrow's supply. */
export function processStrategyDay(state: GameState, next: GameState, context: StrategyContext, businessIncome: number): Effects {
  next.strategy ??= createStrategy(next.day);
  const strategy = next.strategy;
  const accounts = strategySummary(state);
  const notices: string[] = [];
  let businessPressure = 0;
  const enoughUpkeep = state.stats.cash + accounts.zoneIncome + businessIncome >= accounts.zoneUpkeep;
  for (const id of state.crew) strategy.crewFatigue[id] = clamp((strategy.crewFatigue[id] ?? 0) - 30 - (state.safehouse.infirmary ?? 0) * 5);
  for (const definition of zones) {
    const zone = strategy.zones[definition.id];
    if (definition.id !== 'market-street') zone.intel = clamp(zone.intel - 8);
    if (zone.owner === 'player' && definition.id !== 'market-street' && !enoughUpkeep) { zone.control = clamp(zone.control - 8); notices.push(`Unpaid upkeep weakened ${definition.name} by 8 control.`); }
  }
  for (const definition of rivals) {
    const rival = strategy.rivals[definition.id];
    if (rival.strength < definition.strength) rival.strength = Math.min(definition.strength, rival.strength + (strategy.difficulty === 'standard' ? 4 : strategy.difficulty === 'hard' ? 6 : 8));
    rival.alert = clamp(rival.alert - (strategy.agenda === 'silent' ? 10 : 7));
    rival.hostility = clamp(rival.hostility - 1);
    if (rival.truceUntil > next.day) continue;
    const held = zones.filter(zone => zone.rivalId === definition.id && zone.id !== 'market-street' && strategy.zones[zone.id].owner === 'player')
      .map(zone => zoneView(next, zone.id)!).sort((a, b) => a.defense - b.defense);
    if (held.length) {
      const target = held[0];
      const chance = clamp(rival.strength * .25 + rival.hostility * .2 + rival.alert * .25 - target.defense * .4 + (target.connected ? 5 : 18) + strategyRiskPenalty(next) + (strategy.agenda === 'war' ? 10 : 0), 5, 85);
      if (context.random(next) * 100 < chance) {
        const loss = clamp(12 + Math.max(0, rival.strength - target.defense) * .16 + (target.connected ? 0 : 10) + strategyRiskPenalty(next) * .3, 8, 45);
        const zone = strategy.zones[target.definition.id];
        zone.control = clamp(zone.control - loss);
        if (zone.control <= 15) {
          zone.owner = definition.id; zone.control = 0; zone.lieutenantId = null; zone.fortification = Math.max(0, zone.fortification - 1);
          notices.push(`${definition.name} reclaimed ${target.definition.name}. Its supply route is severed.`);
        } else notices.push(`${definition.name} contested ${target.definition.name}: ${loss} control lost.`);
      }
    }
    // A rival needs current alert before extorting a business; a passive starter game stays unchanged.
    if (rival.alert < 15) continue;
    const portfolio = state.businesses.filter(owned => businesses.find(b => b.id === owned.id)?.districtId === definition.districtId);
    if (portfolio.length && context.random(next) * 100 < clamp(rival.alert * .5 + rival.hostility * .2 + strategyRiskPenalty(next), 0, 65)) {
      const pressure = Math.round(portfolio.reduce((total, owned) => total + (businesses.find(b => b.id === owned.id)?.income ?? 0) * owned.level, 0) * .25);
      businessPressure += pressure;
      notices.push(`${definition.name} cost district businesses ${money(pressure)} in pressure.`);
    }
  }
  strategy.rewardClaims = { day: next.day, energy: 0, cash: 0 };
  strategy.lastDaily = { day: next.day, zoneIncome: accounts.zoneIncome, zoneUpkeep: accounts.zoneUpkeep, businessPressure, notices };
  return { cash: accounts.zoneIncome - accounts.zoneUpkeep - businessPressure };
}
function tire(state: GameState, ids: string[], amount: number): void { for (const id of ids) state.strategy!.crewFatigue[id] = clamp((state.strategy!.crewFatigue[id] ?? 0) + amount); }
function teamLoyalty(state: GameState, ids: string[], amount: number): void { for (const id of ids) state.crewLoyalty[id] = clamp(state.crewLoyalty[id] + amount); }
function capture(state: GameState, zoneId: string, control: number): void {
  const strategy = state.strategy!;
  const zone = strategy.zones[zoneId];
  if (zone.owner !== 'player') strategy.counters.zonesCaptured += 1;
  zone.owner = 'player'; zone.control = control; zone.disruptedUntil = 0;
}
/** Called only with an immutable reducer's private clone; all previews are shared with resolution. */
export function reduceStrategy(state: GameState, next: GameState, action: StrategyAction, context: StrategyContext): GameState {
  next.strategy ??= createStrategy(next.day);
  const strategy = next.strategy;
  const finish = (title: string, text: string, success: boolean, effects: Effects = {}, image = '/assets/city.webp') => context.record(next, { title, text, success, effects: context.applyEffects(next, effects), image });
  const reject = (requirements: string[]) => finish('Unavailable', requirements.join(' '), false);
  switch (action.type) {
    case 'SET_DIFFICULTY':
      if (!difficulties.includes(action.difficulty)) return state;
      strategy.difficulty = action.difficulty;
      return finish('Challenge changed', `${action.difficulty === 'standard' ? 'Standard offers ordinary costs and rival pressure.' : action.difficulty === 'hard' ? 'Hard lowers risk chances by 8 points, raises strategy costs 15% and zone upkeep 20%.' : 'Ruthless lowers risk chances by 16 points, raises strategy costs 30% and zone upkeep 45%.'} The next decision uses this setting.`, true);
    case 'SET_AGENDA':
      if (!agendas.includes(action.agenda)) return state;
      strategy.agenda = action.agenda;
      return finish('Organization agenda', ({ balanced: 'Balanced keeps ordinary returns, costs and pressure.', profit: 'Profit raises zone income 25% and upkeep 15%, but lowers battle power by 5 and adds operation suspicion.', silent: 'Silent improves scouting terms and operation chances, reduces suspicion and favors a quiet battle approach.', war: 'War adds 9 battle power but raises zone upkeep 20% and rival pressure.' })[action.agenda], true);
    case 'CLAIM_AD_REWARD': {
      if (action.kind !== 'energy' && action.kind !== 'cash') return state;
      if (strategy.rewardClaims.day !== state.day) strategy.rewardClaims = { day: state.day, energy: 0, cash: 0 };
      if (dailySupplyRemaining(next) === 0) return reject(['Today’s supply has been claimed. End the day to choose another.']);
      if (action.kind === 'energy' && state.stats.energy >= 100) return reject(['Energy is already full.']);
      strategy.rewardClaims[action.kind] += 1;
      return finish('Supply received', action.kind === 'energy' ? 'Recovery supplies restore up to 20 energy. Your next supply is available after End day.' : 'Your supply provides $500. Your next supply is available after End day.', true, action.kind === 'energy' ? { energy: 20 } : { cash: 500 });
    }
    case 'ASSIGN_LIEUTENANT': {
      const view = zoneView(state, action.zoneId);
      if (!view) return state;
      if (!view.owned) return reject(['Control this zone before assigning a lieutenant.']);
      if (action.crewId !== null && !strategyAvailableCrew(state).includes(action.crewId) && view.state.lieutenantId !== action.crewId) return reject(['A lieutenant must be healthy, loyal, rested and free of other assignments.']);
      strategy.zones[action.zoneId].lieutenantId = action.crewId;
      return finish('Lieutenant assignment', action.crewId ? `${crew.find(member => member.id === action.crewId)?.name} now protects ${view.definition.name} and is unavailable for selected encounters.` : `${view.definition.name}'s lieutenant returns to the available crew.`, true);
    }
    case 'RIVAL_TRUCE': {
      const info = rivalTruceInfo(state, action.rivalId);
      if (info.requirements.length) return reject(info.requirements);
      const rival = strategy.rivals[action.rivalId];
      rival.truceUntil = state.day + info.duration; rival.hostility = clamp(rival.hostility - 18); rival.alert = clamp(rival.alert - 15);
      return finish('Terms accepted', `A truce with ${rivals.find(entry => entry.id === action.rivalId)?.name} lasts until day ${rival.truceUntil}. ${info.consequence}`, true, { cash: -info.cost, energy: -info.energy });
    }
    case 'ZONE_ACTION': {
      const info = zoneActionInfo(state, action.zoneId, action.mode);
      if (info.requirements.length) return reject(info.requirements);
      const view = zoneView(state, action.zoneId)!;
      const zone = strategy.zones[action.zoneId];
      const rival = strategy.rivals[view.definition.rivalId];
      const success = info.chance === 100 || context.random(next) * 100 < info.chance;
      const effects: Effects = { cash: -info.cost, energy: -info.energy };
      let text = info.consequence;
      if (action.mode === 'scout') zone.intel = clamp(zone.intel + 35);
      if (action.mode === 'fortify') zone.fortification += 1;
      if (action.mode === 'negotiate') {
        if (success) {
          zone.control = clamp(zone.control + (view.owned ? 25 : 40));
          rival.hostility = clamp(rival.hostility - 8);
          if (!view.owned && zone.control >= 80) { capture(next, action.zoneId, 80); rival.truceUntil = Math.max(rival.truceUntil, state.day + 2); effects.reputation = 18; effects.influence = 3; text = `${view.definition.name} joins your organization on agreed terms. A two-day truce protects the transition.`; }
        } else { rival.alert = clamp(rival.alert + 10); text = 'The terms are refused. The cost is spent and rival alert rises by 10; existing control is retained.'; }
      }
      if (action.mode === 'disrupt') {
        const ids = strategyAvailableCrew(state).slice(0, 1);
        tire(next, ids, 20); rival.hostility = clamp(rival.hostility + 15); rival.alert = clamp(rival.alert + 12);
        effects.heat = strategy.agenda === 'silent' ? 5 : 9;
        if (success) { zone.disruptedUntil = state.day + 2; rival.strength = clamp(rival.strength - 12); effects.reputation = 8; text = 'Rival commitments are disrupted for two days. Their strength falls by 12; hostility and alert rise.'; }
        else { context.applyEffects(next, { health: -8, injuredCrew: true }, ids); text = 'The rival anticipated the pressure. No disruption was secured; the committed crew member was injured.'; }
      }
      return finish(success ? 'Zone command completed' : 'Zone command set back', text, success, effects, districts.find(d => d.id === view.definition.districtId)?.image);
    }
    case 'START_BATTLE': {
      const info = battlePreview(state, action.zoneId, action.crewIds, action.approach);
      if (info.requirements.length) return reject(info.requirements);
      const view = zoneView(state, action.zoneId)!;
      strategy.battle = { zoneId: action.zoneId, rivalId: view.definition.rivalId, crewIds: [...action.crewIds], approach: action.approach, round: 0, momentum: action.approach === 'force' ? 8 : 0, morale: 75, exposure: action.approach === 'force' ? 15 : action.approach === 'silent' ? 0 : 6, choices: [], woundedCrewIds: [] };
      strategy.counters.battlesFought += 1;
      context.applyEffects(next, { cash: -info.cost, energy: -info.energy });
      return next;
    }
    case 'BATTLE_CHOICE': {
      const battle = strategy.battle;
      if (!battle || !battleChoices.some(choice => choice.id === action.choiceId)) return state;
      const info = battleChoiceInfo(state, action.choiceId);
      if (info.requirements.length) return reject(info.requirements);
      const rival = strategy.rivals[battle.rivalId];
      if (action.choiceId === 'retreat') {
        tire(next, battle.crewIds, 25); teamLoyalty(next, battle.crewIds, -5);
        strategy.zones[battle.zoneId].intel = clamp(strategy.zones[battle.zoneId].intel - 15);
        for (const id of battle.woundedCrewIds) next.crewInjured[id] = Math.max(next.crewInjured[id] ?? 0, 2);
        strategy.battle = null; rival.alert = clamp(rival.alert + 12); rival.hostility = clamp(rival.hostility + 8);
        return finish('Crew retreat', 'You withdraw. Entry and earlier costs remain spent. Zone intel loses 15 as the rival adjusts its commitments. The selected crew gains 25 fatigue and loses 5 loyalty; reputation falls by 8.', false, { reputation: -8, heat: 4 });
      }
      const success = context.random(next) * 100 < info.chance;
      battle.round += 1; battle.choices.push(action.choiceId);
      battle.momentum = clamp(battle.momentum + (success ? info.momentum : -8), -100, 100);
      battle.morale = clamp(battle.morale + info.morale - (success ? 0 : 12));
      battle.exposure = clamp(battle.exposure + info.exposure + (success ? 0 : 8));
      if (context.random(next) * 100 < info.injuryChance) {
        const available = battle.crewIds.filter(id => !battle.woundedCrewIds.includes(id));
        if (available.length) battle.woundedCrewIds.push(available[Math.floor(context.random(next) * available.length)]);
      }
      const ended = battle.round >= 3 || battle.morale <= 15 || battle.exposure >= 85;
      const won = ended && battle.round >= 3 && battle.momentum >= 30 && battle.morale > 15 && battle.exposure < 85;
      const effects: Effects = { energy: -info.energy, health: success ? 0 : -5, heat: getStrategy(state).agenda === 'silent' ? 2 : 4 };
      if (ended) {
        rival.hostility = clamp(rival.hostility + (won ? 20 : 12)); rival.alert = clamp(rival.alert + 18); rival.strength = clamp(rival.strength + (won ? -15 : 3));
        tire(next, battle.crewIds, won ? 40 : 50); teamLoyalty(next, battle.crewIds, won ? 2 : -6);
        for (const id of battle.woundedCrewIds) next.crewInjured[id] = Math.max(next.crewInjured[id] ?? 0, 2);
        if (won) { capture(next, battle.zoneId, 65); strategy.counters.battlesWon += 1; effects.reputation = 30; effects.influence = 5; effects.flags = ['battle-won']; }
        else { effects.reputation = -12; strategy.zones[battle.zoneId].intel = clamp(strategy.zones[battle.zoneId].intel - 25); }
        strategy.battle = null;
      }
      return finish(ended ? won ? 'Zone secured' : 'Attack repelled' : `Round ${battle.round}: ${success ? 'momentum gained' : 'a setback'}`, ended ? won ? `${zones.find(zone => zone.id === battle.zoneId)?.name} is yours with 65 control. Fortify, restore control or assign a lieutenant before the rival retaliates. Selected crew gains 40 fatigue.` : 'The crew could not secure the zone. Entry costs stay spent; selected crew gains 50 fatigue. Prepare or choose negotiated terms next time.' : `${success ? `Gain ${info.momentum} momentum.` : 'Lose 8 momentum and 12 morale.'} Momentum ${battle.momentum}; morale ${battle.morale}; exposure ${battle.exposure}. ${battle.woundedCrewIds.length ? `${battle.woundedCrewIds.length} committed crew injured.` : ''}`, ended ? won : success, effects, '/assets/underworld-conflict.webp');
    }
    case 'START_OPERATION': {
      const operation = operations.find(entry => entry.id === action.id);
      if (!operation) return state;
      const info = operationEntryInfo(state, operation, action.crewIds);
      if (info.requirements.length) return reject(info.requirements);
      strategy.operation = { operationId: operation.id, crewIds: [...action.crewIds], stage: 0, progress: 0, suspicion: 0, successes: 0, choices: [] };
      context.applyEffects(next, { cash: -info.cost, energy: -info.energy });
      return next;
    }
    case 'ABORT_OPERATION': {
      const progress = strategy.operation;
      if (!progress) return state;
      tire(next, progress.crewIds, 25); teamLoyalty(next, progress.crewIds, -5);
      strategy.operation = null;
      return finish('Operation abandoned', 'The crew stands down. Entry and stage costs remain spent. Selected crew gains 25 fatigue and loses 5 loyalty; you may prepare another attempt.', false, { reputation: -10, heat: 4 }, '/assets/underworld-operation.webp');
    }
    case 'OPERATION_CHOICE': {
      const progress = strategy.operation;
      if (!progress) return state;
      const operation = operations.find(entry => entry.id === progress.operationId)!;
      const stage = operation.stages[progress.stage];
      if (!stage?.choices.some(choice => choice.id === action.choiceId)) return state;
      const info = operationChoiceInfo(state, action.choiceId);
      if (info.requirements.length) return reject(info.requirements);
      const success = context.random(next) * 100 < info.chance;
      progress.stage += 1; progress.choices.push(action.choiceId); progress.successes += success ? 1 : 0;
      progress.progress = clamp(progress.progress + (success ? info.progress : 10), 0, 150);
      progress.suspicion = clamp(progress.suspicion + info.suspicion + (success ? 0 : 18));
      const effects: Effects = { cash: -info.cost, energy: -info.energy, health: success ? 0 : -8, heat: Math.max(1, Math.ceil(Math.max(0, info.suspicion) / 3)), skillXp: { [stage.skill]: success ? 35 : 18 } };
      if (context.random(next) * 100 < info.injuryChance) context.applyEffects(next, { injuredCrew: true }, progress.crewIds);
      const ended = progress.stage >= operation.stages.length || progress.suspicion >= 90;
      const completed = ended && progress.stage >= operation.stages.length && progress.progress >= 85 && progress.suspicion < 80;
      if (ended) {
        tire(next, progress.crewIds, completed ? 45 : 55); teamLoyalty(next, progress.crewIds, completed ? 3 : -6);
        if (completed) { strategy.counters.operationsCompleted += 1; strategy.operationCooldowns[operation.id] = state.day + operation.cooldown; effects.cash = -info.cost + operation.reward[0] + Math.floor(context.random(next) * (operation.reward[1] - operation.reward[0] + 1)); effects.reputation = 45 + operations.indexOf(operation) * 20; effects.influence = 5; effects.flags = ['operation-completed']; }
        else effects.reputation = -15;
        strategy.operation = null;
      }
      return finish(ended ? completed ? 'Operation completed' : 'Operation collapsed' : `${stage.name}: ${success ? 'secured' : 'a setback'}`, ended ? completed ? `${operation.name} pays out. Selected crew gains 45 fatigue; the operation returns on day ${strategy.operationCooldowns[operation.id]}.` : 'Progress or discretion fell short. No payout was earned. Selected crew gains 55 fatigue; entry and stage costs remain spent.' : `Progress ${progress.progress}/85; suspicion ${progress.suspicion}/80. ${success ? 'The next stage is ready.' : 'A setback adds extra suspicion, but a careful next choice may recover the attempt.'}`, ended ? completed : success, effects, operation.image);
    }
  }
}
