'use strict';
/* ============================================================
   SKYBOUND · obstacles.js — procedural ancient-sky obstacles
   FLOATING RUINS · GIANT VINES · CRYSTAL GATES · SKY TEMPLES ·
   CLOUD CAVERNS. Every spawn is randomized yet always fair.
   ============================================================ */
const OB_TYPES = ['ruins', 'vines', 'crystal', 'temple', 'cloud'];

class ObstacleManager {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.obs = [];
    this.nextX = this.game.w + 480 * this.game.S; // gentle first gate
  }

  get diff() { return clamp(this.game.score.score / 2600, 0, 1); }

  update(dt, speed) {
    const g = this.game, S = g.S;
    for (let i = this.obs.length - 1; i >= 0; i--) {
      const ob = this.obs[i];
      ob.x -= speed * dt;
      if (ob.moveAmp > 0) {
        ob.movePhase += dt * ob.moveSpeed;
        ob.gapY = ob.baseGapY + Math.sin(ob.movePhase) * ob.moveAmp;
      }
      ob.t += dt;
      if (ob.x < -(ob.w + 260 * S)) this.obs.splice(i, 1);
    }
    // procedural spawning while playing
    if (g.state === 'playing') {
      const spacing = lerp(400, 320, this.diff) * S + rand(0, 90 * S);
      while (this.nextX < g.w + 160 * S) {
        this.spawn(this.nextX);
        this.nextX += spacing;
      }
      this.nextX -= speed * dt;
    } else {
      this.nextX -= speed * dt;
   }
  }

  spawn(x) {
    const g = this.game, S = g.S, h = g.h;
    const diff = this.diff;
    // type weights — complexity grows with difficulty
    const pool = diff < 0.2
      ? ['ruins', 'vines', 'crystal']
      : ['ruins', 'ruins', 'vines', 'vines', 'crystal', 'crystal', 'temple', 'temple', 'cloud'];
    const type = pick(pool);

    const w = (type === 'cloud' ? 118 : type === 'crystal' ? 84 : type === 'vines' ? 78 : 94) * S;
    const gapH = Math.max(168 * S, lerp(262, 172, diff) * S * rand(0.94, 1.06));
    const margin = 74 * S;
    let baseGapY = rand(margin + gapH / 2, h - margin - gapH / 2);

    // oscillating gates appear as difficulty rises — never unfairly
    let moveAmp = 0, moveSpeed = 0;
    if (diff > 0.32 && Math.random() < 0.16 + diff * 0.3) {
      const maxAmp = Math.min(
        baseGapY - margin - gapH / 2,
        h - margin - gapH / 2 - baseGapY,
        (34 + diff * 34) * S
      );
      if (maxAmp > 12 * S) {
        moveAmp = rand(14 * S, maxAmp);
        moveSpeed = rand(0.9, 1.7);
      }
    }

    const ob = {
      x, w, gapH, baseGapY, gapY: baseGapY, moveAmp, moveSpeed, movePhase: rand(TAU),
      type, seed: randInt(1, 999999), t: rand(10), passed: false
    };
    this.decorate(ob);
    this.obs.push(ob);
  }

  /* Precompute deterministic decoration so each gate looks the same every frame */
  decorate(ob) {
    const rng = mulberry32(ob.seed);
    const d = {};
    if (ob.type === 'ruins') {
      d.runes = [];
      const nr = randInt(2, 4);
      for (let i = 0; i < nr; i++) d.runes.push({ y: 0.12 + rng() * 0.76, k: (rng() * 4) | 0 });
      d.cracks = [];
      for (let i = 0; i < 3; i++) d.cracks.push({ y: rng(), x: 0.25 + rng() * 0.5, l: 0.1 + rng() * 0.2 });
      d.debris = [];
      for (let i = 0; i < 3; i++) d.debris.push({ dx: rand(-70, 70), dy: rand(-90, 90), r: rand(3, 7), ph: rng() * TAU });
    } else if (ob.type === 'vines') {
      d.vines = [];
      for (let i = 0; i < 5; i++) d.vines.push({ x: rng(), len: 0.25 + rng() * 0.6, sway: rng() * TAU, leaves: randInt(2, 4) });
      d.flowers = [];
      for (let i = 0; i < 3; i++) d.flowers.push({ x: rng(), y: 0.3 + rng() * 0.5, ph: rng() * TAU });
    } else if (ob.type === 'crystal') {
      d.shards = [];
      for (let i = 0; i < 4; i++) d.shards.push({ ph: rng() * TAU, r: rand(30, 64), s: rand(3, 6) });
      d.hue = rng();
    } else if (ob.type === 'temple') {
      d.banners = [];
      for (let i = 0; i < 2; i++) d.banners.push({ x: 0.28 + i * 0.44, c: pick(['#c86b5a', '#c9a24b', '#5a8fc8']) });
      d.windowGlow = rng() > 0.4;
    } else if (ob.type === 'cloud') {
      d.puffs = [];
      for (let i = 0; i < 9; i++) d.puffs.push({ x: rng(), y: rng(), r: 0.3 + rng() * 0.5 });
      d.gems = [];
      for (let i = 0; i < 2; i++) d.gems.push({ x: rng(), y: rng() });
    }
    ob.deco = d;
  }

  /* Collision: bird circle vs the two solid sections */
  hitTest(px, py, pr) {
    const g = this.game, S = g.S;
    for (const ob of this.obs) {
      if (ob.x > px + pr + 8 || ob.x + ob.w < px - pr - 8) continue;
      const gapTop = ob.gapY - ob.gapH / 2;
      const gapBot = ob.gapY + ob.gapH / 2;
      const inset = 5 * S;
      if (circleRect(px, py, pr, ob.x + inset, -200, ob.w - inset * 2, gapTop + 200 - inset)) return ob;
      if (circleRect(px, py, pr, ob.x + inset, gapBot + inset, ob.w - inset * 2, g.h - gapBot + 200)) return ob;
    }
    return null;
  }

  draw(ctx) {
    const g = this.game, S = g.S, h = g.h;
    for (const ob of this.obs) {
      if (ob.x > g.w + 60 || ob.x + ob.w < -260 * S) continue;
      const gapTop = ob.gapY - ob.gapH / 2;
      const gapBot = ob.gapY + ob.gapH / 2;
      // gap edge shimmer — makes the safe passage obvious
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(127,227,218,0.16)';
      ctx.fillRect(ob.x - 3, gapTop - 2, ob.w + 6, 3 * S);
      ctx.fillRect(ob.x - 3, gapBot - 1 * S, ob.w + 6, 3 * S);
      ctx.globalCompositeOperation = 'source-over';
      switch (ob.type) {
        case 'ruins': this._ruins(ctx, ob, gapTop, gapBot, h, S); break;
        case 'vines': this._vines(ctx, ob, gapTop, gapBot, h, S); break;
        case 'crystal': this._crystal(ctx, ob, gapTop, gapBot, h, S); break;
        case 'temple': this._temple(ctx, ob, gapTop, gapBot, h, S); break;
        case 'cloud': this._cloudc(ctx, ob, gapTop, gapBot, h, S); break;
      }
      // ambient dust sparkles around obstacles
      if (Save.data.fx && Math.random() < 0.05) {
        g.particles.spawn({
          x: ob.x + rand(ob.w), y: rand(h), vx: rand(-20, 20), vy: rand(-26, -8),
          life: rand(0.8, 1.4), size: rand(1, 2.4), r: 160, g: 230, b: 220, alpha: 0.6
        });
      }
    }
  }

  _stone(ctx, x, y, w, h, light, dark) {
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, dark);
    grad.addColorStop(0.22, light);
    grad.addColorStop(0.85, dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, 4) : ctx.rect(x, y, w, h);
    ctx.fill();
    // bottom shade + top light edge
    ctx.fillStyle = 'rgba(10,20,40,0.22)';
    ctx.fillRect(x, y + h - 5, w, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x + 3, y, w - 6, 2.5);
  }

  /* ---- FLOATING RUINS: carved columns with glowing runes ---- */
  _ruins(ctx, ob, gapTop, gapBot, h, S) {
    const { x, w } = ob;
    const light = '#9fb2c8', dark = '#5f7391', edge = '#c7d4e4';
    const runes = ob.deco.runes, cracks = ob.deco.cracks;

    const column = (y0, y1, capAtBottom) => {
      const shaftW = w * 0.62;
      const sx = x + (w - shaftW) / 2;
      // shaft
      this._stone(ctx, sx, y0, shaftW, y1 - y0, light, dark);
      // flutes
      ctx.strokeStyle = 'rgba(20,35,60,0.25)';
      ctx.lineWidth = 1.5 * S;
      for (let i = 1; i < 4; i++) {
        const fx = sx + (shaftW / 4) * i;
        ctx.beginPath(); ctx.moveTo(fx, y0 + 4); ctx.lineTo(fx, y1 - 4); ctx.stroke();
      }
      // capital / base
      const capH = 18 * S;
      const capY = capAtBottom ? y1 - capH : y0;
      this._stone(ctx, x, capY, w, capH, edge, dark);
      this._stone(ctx, x + w * 0.08, capAtBottom ? y1 - capH * 1.9 : y0 + capH * 0.9, w * 0.84, capH, light, dark);
      // runes
      if (y1 - y0 > 90 * S) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const r of runes) {
          const ry = y0 + (y1 - y0) * r.y;
          if (ry < y0 + 26 * S || ry > y1 - 26 * S) continue;
          const a = 0.45 + Math.sin(ob.t * 2 + r.y * 9) * 0.3;
          ctx.fillStyle = 'rgba(127,227,218,' + a.toFixed(2) + ')';
          ctx.font = (12 * S) + 'px sans-serif';
          ctx.textAlign = 'center';
          const glyphs = ['◈', '⟁', '✦', '⌘'];
          ctx.fillText(glyphs[r.k % 4], x + w / 2, ry);
        }
        ctx.restore();
      }
      // cracks
      ctx.strokeStyle = 'rgba(15,28,50,0.4)';
      ctx.lineWidth = 1.4 * S;
      for (const c of cracks) {
        const cy = y0 + (y1 - y0) * c.y;
        ctx.beginPath();
        ctx.moveTo(x + w * c.x, cy);
        ctx.lineTo(x + w * (c.x + 0.06), cy + (y1 - y0) * c.l);
        ctx.stroke();
      }
    };

    column(-20, gapTop, true);          // hanging column (capital meets the gap)
    column(gapBot, h + 20, false);      // standing column

    // orbiting debris shards
    ctx.globalCompositeOperation = 'lighter';
    for (const db of ob.deco.debris) {
      const dx = x + w / 2 + db.dx + Math.sin(ob.t * 0.8 + db.ph) * 10 * S;
      const dy = (ob.gapY + db.dy * 1.4) + Math.cos(ob.t * 0.7 + db.ph) * 8 * S;
      ctx.fillStyle = 'rgba(199,212,228,0.5)';
      ctx.beginPath(); ctx.arc(dx, dy, db.r * S, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---- GIANT VINES: hanging gardens from a floating isle ---- */
  _vines(ctx, ob, gapTop, gapBot, h, S) {
    const { x, w } = ob;
    const cx = x + w / 2;
    // TOP: lush canopy slab
    const canH = Math.min(gapTop, 90 * S);
    const canY = gapTop - canH;
    // canopy mass
    const cg = ctx.createLinearGradient(x, canY, x + w, gapTop);
    cg.addColorStop(0, '#2c6e52');
    cg.addColorStop(0.5, '#3f9a68');
    cg.addColorStop(1, '#2c6e52');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(x - 10 * S, canY);
    ctx.quadraticCurveTo(cx, canY - 26 * S, x + w + 10 * S, canY);
    ctx.quadraticCurveTo(x + w + 16 * S, gapTop + 6 * S, x + w * 0.7, gapTop);
    ctx.quadraticCurveTo(cx, gapTop + 12 * S, x + w * 0.3, gapTop);
    ctx.quadraticCurveTo(x - 16 * S, gapTop + 4 * S, x - 10 * S, canY);
    ctx.closePath();
    ctx.fill();
    // hanging vines with swaying leaves
    for (const v of ob.deco.vines) {
      const vx = x + w * v.x;
      const sway = Math.sin(ob.t * 1.3 + v.sway) * 7 * S;
      const vl = v.len * 46 * S;
      ctx.strokeStyle = '#2f7d55';
      ctx.lineWidth = 3 * S;
      ctx.beginPath();
      ctx.moveTo(vx, gapTop - 4 * S);
      ctx.quadraticCurveTo(vx + sway, gapTop - 4 + vl * 0.6, vx + sway * 1.4, gapTop - 4 + vl);
      ctx.stroke();
      // leaves
      ctx.fillStyle = '#48b578';
      for (let i = 1; i <= v.leaves; i++) {
        const lt = i / (v.leaves + 1);
        const lx = vx + sway * lt * 1.3;
        const ly = gapTop - 4 + vl * lt;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(Math.sin(ob.t * 2 + i + v.sway) * 0.4);
        ctx.beginPath(); ctx.ellipse(4 * S, 0, 6 * S, 2.6 * S, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    // BOTTOM: mossy mound with glowing blossoms
    const mg = ctx.createLinearGradient(x, gapBot, x + w, h);
    mg.addColorStop(0, '#4c7f5e');
    mg.addColorStop(1, '#2a5140');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.moveTo(x - 12 * S, h + 10);
    ctx.quadraticCurveTo(x - 14 * S, gapBot + 30 * S, x + w * 0.25, gapBot + 4 * S);
    ctx.quadraticCurveTo(cx, gapBot - 10 * S, x + w * 0.75, gapBot + 6 * S);
    ctx.quadraticCurveTo(x + w + 14 * S, gapBot + 34 * S, x + w + 12 * S, h + 10);
    ctx.closePath();
    ctx.fill();
    // grass rim
    ctx.strokeStyle = '#63c184';
    ctx.lineWidth = 3 * S;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.25, gapBot + 4 * S);
    ctx.quadraticCurveTo(cx, gapBot - 10 * S, x + w * 0.75, gapBot + 6 * S);
    ctx.stroke();
    // glowing blossoms
    ctx.globalCompositeOperation = 'lighter';
    for (const f of ob.deco.flowers) {
      const fx = x + w * f.x;
      const fy = gapBot + 30 * S + f.y * 40 * S;
      const a = 0.5 + Math.sin(ob.t * 2.4 + f.ph) * 0.3;
      ctx.fillStyle = 'rgba(255,170,120,' + a.toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(fx, fy, 3.4 * S, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,160,' + (a * 0.5).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(fx, fy, 7 * S, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---- CRYSTAL GATES: faceted magic formations ---- */
  _crystal(ctx, ob, gapTop, gapBot, h, S) {
    const { x, w } = ob;
    const cx = x + w / 2;
    const hue = ob.deco.hue;
    const cA = hue > 0.5 ? ['#7ee8e0', '#2fa9c4', '#136a90'] : ['#c9a7ff', '#8f6fe0', '#4a3a90'];

    const spike = (cxp, tipY, baseY, halfW, cols) => {
      const g1 = ctx.createLinearGradient(cxp - halfW, 0, cxp + halfW, 0);
      g1.addColorStop(0, cols[2]);
      g1.addColorStop(0.4, cols[0]);
      g1.addColorStop(1, cols[1]);
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.moveTo(cxp, tipY);
      ctx.lineTo(cxp + halfW, baseY);
      ctx.lineTo(cxp - halfW, baseY);
      ctx.closePath();
      ctx.fill();
      // inner facet highlight
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.moveTo(cxp, tipY);
      ctx.lineTo(cxp + halfW * 0.25, baseY);
      ctx.lineTo(cxp - halfW * 0.15, baseY);
      ctx.closePath();
      ctx.fill();
    };

    // glow behind the formation
    ctx.globalCompositeOperation = 'lighter';
    const glowA = 0.2 + Math.sin(ob.t * 2.2) * 0.08;
    const gg = ctx.createRadialGradient(cx, ob.gapY, 10 * S, cx, ob.gapY, 110 * S);
    gg.addColorStop(0, 'rgba(126,232,224,' + (glowA * 0.5).toFixed(2) + ')');
    gg.addColorStop(1, 'rgba(126,232,224,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(cx, ob.gapY, 110 * S, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // top cluster (points down)
    const topH = Math.min(gapTop, 150 * S);
    spike(cx, gapTop, gapTop - topH, w * 0.34, cA);
    spike(cx - w * 0.4, gapTop - topH * 0.25, gapTop - topH * 0.75, w * 0.2, cA);
    spike(cx + w * 0.4, gapTop - topH * 0.2, gapTop - topH * 0.7, w * 0.2, cA);
    // bottom cluster (points up)
    const botH = Math.min(h - gapBot, 150 * S);
    spike(cx, gapBot, gapBot + botH, w * 0.34, cA);
    spike(cx - w * 0.4, gapBot + botH * 0.25, gapBot + botH * 0.75, w * 0.2, cA);
    spike(cx + w * 0.4, gapBot + botH * 0.2, gapBot + botH * 0.7, w * 0.2, cA);

    // orbiting micro-shards
    ctx.globalCompositeOperation = 'lighter';
    for (const sh of ob.deco.shards) {
      const ang = ob.t * 1.4 + sh.ph;
      const sx = cx + Math.cos(ang) * sh.r * S;
      const sy = ob.gapY + Math.sin(ang) * sh.r * S * 0.6;
      ctx.fillStyle = 'rgba(200,255,250,0.85)';
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(0, -sh.s * S); ctx.lineTo(sh.s * 0.6 * S, 0); ctx.lineTo(0, sh.s * S); ctx.lineTo(-sh.s * 0.6 * S, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---- SKY TEMPLES: tiered ancient architecture ---- */
  _temple(ctx, ob, gapTop, gapBot, h, S) {
    const { x, w } = ob;
    const light = '#b8a98e', dark = '#7a6c52', trim = '#d8c9a0';
    const d = ob.deco;

    const tier = (tx, ty, tw, th) => {
      this._stone(ctx, tx, ty, tw, th, light, dark);
      // roof with upturned eaves
      ctx.fillStyle = '#5f6f8a';
      ctx.beginPath();
      ctx.moveTo(tx - 8 * S, ty);
      ctx.quadraticCurveTo(tx + tw * 0.2, ty - th * 0.9, tx + tw * 0.5, ty - th);
      ctx.quadraticCurveTo(tx + tw * 0.8, ty - th * 0.9, tx + tw + 8 * S, ty);
      ctx.quadraticCurveTo(tx + tw * 0.5, ty - th * 0.25, tx - 8 * S, ty);
      ctx.closePath();
      ctx.fill();
      // gold trim line
      ctx.fillStyle = trim;
      ctx.fillRect(tx - 8 * S, ty - 2 * S, tw + 16 * S, 2.6 * S);
    };

    // TOP temple: two tiers + pillars up to screen top
    const t1w = w * 0.95, t1y = Math.max(gapTop - 34 * S, 40 * S);
    tier(x + w * 0.025, t1y, t1w, 24 * S);
    const t2w = w * 0.66, t2y = Math.max(t1y - 30 * S, 14 * S);
    tier(x + w * 0.17, t2y, t2w, 20 * S);
    // pillars from top edge
    this._stone(ctx, x + w * 0.2, -20, 8 * S, t2y + 20, light, dark);
    this._stone(ctx, x + w * 0.72, -20, 8 * S, t2y + 20, light, dark);
    if (d.windowGlow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,208,120,0.75)';
      ctx.beginPath(); ctx.arc(x + w * 0.5, t1y + 12 * S, 4.5 * S, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,208,120,0.25)';
      ctx.beginPath(); ctx.arc(x + w * 0.5, t1y + 12 * S, 10 * S, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    // BOTTOM platform + pillars
    const py = gapBot;
    this._stone(ctx, x + w * 0.05, py, w * 0.9, 16 * S, light, dark);
    this._stone(ctx, x + w * 0.14, py + 16 * S, w * 0.72, 12 * S, light, dark);
    this._stone(ctx, x + w * 0.24, py + 28 * S, 9 * S, Math.max(0, h - py - 28 * S), light, dark);
    this._stone(ctx, x + w * 0.68, py + 28 * S, 9 * S, Math.max(0, h - py - 28 * S), light, dark);
    // banners sway
    for (const b of d.banners) {
      const bx = x + w * b.x;
      const sway = Math.sin(ob.t * 1.8 + b.x * 5) * 4 * S;
      ctx.fillStyle = b.c;
      ctx.beginPath();
      ctx.moveTo(bx, py + 2 * S);
      ctx.quadraticCurveTo(bx + sway, py + 22 * S, bx + sway * 1.3, py + 40 * S);
      ctx.lineTo(bx + 9 * S, py + 38 * S);
      ctx.quadraticCurveTo(bx + 9 * S, py + 18 * S, bx + 9 * S, py + 2 * S);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* ---- CLOUD CAVERNS: dense solid cloud masses ---- */
  _cloudc(ctx, ob, gapTop, gapBot, h, S) {
    const { x, w } = ob;
    const d = ob.deco;
    const drawMass = (y0, y1, flip) => {
      const massH = y1 - y0;
      if (massH < 8) return;
      // dark core for solidity
      const core = ctx.createLinearGradient(0, y0, 0, y1);
      if (flip) { core.addColorStop(0, 'rgba(120,150,190,0.95)'); core.addColorStop(1, 'rgba(210,230,248,0.9)'); }
      else { core.addColorStop(0, 'rgba(210,230,248,0.9)'); core.addColorStop(1, 'rgba(120,150,190,0.95)'); }
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x - 8 * S, y0 - (flip ? 0 : 8 * S), w + 16 * S, massH + 8 * S, 30 * S)
                    : ctx.rect(x - 8 * S, y0 - (flip ? 0 : 8 * S), w + 16 * S, massH + 8 * S);
      ctx.fill();
      // puffy surface
      for (const p of d.puffs) {
        const px = x + p.x * w;
        const py = flip ? y1 - p.y * massH * 0.6 : y0 + p.y * massH * 0.6;
        const pr = p.r * 22 * S;
        const pg = ctx.createRadialGradient(px, py - pr * 0.3, pr * 0.2, px, py, pr);
        pg.addColorStop(0, 'rgba(255,255,255,0.95)');
        pg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
      }
      // embedded glowing gems
      ctx.globalCompositeOperation = 'lighter';
      for (const gm of d.gems) {
        const gx = x + gm.x * w;
        const gy = flip ? y1 - 16 * S - gm.y * massH * 0.4 : y0 + 16 * S + gm.y * massH * 0.4;
        const a = 0.4 + Math.sin(ob.t * 2 + gm.x * 8) * 0.25;
        ctx.fillStyle = 'rgba(127,227,218,' + a.toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(gx, gy, 3.5 * S, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    drawMass(0, gapTop, true);
    drawMass(gapBot, h + 10, false);
  }
}
