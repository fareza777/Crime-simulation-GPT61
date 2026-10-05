import { describe, expect, it } from 'vitest';
import { createGame, gameReducer } from './engine';
import type { GameAction, GameState } from './types';
import { battleChoiceInfo, battlePreview, connectedZoneIds, getStrategy, operationChoiceInfo, operationEntryInfo, operationRequirements, rivalTruceInfo, strategySummary, zoneActionInfo, zoneView } from './strategy';
import { isValidGame } from '../services/storage';
import { operations } from '../data';

function action(state: GameState, value: object): GameState {
  return gameReducer(state, value as GameAction);
}
function command(state: GameState, value: object): GameState {
  return action(action(state, { type: 'DISMISS_RESULT' }), value);
}
function ready(seed = 1): GameState {
  const state = createGame('Morgan', 'boss', seed);
  state.stats.cash = 100000;
  state.stats.reputation = 900;
  state.stats.heat = 0;
  state.stats.energy = 100;
  state.crew = ['cleo', 'mace', 'nika', 'jin'];
  state.crewLoyalty = { cleo: 80, mace: 80, nika: 80, jin: 80 };
  state.crewInjured = { cleo: 0, mace: 0, nika: 0, jin: 0 };
  state.flags = ['intro-event-seen'];
  return state;
}

describe('underworld strategy foundations', () => {
  it('starts with a protected foothold and complete zoned rival state', () => {
    const state = createGame('Morgan', 'leader', 4) as GameState & { strategy?: { zones: Record<string, { owner: string }>; rivals: object; difficulty: string } };
    expect(state.strategy).toBeDefined();
    expect(Object.keys(state.strategy!.zones)).toHaveLength(15);
    expect(Object.keys(state.strategy!.rivals)).toHaveLength(5);
    expect(state.strategy!.zones['market-street'].owner).toBe('player');
    expect(state.strategy!.difficulty).toBe('standard');
  });

  it('scouts a neighboring zone with a paid, deterministic immutable action', () => {
    const state = ready(4);
    const before = structuredClone(state);
    const result = action(state, { type: 'ZONE_ACTION', zoneId: 'foundry-row', mode: 'scout' });
    expect(result.stats.cash).toBeLessThan(state.stats.cash);
    expect(result.stats.energy).toBeLessThan(state.stats.energy);
    expect(result.result?.success).toBe(true);
    expect(result).toEqual(action(state, { type: 'ZONE_ACTION', zoneId: 'foundry-row', mode: 'scout' }));
    expect(state).toEqual(before);
  });

  it('commits selected crew to a three-round battle and prevents conflicting day actions', () => {
    const started = action(ready(), { type: 'START_BATTLE', zoneId: 'foundry-row', crewIds: ['cleo', 'mace'], approach: 'balanced' });
    expect(started.stats.cash).toBeLessThan(100000);
    expect(gameReducer(started, { type: 'NEXT_DAY' })).toEqual(started);
    let state = started;
    for (let round = 0; round < 3; round += 1) {
      state = command(state, { type: 'BATTLE_CHOICE', choiceId: 'advance' });
      expect(state.result).not.toBeNull();
    }
    const beforeReplay = structuredClone(state);
    expect(action(state, { type: 'BATTLE_CHOICE', choiceId: 'advance' })).toEqual(beforeReplay);
  });

  it('retreats without an extra unaffordable cost and permits recovery from zero cash', () => {
    const prepared = ready();
    getStrategy(prepared).zones['foundry-row'].intel = 80;
    const started = action(prepared, { type: 'START_BATTLE', zoneId: 'foundry-row', crewIds: ['cleo'], approach: 'silent' });
    started.stats.cash = 0;
    started.stats.energy = 0;
    const retreated = action(started, { type: 'BATTLE_CHOICE', choiceId: 'retreat' });
    expect(retreated.result?.title).toMatch(/retreat/i);
    expect(retreated.stats.cash).toBe(0);
    expect(getStrategy(retreated).zones['foundry-row'].intel).toBe(65);
    expect(command(retreated, { type: 'NEXT_DAY' }).day).toBe(2);
  });

  it('rejects duplicate, unowned, injured and disloyal selected crew without charging entry', () => {
    for (const ids of [['cleo', 'cleo'], ['sable'], ['mace'], []]) {
      const state = ready();
      state.crewInjured.mace = 2;
      const result = action(state, { type: 'START_BATTLE', zoneId: 'foundry-row', crewIds: ids, approach: 'balanced' });
      expect(result.stats).toEqual(state.stats);
    }
    const state = ready();
    state.crewLoyalty.cleo = 20;
    expect(action(state, { type: 'START_BATTLE', zoneId: 'foundry-row', crewIds: ['cleo'], approach: 'balanced' }).stats).toEqual(state.stats);
  });

  it('caps callback supply rewards by kind and game day', () => {
    let state = ready();
    state.stats.energy = 10;
    state = command(state, { type: 'CLAIM_AD_REWARD', kind: 'energy' });
    expect(state.stats.energy).toBe(30);
    state = command(state, { type: 'CLAIM_AD_REWARD', kind: 'energy' });
    expect(state.stats.energy).toBe(50);
    state = command(state, { type: 'CLAIM_AD_REWARD', kind: 'energy' });
    expect(state.stats.energy).toBe(50);
    state = command(state, { type: 'CLAIM_AD_REWARD', kind: 'cash' });
    expect(state.stats.cash).toBe(100500);
    state = command(state, { type: 'CLAIM_AD_REWARD', kind: 'cash' });
    expect(state.stats.cash).toBe(100500);
  });
});

describe('linked territory and organization choices', () => {
  it('fortification and lieutenant assignment invest in an owned zone only', () => {
    const state = ready();
    const fortified = action(state, { type: 'ZONE_ACTION', zoneId: 'market-street', mode: 'fortify' });
    expect(fortified.strategy?.zones['market-street'].fortification).toBe(1);
    const assigned = command(fortified, { type: 'ASSIGN_LIEUTENANT', zoneId: 'market-street', crewId: 'mace' });
    expect(assigned.strategy?.zones['market-street'].lieutenantId).toBe('mace');
    const invalid = command(assigned, { type: 'ASSIGN_LIEUTENANT', zoneId: 'foundry-row', crewId: 'mace' });
    expect(invalid.strategy?.zones['foundry-row'].lieutenantId).toBeNull();
  });

  it('makes truces last explicit days and blocks attacks without secretly breaking them', () => {
    const state = action(ready(), { type: 'RIVAL_TRUCE', rivalId: 'lanterns' });
    expect(state.strategy?.rivals.lanterns.truceUntil).toBe(4);
    const after = command(state, { type: 'START_BATTLE', zoneId: 'foundry-row', crewIds: ['mace'], approach: 'force' });
    expect(after.strategy?.battle).toBeNull();
    expect(after.stats.cash).toBe(state.stats.cash);
  });

  it('locks the command settings during committed encounters', () => {
    let state = action(ready(), { type: 'SET_DIFFICULTY', difficulty: 'ruthless' });
    expect(state.strategy?.difficulty).toBe('ruthless');
    state = command(state, { type: 'SET_AGENDA', agenda: 'war' });
    expect(state.strategy?.agenda).toBe('war');
    state = command(state, { type: 'START_BATTLE', zoneId: 'foundry-row', crewIds: ['mace'], approach: 'force' });
    expect(action(state, { type: 'SET_DIFFICULTY', difficulty: 'standard' })).toEqual(state);
  });
});

describe('repeatable major operations', () => {
  it('requires actual equipment and committed healthy crew before spending', () => {
    const state = ready();
    const after = action(state, { type: 'START_OPERATION', id: 'harbor-ledger', crewIds: ['cleo', 'nika'] });
    expect(after.stats).toEqual(state.stats);
    expect(after.result?.success).toBe(false);
    state.inventory = ['encrypted-radio', 'urban-kit'];
    const started = action(state, { type: 'START_OPERATION', id: 'harbor-ledger', crewIds: ['cleo', 'nika'] });
    expect(started.strategy?.operation?.stage).toBe(0);
    expect(started.stats.cash).toBeLessThan(state.stats.cash);
    expect(action(started, { type: 'START_BATTLE', zoneId: 'foundry-row', crewIds: ['mace'], approach: 'force' })).toEqual(started);
  });

  it('allows a zero-resource abort so an operation never traps the save', () => {
    const state = ready();
    state.inventory = ['encrypted-radio', 'urban-kit'];
    const started = action(state, { type: 'START_OPERATION', id: 'harbor-ledger', crewIds: ['cleo', 'nika'] });
    started.stats.cash = 0;
    started.stats.energy = 0;
    const stopped = action(started, { type: 'ABORT_OPERATION' });
    expect(stopped.strategy?.operation).toBeNull();
    expect(stopped.result?.success).toBe(false);
    expect(command(stopped, { type: 'NEXT_DAY' }).day).toBe(2);
  });
});

describe('supply, accounts and retaliation', () => {
  it('uses actual skill-adjusted business proceeds when deciding whether upkeep was paid', () => {
    const state = ready();
    state.stats.cash = 0;
    state.skills.business = 10;
    state.businesses = [{ id: 'night-laundry', level: 2 }];
    Object.assign(getStrategy(state).zones['glass-court'], { owner: 'player', control: 100 });
    getStrategy(state).rivals.regency.truceUntil = 4;
    const next = action(state, { type: 'NEXT_DAY' });
    expect(next.strategy?.zones['glass-court'].control).toBe(100); // $965 business + $552 zone covers $1,414 upkeep.
    expect(next.strategy?.lastDaily?.notices.some(text => text.includes('Unpaid upkeep'))).toBe(false);
  });

  it('pays connected territory returns and upkeep separately, while resting crew', () => {
    const state = ready(1);
    const strategy = getStrategy(state);
    Object.assign(strategy.zones['foundry-row'], { owner: 'player', control: 100, fortification: 1, intel: 50 });
    strategy.crewFatigue.cleo = 80;
    strategy.rivals.lanterns.truceUntil = 4;
    strategy.rivals.lanterns.strength = 16;
    const next = action(state, { type: 'NEXT_DAY' });
    expect(next.stats.cash).toBe(99610); // $230 zone income - $130 upkeep - $490 salaries.
    expect(next.strategy?.lastDaily).toMatchObject({ day: 2, zoneIncome: 230, zoneUpkeep: 130, businessPressure: 0 });
    expect(next.strategy?.crewFatigue.cleo).toBe(50);
    expect(next.strategy?.zones['foundry-row'].intel).toBe(42);
    expect(next.strategy?.rivals.lanterns.strength).toBe(20);
  });

  it('traces supply through player-owned neighbors and penalizes a severed link', () => {
    const state = ready();
    Object.assign(getStrategy(state).zones['foundry-row'], { owner: 'player', control: 100 });
    Object.assign(getStrategy(state).zones['dry-dock'], { owner: 'player', control: 100 });
    expect(connectedZoneIds(state)).toContain('dry-dock');
    expect(zoneView(state, 'dry-dock')).toMatchObject({ connected: true, income: 460, upkeep: 200 });
    getStrategy(state).zones['foundry-row'].owner = 'lanterns';
    expect(zoneView(state, 'dry-dock')).toMatchObject({ connected: false, income: 138, upkeep: 280 });
  });

  it('a hostile rival can reclaim a weak disconnected zone while a truce protects it', () => {
    const state = ready(1);
    Object.assign(getStrategy(state).zones['dry-dock'], { owner: 'player', control: 15 });
    Object.assign(getStrategy(state).rivals['salt-union'], { strength: 100, hostility: 100, alert: 100 });
    expect(action(state, { type: 'NEXT_DAY' }).strategy?.zones['dry-dock'].owner).toBe('salt-union');
    getStrategy(state).rivals['salt-union'].truceUntil = 4;
    expect(action(state, { type: 'NEXT_DAY' }).strategy?.zones['dry-dock'].owner).toBe('player');
    expect(getStrategy(state).zones['market-street'].owner).toBe('player');
  });

  it('changes risk, costs and returns visibly across challenges and agendas', () => {
    const state = ready();
    const ordinary = battlePreview(state, 'foundry-row', ['mace']);
    getStrategy(state).difficulty = 'ruthless';
    const difficult = battlePreview(state, 'foundry-row', ['mace']);
    expect(difficult.cost).toBeGreaterThan(ordinary.cost);
    expect(difficult.chance).toBeLessThan(ordinary.chance);
    getStrategy(state).agenda = 'war';
    expect(battlePreview(state, 'foundry-row', ['mace']).power).toBeGreaterThan(difficult.power);
    Object.assign(getStrategy(state).zones['foundry-row'], { owner: 'player', control: 100 });
    getStrategy(state).difficulty = 'standard';
    getStrategy(state).agenda = 'profit';
    expect(zoneView(state, 'foundry-row')?.income).toBe(288);
    expect(zoneView(state, 'foundry-row')?.upkeep).toBe(110);
  });

  it('restores reward allowances only on the next game day and rejects full-energy claims', () => {
    let state = ready();
    expect(action(state, { type: 'CLAIM_AD_REWARD', kind: 'energy' }).strategy?.rewardClaims.energy).toBe(0);
    state = action(state, { type: 'CLAIM_AD_REWARD', kind: 'cash' });
    expect(strategySummary(state).rewardCashRemaining).toBe(0);
    state = command(state, { type: 'NEXT_DAY' });
    expect(strategySummary(state).rewardCashRemaining).toBe(1);
  });
});

describe('shared previews and completed encounters', () => {
  it('discloses the exact challenge-adjusted major-operation entry cost', () => {
    const state = ready();
    getStrategy(state).difficulty = 'ruthless';
    state.inventory = ['encrypted-radio', 'urban-kit'];
    const info = operationEntryInfo(state, 'harbor-ledger', ['cleo', 'nika']);
    expect(info.cost).toBe(2210);
    expect(info.energy).toBe(20);
    expect(info.requirements).toEqual([]);
    expect(action(state, { type: 'START_OPERATION', id: 'harbor-ledger', crewIds: ['cleo', 'nika'] }).stats.cash).toBe(97790);
  });

  it('protecting the crew for all three rounds cannot capture a zone without enough momentum', () => {
    let state = ready(1);
    state.skills.combat = 10;
    getStrategy(state).zones['foundry-row'].intel = 70;
    state = action(state, { type: 'START_BATTLE', zoneId: 'foundry-row', crewIds: ['mace'], approach: 'force' });
    for (let round = 0; round < 3; round += 1) state = command(state, { type: 'BATTLE_CHOICE', choiceId: 'cover' });
    expect(getStrategy(state).zones['foundry-row'].owner).toBe('lanterns');
    expect(getStrategy(state).counters.battlesWon).toBe(0);
    expect(getStrategy(state).zones['foundry-row'].intel).toBe(45);
  });

  it('a malformed selected crew is unavailable without crashing or charging entry', () => {
    const state = ready();
    expect(() => battlePreview(state, 'foundry-row', null as unknown as string[])).not.toThrow();
    expect(battlePreview(state, 'foundry-row', null as unknown as string[]).requirements).not.toEqual([]);
    expect(action(state, { type: 'START_BATTLE', zoneId: 'foundry-row', crewIds: 'mace', approach: 'force' }).stats).toEqual(state.stats);
  });

  it('resolves peaceful control and entry charges using exactly the disclosed preview', () => {
    let state = ready(1);
    state.skills.charisma = 10;
    getStrategy(state).zones['foundry-row'].intel = 100;
    const info = zoneActionInfo(state, 'foundry-row', 'negotiate');
    state = action(state, { type: 'ZONE_ACTION', zoneId: 'foundry-row', mode: 'negotiate' });
    expect(state.stats.cash).toBe(100000 - info.cost);
    expect(state.strategy?.zones['foundry-row'].control).toBe(40);
    state = command(state, { type: 'ZONE_ACTION', zoneId: 'foundry-row', mode: 'negotiate' });
    expect(state.strategy?.zones['foundry-row'].owner).toBe('player');
    expect(state.strategy?.rivals.lanterns.truceUntil).toBe(3);
    const truce = rivalTruceInfo(ready(), 'lanterns');
    expect(truce.requirements).toEqual([]);
    expect(truce.duration).toBe(3);
  });

  it('matches round chance with the seeded roll and limits injuries to selected crew', () => {
    let state = ready(1);
    state.skills.combat = 10;
    state = action(state, { type: 'START_BATTLE', zoneId: 'foundry-row', crewIds: ['mace'], approach: 'force' });
    const info = battleChoiceInfo(state, 'advance');
    const roll = ((Math.imul(state.seed, 1664525) + 1013904223) >>> 0) / 4294967296 * 100;
    const expectedSuccess = roll < info.chance;
    const next = action(state, { type: 'BATTLE_CHOICE', choiceId: 'advance' });
    expect(next.result?.success).toBe(expectedSuccess);
    expect(next.stats.energy).toBe(state.stats.energy - info.energy);
    expect(next.strategy?.battle?.momentum).toBe(expectedSuccess ? 8 + info.momentum : 0);
    expect(next.strategy?.battle?.woundedCrewIds.every(id => id === 'mace')).toBe(true);
  });

  it('completes all three operation stages once, records a payout and enforces a cooldown', () => {
    let state = ready(1);
    state.skills = { charisma: 10, streetSmarts: 10, combat: 10, driving: 10, stealth: 10, business: 10 };
    state.inventory = ['encrypted-radio', 'urban-kit'];
    expect(operationRequirements(state, 'harbor-ledger', ['cleo', 'nika'])).toEqual([]);
    state = action(state, { type: 'START_OPERATION', id: 'harbor-ledger', crewIds: ['cleo', 'nika'] });
    const choices = ['harbor-introduction', 'harbor-specialist', 'harbor-guarantee'];
    for (let stage = 0; stage < 3; stage += 1) {
      const info = operationChoiceInfo(state, choices[stage]);
      const before = state.stats.cash;
      state = action(state, { type: 'OPERATION_CHOICE', choiceId: choices[stage] });
      if (stage < 2) expect(state.stats.cash).toBe(before - info.cost);
      state = action(state, { type: 'DISMISS_RESULT' });
    }
    expect(getStrategy(state).operation).toBeNull();
    expect(getStrategy(state).counters.operationsCompleted).toBe(1);
    expect(state.flags).toContain('operation-completed');
    expect(state.stats.cash).toBeGreaterThan(100000);
    expect(operationRequirements(state, operations[0], ['cleo', 'nika']).some(value => value.includes('day 3'))).toBe(true);
    expect(action(state, { type: 'OPERATION_CHOICE', choiceId: choices[2] })).toEqual(state);
  });

  it('validates every transient tactical state across success, injuries, losses and retreats', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      let state = ready(seed);
      state = action(state, { type: 'START_BATTLE', zoneId: 'foundry-row', crewIds: ['cleo', 'mace'], approach: 'balanced' });
      expect(isValidGame(state), `battle entry seed ${seed}`).toBe(true);
      for (let round = 0; round < 3 && getStrategy(state).battle; round += 1) {
        state = command(state, { type: 'BATTLE_CHOICE', choiceId: seed % 5 === 0 && round === 1 ? 'retreat' : ['advance', 'flank', 'cover'][round] });
        expect(isValidGame(state), `battle round ${round}, seed ${seed}`).toBe(true);
      }
      expect(getStrategy(state).battle).toBeNull();
      expect(state.crewInjured.nika).toBe(0);
      expect(state.crewInjured.jin).toBe(0);
    }
  });

  it('validates every operation stage across setbacks and injuries and never grants a failed payout', () => {
    let succeeded = 0;
    let failed = 0;
    for (let seed = 0; seed < 100; seed += 1) {
      let state = ready(seed);
      state.inventory = ['encrypted-radio', 'urban-kit'];
      state = action(state, { type: 'START_OPERATION', id: 'harbor-ledger', crewIds: ['cleo', 'nika'] });
      for (const choiceId of ['harbor-assert', 'harbor-pressure', 'harbor-fast']) {
        if (!getStrategy(state).operation) break;
        state = command(state, { type: 'OPERATION_CHOICE', choiceId });
        expect(isValidGame(state), `operation ${choiceId}, seed ${seed}`).toBe(true);
      }
      if (getStrategy(state).counters.operationsCompleted) succeeded += 1;
      else { failed += 1; expect(state.stats.cash).toBe(98300); }
      expect(state.crewInjured.mace).toBe(0);
      expect(state.crewInjured.jin).toBe(0);
    }
    expect(succeeded).toBeGreaterThan(0);
    expect(failed).toBeGreaterThan(0);
  });
});
