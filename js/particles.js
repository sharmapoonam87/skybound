'use strict';
/* ============================================================
   SKYBOUND · particles.js — pooled particle system + floating text
   Hard-bounded pool keeps long sessions at 60fps.
   ============================================================ */
class ParticleSystem {
  constructor(game) {
    this.game = game;
    this.active = [];
    this.pool = [];
    this.max = () => Save.data.fx ? 560 : 240;
    this.texts = [];
  }

  _get() {
    const p = this.pool.length ? this.pool.pop() : {};
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.life = 1; p.maxLife = 1;
    p.size = 3; p.sizeEnd = 0; p.rot = 0; p.vr = 0;
    p.r = 255; p.g = 255; p.b = 255; p.alpha = 1;
    p.grav = 0; p.drag = 0; p.shape = 'dot'; p.add = true;
    return p;
  }

  spawn(o) {
    if (this.active.length >= this.max()) return;
    const p = this._get();
    Object.assign(p, o);
    p.maxLife = p.life;
    this.active.push(p);
  }

  /* Radial burst */
  burst(x, y, { count = 12, color = '#ffffff', speed = 160, spread = TAU, dir = 0, life = 0.7, size = 3.2, grav = 0, drag = 2.4, shape = 'dot', add = true, sizeEnd = 0 } = {}) {
    const rgb = hexRGB(color);
    const n = Save.data.fx ? count : Math.ceil(count * 0.5);
    for (let i = 0; i < n; i++) {
      const a = dir + (spread === TAU ? rand(TAU) : rand(-spread / 2, spread / 2));
      const sp = speed * rand(0.35, 1.15);
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: life * rand(0.7, 1.25), size: size * rand(0.6, 1.3), sizeEnd,
        r: rgb[0], g: rgb[1], b: rgb[2], grav, drag, shape, add,
        rot: rand(TAU), vr: rand(-6, 6)
      });
    }
  }

  /* Soft wing-flap puff */
  puff(x, y, scale = 1) {
    this.burst(x, y + 6 * scale, {
      count: 6, color: '#ffffff', speed: 60 * scale, life: 0.5,
      size: 5 * scale, sizeEnd: 12 * scale, drag: 3, add: false, grav: 30
    });
  }

  /* Golden celebration rain (new record) */
  confetti(w, h) {
    const colors = ['#ffc857', '#ff8f5e', '#7fe3da', '#9fd8ff', '#ff6fa0'];
    for (let i = 0; i < (Save.data.fx ? 90 : 40); i++) {
      const c = hexRGB(pick(colors));
      this.spawn({
        x: rand(w), y: rand(-h * 0.3, 0),
        vx: rand(-40, 40), vy: rand(80, 240),
        life: rand(1.6, 3.0), size: rand(3, 6), sizeEnd: 1,
        r: c[0], g: c[1], b: c[2], grav: 60, drag: 0.4,
        shape: 'feather', add: false, rot: rand(TAU), vr: rand(-8, 8)
      });
    }
  }

  text(x, y, str, color = '#ffffff', size = 18) {
    this.texts.push({ x, y, str, color, size: size * this.game.S, t: 0, life: 0.9 });
    if (this.texts.length > 14) this.texts.shift();
  }

  update(dt) {
    const a = this.active;
    for (let i = a.length - 1; i >= 0; i--) {
      const p = a[i];
      p.life -= dt;
      if (p.life <= 0) { a.splice(i, 1); this.pool.push(p); continue; }
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      if (t.t >= t.life) this.texts.splice(i, 1);
    }
  }

  draw(ctx) {
    const a = this.active;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      const lt = p.life / p.maxLife;
      const sz = lerp(p.sizeEnd || 0, p.size, lt);
      const al = p.alpha * Math.min(1, lt * 1.6);
      if (p.add !== true) continue;
      this._drawOne(ctx, p, sz, al, lt);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      if (p.add === true) continue;
      const lt = p.life / p.maxLife;
      const sz = lerp(p.sizeEnd || 0, p.size, lt);
      this._drawOne(ctx, p, sz, p.alpha * Math.min(1, lt * 1.6), lt);
    }
    this._drawTexts(ctx);
    ctx.globalAlpha = 1;
  }

  _drawOne(ctx, p, sz, al, lt) {
    ctx.globalAlpha = clamp(al, 0, 1);
    ctx.fillStyle = rgbaStr([p.r, p.g, p.b], 1);
    switch (p.shape) {
      case 'ring': {
        ctx.strokeStyle = rgbaStr([p.r, p.g, p.b], 1);
        ctx.lineWidth = Math.max(1, sz * 0.3 * lt);
        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, TAU); ctx.stroke();
        break;
      }
      case 'spark': {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillRect(-sz * 2.4, -sz * 0.28, sz * 4.8, sz * 0.56);
        ctx.restore();
        break;
      }
      case 'feather': {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, sz * 1.7, sz * 0.7, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        break;
      }
      default: {
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.4, sz), 0, TAU); ctx.fill();
      }
    }
  }

  _drawTexts(ctx) {
    if (!this.texts.length) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const lt = t.t / t.life;
      const al = lt < 0.15 ? lt / 0.15 : 1 - Math.pow((lt - 0.15) / 0.85, 2);
      ctx.globalAlpha = clamp(al, 0, 1);
      ctx.font = '700 ' + (t.size * (1 + (1 - Math.pow(1 - Math.min(1, t.t * 6), 2)) * 0.25)).toFixed(1) + 'px Righteous, "Trebuchet MS", sans-serif';
      ctx.strokeStyle = 'rgba(6,16,38,0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText(t.str, t.x, t.y - t.t * 52 * this.game.S);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y - t.t * 52 * this.game.S);
    }
  }
}
