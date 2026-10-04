import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { activities, businesses, crew, districts, events, heist, items, quests, safehouseUpgrades } from '../data';
import type { GameState, Settings } from '../game/types';

export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export const storageKeys = { game: 'blackline.save.v1', backup: 'blackline.save.backup.v1', settings: 'blackline.settings.v1' } as const;
export const defaultSettings: Settings = Object.freeze({ sound: true, music: false, haptics: true, reducedMotion: false, language: 'en' });

const MAX_SAVE_BYTES = 2 * 1024 * 1024;
const MAX_COUNTER = 1e9;
const MAX_CASH = 1e12;
const statKeys = ['cash', 'reputation', 'heat', 'health', 'energy', 'influence'] as const;
const skillKeys = ['charisma', 'streetSmarts', 'combat', 'driving', 'stealth', 'business'] as const;
const careerPaths = ['thief', 'smuggler', 'leader', 'fixer', 'businessman', 'boss'];
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);
const districtIds = new Set(districts.map(entry => entry.id));
const crewIds = new Set(crew.map(entry => entry.id));
const itemIds = new Set(items.map(entry => entry.id));
const questIds = new Set(quests.map(entry => entry.id));
const activityIds = new Set(activities.map(entry => entry.id));
const eventIds = new Set(events.map(entry => entry.id));
const businessLevels = new Map(businesses.map(entry => [entry.id, entry.maxLevel]));
const safehouseLevels = new Map(safehouseUpgrades.map(entry => [entry.id, entry.maxLevel]));
type UnknownRecord = Record<string, unknown>;

function record(value: unknown): value is UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function shape(value: unknown, required: readonly string[], optional: readonly string[] = []): value is UnknownRecord {
  return record(value) && required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
}

function textValue(value: unknown, maximum: number, allowEmpty = false): value is string {
  return typeof value === 'string' && value.length <= maximum
    && (allowEmpty || value.trim().length > 0) && !value.includes('\u0000');
}

function id(value: unknown): value is string {
  return textValue(value, 128) && !unsafeKeys.has(value);
}

function number(value: unknown, minimum: number, maximum: number, integer = false): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
    && (!integer || Number.isInteger(value));
}

function strings(value: unknown, maximum: number, unique = true): value is string[] {
  return Array.isArray(value) && value.length <= maximum && Array.from(value).every(id)
    && (!unique || new Set(value).size === value.length);
}

function numberMap(value: unknown, minimum: number, maximum: number, integer = false, cap = 512): value is Record<string, number> {
  return record(value) && Object.keys(value).length <= cap
    && Object.entries(value).every(([key, entry]) => id(key) && number(entry, minimum, maximum, integer));
}

function skillMap(value: unknown, xp = false, partial = false): boolean {
  return shape(value, partial ? [] : skillKeys, partial ? skillKeys : [])
    && Object.values(value).every(entry => (partial && entry === undefined)
      || number(entry, xp ? 0 : 1, xp ? MAX_COUNTER : 10, !xp));
}

function effects(value: unknown): boolean {
  const optional = [...statKeys, 'loyalty', 'relationships', 'flags', 'removeFlags', 'skillXp', 'item', 'jailDays', 'injuredCrew', 'influenceDistrict'];
  if (!shape(value, [], optional)) return false;
  return Object.entries(value).every(([key, entry]) => {
    if (entry === undefined) return true;
    if (statKeys.includes(key as typeof statKeys[number])) return number(entry, -MAX_CASH, MAX_CASH);
    if (key === 'loyalty' || key === 'influenceDistrict') return number(entry, -100, 100);
    if (key === 'relationships') return numberMap(entry, -100, 100);
    if (key === 'flags' || key === 'removeFlags') return strings(entry, 2048);
    if (key === 'skillXp') return skillMap(entry, true, true);
    if (key === 'item') return id(entry);
    if (key === 'jailDays') return number(entry, -MAX_COUNTER, MAX_COUNTER, true);
    return key === 'injuredCrew' && typeof entry === 'boolean';
  });
}

function outcome(value: unknown): boolean {
  return value === null || (shape(value, ['title', 'text', 'success', 'effects', 'image'], ['nextEvent'])
    && textValue(value.title, 200) && textValue(value.text, 8192) && typeof value.success === 'boolean'
    && effects(value.effects) && textValue(value.image, 1024, true)
    && (value.nextEvent === undefined || id(value.nextEvent)));
}

function pending(value: unknown, key: 'activityId' | 'id'): boolean {
  return value === null || (shape(value, [key]) && id(value[key]));
}

function rosterKeysMatch(values: Record<string, number>, owned: Set<string>): boolean {
  const keys = Object.keys(values);
  return keys.length === owned.size && keys.every(key => owned.has(key));
}

/** Shape-valid saves must also point to content the UI and engine can actually resolve. */
function validContent(state: GameState): boolean {
  if (!/^\/assets\/(?:player|crew-(?:[1-9]|1[01]))\.webp$/.test(state.player.portrait)
    || !districtIds.has(state.districtId) || !state.counters.districts.every(id => districtIds.has(id))
    || !state.crew.every(id => crewIds.has(id)) || !state.inventory.every(id => itemIds.has(id))
    || !state.claimedQuests.every(id => questIds.has(id))) return false;
  const owned = new Set(state.crew);
  if (!rosterKeysMatch(state.crewLoyalty, owned) || !rosterKeysMatch(state.crewInjured, owned)) return false;
  if (!state.businesses.every(entry => businessLevels.has(entry.id) && entry.level <= businessLevels.get(entry.id)!)
    || !Object.entries(state.safehouse).every(([id, level]) => safehouseLevels.has(id) && level <= safehouseLevels.get(id)!)
    || !Object.keys(state.territories).every(id => districtIds.has(id))) return false;
  if ((state.pendingJob && !activityIds.has(state.pendingJob.activityId))
    || (state.pendingEvent && !eventIds.has(state.pendingEvent.id))
    || (state.result?.nextEvent !== undefined && !eventIds.has(state.result.nextEvent))) return false;
  const progress = state.heist;
  const unfinishedHeist = Boolean(progress && !progress.completed);
  if ((state.pendingJob && state.pendingEvent)
    || (unfinishedHeist && (state.pendingJob || state.pendingEvent || state.jail))
    || (state.jail && state.pendingJob)) return false;
  const pendingScene = state.pendingEvent && events.find(event => event.id === state.pendingEvent!.id);
  if (pendingScene && Boolean(pendingScene.jailOnly) !== Boolean(state.jail)) return false;
  if (state.flags.includes('heist-completed') !== Boolean(progress?.completed)) return false;
  if (!progress) return true;
  const stages = heist.stages.length;
  if (progress.completed ? progress.stage !== stages : progress.stage >= stages || progress.crewIds.length < heist.requiredCrew) return false;
  return progress.choices.length === progress.stage && progress.successes <= progress.stage
    && progress.crewIds.every(id => owned.has(id))
    && progress.choices.every((id, index) => heist.stages[index]?.choices.some(choice => choice.id === id));
}

/** Validates every persisted field without trusting TypeScript or a JSON checksum. */
export function isValidGame(value: unknown): value is GameState {
  const fields = ['version', 'player', 'day', 'stats', 'skills', 'skillXp', 'districtId', 'crew', 'crewLoyalty', 'crewInjured', 'businesses', 'inventory', 'safehouse', 'territories', 'relationships', 'flags', 'claimedQuests', 'counters', 'pendingJob', 'pendingEvent', 'result', 'jail', 'heist', 'log', 'seed'];
  if (!shape(value, fields) || value.version !== 1) return false;
  if (!shape(value.player, ['name', 'path', 'portrait']) || !textValue(value.player.name, 60)
    || typeof value.player.path !== 'string' || !careerPaths.includes(value.player.path)
    || !textValue(value.player.portrait, 1024)) return false;
  if (!number(value.day, 1, MAX_COUNTER, true) || !number(value.seed, 0, 4294967295, true)
    || !id(value.districtId) || !shape(value.stats, statKeys)) return false;
  if (!statKeys.every(key => number((value.stats as UnknownRecord)[key], 0,
    key === 'cash' ? MAX_CASH : key === 'reputation' ? MAX_COUNTER : 100))) return false;
  if (!skillMap(value.skills) || !skillMap(value.skillXp, true)
    || !strings(value.crew, 64) || !strings(value.inventory, 512)
    || !strings(value.flags, 2048) || !strings(value.claimedQuests, 512)) return false;
  if (!numberMap(value.crewLoyalty, 0, 100) || !numberMap(value.crewInjured, 0, MAX_COUNTER, true)
    || !numberMap(value.safehouse, 0, 100, true) || !numberMap(value.territories, 0, 100)
    || !numberMap(value.relationships, 0, 100)) return false;
  if (!Array.isArray(value.businesses) || value.businesses.length > 128
    || !Array.from(value.businesses).every(business => shape(business, ['id', 'level']) && id(business.id) && number(business.level, 1, 100, true))
    || new Set(value.businesses.map(business => (business as UnknownRecord).id)).size !== value.businesses.length) return false;
  if (!shape(value.counters, ['jobsSucceeded', 'jobsAttempted', 'totalEarned', 'training', 'districts'])
    || !number(value.counters.jobsSucceeded, 0, MAX_COUNTER, true)
    || !number(value.counters.jobsAttempted, 0, MAX_COUNTER, true)
    || value.counters.jobsSucceeded > value.counters.jobsAttempted
    || !number(value.counters.totalEarned, 0, MAX_CASH)
    || !number(value.counters.training, 0, MAX_COUNTER, true)
    || !strings(value.counters.districts, 512)) return false;
  if (!pending(value.pendingJob, 'activityId') || !pending(value.pendingEvent, 'id') || !outcome(value.result)) return false;
  if (value.jail !== null && (!shape(value.jail, ['days', 'reason'])
    || !number(value.jail.days, 0, MAX_COUNTER, true) || !textValue(value.jail.reason, 1024))) return false;
  if (value.heist !== null && (!shape(value.heist, ['stage', 'crewIds', 'successes', 'choices', 'completed'])
    || !number(value.heist.stage, 0, 64, true) || !strings(value.heist.crewIds, 64)
    || !number(value.heist.successes, 0, 64, true) || !strings(value.heist.choices, 64, false)
    || value.heist.successes > value.heist.choices.length || typeof value.heist.completed !== 'boolean')) return false;
  if (!Array.isArray(value.log) || value.log.length > 500
    || !Array.from(value.log).every(entry => shape(entry, ['day', 'title', 'text', 'good'])
      && number(entry.day, 1, MAX_COUNTER, true) && textValue(entry.title, 200)
      && textValue(entry.text, 8192) && typeof entry.good === 'boolean')) return false;
  return validContent(value as unknown as GameState);
}

function checkSize(raw: string): void {
  if (raw.length > MAX_SAVE_BYTES || new TextEncoder().encode(raw).byteLength > MAX_SAVE_BYTES) {
    throw new Error('This save is too large. The limit is 2 MiB.');
  }
}

// FNV-1a detects accidental corruption; it is not an authentication mechanism.
function checksum(raw: string): string {
  let hash = 2166136261;
  const bytes = new TextEncoder().encode(raw);
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

export function exportSave(state: GameState): string {
  if (!isValidGame(state)) throw new Error('Invalid game state. Your existing save was not changed.');
  // Validate the captured JSON too: optional fields may be omitted, while custom serializers must not bypass validation.
  const stateRaw = JSON.stringify(state);
  checkSize(stateRaw);
  const snapshot: unknown = JSON.parse(stateRaw);
  if (!isValidGame(snapshot)) throw new Error('Invalid serialized game state. Your existing save was not changed.');
  const raw = JSON.stringify({ format: 'blackline.save', version: 1, savedAt: Date.now(), checksum: checksum(stateRaw), state: snapshot });
  checkSize(raw);
  return raw;
}

export function importSave(raw: string): GameState {
  if (typeof raw !== 'string') throw new Error('Choose a valid save file.');
  checkSize(raw);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('This file is not valid save JSON.'); }
  if (!record(parsed)) throw new Error('This file does not contain a valid game state.');
  if (typeof parsed.version === 'number' && parsed.version > 1) throw new Error('This save was created by a newer game version.');
  if (Object.hasOwn(parsed, 'state') || Object.hasOwn(parsed, 'format') || Object.hasOwn(parsed, 'checksum')) {
    if (!shape(parsed, ['format', 'version', 'savedAt', 'checksum', 'state']) || parsed.format !== 'blackline.save'
      || parsed.version !== 1 || !number(parsed.savedAt, 0, 1e14, true)
      || typeof parsed.checksum !== 'string' || !/^[a-f0-9]{8}$/.test(parsed.checksum)) {
      throw new Error('This save format is invalid or unsupported.');
    }
    if (checksum(JSON.stringify(parsed.state)) !== parsed.checksum) throw new Error('This save is damaged: its checksum does not match.');
    if (!isValidGame(parsed.state)) throw new Error('This save contains an invalid game state or unknown city content.');
    return parsed.state;
  }
  // Early builds stored the same version 1 state without an envelope.
  if (!isValidGame(parsed)) throw new Error('This save contains an invalid game state, unknown city content or unsupported version.');
  return parsed;
}

function validSavedGame(raw: string | null): GameState | null {
  if (raw === null) return null;
  try { return importSave(raw); } catch { return null; }
}

function validSettings(value: unknown): value is Settings {
  return shape(value, ['sound', 'music', 'haptics', 'reducedMotion', 'language'])
    && ['sound', 'music', 'haptics', 'reducedMotion'].every(key => typeof value[key] === 'boolean')
    && (value.language === 'en' || value.language === 'id');
}

function storageError(message: string, cause: unknown): Error {
  return new Error(`${message} Device storage is full or unavailable.`, { cause });
}

export function createStorageService(adapter: StorageAdapter) {
  let queue: Promise<unknown> = Promise.resolve();
  function serialized<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation);
    queue = next.then(() => undefined, () => undefined);
    return next;
  }

  return {
    loadGame(): Promise<GameState | null> {
      return serialized(async () => {
        let primary: string | null;
        let backup: string | null;
        try {
          primary = await adapter.getItem(storageKeys.game);
          const game = validSavedGame(primary);
          if (game) return game;
          backup = await adapter.getItem(storageKeys.backup);
        } catch (error) { throw storageError('Could not load your game.', error); }
        const recovered = validSavedGame(backup);
        if (recovered) {
          try { await adapter.setItem(storageKeys.game, exportSave(recovered)); }
          catch (error) { throw storageError('Could not restore your game backup.', error); }
          return recovered;
        }
        if (primary === null && backup === null) return null;
        throw new Error('Your saved game and backup are damaged. Import a valid save or start a new game.');
      });
    },
    async saveGame(state: GameState): Promise<void> {
      // Capture now, before the queue waits, so later state mutations cannot change this save.
      const raw = exportSave(state);
      return serialized(async () => {
        try {
          const primary = await adapter.getItem(storageKeys.game);
          if (validSavedGame(primary)) await adapter.setItem(storageKeys.backup, primary!);
          else {
            const backup = await adapter.getItem(storageKeys.backup);
            if (!validSavedGame(backup)) await adapter.setItem(storageKeys.backup, raw);
          }
          await adapter.setItem(storageKeys.game, raw);
        } catch (error) { throw storageError('Could not save your game.', error); }
      });
    },
    clearSave(): Promise<void> {
      return serialized(async () => {
        try {
          await adapter.removeItem(storageKeys.game);
          await adapter.removeItem(storageKeys.backup);
        } catch (error) { throw storageError('Could not clear your saved game.', error); }
      });
    },
    loadSettings(): Promise<Settings> {
      return serialized(async () => {
        let raw: string | null;
        try { raw = await adapter.getItem(storageKeys.settings); }
        catch (error) { throw storageError('Could not load your settings.', error); }
        if (raw === null) return { ...defaultSettings };
        let parsed: unknown;
        try {
          if (raw.length > 4096) throw new Error('Settings are too large.');
          parsed = JSON.parse(raw);
        } catch { throw new Error('Saved settings are damaged. Reset settings to use the defaults.'); }
        // Plain settings from early builds remain readable.
        const settings = record(parsed) && parsed.version === 1 ? parsed.settings : parsed;
        if (!validSettings(settings)) throw new Error('Saved settings are invalid or use an unsupported version.');
        return { ...settings };
      });
    },
    async saveSettings(settings: Settings): Promise<void> {
      if (!validSettings(settings)) throw new Error('Invalid settings. Your saved settings were not changed.');
      const raw = JSON.stringify({ version: 1, settings });
      return serialized(async () => {
        try { await adapter.setItem(storageKeys.settings, raw); }
        catch (error) { throw storageError('Could not save your settings.', error); }
      });
    },
  };
}

function browserStorage(): Storage {
  if (typeof globalThis.localStorage === 'undefined') throw new Error('Local storage is unavailable on this device.');
  return globalThis.localStorage;
}

const deviceAdapter: StorageAdapter = {
  async getItem(key) {
    return Capacitor.isNativePlatform() ? (await Preferences.get({ key })).value : browserStorage().getItem(key);
  },
  async setItem(key, value) {
    if (Capacitor.isNativePlatform()) await Preferences.set({ key, value });
    else browserStorage().setItem(key, value);
  },
  async removeItem(key) {
    if (Capacitor.isNativePlatform()) await Preferences.remove({ key });
    else browserStorage().removeItem(key);
  },
};

const localService = createStorageService(deviceAdapter);
export const loadGame = localService.loadGame;
export const saveGame = localService.saveGame;
export const clearSave = localService.clearSave;
export const loadSettings = localService.loadSettings;
export const saveSettings = localService.saveSettings;
