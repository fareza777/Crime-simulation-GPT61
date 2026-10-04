import type { GameAction, GameState } from '../game/types';
export type Screen = 'overview' | 'city' | 'operations' | 'empire' | 'crew' | 'character' | 'journal';
export type Overlay = { kind: 'settings' | 'about' | 'help' | 'rest' | 'heist' | 'lay-low' | 'clinic' } | { kind: 'crew' | 'district' | 'contact' | 'item' | 'territory'; id: string } | null;
export interface ScreenProps { state: GameState; act: (action: GameAction) => void; nav: (screen: Screen) => void; open: (overlay: Overlay) => void; }
