import type { GameAction, GameState } from '../game/types';
import { getStrategy } from '../game/strategy';

export function dayInterstitialOpportunity(before: GameState, after: GameState, action: GameAction['type']): number | null {
  if (action !== 'NEXT_DAY' || after.day !== before.day + 1) return null;
  const strategy = getStrategy(after);
  if (after.result?.nextEvent || after.pendingEvent || after.pendingJob || after.jail ||
    (after.heist && !after.heist.completed) || strategy.battle || strategy.operation) return null;
  return after.day;
}
