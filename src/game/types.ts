import type { StrategyAction, StrategyState } from './strategy-types';

export type StatKey = 'cash' | 'reputation' | 'heat' | 'health' | 'energy' | 'influence';
export type SkillKey = 'charisma' | 'streetSmarts' | 'combat' | 'driving' | 'stealth' | 'business';
export type CareerPath = 'thief' | 'smuggler' | 'leader' | 'fixer' | 'businessman' | 'boss';
export type Effects = Partial<Record<StatKey, number>> & {
  loyalty?: number; relationships?: Record<string, number>; flags?: string[];
  removeFlags?: string[]; skillXp?: Partial<Record<SkillKey, number>>;
  item?: string; jailDays?: number; injuredCrew?: boolean; influenceDistrict?: number;
};
export interface District {
  id: string; name: string; subtitle: string; description: string; image: string;
  requiredRep: number; risk: number; gang: string; color: string;
}
export interface Activity {
  id: string; name: string; category: string; districtId: string; description: string;
  image: string; difficulty: number; cost: number; energy: number; baseChance: number;
  reward: [number, number]; heat: number; rep: number; requiredRep: number;
  skill: SkillKey; requiredItem?: string; requiredCrew?: number;
  successText: string; failureText: string; failure: Effects;
}
export interface EventChoice {
  id: string; label: string; description: string; effects: Effects;
  chance?: number; skill?: SkillKey; failure?: Effects; result: string;
  failureResult?: string; followUp?: string; failureFollowUp?: string;
  requiredFlag?: string; requiredCrew?: number;
}
export interface GameEvent {
  id: string; title: string; category: string; text: string; image: string;
  choices: EventChoice[]; weight: number; minRep?: number; minHeat?: number;
  maxHeat?: number; districtId?: string; requiredFlag?: string;
  forbiddenFlag?: string; requiresBusiness?: boolean; requiresCrew?: boolean;
  jailOnly?: boolean; followUpOnly?: boolean;
}
export interface CrewMember {
  id: string; name: string; alias: string; role: string; description: string;
  portrait: string; skill: SkillKey; rating: number; loyalty: number;
  cost: number; salary: number; requiredRep: number; trait: string;
}
export interface Business {
  id: string; name: string; type: 'legitimate' | 'illegal'; districtId: string;
  description: string; image: string; cost: number; income: number;
  heat: number; requiredRep: number; maxLevel: number;
}
export interface Item {
  id: string; name: string; category: 'tools' | 'equipment' | 'vehicles' | 'special';
  description: string; image: string; cost: number; requiredRep: number;
  bonuses: Partial<Record<SkillKey | 'heatReduction' | 'health' | 'energy', number>>;
  consumable?: boolean;
}
export interface Quest {
  id: string; name: string; description: string; kind: 'main' | 'side';
  chapter?: string; prerequisite?: string; target: number;
  metric: 'jobsSucceeded' | 'cash' | 'reputation' | 'crew' | 'businesses' | 'influence' | 'items' | 'heist' | 'days' | 'districts' | 'training' | 'lowHeat' | 'zones' | 'battles' | 'operations';
  reward: Effects; contact: string; image: string;
}
export interface Contact {
  id: string; name: string; role: string; portrait: string; description: string;
  requiredRep: number; initialRelationship: number;
}
export interface SafehouseUpgrade {
  id: string; name: string; description: string; cost: number; maxLevel: number;
  bonus: string; icon: string;
}
export interface HeistStage {
  id: string; name: string; description: string; skill: SkillKey;
  choices: {id: string; label: string; description: string; cost: number; chanceBonus: number; heat: number}[];
}
export interface HeistDefinition {
  id: string; name: string; description: string; image: string; requiredRep: number;
  requiredCrew: number; requiredItems: string[]; cost: number; reward: [number, number];
  stages: HeistStage[];
}
export interface Outcome {
  title: string; text: string; success: boolean; effects: Effects; image: string;
  nextEvent?: string;
}
export interface GameState {
  version: 1; player: { name: string; path: CareerPath; portrait: string };
  day: number; stats: Record<StatKey, number>; skills: Record<SkillKey, number>;
  skillXp: Record<SkillKey, number>; districtId: string;
  crew: string[]; crewLoyalty: Record<string, number>; crewInjured: Record<string, number>;
  businesses: { id: string; level: number }[]; inventory: string[];
  safehouse: Record<string, number>; territories: Record<string, number>;
  relationships: Record<string, number>; flags: string[]; claimedQuests: string[];
  counters: { jobsSucceeded: number; jobsAttempted: number; totalEarned: number; training: number; districts: string[] };
  pendingJob: { activityId: string } | null; pendingEvent: { id: string } | null;
  result: Outcome | null; jail: { days: number; reason: string } | null;
  heist: { stage: number; crewIds: string[]; successes: number; choices: string[]; completed: boolean } | null;
  log: { day: number; title: string; text: string; good: boolean }[];
  seed: number;
  /** Optional only for source-compatible legacy saves; createGame and importSave supply it. */
  strategy?: StrategyState;
}
export type GameAction = StrategyAction
  | { type: 'START_JOB'; id: string }
  | { type: 'RESOLVE_JOB'; approach: 'rush' | 'informant' | 'scout' | 'leave' }
  | { type: 'CHOOSE_EVENT'; choiceId: string }
  | { type: 'DISMISS_RESULT' }
  | { type: 'NEXT_DAY' }
  | { type: 'RECRUIT'; id: string }
  | { type: 'BUY_ITEM'; id: string }
  | { type: 'BUY_BUSINESS'; id: string }
  | { type: 'UPGRADE_BUSINESS'; id: string }
  | { type: 'TRAIN'; skill: SkillKey }
  | { type: 'UPGRADE_SAFEHOUSE'; id: string }
  | { type: 'TRAVEL'; id: string }
  | { type: 'CLAIM_QUEST'; id: string }
  | { type: 'INFLUENCE'; districtId: string; mode: 'negotiate' | 'pressure' }
  | { type: 'CONTACT'; id: string; mode: 'favor' | 'gift' }
  | { type: 'LAY_LOW' }
  | { type: 'HEAL' }
  | { type: 'BAIL' }
  | { type: 'START_HEIST'; crewIds: string[] }
  | { type: 'HEIST_CHOICE'; choiceId: string }
  | { type: 'ABORT_HEIST' };
export interface Settings { sound: boolean; music: boolean; haptics: boolean; reducedMotion: boolean; language: 'en' | 'id'; }
