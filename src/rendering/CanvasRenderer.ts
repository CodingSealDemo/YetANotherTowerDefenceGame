import { GameEngine } from '../engine/GameEngine';
import { BezierPath } from '../engine/BezierPath';
import { PlacedTower, ActiveEnemy } from '../models/GameModels';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: GameEngine;
  private spriteCache: Map<string, HTMLImageElement> = new Map();

  constructor(canvas: HTMLCanvasElement, engine: GameEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.engine = engine;
  }

  public preloadImage(src: string): Promise<HTMLImageElement> {
    if (this.spriteCache.has(src)) {
      return Promise.resolve(this.spriteCache.get(src)!);
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        this.spriteCache.set(src, img);
        resolve(img);
      };
      img.onerror = () => {
        this.spriteCache.set(src, img);
        resolve(img);
      };
    });
  }

  public render(selectedTowerId?: string | null): void {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    this.renderTerrain(width, height);

    const path = this.engine.getPath();
    if (path) {
      this.renderPath(path);
    }

    const towers = this.engine.getPlacedTowers();
    for (const tower of towers) {
      this.renderTower(tower, tower.id === selectedTowerId);
    }

    const enemies = this.engine.getActiveEnemies();
    for (const enemy of enemies) {
      this.renderEnemy(enemy);
    }
  }

  private renderTerrain(width: number, height: number): void {
    const grad = this.ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, width);
    grad.addColorStop(0, '#2e5d32');
    grad.addColorStop(1, '#1b381e');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, width, height);
  }

  private renderPath(path: BezierPath): void {
    const points = path.getSampledPoints();
    if (points.length < 2) return;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.strokeStyle = 'rgba(210, 180, 140, 0.4)';
    this.ctx.lineWidth = 44;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.strokeStyle = '#c2a682';
    this.ctx.lineWidth = 30;
    this.ctx.stroke();
    this.ctx.restore();
  }

  private renderTower(tower: PlacedTower, isSelected: boolean): void {
    const { x, y, directionAngle, spreadAngle, typeId } = tower;
    const size = 36;

    this.ctx.save();
    this.ctx.translate(x, y);

    // Draw Attack Cone Area
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    const startRad = ((directionAngle - spreadAngle / 2) * Math.PI) / 180;
    const endRad = ((directionAngle + spreadAngle / 2) * Math.PI) / 180;
    this.ctx.arc(0, 0, 150, startRad, endRad);
    this.ctx.closePath();
    this.ctx.fillStyle = isSelected ? 'rgba(0, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)';
    this.ctx.fill();
    this.ctx.strokeStyle = isSelected ? '#00ffff' : 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.restore();

    if (isSelected) {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, size / 2 + 6, 0, Math.PI * 2);
      this.ctx.strokeStyle = '#00ffff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    // Render Tower PNG Sprite if available
    const spritePath = `assets/tower_${typeId}.png`;
    const spriteImg = this.spriteCache.get(spritePath);

    if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
      this.ctx.drawImage(spriteImg, -size / 2, -size / 2, size, size);
    } else {
      this.preloadImage(spritePath);
      this.ctx.beginPath();
      this.ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      this.ctx.fillStyle = '#4a90e2';
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    // Direction Cannon Barrel Indicator
    const dirRad = (directionAngle * Math.PI) / 180;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(Math.cos(dirRad) * (size / 2 + 10), Math.sin(dirRad) * (size / 2 + 10));
    this.ctx.strokeStyle = '#ff3366';
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    this.ctx.restore();
  }

  private renderEnemy(enemy: ActiveEnemy): void {
    const { x, y, isStealth, isRevealed, isReinforced, typeId } = enemy;
    const size = 26;

    this.ctx.save();
    this.ctx.translate(x, y);

    if (isStealth && !isRevealed) {
      this.ctx.globalAlpha = 0.3;
    }

    const spritePath = `assets/enemy_${typeId}.png`;
    const spriteImg = this.spriteCache.get(spritePath);

    if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
      this.ctx.drawImage(spriteImg, -size / 2, -size / 2, size, size);
    } else {
      this.preloadImage(spritePath);
      this.ctx.beginPath();
      this.ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      if (isReinforced) {
        this.ctx.fillStyle = '#7f8c8d';
      } else if (isStealth) {
        this.ctx.fillStyle = '#9b59b6';
      } else {
        this.ctx.fillStyle = '#e74c3c';
      }
      this.ctx.fill();
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    // Health Bar
    const hpRatio = Math.max(0, enemy.currentHealth.div(enemy.maxHealth).toNumber());
    const barWidth = 28;
    const barHeight = 4;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.fillRect(-barWidth / 2, -size / 2 - 8, barWidth, barHeight);
    this.ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.2 ? '#f1c40f' : '#e74c3c';
    this.ctx.fillRect(-barWidth / 2, -size / 2 - 8, barWidth * hpRatio, barHeight);

    this.ctx.restore();
  }
}
