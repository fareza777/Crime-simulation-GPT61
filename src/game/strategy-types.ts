import type { Effects, GameState, Outcome, SkillKey } from './types';

export type Difficulty = 'standard' | 'hard' | 'ruthless';
export type OrganizationAgenda = 'balanced' | 'profit' | 'silent' | 'war';
export type ZoneActionMode = 'scout' | 'negotiate' | 'disrupt' | 'fortify';
export type BattleApproach = 'silent' | 'balanced' | 'force';
export type BattleChoiceId = 'advance' | 'flank' | 'cover' | 'rally' | 'retreat';
export interface ZoneDefinition {
  id: string; name: string; districtId: string; description: string;
  x: number; y: number; neighbors: string[]; rivalId: string;
  income: number; upkeep: number; defense: number; requiredRep: number;
}
export interface RivalDefinition {
  id: string; name: string; districtId: string; description: string;
  strength: number; hostility: number; image: string;
}
export interface OperationChoice {
  id: string; label: string; description: string; cost: number; energy: number;
  chanceBonus: number; progress: number; suspicion: number; injuryChance: number;
}
export interface OperationStage {
  id: string; name: string; description: string; skill: SkillKey; choices: OperationChoice[];
}
export interface OperationDefinition {
  id: string; name: string; description: string; image: string; districtId: string;
  requiredRep: number; requiredCrew: number; requiredItems: string[]; cost: number;
  energy: number; reward: [number, number]; cooldown: number; stages: OperationStage[];
}
export interface ZoneState {
  owner: string; control: number; intel: number; fortification: number;
  lieutenantId: string | null; disruptedUntil: number;
}
export interface RivalState { strength: number; hostility: number; alert: number; truceUntil: number; }
export interface BattleState {
  zoneId: string; rivalId: string; crewIds: string[]; approach: BattleApproach;
  round: number; momentum: number; morale: number; exposure: number;
  choices: string[]; woundedCrewIds: string[];
}
export interface OperationState {
  operationId: string; crewIds: string[]; stage: number; progress: number;
  suspicion: number; successes: number; choices: string[];
}
export interface StrategyState {
  difficulty: Difficulty; agenda: OrganizationAgenda;
  zones: Record<string, ZoneState>; rivals: Record<string, RivalState>;
  crewFatigue: Record<string, number>; battle: BattleState | null; operation: OperationState | null;
  counters: { battlesWon: number; battlesFought: number; operationsCompleted: number; zonesCaptured: number };
  operationCooldowns: Record<string, number>; rewardClaims: { day: number; energy: number; cash: number };
  lastDaily: { day: number; zoneIncome: number; zoneUpkeep: number; businessPressure: number; notices: string[] } | null;
}
export interface CommandInfo { cost: number; energy: number; chance: number; requirements: string[]; consequence: string; }
export interface ZoneView {
  definition: ZoneDefinition; state: ZoneState; owned: boolean; connected: boolean;
  adjacent: boolean; unlocked: boolean; rival: RivalDefinition | null;
  income: number; upkeep: number; defense: number;
}
export interface BattlePreview extends CommandInfo { power: number; defense: number; }
export interface BattleChoiceInfo extends CommandInfo {
  label: string; description: string; momentum: number; exposure: number; morale: number; injuryChance: number;
}
export interface OperationChoiceInfo extends CommandInfo { progress: number; suspicion: number; injuryChance: number; }
export type StrategyAction =
  | { type: 'SET_DIFFICULTY'; difficulty: Difficulty }
  | { type: 'SET_AGENDA'; agenda: OrganizationAgenda }
  | { type: 'ZONE_ACTION'; zoneId: string; mode: ZoneActionMode }
  | { type: 'ASSIGN_LIEUTENANT'; zoneId: string; crewId: string | null }
  | { type: 'RIVAL_TRUCE'; rivalId: string }
  | { type: 'START_BATTLE'; zoneId: string; crewIds: string[]; approach: BattleApproach }
  | { type: 'BATTLE_CHOICE'; choiceId: BattleChoiceId }
  | { type: 'START_OPERATION'; id: string; crewIds: string[] }
  | { type: 'OPERATION_CHOICE'; choiceId: string }
  | { type: 'ABORT_OPERATION' }
  | { type: 'CLAIM_AD_REWARD'; kind: 'energy' | 'cash' };
export interface StrategyContext {
  random: (state: GameState) => number;
  applyEffects: (state: GameState, effects: Effects, injuryCrewIds?: readonly string[]) => Effects;
  record: (state: GameState, outcome: Outcome) => GameState;
}
