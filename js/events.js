'use strict';
/* ============================================================
   SKYBOUND · events.js — special moments: SKY RUSH, WIND ZONE,
   CRYSTAL STORM, GOLDEN SKY. Uncommon, announced, always fair.
   ============================================================ */
const EVENT_DEFS = {
  rush:   { title: 'SKY RUSH',      sub: 'HOLD STEADY',      w: 3 },
  wind:   { title: 'WIND ZONE',     sub: 'RIDE THE GUST',    w: 3 },
  storm:  { title: 'CRYSTAL STORM', sub: 'CATCH THE SHARDS', w: 2.5 },
  golden: { title: 'GOLDEN SKY',    sub: 'DOUBLE FEATHERS',  w: 1.5 }
};

class EventsManager {
  constructor(game) { this.game = game; this.reset(); }

  reset() {
    this.active = null;
    this.nextT = rand(20, 30);
  }

  update(dt) {
    const g = this.game;
    if (this.active) {
      this.active.t += dt;
      if (this.active.type === 'wind') {
        // breathing gust, announced direction
        const s = this.active.strength;
        g.windY = Math.sin(this.active.t * 1.6) * s * 0.6 + Math.sin(this.active.t * 3.7) * s * 0.25;
        if (Save.data.fx && Math.random() < 0.4) {
          g.particles.spawn({
            x: rand(g.w), y: rand(g.h),
            vx: -g.speed * 1.6, vy: rand(-30, 30),
            life: 0.5, size: 1.6, sizeEnd: 0.4, r: 200, g: 235, b: 255, alpha: 0.5, shape: 'spark'
          });
        }
      }
      if (this.active.t >= this.active.dur) this.end();
    } else if (g.state === 'playing') {
      this.nextT -= dt;
      if (this.nextT <= 0) this.start();
    }
  }

  start() {
    const g = this.game;
    // weighted pick
    let total = 0;
    for (const k in EVENT_DEFS) total += EVENT_DEFS[k].w;
    let r = Math.random() * total, type = 'rush';
    for (const k in EVENT_DEFS) { r -= EVENT_DEFS[k].w; if (r <= 0) { type = k; break; } }
    const def = EVENT_DEFS[type];
    const dur = type === 'golden' ? rand(9, 13) : rand(7, 11);
    this.active = { type, t: 0, dur };

    if (type === 'rush') g.speedMult = 1.45;
    if (type === 'wind') {
      this.active.strength = (Math.random() < 0.5 ? -1 : 1) * rand(230, 320) * g.S;
    }
    if (type === 'storm') g.pickups.startShardStorm(dur);
    if (type === 'golden') g.goldenT = dur;

    g.ui.banner(def.title, def.sub);
    g.audio.event();
  }

  end() {
    const g = this.game;
    if (this.active && this.active.type === 'rush') g.speedMult = 1;
    if (this.active && this.active.type === 'wind') g.windY = 0;
    this.active = null;
    this.nextT = rand(24, 38);
  }
}