import { describe, expect, it } from 'vitest';
import { createGame, gameReducer } from '../game/engine';
import { getStrategy, strategySummary } from '../game/strategy';
import { createStorageService, exportSave, importSave, isValidGame, storageKeys } from './storage';
import type { GameState } from '../game/types';

function ready(): GameState {
  const state = createGame('Morgan', 'boss', 1);
  state.stats.cash = 100000;
  state.stats.reputation = 900;
  state.stats.heat = 0;
  state.stats.energy = 100;
  state.crew = ['cleo', 'mace', 'nika'];
  state.crewLoyalty = { cleo: 80, mace: 80, nika: 80 };
  state.crewInjured = { cleo: 0, mace: 0, nika: 0 };
  state.inventory = ['encrypted-radio', 'urban-kit'];
  return state;
}

describe('strategy save migration', () => {
  it('imports a legacy v1 state losslessly while supplying a complete strategy subtree', () => {
    const state = ready();
    delete state.strategy;
    state.day = 23;
    state.stats.cash = 17;
    state.counters.jobsSucceeded = 12;
    state.counters.jobsAttempted = 19;
    const before = structuredClone(state);
    const migrated = importSave(JSON.stringify(state));
    expect(migrated.strategy?.rewardClaims).toEqual({ day: 23, energy: 0, cash: 0 });
    expect(Object.keys(migrated.strategy!.zones)).toHaveLength(15);
    const { strategy: _strategy, ...restored } = migrated;
    expect(restored).toEqual(before);
    expect(state).toEqual(before);
    expect(migrated.version).toBe(1);
  });

  it('migrates old checksum envelopes after verifying their original payload', () => {
    const state = ready();
    delete state.strategy;
    const stateRaw = JSON.stringify(state);
    let hash = 2166136261;
    for (const byte of new TextEncoder().encode(stateRaw)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
    const envelope = JSON.stringify({ format: 'blackline.save', version: 1, savedAt: 1, checksum: hash.toString(16).padStart(8, '0'), state });
    expect(importSave(envelope).strategy?.difficulty).toBe('standard');
  });

  it('round trips active tactical rounds, stage operations and daily claims', () => {
    let battle = gameReducer(ready(), { type: 'START_BATTLE', zoneId: 'foundry-row', crewIds: ['mace'], approach: 'force' });
    battle = gameReducer(battle, { type: 'BATTLE_CHOICE', choiceId: 'advance' });
    expect(importSave(exportSave(battle))).toEqual(battle);
    let operation = gameReducer(ready(), { type: 'START_OPERATION', id: 'harbor-ledger', crewIds: ['cleo', 'nika'] });
    operation = gameReducer(operation, { type: 'OPERATION_CHOICE', choiceId: 'harbor-introduction' });
    expect(importSave(exportSave(operation))).toEqual(operation);
    const reward = gameReducer(ready(), { type: 'CLAIM_AD_REWARD', kind: 'cash' });
    expect(importSave(exportSave(reward)).strategy?.rewardClaims.cash).toBe(1);
  });

  it('keeps the daily supply spent across save restoration and reward kinds', () => {
    const rewarded = gameReducer(ready(), { type: 'CLAIM_AD_REWARD', kind: 'cash' });
    const restored = gameReducer(importSave(exportSave(rewarded)), { type: 'DISMISS_RESULT' });
    restored.stats.energy = 20;
    const repeated = gameReducer(restored, { type: 'CLAIM_AD_REWARD', kind: 'energy' });
    expect(repeated.stats).toEqual(restored.stats);
    expect(repeated.result?.success).toBe(false);
  });

  it('accepts previously valid multi-claim saves without granting extra supplies', () => {
    const previous = ready();
    previous.stats.energy = 20;
    previous.strategy!.rewardClaims.energy = 2;
    previous.strategy!.rewardClaims.cash = 1;
    const restored = importSave(exportSave(previous));
    expect(restored).toEqual(previous);
    expect(strategySummary(restored).rewardEnergyRemaining).toBe(0);
    expect(strategySummary(restored).rewardCashRemaining).toBe(0);
    const repeated = gameReducer(restored, { type: 'CLAIM_AD_REWARD', kind: 'cash' });
    expect(repeated.stats).toEqual(previous.stats);
  });
});

describe('strict strategy references and commitments', () => {
  it.each([
    ['unknown zone', (state: GameState) => { getStrategy(state).zones['forged-zone'] = getStrategy(state).zones['market-street']; }],
    ['unknown owner', (state: GameState) => { getStrategy(state).zones['foundry-row'].owner = 'unknown-rival'; }],
    ['wrong district rival', (state: GameState) => { getStrategy(state).zones['foundry-row'].owner = 'regency'; }],
    ['unknown rival', (state: GameState) => { delete getStrategy(state).rivals.lanterns; }],
    ['negative upkeep', (state: GameState) => { getStrategy(state).lastDaily = { day: 1, zoneIncome: 0, zoneUpkeep: -1, businessPressure: 0, notices: [] }; }],
    ['nonfinite fatigue', (state: GameState) => { getStrategy(state).crewFatigue.cleo = NaN; }],
    ['unowned fatigue', (state: GameState) => { getStrategy(state).crewFatigue.sable = 10; }],
    ['forged rewards', (state: GameState) => { getStrategy(state).rewardClaims.energy = 3; }],
    ['future reward day', (state: GameState) => { getStrategy(state).rewardClaims.day = 2; }],
    ['negative counter', (state: GameState) => { getStrategy(state).counters.battlesWon = -1; }],
    ['unknown operation cooldown', (state: GameState) => { getStrategy(state).operationCooldowns.fake = 4; }],
    ['unsafe key', (state: GameState) => { getStrategy(state).crewFatigue = JSON.parse('{"constructor":0}'); }],
    ['unowned lieutenant', (state: GameState) => { getStrategy(state).zones['market-street'].lieutenantId = 'sable'; }],
    ['lieutenant on rival ground', (state: GameState) => { getStrategy(state).zones['foundry-row'].lieutenantId = 'mace'; }],
  ])('rejects %s', (_label, corrupt) => {
    const state = ready();
    corrupt(state);
    expect(isValidGame(state)).toBe(false);
    expect(() => exportSave(state)).toThrow(/invalid/i);
  });

  it('rejects overlapping legal activities and impossible battle crews', () => {
    const battle = gameReducer(ready(), { type: 'START_BATTLE', zoneId: 'foundry-row', crewIds: ['mace'], approach: 'force' });
    const cases = [
      (state: GameState) => { state.pendingJob = { activityId: 'quarter-courier' }; },
      (state: GameState) => { state.pendingEvent = { id: 'warehouse-offer' }; },
      (state: GameState) => { state.jail = { days: 2, reason: 'Impossible conflict.' }; },
      (state: GameState) => { getStrategy(state).battle!.crewIds = ['sable']; },
      (state: GameState) => { getStrategy(state).battle!.crewIds = ['mace', 'mace']; },
      (state: GameState) => { state.crewInjured.mace = 1; },
      (state: GameState) => { state.crewLoyalty.mace = 10; },
      (state: GameState) => { getStrategy(state).battle!.round = 3; },
      (state: GameState) => { getStrategy(state).battle!.choices = ['retreat']; },
      (state: GameState) => { getStrategy(state).battle!.woundedCrewIds = ['cleo']; },
      (state: GameState) => { getStrategy(state).battle!.woundedCrewIds = ['mace']; },
      (state: GameState) => { getStrategy(state).battle!.momentum = 100; },
      (state: GameState) => { getStrategy(state).zones['market-street'].lieutenantId = 'mace'; },
    ];
    for (const corrupt of cases) {
      const candidate = structuredClone(battle);
      corrupt(candidate);
      expect(isValidGame(candidate)).toBe(false);
    }
  });

  it('rejects forged operation costs, stages and a second pending encounter', () => {
    const operation = gameReducer(ready(), { type: 'START_OPERATION', id: 'harbor-ledger', crewIds: ['cleo', 'nika'] });
    const cases = [
      (state: GameState) => { Object.assign(getStrategy(state).operation!, { cost: -100 }); },
      (state: GameState) => { getStrategy(state).operation!.operationId = 'missing'; },
      (state: GameState) => { getStrategy(state).operation!.stage = 3; },
      (state: GameState) => { getStrategy(state).operation!.choices = ['foundry-finish']; },
      (state: GameState) => { getStrategy(state).operation!.crewIds = ['cleo']; },
      (state: GameState) => { getStrategy(state).operation!.suspicion = 90; },
      (state: GameState) => { getStrategy(state).operation!.progress = 150; },
      (state: GameState) => { getStrategy(state).operation!.suspicion = 50; },
      (state: GameState) => { getStrategy(state).battle = gameReducer(ready(), { type: 'START_BATTLE', zoneId: 'foundry-row', crewIds: ['mace'], approach: 'force' }).strategy!.battle; },
    ];
    for (const corrupt of cases) {
      const candidate = structuredClone(operation);
      corrupt(candidate);
      expect(isValidGame(candidate)).toBe(false);
    }
  });

  it('allows assigned crew to become injured and an operation stage to injure its own crew', () => {
    const state = ready();
    getStrategy(state).zones['market-street'].lieutenantId = 'mace';
    state.crewInjured.mace = 2;
    expect(isValidGame(state)).toBe(true);
    const operation = gameReducer(ready(), { type: 'START_OPERATION', id: 'harbor-ledger', crewIds: ['cleo', 'nika'] });
    const progressed = gameReducer(operation, { type: 'OPERATION_CHOICE', choiceId: 'harbor-introduction' });
    progressed.crewInjured.cleo = 2;
    expect(isValidGame(progressed)).toBe(true);
  });

  it('recovers a good strategy backup instead of loading a primary with illegal commitments', async () => {
    const valid = ready();
    const corrupt = structuredClone(valid);
    getStrategy(corrupt).zones['foundry-row'].lieutenantId = 'mace';
    const values = new Map<string, string>([[storageKeys.game, JSON.stringify(corrupt)], [storageKeys.backup, exportSave(valid)]]);
    const service = createStorageService({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } });
    expect(await service.loadGame()).toEqual(valid);
    expect(importSave(values.get(storageKeys.game)!)).toEqual(valid);
  });
});
