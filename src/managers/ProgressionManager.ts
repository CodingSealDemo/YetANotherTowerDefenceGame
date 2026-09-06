import { BigNumber } from '../utils/BigNumber';
import { EventBus } from '../core/EventBus';
import { ErrorPipeline } from '../core/ErrorPipeline';
import { SkillTreeDefinition, SkillDefinition, PlayerSaveData, GameConfig } from '../models/GameModels';

export class ProgressionManager {
  private eventBus = EventBus.getInstance();
  private errorPipeline = ErrorPipeline.getInstance();

  private coins: BigNumber = new BigNumber(100);
  private crystals: BigNumber = new BigNumber(0);
  private diamonds: BigNumber = new BigNumber(0);
  private darkOrbs: BigNumber = new BigNumber(0);

  private prestigeTier: number = 0;
  private unlockedLevels: Set<number> = new Set([1]);
  private unlockedTowers: Set<string> = new Set(['basic', 'rapid', 'sniper', 'splash', 'detector']);
  private purchasedSkills: Set<string> = new Set();
  private currentLevelId: number = 1;

  private skillTrees: Map<string, SkillTreeDefinition> = new Map();
  private config!: GameConfig;

  constructor() {}

  public initialize(config: GameConfig, skillTrees: SkillTreeDefinition[]): void {
    this.config = config;
    skillTrees.forEach(tree => this.skillTrees.set(tree.treeId, tree));
  }

  public getCurrency(currency: string): BigNumber {
    switch (currency) {
      case 'coins': return this.coins;
      case 'crystals': return this.crystals;
      case 'diamonds': return this.diamonds;
      case 'dark_orbs': return this.darkOrbs;
      default: return new BigNumber(0);
    }
  }

  public addCoins(amount: BigNumber | string | number): void {
    this.coins = this.coins.add(amount);
    this.eventBus.emit('progression:currencyChanged', { currency: 'coins', amount: this.coins.toString() });
  }

  public unlockLevel(levelId: number): void {
    this.unlockedLevels.add(levelId);
    this.eventBus.emit('progression:levelUnlocked', levelId);
  }

  public unlockTower(towerId: string): void {
    this.unlockedTowers.add(towerId);
    this.eventBus.emit('progression:towerUnlocked', towerId);
  }

  public purchaseSkill(skillId: string): boolean {
    if (this.purchasedSkills.has(skillId)) {
      this.errorPipeline.handleError('SKILL_ALREADY_PURCHASED', `Skill ${skillId} is already unlocked.`);
      return false;
    }

    let targetSkill: SkillDefinition | null = null;
    for (const tree of this.skillTrees.values()) {
      const found = tree.skills.find(s => s.id === skillId);
      if (found) {
        targetSkill = found;
        break;
      }
    }

    if (!targetSkill) {
      this.errorPipeline.handleError('SKILL_NOT_FOUND', `Skill ${skillId} not found.`);
      return false;
    }

    for (const reqId of targetSkill.requires) {
      if (!this.purchasedSkills.has(reqId)) {
        this.errorPipeline.handleError('PREREQUISITE_NOT_MET', `Prerequisite skill ${reqId} is required.`);
        return false;
      }
    }

    const cost = new BigNumber(targetSkill.cost);
    const currBalance = this.getCurrency(targetSkill.currency);

    if (currBalance.lt(cost)) {
      this.errorPipeline.handleError('INSUFFICIENT_FUNDS', `Insufficient ${targetSkill.currency} balance.`);
      return false;
    }

    this.deductCurrency(targetSkill.currency, cost);
    this.purchasedSkills.add(skillId);
    this.eventBus.emit('progression:skillPurchased', skillId);
    return true;
  }

  private deductCurrency(currency: string, amount: BigNumber): void {
    switch (currency) {
      case 'coins': this.coins = this.coins.sub(amount); break;
      case 'crystals': this.crystals = this.crystals.sub(amount); break;
      case 'diamonds': this.diamonds = this.diamonds.sub(amount); break;
      case 'dark_orbs': this.darkOrbs = this.darkOrbs.sub(amount); break;
    }
    this.eventBus.emit('progression:currencyChanged', { currency, amount: this.getCurrency(currency).toString() });
  }

  public canPrestige(targetTier: number): boolean {
    if (targetTier !== this.prestigeTier + 1) return false;
    if (targetTier === 1) return this.coins.gte(this.config.prestige.tier1Cost);
    if (targetTier === 2) return this.crystals.gte(this.config.prestige.tier2Cost);
    if (targetTier === 3) return this.diamonds.gte(this.config.prestige.tier3Cost);
    return false;
  }

  public performPrestige(targetTier: number): boolean {
    if (!this.canPrestige(targetTier)) {
      this.errorPipeline.handleError('PRESTIGE_FAILED', `Prestige Tier ${targetTier} requirements not met.`);
      return false;
    }

    if (targetTier === 1) {
      this.coins = new BigNumber(100);
      this.crystals = this.crystals.add(1);
      this.prestigeTier = 1;
      this.resetSkillsForTree('normal');
    } else if (targetTier === 2) {
      this.crystals = new BigNumber(0);
      this.diamonds = this.diamonds.add(1);
      this.prestigeTier = 2;
      this.resetSkillsForTree('prestige_1');
    } else if (targetTier === 3) {
      this.diamonds = new BigNumber(0);
      this.darkOrbs = this.darkOrbs.add(1);
      this.prestigeTier = 3;
      this.resetSkillsForTree('prestige_2');
    }

    this.eventBus.emit('progression:prestigePerformed', { tier: targetTier });
    return true;
  }

  private resetSkillsForTree(treeId: string): void {
    const tree = this.skillTrees.get(treeId);
    if (tree) {
      tree.skills.forEach(skill => {
        this.purchasedSkills.delete(skill.id);
      });
    }
  }

  public exportSaveState(): string {
    const saveObj: PlayerSaveData = {
      coins: this.coins.toString(),
      crystals: this.crystals.toString(),
      diamonds: this.diamonds.toString(),
      darkOrbs: this.darkOrbs.toString(),
      prestigeTier: this.prestigeTier,
      unlockedLevels: Array.from(this.unlockedLevels),
      unlockedTowers: Array.from(this.unlockedTowers),
      purchasedSkills: Array.from(this.purchasedSkills),
      currentLevelId: this.currentLevelId,
      version: '1.0.0'
    };
    return JSON.stringify(saveObj, null, 2);
  }

  public importSaveState(jsonString: string): boolean {
    try {
      const data: PlayerSaveData = JSON.parse(jsonString);
      this.coins = new BigNumber(data.coins || '100');
      this.crystals = new BigNumber(data.crystals || '0');
      this.diamonds = new BigNumber(data.diamonds || '0');
      this.darkOrbs = new BigNumber(data.darkOrbs || '0');
      this.prestigeTier = data.prestigeTier || 0;
      this.unlockedLevels = new Set(data.unlockedLevels || [1]);
      this.unlockedTowers = new Set(data.unlockedTowers || ['basic', 'rapid', 'sniper', 'splash', 'detector']);
      this.purchasedSkills = new Set(data.purchasedSkills || []);
      this.currentLevelId = data.currentLevelId || 1;

      this.eventBus.emit('progression:stateLoaded');
      return true;
    } catch (err: any) {
      this.errorPipeline.handleError('SAVE_IMPORT_ERROR', 'Invalid JSON save state format.', err);
      return false;
    }
  }

  public getCoins(): BigNumber { return this.coins; }
  public getCrystals(): BigNumber { return this.crystals; }
  public getDiamonds(): BigNumber { return this.diamonds; }
  public getDarkOrbs(): BigNumber { return this.darkOrbs; }
  public getPrestigeTier(): number { return this.prestigeTier; }
  public getUnlockedLevels(): number[] { return Array.from(this.unlockedLevels); }
  public getUnlockedTowers(): string[] { return Array.from(this.unlockedTowers); }
  public getPurchasedSkills(): string[] { return Array.from(this.purchasedSkills); }
}
