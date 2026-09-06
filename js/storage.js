'use strict';
/* ============================================================
   SKYBOUND · storage.js — local persistence (no backend)
   ============================================================ */
const Save = {
  KEY: 'skybound.save.v1',
  data: {
    best: 0,
    totalFeathers: 0,
    sound: true,
    music: true,
    shake: true,
    fx: true
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const k in this.data) {
          if (parsed[k] !== undefined) this.data[k] = parsed[k];
        }
      }
    } catch (e) { /* private mode / corrupted — defaults stand */ }
    return this.data;
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); }
    catch (e) { /* storage unavailable — game still fully playable */ }
  },

  submitRun(score, feathers) {
    const isRecord = score > this.data.best;
    if (isRecord) this.data.best = score;
    this.data.totalFeathers += feathers;
    this.save();
    return isRecord;
  }
};
Save.load();
