'use strict';
/* ============================================================
   SKYBOUND · player.js — "Lumivane", the mystical skybird.
   Layered feathered wings, glowing chest sigil, expressive eye.
   Physics: gravity / impulse / terminal velocity / smooth tilt.
   ============================================================ */
class Player {
  constructor(game) {
    this.game = game;
    this.trail = [];
    this.reset();
  }

  reset() {
    const g = this.game;
    this.x = g.w * 0.32;
    this.y = g.h * 0.44;
    this.vy = 0;
    this.rot = 0;
    this.wingPhase = rand(TAU);
    this.flapAnim = 0;
    this.bobT = rand(TAU);
    this.blinkT = rand(2.2, 4.5);
    this.blink = 0;
    this.hitFlash = 0;
    this.tumble = 0;
    this.alive = true;
    this.trail.length = 0;
  }

  get r() { return 13 * this.game.S; } // collision radius

  flap() {
    const g = this.game;
    this.vy = -470 * g.S;
    this.flapAnim = 1;
    this.wingPhase -= 0.9;
    g.audio.flap();
    g.particles.puff(this.x - 14 * g.S, this.y + 10 * g.S, g.S);
  }

  update(dt) {
    const g = this.game;
    this.bobT += dt;
    this.wingPhase += dt * (7 + this.flapAnim * 13);
    this.flapAnim = Math.max(0, this.flapAnim - dt * 3.4);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3);
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.13; this.blinkT = rand(2.2, 4.8); }
    this.blink = Math.max(0, this.blink - dt);

    if (this.alive) {
      // menu / ready hover
      if (g.state !== 'playing' && g.state !== 'over') {
        this.y = g.h * 0.44 + Math.sin(this.bobT * 2.1) * 16 * g.S;
        this.rot = damp(this.rot, Math.sin(this.bobT * 2.1 + 0.8) * 0.08, 8, dt);
        this.flapAnim = Math.max(this.flapAnim, 0.25 + Math.sin(this.bobT * 2.1) * 0.25);
        return;
      }
      // flight physics
      const grav = g.windY !== 0 ? 1650 * g.S : 1650 * g.S;
      this.vy += (grav + g.windY) * dt;
      const vmax = 880 * g.S;
      if (this.vy > vmax) this.vy = vmax;
      if (this.vy < -640 * g.S) this.vy = -640 * g.S;
      this.y += this.vy * dt;

      // smooth rotation: snappy up, heavy down
      const target = this.vy < 0
        ? -0.42 * Math.min(1, -this.vy / (470 * g.S))
        : Math.min(1.35, this.vy / (620 * g.S));
      this.rot = damp(this.rot, target, this.vy < 0 ? 11 : 7.5, dt);

      // speed trail under rush / dive / speed powers
      if ((g.speedMult > 1.2 || g.puSpeed > 0 || g.puPhantom > 0 || this.vy > 600 * g.S) && Save.data.fx) {
        this.trail.push({ x: this.x, y: this.y, a: 0.5 });
      }
      for (let i = this.trail.length - 1; i >= 0; i--) {
        this.trail[i].a -= dt * 2.2;
        if (this.trail[i].a <= 0) this.trail.splice(i, 1);
      }
      if (this.trail.length > 16) this.trail.splice(0, this.trail.length - 16);
    } else {
      // game-over tumble
      this.vy += 1900 * g.S * dt;
      this.y += this.vy * dt;
      this.x -= g.speed * 0.25 * dt * g.timeScale;
      this.tumble += dt * 5;
      this.rot = damp(this.rot, 2.4 + Math.sin(this.tumble) * 0.3, 4, dt);
      this.wingPhase += dt * 2;
    }
  }

  /* ---------------- rendering ---------------- */
  draw(ctx) {
    const g = this.game, u = g.S;
    // motion trail
    for (const t of this.trail) {
      ctx.globalAlpha = t.a * 0.35;
      ctx.fillStyle = '#7fe3da';
      ctx.beginPath(); ctx.arc(t.x - 6 * u, t.y, 10 * u * t.a + 3, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // magical aura
    const pulse = 0.16 + Math.sin(this.bobT * 4) * 0.05 + this.flapAnim * 0.1;
    const aura = ctx.createRadialGradient(this.x, this.y, 2 * u, this.x, this.y, 40 * u);
    aura.addColorStop(0, 'rgba(127,227,218,' + pulse.toFixed(3) + ')');
    aura.addColorStop(1, 'rgba(127,227,218,0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(this.x, this.y, 40 * u, 0, TAU); ctx.fill();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    const sq = 1 + this.flapAnim * 0.14;
    ctx.scale((2 - sq) * u, sq * u); // squash & stretch

    // GHOST / PHANTOM — spectral veil (bird phases through the world)
    const ghost = g.puGhost > 0 || g.puPhantom > 0;
    if (ghost) ctx.globalAlpha = 0.45;

    const flapA = -0.18 + Math.sin(this.wingPhase) * 0.5 - this.flapAnim * 1.15;
    this._tail(ctx, u);
    this._wing(ctx, u, flapA * 0.75 + 0.55, true);   // far wing
    this._body(ctx, u);
    this._head(ctx, u);
    this._wing(ctx, u, flapA, false);                 // near wing

    if (this.hitFlash > 0) {
      ctx.globalAlpha = this.hitFlash * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(0, 0, 26, 15, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // ghosty shimmer ring around the phase-shifted bird
    if (ghost) {
      const sa = 0.3 + Math.sin(this.bobT * 6) * 0.12;
      ctx.strokeStyle = 'rgba(170,190,255,' + sa.toFixed(3) + ')';
      ctx.lineWidth = 2 * u;
      ctx.setLineDash([10 * u, 8 * u]);
      ctx.lineDashOffset = -this.bobT * 30 * u;
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, 24 * u, 15 * u, 0, this.rot, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  _feather(ctx, len, wid) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.35, -wid, len * 0.82, -wid * 0.62);
    ctx.quadraticCurveTo(len * 1.06, -wid * 0.1, len * 0.7, wid * 0.3);
    ctx.quadraticCurveTo(len * 0.3, wid * 0.52, 0, 0);
    ctx.closePath();
  }

  _tail(ctx, u) {
    const wag = Math.sin(this.bobT * 5) * 0.1;
    ctx.save();
    ctx.translate(-18 * u, -1 * u);
    ctx.rotate(0.5 + wag);
    const cols = ['#1a7390', '#2596ae', '#31b2c6'];
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(-0.42 + i * 0.42);
      ctx.fillStyle = cols[i];
      this._feather(ctx, 20 * u, 5.5 * u);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  _wing(ctx, u, angle, far) {
    ctx.save();
    ctx.translate(far ? -3 * u : 1 * u, far ? -6 * u : -3 * u);
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(0, 0, -30 * u, -6 * u);
    if (far) { grad.addColorStop(0, '#1c89a4'); grad.addColorStop(1, '#115f78'); }
    else { grad.addColorStop(0, '#4fd0d4'); grad.addColorStop(1, '#1b829e'); }
    ctx.fillStyle = grad;
    const lens = far ? [20, 17, 13] : [27, 23, 18];
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(-0.3 + i * 0.3);
      this._feather(ctx, lens[i] * u, 7 * u);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = far ? 'rgba(16,80,100,0.9)' : 'rgba(53,199,216,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 0, 8 * u, 6 * u, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  _body(ctx, u) {
    const grad = ctx.createLinearGradient(0, -12 * u, 0, 12 * u);
    grad.addColorStop(0, '#6fe0da');
    grad.addColorStop(0.55, '#2fa9c4');
    grad.addColorStop(1, '#1b7292');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(17 * u, -5 * u);
    ctx.bezierCurveTo(20 * u, 2 * u, 10 * u, 10.5 * u, -2 * u, 10.5 * u);
    ctx.bezierCurveTo(-14 * u, 10.5 * u, -22 * u, 4 * u, -22 * u, -1 * u);
    ctx.bezierCurveTo(-22 * u, -7 * u, -12 * u, -11.5 * u, 0, -11.5 * u);
    ctx.bezierCurveTo(8 * u, -11.5 * u, 15 * u, -9.5 * u, 17 * u, -5 * u);
    ctx.closePath();
    ctx.fill();

    // pale belly
    ctx.fillStyle = '#e9fbf7';
    ctx.beginPath();
    ctx.moveTo(14 * u, 1 * u);
    ctx.bezierCurveTo(8 * u, 9 * u, -6 * u, 10.5 * u, -14 * u, 6 * u);
    ctx.bezierCurveTo(-8 * u, 4 * u, 2 * u, 4 * u, 14 * u, 1 * u);
    ctx.closePath();
    ctx.fill();

    // glowing chest sigil
    const gp = 0.7 + Math.sin(this.bobT * 5) * 0.3;
    const gg = ctx.createRadialGradient(3 * u, 2 * u, 0.5 * u, 3 * u, 2 * u, 6 * u);
    gg.addColorStop(0, 'rgba(255,255,255,' + gp.toFixed(2) + ')');
    gg.addColorStop(0.45, 'rgba(127,227,218,' + (gp * 0.85).toFixed(2) + ')');
    gg.addColorStop(1, 'rgba(53,199,216,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(3 * u, 2 * u, 6 * u, 0, TAU); ctx.fill();
    ctx.fillStyle = '#eafffb';
    ctx.beginPath(); ctx.arc(3 * u, 2 * u, 1.7 * u, 0, TAU); ctx.fill();
  }

  _head(ctx, u) {
    // crest feathers
    const sway = Math.sin(this.bobT * 4.5) * 0.12;
    ctx.save();
    ctx.translate(7 * u, -15 * u);
    ctx.rotate(-0.5 + sway);
    const cc = ['#7fe3da', '#4fc3d8', '#35a8c8'];
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(-0.34 + i * 0.34);
      ctx.fillStyle = cc[i];
      this._feather(ctx, 11 * u, 3.4 * u);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // head
    const hg = ctx.createRadialGradient(10 * u, -12 * u, 1 * u, 12 * u, -8 * u, 11 * u);
    hg.addColorStop(0, '#8feee6');
    hg.addColorStop(1, '#2fa0be');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(11 * u, -9 * u, 8.5 * u, 0, TAU); ctx.fill();

    // beak
    ctx.fillStyle = '#ffb64f';
    ctx.beginPath();
    ctx.moveTo(17.5 * u, -10.5 * u);
    ctx.lineTo(25 * u, -8.6 * u);
    ctx.lineTo(17.5 * u, -6.6 * u);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e08a2c';
    ctx.beginPath();
    ctx.moveTo(17.5 * u, -6.8 * u);
    ctx.lineTo(22.6 * u, -7.6 * u);
    ctx.lineTo(17.5 * u, -5.6 * u);
    ctx.closePath(); ctx.fill();

    // eye (blinks)
    const blinkS = this.blink > 0 ? 0.12 : 1;
    ctx.save();
    ctx.translate(13.4 * u, -10.6 * u);
    ctx.scale(1, blinkS);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, 0, 4.4 * u, 4.8 * u, 0, 0, TAU); ctx.fill();
    const ig = ctx.createRadialGradient(-0.6 * u, -0.6 * u, 0.3 * u, 0, 0, 3 * u);
    ig.addColorStop(0, '#43c9d8');
    ig.addColorStop(1, '#134a63');
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(0.4 * u, 0.2 * u, 2.9 * u, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a1622';
    ctx.beginPath(); ctx.arc(0.6 * u, 0.2 * u, 1.5 * u, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-0.4 * u, -1.2 * u, 1.05 * u, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
