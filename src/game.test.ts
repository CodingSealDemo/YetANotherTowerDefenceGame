import { describe, it, expect, beforeEach } from 'vitest';
import { BigNumber } from '../src/utils/BigNumber';
import { EventBus } from '../src/core/EventBus';
import { ErrorPipeline } from '../src/core/ErrorPipeline';
import { GameEngine } from '../src/engine/GameEngine';
import { ProgressionManager } from '../src/managers/ProgressionManager';
import { EditorManager } from '../src/editors/EditorManager';
import { LevelDefinition, TowerDefinition, EnemyDefinition, SkillTreeDefinition, GameConfig } from '../src/models/GameModels';

describe('BigNumber Utility', () => {
  it('handles extremely large numbers (1e300000+)', () => {
    const num1 = new BigNumber('1e300000');
    const num2 = new BigNumber('2e300000');
    const sum = num1.add(num2);

    expect(sum.toString()).toContain('3e+300000');
    expect(sum.gte('1e300000')).toBe(true);
  });

  it('formats standard and scientific notation correctly', () => {
    const small = new BigNumber(250);
    expect(small.toFormattedString()).toBe('250');

    const big = new BigNumber('1.25e500');
    expect(big.toFormattedString()).toBe('1.25e500');
  });
});

describe('EventBus & ErrorPipeline', () => {
  it('emits and receives events correctly', () => {
    const bus = EventBus.getInstance();
    let received = false;
    bus.on('test_event', () => { received = true; });
    bus.emit('test_event');
    expect(received).toBe(true);
  });

  it('logs errors into ErrorPipeline', () => {
    const pipeline = ErrorPipeline.getInstance();
    pipeline.clearErrors();
    pipeline.handleError('TEST_CODE', 'Test message');
    const errors = pipeline.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe('TEST_CODE');
  });
});

describe('GameEngine & Enemy Mechanics', () => {
  let engine: GameEngine;
  const dummyTower: TowerDefinition = {
    id: 'basic',
    name: 'Basic',
    cost: '100',
    range: 200,
    damage: '50',
    fireRate: 1,
    unlockedByDefault: true,
    unlockLevelRequired: 0,
    canDetectStealth: false,
    canPierceArmor: false,
    sprite: 'assets/tower_basic.png',
    description: 'Basic'
  };

  const dummyDetector: TowerDefinition = {
    ...dummyTower,
    id: 'detector',
    canDetectStealth: true
  };

  const dummyPiercer: TowerDefinition = {
    ...dummyTower,
    id: 'piercer',
    canPierceArmor: true
  };

  const dummyEnemies: EnemyDefinition[] = [
    {
      id: 'normal',
      name: 'Normal',
      health: '100',
      speed: 100,
      reward: '10',
      damage: '10',
      isReinforced: false,
      isStealth: false,
      splitsInto: null,
      splitCount: 0,
      sprite: 'assets/enemy_normal.png'
    },
    {
      id: 'reinforced',
      name: 'Reinforced',
      health: '100',
      speed: 100,
      reward: '20',
      damage: '10',
      isReinforced: true,
      isStealth: false,
      splitsInto: null,
      splitCount: 0,
      sprite: 'assets/enemy_reinforced.png'
    },
    {
      id: 'stealth',
      name: 'Stealth',
      health: '100',
      speed: 100,
      reward: '20',
      damage: '10',
      isReinforced: false,
      isStealth: true,
      splitsInto: null,
      splitCount: 0,
      sprite: 'assets/enemy_stealth.png'
    },
    {
      id: 'big',
      name: 'Big',
      health: '100',
      speed: 100,
      reward: '30',
      damage: '20',
      isReinforced: false,
      isStealth: false,
      splitsInto: 'normal',
      splitCount: 2,
      sprite: 'assets/enemy_big.png'
    }
  ];

  const dummyLevel: LevelDefinition = {
    id: 1,
    name: 'Level 1',
    baseHealth: '100',
    rewardCoins: '100',
    pathPoints: [{ x: 0, y: 0 }, { x: 500, y: 0 }],
    waves: [{ enemyId: 'stealth', count: 1, interval: 1 }]
  };

  beforeEach(() => {
    engine = new GameEngine();
    engine.initializeData([dummyTower, dummyDetector, dummyPiercer], dummyEnemies, []);
    engine.loadLevel(dummyLevel);
  });

  it('places tower on valid position and rejects placement on path', () => {
    const placedOnPath = engine.placeTower('basic', 10, 0);
    expect(placedOnPath).toBeNull();

    const placedValid = engine.placeTower('basic', 100, 100);
    expect(placedValid).not.toBeNull();
    expect(engine.getPlacedTowers().length).toBe(1);
  });

  it('updates direction angle and spread angle', () => {
    const tower = engine.placeTower('basic', 100, 100)!;
    engine.updateTowerAngleAndSpread(tower.id, 90, 60);
    expect(tower.directionAngle).toBe(90);
    expect(tower.spreadAngle).toBe(60);
  });

  it('reveals stealth enemies only when in detector tower range', () => {
    engine.placeTower('detector', 0, 50);
    engine.startCombatPhase();
    engine.update(0.1, 0);

    engine.update(0.1, 0.1);
    expect(engine.getActiveEnemies()[0].isRevealed).toBe(true);
  });
});

describe('ProgressionManager & Prestige System', () => {
  let manager: ProgressionManager;
  const config: GameConfig = {
    editorPasswordHash: 'secret',
    prestige: {
      tier1Cost: '1e300',
      tier2Cost: '1e300',
      tier3Cost: '1e300'
    }
  };

  const dummyTree: SkillTreeDefinition = {
    treeId: 'normal',
    name: 'Normal Tree',
    currency: 'coins',
    skills: [
      {
        id: 's1',
        name: 'Skill 1',
        description: 'Desc',
        cost: '50',
        currency: 'coins',
        requires: [],
        statBonus: { damageMultiplier: 0.1, rangeBonus: 5, fireRateBonus: 0.1 },
        icon: ''
      }
    ]
  };

  beforeEach(() => {
    manager = new ProgressionManager();
    manager.initialize(config, [dummyTree]);
  });

  it('allows purchasing skills with sufficient coins', () => {
    expect(manager.purchaseSkill('s1')).toBe(true);
    expect(manager.getCoins().toString()).toBe('50');
    expect(manager.getPurchasedSkills()).toContain('s1');
  });

  it('prevents prestige tier 1 before reaching 1e300 coins', () => {
    expect(manager.canPrestige(1)).toBe(false);
    manager.addCoins('1e300');
    expect(manager.canPrestige(1)).toBe(true);
    expect(manager.performPrestige(1)).toBe(true);
    expect(manager.getCrystals().toString()).toBe('1');
    expect(manager.getPrestigeTier()).toBe(1);
  });

  it('exports and imports JSON save state', () => {
    manager.addCoins(500);
    const json = manager.exportSaveState();

    const newManager = new ProgressionManager();
    newManager.initialize(config, [dummyTree]);
    expect(newManager.importSaveState(json)).toBe(true);
    expect(newManager.getCoins().toString()).toBe('600');
  });
});

describe('EditorManager', () => {
  let editor: EditorManager;
  const config: GameConfig = {
    editorPasswordHash: 'admin123',
    prestige: { tier1Cost: '1e300', tier2Cost: '1e300', tier3Cost: '1e300' }
  };

  beforeEach(() => {
    editor = new EditorManager();
    editor.initialize(config, [], [], [], []);
  });

  it('requires password authentication before modification', () => {
    expect(editor.authenticate('wrong')).toBe(false);
    expect(editor.authenticate('admin124')).toBe(false); // same length mismatch
    expect(editor.authenticate('')).toBe(false);
    expect(editor.authenticate(null as any)).toBe(false);
    expect(editor.isAuth()).toBe(false);

    expect(editor.authenticate('admin123')).toBe(true);
    expect(editor.isAuth()).toBe(true);
  });

  it('adds, modifies, and deletes levels when authenticated', () => {
    editor.authenticate('admin123');
    const level: LevelDefinition = {
      id: 99,
      name: 'Custom Level',
      baseHealth: '100',
      rewardCoins: '1000',
      pathPoints: [],
      waves: []
    };

    expect(editor.addLevel(level)).toBe(true);
    expect(editor.getLevels().length).toBe(1);

    level.name = 'Updated Custom Level';
    expect(editor.updateLevel(level)).toBe(true);
    expect(editor.getLevels()[0].name).toBe('Updated Custom Level');

    expect(editor.deleteLevel(99)).toBe(true);
    expect(editor.getLevels().length).toBe(0);
  });
});
