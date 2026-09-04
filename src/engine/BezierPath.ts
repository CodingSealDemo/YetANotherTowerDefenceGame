import { Point } from '../models/GameModels';

export class BezierPath {
  private rawPoints: Point[];
  private sampledPoints: Point[] = [];
  private totalLength: number = 0;
  private segmentLengths: number[] = [];

  constructor(points: Point[]) {
    this.rawPoints = points;
    this.generateSpline();
  }

  private generateSpline(): void {
    if (this.rawPoints.length < 2) {
      this.sampledPoints = [...this.rawPoints];
      return;
    }

    const samplesPerSegment = 20;
    this.sampledPoints = [];

    for (let i = 0; i < this.rawPoints.length - 1; i++) {
      const p0 = this.rawPoints[Math.max(0, i - 1)];
      const p1 = this.rawPoints[i];
      const p2 = this.rawPoints[i + 1];
      const p3 = this.rawPoints[Math.min(this.rawPoints.length - 1, i + 2)];

      for (let t = 0; t < 1; t += 1 / samplesPerSegment) {
        this.sampledPoints.push(this.catmullRom(p0, p1, p2, p3, t));
      }
    }
    this.sampledPoints.push(this.rawPoints[this.rawPoints.length - 1]);

    this.totalLength = 0;
    this.segmentLengths = [0];
    for (let i = 1; i < this.sampledPoints.length; i++) {
      const dx = this.sampledPoints[i].x - this.sampledPoints[i - 1].x;
      const dy = this.sampledPoints[i].y - this.sampledPoints[i - 1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      this.totalLength += dist;
      this.segmentLengths.push(this.totalLength);
    }
  }

  private catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
    const t2 = t * t;
    const t3 = t2 * t;

    const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

    return { x, y };
  }

  public getTotalLength(): number {
    return this.totalLength;
  }

  public getPointAtDistance(distance: number): Point {
    if (distance <= 0) return this.sampledPoints[0];
    if (distance >= this.totalLength) return this.sampledPoints[this.sampledPoints.length - 1];

    let low = 0;
    let high = this.segmentLengths.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.segmentLengths[mid] < distance) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.max(1, low);
    const d0 = this.segmentLengths[idx - 1];
    const d1 = this.segmentLengths[idx];
    const p0 = this.sampledPoints[idx - 1];
    const p1 = this.sampledPoints[idx];

    const factor = (distance - d0) / (d1 - d0 || 1);
    return {
      x: p0.x + (p1.x - p0.x) * factor,
      y: p0.y + (p1.y - p0.y) * factor
    };
  }

  public getSampledPoints(): Point[] {
    return this.sampledPoints;
  }

  public getRawPoints(): Point[] {
    return this.rawPoints;
  }

  public isNearPath(x: number, y: number, minDistance: number = 25): boolean {
    for (let i = 0; i < this.sampledPoints.length; i++) {
      const p = this.sampledPoints[i];
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        return true;
      }
    }
    return false;
  }
}
