'use strict';
/* ============================================================
   SKYBOUND · score.js — score, combo multiplier, milestones.
   Bird speed stays constant; +36px/s for every 1000 points.
   ============================================================ */
class ScoreSystem {
  constructor(game) {
    this.game = game;
    this.best = Save.data.best;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.feathers = 0;
    this.combo = 0;
    this.comboT = 0;
    this.lastMilestone = 0;
  }

  get mult() { return 1 + Math.min(4, Math.floor(this.combo / 4)); }

  addPass() {
    this.combo++;
    this.comboT = 6; // chain window: 6s between gates keeps the combo
    const gained = 10 * this.mult;
    this.score += gained;
    return gained;
  }

  breakCombo() { this.combo = 0; this.comboT = 0; }

  addFeather(mult = 1) {
    this.feathers += mult;
    this.score += 2 * mult;
  }

  update(dt) {
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) { this.comboT = 0; this.combo = 0; }
    }
  }

  /* World scroll speed — constant between 1000-point milestones */
  speedFor(S) {
    const step = Math.floor(this.score / 1000);
    return Math.min(520, 258 + step * 36) * S;
  }

  /* Returns milestone number when a new 1000-point tier begins */
  milestone() {
    const m = Math.floor(this.score / 1000);
    if (m > this.lastMilestone) {
      this.lastMilestone = m;
      return m;
    }
    return 0;
  }
}
