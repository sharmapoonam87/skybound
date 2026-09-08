'use strict';
/* ============================================================
   SKYBOUND · render.js — Game.prototype render pipeline.
   Layer order: sky > back > mid > obstacles > pickups > bird >
   foreground > particles > screen effects.
   ============================================================ */
Object.assign(Game.prototype, {
  render() {
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    // screen shake
    if (this.shake > 0.2) {
      ctx.translate(rand(-this.shake, this.shake) * 0.5, rand(-this.shake, this.shake) * 0.5);
    }

    this.world.drawSky(ctx);
    this.world.drawBack(ctx);
    this.world.drawMid(ctx);
    this.obstacles.draw(ctx);
    this.pickups.draw(ctx);
    this.player.draw(ctx);
    this.world.drawFront(ctx);
    this.particles.draw(ctx);

    this.drawScreenFX(ctx);
    ctx.restore();
  },

  drawScreenFX(ctx) {
    const w = this.w, h = this.h;
    // Sky Rush speed lines
    if (this.speedMult > 1.2 || (this.state === 'playing' && this.score.score >= 1000)) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(210,240,255,0.12)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const x = w - ((this.worldXSpeed() * 2.2 + i * 173) % (w + 240));
        const y = (i * 131 + ((i * i * 37) % 211)) % h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 60 + (i % 3) * 30, y);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // Golden Sky tint
    if (this.goldenT > 0) {
      const a = Math.min(0.14, this.goldenT * 0.3);
      ctx.fillStyle = 'rgba(255,200,87,' + a.toFixed(3) + ')';
      ctx.fillRect(0, 0, w, h);
    }
    // GHOST / PHANTOM spectral tint
    if (this.puGhost > 0 || this.puPhantom > 0) {
      ctx.fillStyle = 'rgba(150,170,255,' + (0.05 + Math.sin(this.t * 3) * 0.015).toFixed(3) + ')';
      ctx.fillRect(0, 0, w, h);
    }
    // vignette (cached)
    if (!this._vig) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(6,12,30,0)');
      g.addColorStop(1, 'rgba(6,12,30,0.4)');
      this._vig = g;
    }
    ctx.fillStyle = this._vig;
    ctx.fillRect(0, 0, w, h);
    // impact flash
    if (this.flash > 0.01) {
      ctx.fillStyle = 'rgba(255,255,255,' + (this.flash * 0.55).toFixed(3) + ')';
      ctx.fillRect(0, 0, w, h);
    }
  },

  worldXSpeed() {
    return this.world.worldX;
  }
});