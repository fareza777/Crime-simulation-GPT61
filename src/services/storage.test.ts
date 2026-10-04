import { afterEach, describe, expect, it, vi } from 'vitest';

const device = vi.hoisted(() => ({ native: false, preferences: new Map<string, string>() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => device.native } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: {
  get: async ({ key }: { key: string }) => ({ value: device.preferences.get(key) ?? null }),
  set: async ({ key, value }: { key: string; value: string }) => { device.preferences.set(key, value); },
  remove: async ({ key }: { key: string }) => { device.preferences.delete(key); },
} }));
import type { GameState, Settings } from '../game/types';
import { createGame, gameReducer } from '../game/engine';
import {
  createStorageService, defaultSettings, exportSave, importSave, isValidGame, storageKeys,
  clearSave, loadGame, loadSettings, saveGame, saveSettings,
  type StorageAdapter,
} from './storage';

afterEach(() => {
  device.native = false;
  device.preferences.clear();
  vi.unstubAllGlobals();
});

function game(): GameState {
  return {
    version: 1,
    player: { name: 'Alex', path: 'fixer', portrait: '/assets/player.webp' },
    day: 4,
    stats: { cash: 2400, reputation: 28, heat: 12, health: 90, energy: 75, influence: 5 },
    skills: { charisma: 2, streetSmarts: 3, combat: 1, driving: 2, stealth: 1, business: 1 },
    skillXp: { charisma: 20, streetSmarts: 30, combat: 0, driving: 10, stealth: 0, business: 0 },
    districtId: 'old-quarter', crew: ['cleo', 'mace', 'nika'],
    crewLoyalty: { cleo: 60, mace: 72, nika: 69 }, crewInjured: { cleo: 2, mace: 0, nika: 0 },
    businesses: [{ id: 'night-laundry', level: 1 }], inventory: ['urban-kit'],
    safehouse: { security: 1 }, territories: { 'old-quarter': 5 }, relationships: { lina: 40 },
    flags: ['intro-event-seen'], claimedQuests: ['main-first-steps'],
    counters: { jobsSucceeded: 2, jobsAttempted: 3, totalEarned: 2500, training: 1, districts: ['old-quarter'] },
    pendingJob: null, pendingEvent: null,
    result: {
      title: 'A quiet handoff', text: 'The payment arrived.', success: true, image: '/assets/job.webp',
      effects: {
        cash: 200, heat: -2, loyalty: 1, relationships: { lina: 5 }, flags: ['contact-met'],
        removeFlags: ['old-debt'], skillXp: { driving: 15 }, item: 'dress-watch', jailDays: 1,
        injuredCrew: false, influenceDistrict: 2,
      },
    },
    jail: null,
    heist: { stage: 1, crewIds: ['cleo', 'mace', 'nika'], successes: 1, choices: ['patient-terms'], completed: false },
    log: [{ day: 3, title: 'Delivery', text: 'You earned a little trust.', good: true }],
    seed: 4294967295,
  };
}

function completedGame(): GameState {
  const state = game();
  state.heist = {
    stage: 4, crewIds: ['cleo', 'mace', 'nika'], successes: 3,
    choices: ['patient-terms', 'circle-concession', 'pressure-settle', 'closing-patient'], completed: true,
  };
  state.flags.push('heist-completed');
  return state;
}

class MemoryStorage implements StorageAdapter {
  readonly values = new Map<string, string>();
  beforeSet?: (key: string, value: string) => Promise<void>;
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) {
    await this.beforeSet?.(key, value);
    this.values.set(key, value);
  }
  async removeItem(key: string) { this.values.delete(key); }
}

describe('save import and validation', () => {
  it('round trips populated empire, outcome and heist records through a versioned checksum envelope', () => {
    const state = game();
    const raw = exportSave(state);
    const envelope = JSON.parse(raw) as { format: string; version: number; checksum: string };
    expect(envelope.format).toBe('blackline.save');
    expect(envelope.version).toBe(1);
    expect(envelope.checksum).toMatch(/^[a-f0-9]{8}$/);
    expect(importSave(raw)).toEqual(state);
  });

  it('migrates an earlier unwrapped version 1 game', () => {
    expect(importSave(JSON.stringify(game()))).toEqual(game());
  });

  it('detects edited payloads instead of trusting a valid-looking state', () => {
    const envelope = JSON.parse(exportSave(game()));
    envelope.state.stats.cash = 99999;
    expect(() => importSave(JSON.stringify(envelope))).toThrow(/checksum|damaged/i);
  });

  it('gives useful errors for malformed and unsupported saves', () => {
    expect(() => importSave('not json')).toThrow(/json|valid save/i);
    expect(() => importSave('null')).toThrow(/valid save|game state/i);
    const newer = JSON.parse(exportSave(game()));
    newer.version = 99;
    expect(() => importSave(JSON.stringify(newer))).toThrow(/newer|version/i);
    expect(() => importSave(JSON.stringify({ ...game(), version: 2 }))).toThrow(/newer|version/i);
  });

  const invalidStates: [string, (state: GameState) => void][] = [
    ['NaN cash', state => { state.stats.cash = Number.NaN; }],
    ['infinite energy', state => { state.stats.energy = Number.POSITIVE_INFINITY; }],
    ['negative cash', state => { state.stats.cash = -1; }],
    ['huge cash', state => { state.stats.cash = 1e100; }],
    ['health above maximum', state => { state.stats.health = 101; }],
    ['invalid skill level', state => { state.skills.stealth = 11; }],
    ['negative XP', state => { state.skillXp.driving = -1; }],
    ['missing skill XP', state => { delete (state as Partial<GameState>).skillXp; }],
    ['null stats', state => { (state as unknown as { stats: null }).stats = null; }],
    ['missing counter', state => { delete (state.counters as Partial<GameState['counters']>).training; }],
    ['fractional day', state => { state.day = 1.5; }],
    ['unknown career', state => { state.player.path = 'mayor' as GameState['player']['path']; }],
    ['empty player name', state => { state.player.name = ' '; }],
    ['malformed crew injuries', state => { state.crewInjured.cleo = -3; }],
    ['business with invalid level', state => { state.businesses[0].level = 0; }],
    ['invalid relationship', state => { state.relationships.lina = 101; }],
    ['malformed pending event', state => { state.pendingEvent = {} as GameState['pendingEvent']; }],
    ['malformed result effects', state => { state.result!.effects.skillXp = { stealth: Number.NaN }; }],
    ['malformed result', state => { delete (state.result as Partial<NonNullable<GameState['result']>>).success; }],
    ['invalid jail', state => { state.jail = { days: -1, reason: 'Caught in a raid.' }; }],
    ['invalid heist progress', state => { state.heist!.successes = 5; }],
    ['malformed log', state => { state.log[0].good = 'yes' as unknown as boolean; }],
    ['unsafe seed', state => { state.seed = 4294967296; }],
    ['too many crew', state => { state.crew = Array.from({ length: 65 }, (_, i) => `member-${i}`); }],
    ['too many flags', state => { state.flags = Array.from({ length: 2049 }, (_, i) => `flag-${i}`); }],
    ['too many nested relationships', state => {
      state.relationships = Object.fromEntries(Array.from({ length: 513 }, (_, i) => [`contact-${i}`, 20]));
    }],
    ['missing crew array entries', state => { state.crew = new Array<string>(1); }],
    ['missing business array entries', state => { state.businesses = new Array<GameState['businesses'][number]>(1); }],
    ['missing log array entries', state => { state.log = new Array<GameState['log'][number]>(1); }],
  ];

  it.each(invalidStates)('rejects %s before storing or exporting', (_name, change) => {
    const state = game();
    change(state);
    expect(isValidGame(state)).toBe(false);
    expect(() => exportSave(state)).toThrow(/game state|invalid/i);
    expect(() => importSave(JSON.stringify(state))).toThrow(/game state|invalid/i);
  });

  it('rejects saves larger than 2 MiB before parsing', () => {
    expect(() => importSave(' '.repeat(2 * 1024 * 1024 + 1))).toThrow(/too large|2 mb|2 mib/i);
  });

  it('checks byte size for non-ASCII saves too', () => {
    expect(() => importSave('界'.repeat(800000))).toThrow(/too large|2 mb|2 mib/i);
  });

  it('rejects unsafe dictionary keys', () => {
    const state = JSON.parse(JSON.stringify(game()));
    state.relationships = JSON.parse('{"__proto__":50}');
    expect(() => importSave(JSON.stringify(state))).toThrow(/game state|invalid/i);
  });

  it('accepts the empty optional flows in a fresh game', () => {
    const state = game();
    state.pendingJob = state.pendingEvent = state.result = state.jail = state.heist = null;
    state.crew = state.businesses = state.inventory = state.flags = state.claimedQuests = state.log = [];
    state.crewLoyalty = state.crewInjured = state.safehouse = state.territories = state.relationships = {};
    expect(importSave(exportSave(state))).toEqual(state);
  });

  it('preserves signed sentence reductions in outcome effects', () => {
    const state = game();
    state.result!.effects.jailDays = -1;
    expect(importSave(exportSave(state)).result!.effects.jailDays).toBe(-1);
  });

  it('accepts undefined optional fields that JSON safely omits', () => {
    const state = game();
    state.result!.nextEvent = undefined;
    state.result!.effects.item = undefined;
    state.result!.effects.skillXp = undefined;
    const restored = importSave(exportSave(state));
    expect(restored.result!.nextEvent).toBeUndefined();
    expect(Object.hasOwn(restored.result!.effects, 'item')).toBe(false);
  });

  it('rejects a valid-looking object that serializes to invalid nested data', () => {
    const state = game();
    Object.defineProperty(state.crew, 'toJSON', { value: () => null });
    expect(() => exportSave(state)).toThrow(/invalid|game state/i);
  });
});

describe('catalog references and active heist consistency', () => {
  const heistChoices = ['patient-terms', 'circle-concession', 'pressure-settle', 'closing-patient'];
  const invalidContent: [string, (state: GameState) => void][] = [
    ['unknown current district', state => { state.districtId = 'missing-district'; }],
    ['unknown visited district', state => { state.counters.districts.push('missing-district'); }],
    ['unknown crew member with matching roster maps', state => {
      state.crew[0] = 'missing-crew';
      delete state.crewLoyalty.cleo;
      delete state.crewInjured.cleo;
      state.crewLoyalty['missing-crew'] = 60;
      state.crewInjured['missing-crew'] = 0;
    }],
    ['missing owned crew loyalty', state => { delete state.crewLoyalty.cleo; }],
    ['missing owned crew injury status', state => { delete state.crewInjured.cleo; }],
    ['loyalty for unowned crew', state => { state.crewLoyalty.rory = 50; }],
    ['injury status for unowned crew', state => { state.crewInjured.rory = 0; }],
    ['unknown business', state => { state.businesses[0].id = 'missing-business'; }],
    ['business above its authored maximum', state => { state.businesses[0].level = 6; }],
    ['unknown inventory item', state => { state.inventory.push('missing-item'); }],
    ['unknown safehouse upgrade', state => { state.safehouse['missing-upgrade'] = 1; }],
    ['safehouse above its authored maximum', state => { state.safehouse.security = 5; }],
    ['unknown territory district', state => { state.territories['missing-district'] = 5; }],
    ['unknown claimed quest', state => { state.claimedQuests.push('missing-quest'); }],
    ['unknown pending job', state => { state.heist = null; state.pendingJob = { activityId: 'missing-activity' }; }],
    ['unknown pending event', state => { state.heist = null; state.pendingEvent = { id: 'missing-event' }; }],
    ['unknown event after a result', state => { state.result!.nextEvent = 'missing-event'; }],
    ['remote player portrait', state => { state.player.portrait = 'https://example.com/portrait.webp'; }],
    ['unknown local player portrait', state => { state.player.portrait = '/assets/crew-12.webp'; }],
    ['local avatar with an extra trailing newline', state => { state.player.portrait = '/assets/player.webp\n'; }],
    ['unfinished heist past the final playable stage', state => {
      state.heist = { ...state.heist!, stage: 4, successes: 4, choices: [...heistChoices], completed: false };
    }],
    ['completed heist before the final stage', state => { state.heist!.completed = true; }],
    ['heist success count ahead of its stage', state => {
      state.heist = { ...state.heist!, stage: 0, successes: 1, choices: ['patient-terms'] };
    }],
    ['heist choices ahead of the stage', state => {
      state.heist!.choices.push('circle-concession');
    }],
    ['heist choices missing earlier stages', state => { state.heist!.stage = 2; }],
    ['heist choice from the wrong stage', state => { state.heist!.choices[0] = 'circle-concession'; }],
    ['unknown heist choice', state => { state.heist!.choices[0] = 'missing-choice'; }],
    ['unowned selected heist crew', state => { state.heist!.crewIds[0] = 'rory'; }],
    ['unknown selected heist crew', state => { state.heist!.crewIds[0] = 'missing-crew'; }],
    ['unfinished heist without enough crew', state => { state.heist!.crewIds.pop(); }],
  ];

  it.each(invalidContent)('rejects %s on import and export', (_name, change) => {
    const state = game();
    change(state);
    expect(isValidGame(state)).toBe(false);
    expect(() => importSave(JSON.stringify(state))).toThrow(/invalid|content|game state/i);
    expect(() => exportSave(state)).toThrow(/invalid|game state/i);
  });

  it.each([0, 1, 2, 3, 4])('round trips legitimate heist progress after %i stages', stage => {
    const state = game();
    state.heist = {
      stage, crewIds: ['cleo', 'mace', 'nika'], successes: Math.max(0, stage - 1),
      choices: heistChoices.slice(0, stage), completed: stage === 4,
    };
    if (state.heist.completed) state.flags.push('heist-completed');
    expect(importSave(exportSave(state))).toEqual(state);
  });

  it('accepts owned crew injuries and lower loyalty caused during an active heist', () => {
    const state = game();
    state.crewInjured.cleo = 2;
    state.crewLoyalty.cleo = 31;
    expect(importSave(exportSave(state))).toEqual(state);
  });

  it.each(['/assets/player.webp', '/assets/crew-1.webp', '/assets/crew-11.webp'])('accepts the local avatar %s', portrait => {
    const state = game();
    state.player.portrait = portrait;
    expect(importSave(exportSave(state)).player.portrait).toBe(portrait);
  });

  it('continues to support story flags and non-contact relationship keys', () => {
    const state = game();
    state.flags.push('recent-event:investigation-letter', 'chapter:custom-progress');
    state.relationships['The Lanterns'] = 45;
    expect(importSave(exportSave(state))).toEqual(state);
  });

  it('recovers a valid backup when the primary contains unavailable city content', async () => {
    const adapter = new MemoryStorage();
    const storage = createStorageService(adapter);
    await storage.saveGame(game());
    const backup = adapter.values.get(storageKeys.backup);
    const invalid = game();
    invalid.heist = null;
    invalid.pendingJob = { activityId: 'missing-activity' };
    adapter.values.set(storageKeys.game, JSON.stringify(invalid));
    expect(await storage.loadGame()).toEqual(game());
    expect(importSave(adapter.values.get(storageKeys.game)!)).toEqual(game());
    expect(adapter.values.get(storageKeys.backup)).toBe(backup);
  });

  it('keeps both save slots when an imported or caller-provided state is unplayable', async () => {
    const adapter = new MemoryStorage();
    const storage = createStorageService(adapter);
    await storage.saveGame(game());
    const slotsBefore = [...adapter.values.entries()];
    const invalid = game();
    invalid.heist = { ...invalid.heist!, stage: 4, successes: 4, choices: [...heistChoices], completed: false };
    expect(() => importSave(JSON.stringify(invalid))).toThrow(/invalid|content|game state/i);
    await expect(storage.saveGame(invalid)).rejects.toThrow(/invalid|game state/i);
    expect([...adapter.values.entries()]).toEqual(slotsBefore);
    expect(await storage.loadGame()).toEqual(game());
  });
});

describe('exclusive decisions and custody context', () => {
  const invalidFlows: [string, (state: GameState) => void][] = [
    ['a pending job and event with legal catalog IDs', state => {
      state.pendingJob = { activityId: 'old-pocket' };
      state.pendingEvent = { id: 'warehouse-offer' };
    }],
    ['a pending job during an unfinished heist', state => {
      state.heist = game().heist;
      state.pendingJob = { activityId: 'old-pocket' };
    }],
    ['a pending event during an unfinished heist', state => {
      state.heist = game().heist;
      state.pendingEvent = { id: 'warehouse-offer' };
    }],
    ['a pending job while jailed', state => {
      state.jail = { days: 2, reason: 'Caught in a raid.' };
      state.pendingJob = { activityId: 'old-pocket' };
    }],
    ['an unfinished heist while jailed', state => {
      state.jail = { days: 2, reason: 'Caught in a raid.' };
      state.heist = game().heist;
    }],
    ['a city event while jailed', state => {
      state.jail = { days: 2, reason: 'Caught in a raid.' };
      state.pendingEvent = { id: 'warehouse-offer' };
    }],
    ['a jail event outside custody', state => { state.pendingEvent = { id: 'jail-arrival' }; }],
    ['a completion flag without a persisted heist', state => { state.flags.push('heist-completed'); }],
    ['a completion flag during an unfinished heist', state => {
      state.flags.push('heist-completed');
      state.heist = game().heist;
    }],
    ['a completed heist without its completion flag', state => { state.heist = completedGame().heist; }],
  ];

  it.each(invalidFlows)('rejects %s before importing or writing a save', (_name, change) => {
    const state = createGame('Alex', 'fixer', 42);
    state.crew = ['cleo', 'mace', 'nika'];
    state.crewLoyalty = { cleo: 60, mace: 72, nika: 69 };
    state.crewInjured = { cleo: 0, mace: 0, nika: 0 };
    change(state);
    expect(isValidGame(state)).toBe(false);
    expect(() => importSave(JSON.stringify(state))).toThrow(/invalid|content|game state/i);
    expect(() => exportSave(state)).toThrow(/invalid|game state/i);
  });

  it('preserves a job decision and its rejected unaffordable approach result', () => {
    const initial = createGame('Alex', 'fixer', 42);
    initial.stats.cash = 700;
    const pending = gameReducer(initial, { type: 'START_JOB', id: 'old-warehouse' });
    const rejected = gameReducer(pending, { type: 'RESOLVE_JOB', approach: 'informant' });
    expect(rejected.pendingJob).toEqual({ activityId: 'old-warehouse' });
    expect(rejected.result?.success).toBe(false);
    const restored = importSave(exportSave(rejected));
    expect(restored).toEqual(rejected);
    expect(gameReducer(gameReducer(restored, { type: 'DISMISS_RESULT' }), { type: 'RESOLVE_JOB', approach: 'leave' }).pendingJob).toBeNull();
  });

  it('preserves an event decision and its rejected unaffordable choice result', () => {
    const initial = createGame('Alex', 'fixer', 42);
    initial.stats.cash = 0;
    initial.pendingEvent = { id: 'investigation-letter' };
    const rejected = gameReducer(initial, { type: 'CHOOSE_EVENT', choiceId: 'counsel' });
    expect(rejected.pendingEvent).toEqual({ id: 'investigation-letter' });
    expect(rejected.result?.success).toBe(false);
    const restored = importSave(exportSave(rejected));
    expect(restored).toEqual(rejected);
    expect(gameReducer(gameReducer(restored, { type: 'DISMISS_RESULT' }), { type: 'CHOOSE_EVENT', choiceId: 'cooperate' }).pendingEvent).toBeNull();
  });

  const completedContexts: [string, (state: GameState) => void][] = [
    ['a pending job', state => { state.pendingJob = { activityId: 'old-pocket' }; }],
    ['a city event', state => { state.pendingEvent = { id: 'warehouse-offer' }; }],
    ['a jail sentence', state => { state.jail = { days: 2, reason: 'Caught in a raid.' }; }],
    ['a jail event while jailed', state => {
      state.jail = { days: 2, reason: 'Caught in a raid.' };
      state.pendingEvent = { id: 'jail-arrival' };
    }],
  ];

  it.each(completedContexts)('retains completed heist history alongside %s', (_name, change) => {
    const state = completedGame();
    change(state);
    expect(importSave(exportSave(state))).toEqual(state);
  });

  it('restores a valid backup when legal job and event IDs conflict in the primary', async () => {
    const adapter = new MemoryStorage();
    const storage = createStorageService(adapter);
    const backupState = createGame('Backup', 'thief', 17);
    await storage.saveGame(backupState);
    const previousBackup = adapter.values.get(storageKeys.backup);
    const invalid = createGame('Blocked', 'fixer', 42);
    invalid.pendingJob = { activityId: 'old-pocket' };
    invalid.pendingEvent = { id: 'warehouse-offer' };
    adapter.values.set(storageKeys.game, JSON.stringify(invalid));
    expect(await storage.loadGame()).toEqual(backupState);
    expect(importSave(adapter.values.get(storageKeys.game)!)).toEqual(backupState);
    expect(adapter.values.get(storageKeys.backup)).toBe(previousBackup);
  });
});

describe('persistent save recovery', () => {
  it('returns no game when both slots are absent', async () => {
    expect(await createStorageService(new MemoryStorage()).loadGame()).toBeNull();
  });

  it('saves and loads real storage, retaining the previous valid save as backup', async () => {
    const adapter = new MemoryStorage();
    const storage = createStorageService(adapter);
    const first = game();
    await storage.saveGame(first);
    const second = { ...game(), day: 5 };
    await storage.saveGame(second);
    expect(await storage.loadGame()).toEqual(second);
    expect(importSave(adapter.values.get(storageKeys.backup)!)).toEqual(first);
  });

  it('recovers a corrupt primary from backup and repairs the primary', async () => {
    const adapter = new MemoryStorage();
    const storage = createStorageService(adapter);
    await storage.saveGame(game());
    const previousBackup = adapter.values.get(storageKeys.backup);
    adapter.values.set(storageKeys.game, '{broken');
    expect(await storage.loadGame()).toEqual(game());
    expect(importSave(adapter.values.get(storageKeys.game)!)).toEqual(game());
    expect(adapter.values.get(storageKeys.backup)).toBe(previousBackup);
  });

  it('recovers from backup when the primary slot is missing', async () => {
    const adapter = new MemoryStorage();
    adapter.values.set(storageKeys.backup, exportSave(game()));
    expect(await createStorageService(adapter).loadGame()).toEqual(game());
  });

  it('accepts a legacy save in persistent storage', async () => {
    const adapter = new MemoryStorage();
    adapter.values.set(storageKeys.game, JSON.stringify(game()));
    const storage = createStorageService(adapter);
    expect(await storage.loadGame()).toEqual(game());
    await storage.saveGame(game());
    expect(JSON.parse(adapter.values.get(storageKeys.game)!).format).toBe('blackline.save');
  });

  it('reports corruption when both save slots are damaged', async () => {
    const adapter = new MemoryStorage();
    adapter.values.set(storageKeys.game, 'null');
    adapter.values.set(storageKeys.backup, '{broken');
    await expect(createStorageService(adapter).loadGame()).rejects.toThrow(/damaged|corrupt/i);
  });

  it('loads a valid primary even if its backup is damaged', async () => {
    const adapter = new MemoryStorage();
    adapter.values.set(storageKeys.game, exportSave(game()));
    adapter.values.set(storageKeys.backup, '{broken');
    expect(await createStorageService(adapter).loadGame()).toEqual(game());
  });

  it('keeps a good backup when saving over a corrupt primary', async () => {
    const adapter = new MemoryStorage();
    const storage = createStorageService(adapter);
    await storage.saveGame(game());
    const backup = adapter.values.get(storageKeys.backup);
    adapter.values.set(storageKeys.game, 'corrupt');
    await storage.saveGame({ ...game(), day: 7 });
    expect(adapter.values.get(storageKeys.backup)).toBe(backup);
    expect((await storage.loadGame())!.day).toBe(7);
  });

  it('does not touch a known good backup when the caller provides an invalid state', async () => {
    const adapter = new MemoryStorage();
    const storage = createStorageService(adapter);
    await storage.saveGame(game());
    const slotsBefore = [...adapter.values.entries()];
    const invalid = game();
    invalid.stats.cash = Number.NaN;
    await expect(storage.saveGame(invalid)).rejects.toThrow(/game state|invalid/i);
    expect([...adapter.values.entries()]).toEqual(slotsBefore);
  });

  it('serializes concurrent saves and captures their states at call time', async () => {
    const adapter = new MemoryStorage();
    const storage = createStorageService(adapter);
    await storage.saveGame(game());
    let release!: () => void;
    let reachedWrite!: () => void;
    const hold = new Promise<void>(resolve => { release = resolve; });
    const writing = new Promise<void>(resolve => { reachedWrite = resolve; });
    let blocked = false;
    adapter.beforeSet = async key => {
      if (key === storageKeys.game && !blocked) {
        blocked = true;
        reachedWrite();
        await hold;
      }
    };
    const first = game();
    first.day = 5;
    first.stats.cash = 3000;
    const firstSave = storage.saveGame(first);
    await writing;
    const secondSave = storage.saveGame({ ...game(), day: 6 });
    first.stats.cash = 9999;
    release();
    await Promise.all([firstSave, secondSave]);
    expect((await storage.loadGame())!.day).toBe(6);
    const backup = importSave(adapter.values.get(storageKeys.backup)!);
    expect(backup.day).toBe(5);
    expect(backup.stats.cash).toBe(3000);
  });

  it('reports failed writes, preserves the prior save and allows a later retry', async () => {
    const adapter = new MemoryStorage();
    const storage = createStorageService(adapter);
    await storage.saveGame(game());
    adapter.beforeSet = async key => {
      if (key === storageKeys.backup) throw new Error('disk full');
    };
    await expect(storage.saveGame({ ...game(), day: 8 })).rejects.toThrow(/save|storage/i);
    expect((await storage.loadGame())!.day).toBe(4);
    adapter.beforeSet = undefined;
    await storage.saveGame({ ...game(), day: 9 });
    expect((await storage.loadGame())!.day).toBe(9);
  });

  it('reports read failures instead of pretending there is no game', async () => {
    const adapter: StorageAdapter = {
      getItem: () => { throw new Error('access denied'); },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    await expect(createStorageService(adapter).loadGame()).rejects.toThrow(/load|storage/i);
  });

  it('reports a failed recovery write instead of silently succeeding', async () => {
    const adapter = new MemoryStorage();
    adapter.values.set(storageKeys.game, 'corrupt');
    adapter.values.set(storageKeys.backup, exportSave(game()));
    adapter.beforeSet = async () => { throw new Error('disk full'); };
    await expect(createStorageService(adapter).loadGame()).rejects.toThrow(/restore|recover|storage/i);
  });

  it('clears both game slots without erasing settings', async () => {
    const adapter = new MemoryStorage();
    const storage = createStorageService(adapter);
    await storage.saveGame(game());
    await storage.saveSettings({ ...defaultSettings, language: 'id' });
    await storage.clearSave();
    expect(await storage.loadGame()).toBeNull();
    expect((await storage.loadSettings()).language).toBe('id');
  });

  it('reports failed deletion', async () => {
    const adapter: StorageAdapter = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => { throw new Error('permission denied'); },
    };
    await expect(createStorageService(adapter).clearSave()).rejects.toThrow(/clear|delete|storage/i);
  });
});

describe('settings storage', () => {
  it('uses English settings by default and returns independent objects', async () => {
    const storage = createStorageService(new MemoryStorage());
    const settings = await storage.loadSettings();
    expect(settings).toEqual({ sound: true, music: false, haptics: true, reducedMotion: false, language: 'en' });
    settings.sound = false;
    expect((await storage.loadSettings()).sound).toBe(true);
  });

  it('round trips every setting', async () => {
    const storage = createStorageService(new MemoryStorage());
    const settings: Settings = { sound: false, music: true, haptics: false, reducedMotion: true, language: 'id' };
    await storage.saveSettings(settings);
    expect(await storage.loadSettings()).toEqual(settings);
  });

  it('rejects corrupt settings and invalid settings writes', async () => {
    const adapter = new MemoryStorage();
    const storage = createStorageService(adapter);
    adapter.values.set(storageKeys.settings, '{broken');
    await expect(storage.loadSettings()).rejects.toThrow(/settings/i);
    await expect(storage.saveSettings({ ...defaultSettings, sound: 'yes' } as unknown as Settings)).rejects.toThrow(/settings/i);
  });

  it('propagates settings write failure', async () => {
    const adapter = new MemoryStorage();
    adapter.beforeSet = async () => { throw new Error('disk full'); };
    await expect(createStorageService(adapter).saveSettings(defaultSettings)).rejects.toThrow(/settings|storage/i);
  });
});

describe('device storage selection', () => {
  function webStorage() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
      clear: () => { values.clear(); },
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    } satisfies Storage;
  }

  it('persists browser saves and settings in localStorage', async () => {
    vi.stubGlobal('localStorage', webStorage());
    await saveGame(game());
    await saveSettings({ ...defaultSettings, reducedMotion: true });
    expect(await loadGame()).toEqual(game());
    expect((await loadSettings()).reducedMotion).toBe(true);
    expect(device.preferences.size).toBe(0);
    await clearSave();
    expect(await loadGame()).toBeNull();
    expect((await loadSettings()).reducedMotion).toBe(true);
  });

  it('persists native saves and settings using Preferences without browser storage', async () => {
    device.native = true;
    vi.stubGlobal('localStorage', undefined);
    await saveGame(game());
    await saveSettings({ ...defaultSettings, language: 'id' });
    expect(await loadGame()).toEqual(game());
    expect((await loadSettings()).language).toBe('id');
    expect(device.preferences.has(storageKeys.game)).toBe(true);
    await clearSave();
    expect(await loadGame()).toBeNull();
    expect((await loadSettings()).language).toBe('id');
  });

  it('reports unavailable browser storage', async () => {
    vi.stubGlobal('localStorage', undefined);
    await expect(loadGame()).rejects.toThrow(/storage/i);
    await expect(saveGame(game())).rejects.toThrow(/storage/i);
  });
});
