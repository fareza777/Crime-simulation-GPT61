import { describe, expect, it } from 'vitest';
import { createGame, gameReducer } from '../game/engine';
import { dayInterstitialOpportunity } from './ad-opportunities';

describe('natural day transitions', () => {
  it('discards a day that creates a story decision', () => {
    const state = createGame('Vale', 'thief', 1);
    state.day = 3;
    const after = gameReducer(state, { type: 'NEXT_DAY' });
    expect(after.day).toBe(4);
    expect(after.result?.nextEvent).toBe('warehouse-offer');
    expect(dayInterstitialOpportunity(state, after, 'NEXT_DAY')).toBeNull();
  });
  it('accepts a plain completed day and never treats a choice as a day', () => {
    const state = createGame('Vale', 'fixer', 1);
    const after = structuredClone(state);
    after.day++;
    after.result = { title: 'Day closed', text: 'Accounts settled.', success: true, effects: {}, image: '/assets/city.webp' };
    expect(dayInterstitialOpportunity(state, after, 'NEXT_DAY')).toBe(2);
    expect(dayInterstitialOpportunity(state, after, 'CHOOSE_EVENT')).toBeNull();
    expect(dayInterstitialOpportunity(state, state, 'NEXT_DAY')).toBeNull();
  });
  it('never queues custody or an active encounter', () => {
    const before = createGame('Vale', 'leader', 1);
    const after = structuredClone(before);
    after.day++;
    after.jail = { days: 2, reason: 'A case.' };
    expect(dayInterstitialOpportunity(before, after, 'NEXT_DAY')).toBeNull();
    after.jail = null;
    after.pendingEvent = { id: 'warehouse-offer' };
    expect(dayInterstitialOpportunity(before, after, 'NEXT_DAY')).toBeNull();
  });
});
