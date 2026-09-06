import { EventBus } from './core/EventBus';
import { ErrorPipeline } from './core/ErrorPipeline';
import { BigNumber } from './utils/BigNumber';
import { GameEngine } from './engine/GameEngine';
import { CanvasRenderer } from './rendering/CanvasRenderer';
import { ProgressionManager } from './managers/ProgressionManager';
import { EditorManager } from './editors/EditorManager';
import {
  GameConfig,
  LevelDefinition,
  TowerDefinition,
  EnemyDefinition,
  SkillTreeDefinition,
  PlacedTower,
  SkillDefinition
} from './models/GameModels';

class App {
  private eventBus = EventBus.getInstance();
  private errorPipeline = ErrorPipeline.getInstance();

  private engine!: GameEngine;
  private renderer!: CanvasRenderer;
  private progression!: ProgressionManager;
  private editor!: EditorManager;

  private config!: GameConfig;
  private levels: LevelDefinition[] = [];
  private towers: TowerDefinition[] = [];
  private enemies: EnemyDefinition[] = [];
  private skillTrees: SkillTreeDefinition[] = [];

  private selectedTowerType: string | null = null;
  private selectedPlacedTowerId: string | null = null;
  private lastFrameTime: number = performance.now();

  constructor() {}

  public async init(): Promise<void> {
    this.setupErrorHandling();

    await this.loadData();

    this.engine = new GameEngine();
    this.progression = new ProgressionManager();
    this.editor = new EditorManager();

    const allSkills = this.skillTrees.flatMap(t => t.skills);
    this.engine.initializeData(this.towers, this.enemies, allSkills);
    this.progression.initialize(this.config, this.skillTrees);
    this.editor.initialize(this.config, this.levels, this.towers, this.enemies, this.skillTrees);

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new CanvasRenderer(canvas, this.engine);

    this.setupUI();
    this.setupEventListeners();

    const initialLevel = this.levels[0];
    if (initialLevel) {
      this.engine.loadLevel(initialLevel, this.progression.getPurchasedSkills());
    }

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private setupErrorHandling(): void {
    this.eventBus.on('error:occurred', (err: any) => {
      const toast = document.getElementById('error-toast');
      if (toast) {
        toast.textContent = `[${err.code}] ${err.message}`;
        toast.style.display = 'block';
        setTimeout(() => {
          toast.style.display = 'none';
        }, 3500);
      }
    });
  }

  private async loadData(): Promise<void> {
    const [configRes, towersRes, enemiesRes, levelsRes, skillsRes] = await Promise.all([
      fetch('/data/config.json'),
      fetch('/data/towers.json'),
      fetch('/data/enemies.json'),
      fetch('/data/levels.json'),
      fetch('/data/skilltrees.json')
    ]);

    this.config = await configRes.json();
    this.towers = await towersRes.json();
    this.enemies = await enemiesRes.json();
    this.levels = await levelsRes.json();
    const treesObj = await skillsRes.json();
    this.skillTrees = Object.values(treesObj);
  }

  private setupUI(): void {
    this.updateCurrencyDisplay();

    const levelSelect = document.getElementById('level-select') as HTMLSelectElement;
    if (levelSelect) {
      levelSelect.innerHTML = '';
      this.levels.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id.toString();
        opt.textContent = `Level ${l.id}: ${l.name}`;
        levelSelect.appendChild(opt);
      });
      levelSelect.addEventListener('change', (e) => {
        const levelId = parseInt((e.target as HTMLSelectElement).value);
        const levelDef = this.levels.find(l => l.id === levelId);
        if (levelDef) {
          this.engine.loadLevel(levelDef, this.progression.getPurchasedSkills());
        }
      });
    }

    this.updateTowerArsenalUI();

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = (e.currentTarget as HTMLButtonElement).dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        (e.currentTarget as HTMLButtonElement).classList.add('active');
        document.getElementById(targetTab!)?.classList.add('active');

        if (targetTab === 'skills-tab') {
          this.renderSkillTreeUI();
        } else if (targetTab === 'editor-tab' && this.editor.isAuth()) {
          this.renderEditorTowerListUI();
        } else if (targetTab === 'skills-editor-tab' && this.editor.isAuth()) {
          this.renderEditorSkillListUI();
        }
      });
    });

    document.getElementById('start-combat-btn')?.addEventListener('click', () => {
      this.engine.startCombatPhase();
    });

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const existing = this.engine.getPlacedTowers().find(t => {
        const dx = t.x - x;
        const dy = t.y - y;
        return dx * dx + dy * dy <= 20 * 20;
      });

      if (existing) {
        this.selectedPlacedTowerId = existing.id;
        this.updateTowerControlsUI(existing);
      } else if (this.selectedTowerType && !this.engine.isCombat()) {
        const towerDef = this.towers.find(t => t.id === this.selectedTowerType);
        if (towerDef) {
          const cost = new BigNumber(towerDef.cost);
          if (this.progression.getCoins().gte(cost)) {
            const placed = this.engine.placeTower(this.selectedTowerType, x, y);
            if (placed) {
              this.progression.addCoins(cost.mul(-1));
              this.updateCurrencyDisplay();
            }
          } else {
            this.errorPipeline.handleError('INSUFFICIENT_FUNDS', 'Not enough coins to place tower');
          }
        }
      }
    });

    const angleInput = document.getElementById('angle-input') as HTMLInputElement;
    const spreadInput = document.getElementById('spread-input') as HTMLInputElement;

    angleInput?.addEventListener('input', () => {
      if (this.selectedPlacedTowerId) {
        document.getElementById('angle-val')!.textContent = angleInput.value;
        this.engine.updateTowerAngleAndSpread(this.selectedPlacedTowerId, parseFloat(angleInput.value), parseFloat(spreadInput.value));
      }
    });

    spreadInput?.addEventListener('input', () => {
      if (this.selectedPlacedTowerId) {
        document.getElementById('spread-val')!.textContent = spreadInput.value;
        this.engine.updateTowerAngleAndSpread(this.selectedPlacedTowerId, parseFloat(angleInput.value), parseFloat(spreadInput.value));
      }
    });

    document.getElementById('delete-tower-btn')?.addEventListener('click', () => {
      if (this.selectedPlacedTowerId) {
        this.engine.removeTower(this.selectedPlacedTowerId);
        this.selectedPlacedTowerId = null;
        document.getElementById('tower-controls')!.style.display = 'none';
      }
    });

    // Editor login & CRUD setup
    document.getElementById('editor-login-btn')?.addEventListener('click', () => {
      const pass = (document.getElementById('editor-pass-input') as HTMLInputElement).value;
      if (this.editor.authenticate(pass)) {
        document.getElementById('editor-auth-section')!.style.display = 'none';
        document.getElementById('editor-main-section')!.style.display = 'block';
        document.getElementById('skills-editor-auth-msg')!.style.display = 'none';
        document.getElementById('skills-editor-main')!.style.display = 'block';
        this.renderEditorTowerListUI();
        this.renderEditorSkillListUI();
      }
    });

    // Save/Add Tower CRUD in Editor
    document.getElementById('ed-tower-save-btn')?.addEventListener('click', () => {
      if (!this.editor.isAuth()) return;
      const id = (document.getElementById('ed-tower-id') as HTMLInputElement).value;
      const name = (document.getElementById('ed-tower-name') as HTMLInputElement).value;
      const cost = (document.getElementById('ed-tower-cost') as HTMLInputElement).value;
      const range = parseFloat((document.getElementById('ed-tower-range') as HTMLInputElement).value);
      const damage = (document.getElementById('ed-tower-damage') as HTMLInputElement).value;
      const fireRate = parseFloat((document.getElementById('ed-tower-firerate') as HTMLInputElement).value);

      if (!id || !name) return;

      const newTower: TowerDefinition = {
        id,
        name,
        cost: cost || '100',
        range: range || 150,
        damage: damage || '50',
        fireRate: fireRate || 1.0,
        unlockedByDefault: true,
        unlockLevelRequired: 0,
        canDetectStealth: false,
        canPierceArmor: false,
        sprite: `assets/tower_${id}.png`,
        description: name
      };

      if (this.editor.getTowers().some(t => t.id === id)) {
        this.editor.updateTower(newTower);
      } else {
        this.editor.addTower(newTower);
      }
      this.renderEditorTowerListUI();
      this.updateTowerArsenalUI();
    });

    // Save/Add Skill CRUD in Editor
    document.getElementById('ed-skill-save-btn')?.addEventListener('click', () => {
      if (!this.editor.isAuth()) return;
      const treeSelect = document.getElementById('ed-tree-select') as HTMLSelectElement;
      const treeId = treeSelect.value;
      const id = (document.getElementById('ed-skill-id') as HTMLInputElement).value;
      const name = (document.getElementById('ed-skill-name') as HTMLInputElement).value;
      const desc = (document.getElementById('ed-skill-desc') as HTMLInputElement).value;
      const cost = (document.getElementById('ed-skill-cost') as HTMLInputElement).value;

      if (!id || !name) return;

      const currency = treeId === 'normal' ? 'coins' : treeId === 'prestige_1' ? 'crystals' : treeId === 'prestige_2' ? 'diamonds' : 'dark_orbs';
      const skillNode: SkillDefinition = {
        id,
        name,
        description: desc || name,
        cost: cost || '10',
        currency,
        requires: [],
        statBonus: { damageMultiplier: 0.2, rangeBonus: 5, fireRateBonus: 0.1 },
        icon: 'assets/skill_icon.png'
      };

      const tree = this.editor.getSkillTree(treeId);
      if (tree && tree.skills.some(s => s.id === id)) {
        this.editor.updateSkill(treeId, skillNode);
      } else {
        this.editor.addSkill(treeId, skillNode);
      }
      this.renderEditorSkillListUI();
    });

    document.getElementById('ed-tree-select')?.addEventListener('change', () => {
      this.renderEditorSkillListUI();
    });

    // Editor Export JSONs
    document.getElementById('export-levels-btn')?.addEventListener('click', () => {
      this.downloadJSON('levels.json', this.editor.exportLevelsJSON());
    });
    document.getElementById('export-towers-btn')?.addEventListener('click', () => {
      this.downloadJSON('towers.json', this.editor.exportTowersJSON());
    });
    document.getElementById('export-enemies-btn')?.addEventListener('click', () => {
      this.downloadJSON('enemies.json', this.editor.exportEnemiesJSON());
    });
    document.getElementById('export-skills-btn')?.addEventListener('click', () => {
      this.downloadJSON('skilltrees.json', this.editor.exportSkillTreesJSON());
    });

    // Save & Prestige
    document.getElementById('export-save-btn')?.addEventListener('click', () => {
      (document.getElementById('save-json-text') as HTMLTextAreaElement).value = this.progression.exportSaveState();
    });

    document.getElementById('import-save-btn')?.addEventListener('click', () => {
      const text = (document.getElementById('save-json-text') as HTMLTextAreaElement).value;
      if (this.progression.importSaveState(text)) {
        this.updateCurrencyDisplay();
        this.updateTowerArsenalUI();
      }
    });

    document.getElementById('prestige-1-btn')?.addEventListener('click', () => {
      if (this.progression.performPrestige(1)) {
        this.updateCurrencyDisplay();
      }
    });
    document.getElementById('prestige-2-btn')?.addEventListener('click', () => {
      if (this.progression.performPrestige(2)) {
        this.updateCurrencyDisplay();
      }
    });
    document.getElementById('prestige-3-btn')?.addEventListener('click', () => {
      if (this.progression.performPrestige(3)) {
        this.updateCurrencyDisplay();
      }
    });

    document.getElementById('skill-tree-select')?.addEventListener('change', () => {
      this.renderSkillTreeUI();
    });
  }

  private renderEditorTowerListUI(): void {
    const list = document.getElementById('editor-tower-list');
    if (!list) return;
    list.innerHTML = '';

    this.editor.getTowers().forEach(tower => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div><strong>${tower.name}</strong> (${tower.id}) - Cost: ${tower.cost}</div>
        <button class="btn btn-danger ed-del-tower-btn" style="padding: 2px 8px; font-size: 0.8rem;">Delete</button>
      `;

      row.querySelector('.ed-del-tower-btn')?.addEventListener('click', () => {
        this.editor.deleteTower(tower.id);
        this.renderEditorTowerListUI();
        this.updateTowerArsenalUI();
      });

      list.appendChild(row);
    });
  }

  private renderEditorSkillListUI(): void {
    const list = document.getElementById('ed-skill-list');
    const treeSelect = document.getElementById('ed-tree-select') as HTMLSelectElement;
    if (!list || !treeSelect) return;

    list.innerHTML = '';
    const treeId = treeSelect.value;
    const tree = this.editor.getSkillTree(treeId);
    if (!tree) return;

    tree.skills.forEach(skill => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div><strong>${skill.name}</strong> (${skill.id}) - Cost: ${skill.cost}</div>
        <button class="btn btn-danger ed-del-skill-btn" style="padding: 2px 8px; font-size: 0.8rem;">Delete</button>
      `;

      row.querySelector('.ed-del-skill-btn')?.addEventListener('click', () => {
        this.editor.deleteSkill(treeId, skill.id);
        this.renderEditorSkillListUI();
      });

      list.appendChild(row);
    });
  }

  private downloadJSON(filename: string, text: string): void {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private setupEventListeners(): void {
    this.eventBus.on('engine:enemyKilled', (data: any) => {
      this.progression.addCoins(data.reward);
      this.updateCurrencyDisplay();
    });

    this.eventBus.on('engine:levelCleared', (data: any) => {
      this.progression.addCoins(data.rewardCoins);
      if (data.flawless) {
        const nextLevelId = data.levelId + 1;
        this.progression.unlockLevel(nextLevelId);
        this.towers.forEach(t => {
          if (t.unlockLevelRequired <= data.levelId) {
            this.progression.unlockTower(t.id);
          }
        });
        this.updateTowerArsenalUI();
      }
      this.updateCurrencyDisplay();
    });

    this.eventBus.on('engine:levelFailed', () => {
      this.errorPipeline.handleError('LEVEL_FAILED', 'Base was destroyed! Round reset.');
    });
  }

  private updateCurrencyDisplay(): void {
    document.getElementById('coins-display')!.textContent = this.progression.getCoins().toFormattedString();
    document.getElementById('crystals-display')!.textContent = this.progression.getCrystals().toFormattedString();
    document.getElementById('diamonds-display')!.textContent = this.progression.getDiamonds().toFormattedString();
    document.getElementById('dark-orbs-display')!.textContent = this.progression.getDarkOrbs().toFormattedString();
    document.getElementById('prestige-display')!.textContent = this.progression.getPrestigeTier().toString();
  }

  private updateTowerArsenalUI(): void {
    const list = document.getElementById('tower-list');
    if (!list) return;
    list.innerHTML = '';

    const unlocked = this.progression.getUnlockedTowers();
    this.towers.forEach(t => {
      if (unlocked.includes(t.id)) {
        const card = document.createElement('div');
        card.className = `tower-card ${this.selectedTowerType === t.id ? 'selected' : ''}`;
        card.innerHTML = `
          <strong>${t.name}</strong>
          <div>🪙 ${new BigNumber(t.cost).toFormattedString()}</div>
        `;
        card.addEventListener('click', () => {
          this.selectedTowerType = t.id;
          this.updateTowerArsenalUI();
        });
        list.appendChild(card);
      }
    });
  }

  private updateTowerControlsUI(tower: PlacedTower): void {
    const controls = document.getElementById('tower-controls');
    if (controls) {
      controls.style.display = 'block';
      (document.getElementById('angle-input') as HTMLInputElement).value = tower.directionAngle.toString();
      (document.getElementById('spread-input') as HTMLInputElement).value = tower.spreadAngle.toString();
      document.getElementById('angle-val')!.textContent = tower.directionAngle.toString();
      document.getElementById('spread-val')!.textContent = tower.spreadAngle.toString();
    }
  }

  private renderSkillTreeUI(): void {
    const treeSelect = document.getElementById('skill-tree-select') as HTMLSelectElement;
    const grid = document.getElementById('skill-tree-grid');
    if (!treeSelect || !grid) return;

    const treeId = treeSelect.value;
    const tree = this.editor.getSkillTree(treeId);
    if (!tree) return;

    grid.innerHTML = '';
    const purchased = new Set(this.progression.getPurchasedSkills());

    tree.skills.forEach(skill => {
      const isPurchased = purchased.has(skill.id);
      const prereqsMet = skill.requires.every(req => purchased.has(req));

      let statusClass = 'locked';
      if (isPurchased) {
        statusClass = 'unlocked';
      } else if (prereqsMet) {
        statusClass = 'available';
      }

      const node = document.createElement('div');
      node.className = `skill-node ${statusClass}`;

      const reqText = skill.requires.length > 0 ? skill.requires.join(', ') : 'None (Root)';

      node.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>${skill.name}</strong>
          <span class="prereq-tag">Req: ${reqText}</span>
        </div>
        <p style="font-size: 0.8rem; color: #aaa;">${skill.description}</p>
        <div style="font-size: 0.85rem; font-weight: bold;">Cost: ${new BigNumber(skill.cost).toFormattedString()} ${skill.currency}</div>
        ${!isPurchased ? `<button class="btn buy-skill-btn" ${!prereqsMet ? 'disabled style="opacity: 0.5;"' : ''} style="padding: 4px 8px; font-size: 0.8rem; margin-top: 4px;">Unlock</button>` : '<span style="color:#4caf50; font-size:0.8rem;">Unlocked</span>'}
      `;

      if (!isPurchased && prereqsMet) {
        node.querySelector('.buy-skill-btn')?.addEventListener('click', () => {
          if (this.progression.purchaseSkill(skill.id)) {
            this.updateCurrencyDisplay();
            this.renderSkillTreeUI();
          }
        });
      }

      grid.appendChild(node);
    });
  }

  private gameLoop(currentTime: number): void {
    const deltaTime = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    this.engine.update(deltaTime, currentTime / 1000);

    const curHp = this.engine.getCurrentBaseHealth().toFormattedString();
    const maxHp = this.engine.getMaxBaseHealth().toFormattedString();
    const hpElem = document.getElementById('base-hp-display');
    if (hpElem) hpElem.textContent = `${curHp} / ${maxHp}`;

    this.renderer.render(this.selectedPlacedTowerId);

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
