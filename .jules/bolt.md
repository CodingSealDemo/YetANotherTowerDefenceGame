## 2025-02-19 - GameEngine Tick Loop Optimization
**Learning:** `GameEngine.update()` runs 60 times/sec. Recalculating skill bonuses on every tick allocated new `BigNumber` instances and iterated over sets/maps per tick. In addition, nested inner loops in `findTargetsInCone` and `updateStealthReveals` repeated Map lookups (`towerDefs.get`) and `range * range` multiplications per active enemy.
**Action:** Cache skill stat calculations when level/skills change, short-circuit stealth detection when no stealth enemies are present, and hoist constant calculations and lookups outside inner loops.
