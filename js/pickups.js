'use strict';
/* ============================================================
   SKYBOUND · pickups.js — glowing feathers, power-up orbs,
   and crystal-storm shards. Magnet attraction included.
   ============================================================ */
const PU_KINDS = {
  shield: { color: '#9fd8ff', label: 'SKY SHIELD',  dur: 0 },      // consumed on hit
  warp:   { color: '#b28fff', label: 'TIME WARP',   dur: 5 },
  magnet: { color: '#7fe3da', label: 'FEATHER MAGNET', dur: 8 },
  boost:  { color: '#ffc857', label: 'SCORE BOOST', dur: 8 }
};

class PickupManager {
  constructor(game) { this.game = game; this.reset(); }

  reset() {
    this.feathers = [];
    this.powerups = [];
    this.shards = [];
    this.featherTimer = 1.6;
    this.powerupTimer = rand(9, 15);
    this.shardStormT = 0;
    this.shardSpawnT = 0;
  }

  startShardStorm(dur) { this.shardStormT = dur; }

  _gapAnchorY() {
    // place collectibles along the safest current corridor
    const g = this.game;
    let best = null;
    for (const ob of g.obstacles.obs) {
      if (ob.x > g.w * 0.5 && ob.x < g.w * 2.2) { best = ob; break; }
    }
    if (best) return best.gapY + rand(-best.gapH * 0.28, best.gapH * 0.28);
    return rand(g.h * 0.25, g.h * 0.7);
  }

  spawnFeatherPattern() {
    const g = this.game, S = g.S;
    const x0 = g.w + 60 * S;
    const y0 = this._gapAnchorY();
    const pattern = pick(['line', 'arc', 'diamond']);
    const add = (x, y) => this.feathers.push({ x, y, ph: rand(TAU), t: 0 });
    if (pattern === 'line') {
      const n = randInt(3, 5);
      for (let i = 0; i < n; i++) add(x0 + i * 46 * S, y0 + Math.sin(i * 0.9) * 26 * S);
    } else if (pattern === 'arc') {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        add(x0 + (i - 2) * 44 * S, y0 - t * t * 150 * S + 40 * S);
      }
    } else {
      add(x0, y0);
      add(x0 - 40 * S, y0 - 34 * S);
      add(x0 - 40 * S, y0 + 34 * S);
      add(x0 - 80 * S, y0);
    }
  }

  spawnPowerup() {
    const g = this.game, S = g.S;
    const kind = pick(Object.keys(PU_KINDS));
    this.powerups.push({
      x: g.w + 60 * S, y: clamp(this._gapAnchorY(), 90 * S, g.h - 90 * S),
      kind, ph: rand(TAU)
    });
  }

  update(dt, speed) {
    const g = this.game, S = g.S, p = g.player;
    const magnetR = 300 * S;
    const magnetOn = g.puMagnet > 0;

    // spawning only during active flight
    if (g.state === 'playing') {
      const golden = g.goldenT > 0;
      this.featherTimer -= dt * (golden ? 2.6 : 1);
      if (this.featherTimer <= 0) {
        this.featherTimer = rand(2.2, 3.6);
        this.spawnFeatherPattern();
      }
      this.powerupTimer -= dt;
      if (this.powerupTimer <= 0) {
        this.powerupTimer = rand(14, 22);
        this.spawnPowerup();
      }
      if (this.shardStormT > 0) {
        this.shardStormT -= dt;
        this.shardSpawnT -= dt;
        if (this.shardSpawnT <= 0) {
          this.shardSpawnT = 0.45;
          this.shards.push({
            x: rand(g.w + 40 * S, g.w + 260 * S), y: rand(-40, g.h * 0.3),
            vy: rand(140, 260) * S, vx: -speed * 0.4, ph: rand(TAU)
          });
        }
      }
    }

    // feathers drift + magnet + collect
    for (let i = this.feathers.length - 1; i >= 0; i--) {
      const f = this.feathers[i];
      f.t += dt;
      f.x -= speed * dt;
      f.y += Math.sin(f.t * 2.4 + f.ph) * 12 * S * dt;
      if (magnetOn) {
        const dx = p.x - f.x, dy = p.y - f.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < magnetR * magnetR) {
          const d = Math.sqrt(d2) || 1;
          const pull = 900 * S * (1 - d / magnetR);
          f.x += (dx / d) * pull * dt;
          f.y += (dy / d) * pull * dt;
        }
      }
      if (f.x < -40 * S) { this.feathers.splice(i, 1); continue; }
      const dx = p.x - f.x, dy = p.y - f.y;
      const cr = (18 + p.r) * S;
      if (p.alive && dx * dx + dy * dy < cr * cr) {
        this.feathers.splice(i, 1);
        g.onFeather(f.x, f.y);
      }
    }

    // powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const u = this.powerups[i];
      u.t = (u.t || 0) + dt;
      u.x -= speed * dt;
      u.y += Math.sin(u.t * 1.8 + u.ph) * 10 * S * dt;
      if (u.x < -60 * S) { this.powerups.splice(i, 1); continue; }
      const dx = p.x - u.x, dy = p.y - u.y;
      const cr = (20 + p.r) * S;
      if (p.alive && dx * dx + dy * dy < cr * cr) {
        this.powerups.splice(i, 1);
        g.onPowerup(u.kind, u.x, u.y);
      }
    }

    // crystal storm shards
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.t = (s.t || 0) + dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx = lerp(s.vx, -speed, dt * 2);
      if (s.y > g.h + 40 * S || s.x < -40 * S) { this.shards.splice(i, 1); continue; }
      if (magnetOn) {
        const dx = p.x - s.x, dy = p.y - s.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < magnetR * magnetR * 0.6) {
          const d = Math.sqrt(d2) || 1;
          s.x += (dx / d) * 700 * S * dt;
          s.y += (dy / d) * 700 * S * dt;
        }
      }
      const dx = p.x - s.x, dy = p.y - s.y;
      const cr = (16 + p.r) * S;
      if (p.alive && dx * dx + dy * dy < cr * cr) {
        this.shards.splice(i, 1);
        g.onFeather(s.x, s.y, true);
      }
    }
  }

  draw(ctx) {
    const g = this.game, S = g.S;
    // feathers
    for (const f of this.feathers) {
      if (f.x < -30 || f.x > g.w + 80 * S) continue;
      const bob = Math.sin(f.t * 2.4 + f.ph);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(0.5 + bob * 0.3);
      // glow
      ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(0, 0, 1 * S, 0, 0, 16 * S);
      const a = 0.5 + bob * 0.18;
      gg.addColorStop(0, 'rgba(190,250,244,' + a.toFixed(2) + ')');
      gg.addColorStop(1, 'rgba(95,216,232,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(0, 0, 16 * S, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // vane
      const vg = ctx.createLinearGradient(0, -12 * S, 0, 10 * S);
      vg.addColorStop(0, '#eafffb');
      vg.addColorStop(1, '#5fd8e8');
      ctx.fillStyle = vg;
      ctx.beginPath();
      ctx.moveTo(0, 10 * S);
      ctx.quadraticCurveTo(-7 * S, 2 * S, -4.5 * S, -7 * S);
      ctx.quadraticCurveTo(-2 * S, -12 * S, 0, -12 * S);
      ctx.quadraticCurveTo(2 * S, -12 * S, 4.5 * S, -7 * S);
      ctx.quadraticCurveTo(7 * S, 2 * S, 0, 10 * S);
      ctx.closePath();
      ctx.fill();
      // spine
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.1 * S;
      ctx.beginPath(); ctx.moveTo(0, 10 * S); ctx.lineTo(0, -11 * S); ctx.stroke();
      ctx.restore();
    }

    // power-up orbs
    for (const u of this.powerups) {
      if (u.x < -50 || u.x > g.w + 90 * S) continue;
      const cfg = PU_KINDS[u.kind];
      const rgb = hexRGB(cfg.color);
      const pulse = 0.8 + Math.sin(u.t * 4) * 0.2;
      ctx.save();
      ctx.translate(u.x, u.y);
      // glow
      ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(0, 0, 4 * S, 0, 0, 26 * S);
      gg.addColorStop(0, rgbaStr(rgb, 0.55 * pulse));
      gg.addColorStop(1, rgbaStr(rgb, 0));
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(0, 0, 26 * S, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // orb shell
      const og = ctx.createRadialGradient(-4 * S, -5 * S, 2 * S, 0, 0, 15 * S);
      og.addColorStop(0, '#ffffff');
      og.addColorStop(0.35, cfg.color);
      og.addColorStop(1, rgbaStr(rgb, 0.85));
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(0, 0, 14 * S, 0, TAU); ctx.fill();
      // rotating ring
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.6 * S;
      ctx.setLineDash([6 * S, 5 * S]);
      ctx.lineDashOffset = -u.t * 30 * S;
      ctx.beginPath(); ctx.arc(0, 0, 18 * S, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      // icon
      ctx.fillStyle = 'rgba(10,30,50,0.85)';
      this._icon(ctx, u.kind, S);
      ctx.restore();
    }

    // crystal storm shards
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.shards) {
      if (s.x < -30 || s.x > g.w + 60 * S) continue;
      const a = 0.6 + Math.sin(s.t * 5 + s.ph) * 0.3;
      ctx.fillStyle = 'rgba(140,240,255,' + a.toFixed(2) + ')';
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.t * 3 + s.ph);
      ctx.beginPath();
      ctx.moveTo(0, -7 * S); ctx.lineTo(4.4 * S, 0); ctx.lineTo(0, 7 * S); ctx.lineTo(-4.4 * S, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  _icon(ctx, kind, S) {
    ctx.lineWidth = 1.8 * S;
    ctx.strokeStyle = 'rgba(10,30,50,0.85)';
    ctx.fillStyle = 'rgba(10,30,50,0.85)';
    if (kind === 'shield') {
      ctx.beginPath();
      ctx.moveTo(0, -6.5 * S);
      ctx.lineTo(5.5 * S, -4 * S);
      ctx.lineTo(5.5 * S, 1.5 * S);
      ctx.quadraticCurveTo(5.5 * S, 5.5 * S, 0, 7 * S);
      ctx.quadraticCurveTo(-5.5 * S, 5.5 * S, -5.5 * S, 1.5 * S);
      ctx.lineTo(-5.5 * S, -4 * S);
      ctx.closePath();
      ctx.stroke();
    } else if (kind === 'warp') {
      ctx.beginPath(); ctx.arc(0, 0, 6.5 * S, 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -4.2 * S);
      ctx.moveTo(0, 0); ctx.lineTo(3.4 * S, 1.6 * S);
      ctx.stroke();
    } else if (kind === 'magnet') {
      ctx.beginPath();
      ctx.arc(0, -1 * S, 5 * S, Math.PI * 0.15, Math.PI * 0.85, true);
      ctx.stroke();
      ctx.fillRect(-6.2 * S, -2.4 * S, 2.6 * S, 5 * S);
      ctx.fillRect(3.6 * S, -2.4 * S, 2.6 * S, 5 * S);
    } else if (kind === 'boost') {
      ctx.beginPath();
      ctx.moveTo(0, -7 * S);
      ctx.lineTo(1.8 * S, -1.8 * S);
      ctx.lineTo(7 * S, 0);
      ctx.lineTo(1.8 * S, 1.8 * S);
      ctx.lineTo(0, 7 * S);
      ctx.lineTo(-1.8 * S, 1.8 * S);
      ctx.lineTo(-7 * S, 0);
      ctx.lineTo(-1.8 * S, -1.8 * S);
      ctx.closePath();
      ctx.fill();
    }
  }
}
