import { BigNumber } from '../utils/BigNumber';

export interface Point {
  x: number;
  y: number;
}

export interface TowerDefinition {
  id: string;
  name: string;
  cost: string;
  range: number;
  damage: string;
  fireRate: number;
  unlockedByDefault: boolean;
  unlockLevelRequired: number;
  canDetectStealth: boolean;
  canPierceArmor: boolean;
  sprite: string;
  description: string;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  health: string;
  speed: number;
  reward: string;
  damage: string;
  isReinforced: boolean;
  isStealth: boolean;
  splitsInto: string | null;
  splitCount: number;
  sprite: string;
}

export interface WaveDefinition {
  enemyId: string;
  count: number;
  interval: number;
}

export interface LevelDefinition {
  id: number;
  name: string;
  baseHealth: string;
  rewardCoins: string;
  pathPoints: Point[];
  waves: WaveDefinition[];
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  cost: string;
  currency: 'coins' | 'crystals' | 'diamonds' | 'dark_orbs';
  requires: string[];
  statBonus: {
    damageMultiplier: number;
    rangeBonus: number;
    fireRateBonus: number;
  };
  icon: string;
}

export interface SkillTreeDefinition {
  treeId: string;
  name: string;
  currency: string;
  skills: SkillDefinition[];
}

export interface GameConfig {
  editorPasswordHash: string;
  prestige: {
    tier1Cost: string;
    tier2Cost: string;
    tier3Cost: string;
  };
}

export interface PlacedTower {
  id: string;
  typeId: string;
  x: number;
  y: number;
  directionAngle: number;
  spreadAngle: number;
  lastShotTime: number;
}

export interface ActiveEnemy {
  id: string;
  typeId: string;
  x: number;
  y: number;
  currentHealth: BigNumber;
  maxHealth: BigNumber;
  speed: number;
  reward: BigNumber;
  damage: BigNumber;
  isReinforced: boolean;
  isStealth: boolean;
  isRevealed: boolean;
  splitsInto: string | null;
  splitCount: number;
  pathProgress: number;
  sprite: string;
}

export interface PlayerSaveData {
  coins: string;
  crystals: string;
  diamonds: string;
  darkOrbs: string;
  prestigeTier: number;
  unlockedLevels: number[];
  unlockedTowers: string[];
  purchasedSkills: string[];
  currentLevelId: number;
  version: string;
}
