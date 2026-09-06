'use strict';
/* ============================================================
   SKYBOUND · world.js — cinematic parallax sky
   7-phase day cycle: DAWN > MORNING > GOLDEN HOUR > SUNSET >
   TWILIGHT > NIGHT > MYSTICAL (aurora). Procedural infinite
   mountains, sprite-baked clouds, floating islands, weather.
   ============================================================ */
const SKY_PHASES = [
  { name: 'DAWN',     top: '#6fa5dd', mid: '#b8d9ee', bot: '#f2dfc4', sun: '#fff3cf', mountFar: '#93a9cc', mountNear: '#6d84b0', cloudA: 0.92, starA: 0.12, auroraA: 0 },
  { name: 'MORNING',  top: '#4f9de0', mid: '#9fd0f0', bot: '#eaf7ff', sun: '#fffdf0', mountFar: '#7e9cc9', mountNear: '#5a7aa8', cloudA: 1.0,  starA: 0.0,  auroraA: 0 },
  { name: 'GOLDEN',   top: '#6fa3d8', mid: '#f0b26e', bot: '#ffd98f', sun: '#ffedb8', mountFar: '#8f86b8', mountNear: '#6b6494', cloudA: 0.98, starA: 0.0,  auroraA: 0 },
  { name: 'SUNSET',   top: '#453a78', mid: '#b45a8e', bot: '#ff9d6f', sun: '#ffd9a0', mountFar: '#5c5387', mountNear: '#433d6d', cloudA: 0.9,  starA: 0.25, auroraA: 0 },
  { name: 'TWILIGHT', top: '#16204c', mid: '#34406e', bot: '#6a5a9e', sun: '#cfd8ff', mountFar: '#2e3a63', mountNear: '#232c4e', cloudA: 0.8,  starA: 0.6,  auroraA: 0 },
  { name: 'NIGHT',    top: '#070d28', mid: '#141f4a', bot: '#2a3766', sun: '#e8ecff', mountFar: '#1a2445', mountNear: '#121a35', cloudA: 0.55, starA: 1.0,  auroraA: 0 },
  { name: 'MYSTICAL', top: '#0b1533', mid: '#173a5e', bot: '#1f6b6b', sun: '#bfeee2', mountFar: '#14304d', mountNear: '#0f2338', cloudA: 0.6,  starA: 0.75, auroraA: 1 }
];
const CYCLE_LEN = 8600; // world px per phase (scaled by S)

/* Numeric channel interpolation — avoids caching fresh per-frame strings */
function _lerpArr(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function paletteAt(c) {
  const n = SKY_PHASES.length;
  const i = Math.floor(c) % n;
  const j = (i + 1) % n;
  const t = c - Math.floor(c);
  const A = SKY_PHASES[i], B = SKY_PHASES[j];
  // arrays are derived from stable phase hexes (cache-friendly); gradients
  // consume these arrays directly so no dynamic strings hit the color cache
  const farArr = _lerpArr(hexRGB(A.mountFar), hexRGB(B.mountFar), t);
  const nearArr = _lerpArr(hexRGB(A.mountNear), hexRGB(B.mountNear), t);
  const botArr = _lerpArr(hexRGB(A.bot), hexRGB(B.bot), t);
  return {
    name: t < 0.5 ? A.name : B.name,
    top: lerpColor(A.top, B.top, t),
    mid: lerpColor(A.mid, B.mid, t),
    bot: lerpColor(A.bot, B.bot, t),
    sun: lerpColor(A.sun, B.sun, t),
    mountFarArr: farArr,
    mountNearArr: nearArr,
    botArr,
    cloudA: lerp(A.cloudA, B.cloudA, t),
    starA: lerp(A.starA, B.starA, t),
    auroraA: lerp(A.auroraA, B.auroraA, t)
  };
}

class Cloud {
  constructor(layer, w, h, S, spawnAnywhere) {
    this.layer = layer;
    this.S = S;
    this.respawn(w, h, spawnAnywhere);
  }
  respawn(w, h, anywhere) {
    const S = this.S, L = this.layer;
    this.x = anywhere ? rand(-0.1 * w, 1.15 * w) : w + rand(60, 320) * S;
    this.y = rand(h * L.yMin, h * L.yMax);
    this.sc = rand(L.sMin, L.sMax) * S;
    this.alpha = rand(0.55, 0.95);
    this.drift = rand(4, 14) * S;
    if (!this.sprite || Math.random() < 0.4) this.bake();
  }
  bake() {
    const pw = 240, ph = 130;
    const c = document.createElement('canvas');
    c.width = pw; c.height = ph;
    const x = c.getContext('2d');
    const puffs = [];
    const n = randInt(6, 9);
    for (let i = 0; i < n; i++) {
      puffs.push({ dx: rand(30, pw - 30), dy: rand(55, 100), r: rand(22, 46) });
    }
    puffs.push({ dx: pw / 2, dy: 52, r: rand(40, 55) });
    // soft shading beneath
    x.globalAlpha = 0.5;
    x.fillStyle = '#b9cdea';
    for (const p of puffs) {
      x.beginPath(); x.arc(p.dx, p.dy + p.r * 0.35, p.r * 0.95, 0, TAU); x.fill();
    }
    // bright body
    x.globalAlpha = 1;
    for (const p of puffs) {
      const g = x.createRadialGradient(p.dx, p.dy - p.r * 0.25, p.r * 0.15, p.dx, p.dy, p.r);
      g.addColorStop(0, 'rgba(255,255,255,0.98)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.75)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.beginPath(); x.arc(p.dx, p.dy, p.r, 0, TAU); x.fill();
    }
    this.sprite = c;
  }
  update(dx, dt, w) {
    this.x -= dx;
    this.x -= this.drift * dt;
    if (this.x < -280 * this.S) this.respawn(w, this.game_h, false);
  }
  draw(ctx, pal) {
    const w = this.sprite.width * this.sc;
    const h = this.sprite.height * this.sc;
    ctx.globalAlpha = this.alpha * pal.cloudA;
    ctx.drawImage(this.sprite, this.x - w / 2, this.y - h / 2, w, h);
    ctx.globalAlpha = 1;
  }
}

class World {
  constructor(game) {
    this.game = game;
    this.build();
  }

  build() {
    const g = this.game, S = g.S, w = g.w, h = g.h;
    this.worldX = 0;
    this.t = 0;
    this.cycle = 0;           // 0..7 phase position
    this.rainT = 0;           // active rain time
    this.nextRain = rand(26, 60);
    this.meteors = [];
    this.nextMeteor = rand(3, 9);
    this.islands = [];
    // island scroll spacing
    for (let i = 0; i < 3; i++) this.islands.push(this.makeIsland(w * (0.5 + i * 0.9) + rand(0, 300) * S));
    // star field (relative coords)
    this.stars = [];
    for (let i = 0; i < 110; i++) {
      this.stars.push({ rx: Math.random(), ry: Math.random() * 0.62, s: rand(0.6, 1.9) * S, tw: rand(TAU), ts: rand(1.5, 4) });
    }
    // cloud layers: far / mid / near
    this.cloudsFar = []; this.cloudsMid = []; this.cloudsNear = [];
    const mk = (arr, n, cfg) => { for (let i = 0; i < n; i++) { const c = new Cloud(cfg, w, h, S, true); c.game_h = h; arr.push(c); } };
    mk(this.cloudsFar, 5, { yMin: 0.06, yMax: 0.34, sMin: 0.5, sMax: 0.9 });
    mk(this.cloudsMid, 4, { yMin: 0.16, yMax: 0.55, sMin: 0.7, sMax: 1.25 });
    mk(this.cloudsNear, 3, { yMin: 0.4, yMax: 0.78, sMin: 1.1, sMax: 1.9 });
    // foreground wisps
    this.wisps = [];
    for (let i = 0; i < 6; i++) {
      this.wisps.push({ x: rand(w), y: rand(h), w: rand(140, 340) * S, h: rand(24, 60) * S, a: rand(0.04, 0.1), sp: rand(0.3, 0.8) });
    }
    // ambient dust
    this.dust = [];
    for (let i = 0; i < 34; i++) {
      this.dust.push({ x: rand(w), y: rand(h), s: rand(0.8, 2.2) * S, ph: rand(TAU), sp: rand(6, 26) });
    }
    this.rain = [];
  }

  reset() { this.build(); }

  makeIsland(x) {
    const g = this.game, S = g.S;
    const wI = rand(150, 300) * S;
    const pts = [];
    const n = randInt(6, 9);
    for (let i = 0; i <= n; i++) pts.push(rand(0.55, 1));
    return {
      x, y: rand(g.h * 0.18, g.h * 0.6), w: wI, h: wI * rand(0.4, 0.62), pts,
      seed: randInt(1, 99999), waterfall: Math.random() < 0.5, wfPhase: rand(TAU)
    };
  }

  update(dt, speed) {
    const g = this.game, S = g.S, w = g.w, h = g.h;
    this.t += dt;
    this.worldX += speed * dt;
    this.cycle = (this.worldX / (CYCLE_LEN * S)) % SKY_PHASES.length;
    const pal = this.palette();

    // clouds
    for (const c of this.cloudsFar) { c.update(speed * 0.22 * dt, dt, w); c.game_h = h; }
    for (const c of this.cloudsMid) { c.update(speed * 0.45 * dt, dt, w); c.game_h = h; }
    for (const c of this.cloudsNear) { c.update(speed * 0.72 * dt, dt, w); c.game_h = h; }
    // islands
    for (let i = 0; i < this.islands.length; i++) {
      const isl = this.islands[i];
      isl.x -= speed * 0.5 * dt;
      isl.wfPhase += dt * 2;
      if (isl.x < -isl.w) {
        this.islands[i] = this.makeIsland(w + rand(500, 1500) * S);
      }
    }
    // wisps (foreground)
    for (const ws of this.wisps) {
      ws.x -= (speed * 1.25 + ws.sp * 20) * dt;
      if (ws.x < -ws.w * 1.5) { ws.x = w + ws.w * rand(0.8, 1.5); ws.y = rand(h); }
    }
    // dust
    for (const d of this.dust) {
      d.x -= (speed * 0.9 + d.sp) * dt;
      d.y += Math.sin(this.t * 1.7 + d.ph) * 8 * dt;
      if (d.x < -6) { d.x = w + rand(0, 60); d.y = rand(h); }
    }
    // weather: occasional soft rain (never blocks visibility)
    this.nextRain -= dt;
    if (this.nextRain <= 0 && this.rainT <= 0 && pal.starA < 0.7) {
      this.rainT = rand(5, 9);
      this.nextRain = rand(30, 70);
    }
    if (this.rainT > 0) {
      this.rainT -= dt;
      if (this.rain.length < 46 && Save.data.fx) {
        for (let i = 0; i < 3; i++) {
          this.rain.push({ x: rand(w * 1.2), y: rand(-40, -4), v: rand(680, 980) * S, dx: -speed * 0.8 });
        }
      }
    }
    for (let i = this.rain.length - 1; i >= 0; i--) {
      const r = this.rain[i];
      r.x += r.dx * dt; r.y += r.v * dt;
      if (r.y > h + 20) this.rain.splice(i, 1);
    }
    // meteors at night
    if (pal.starA > 0.5) {
      this.nextMeteor -= dt;
      if (this.nextMeteor <= 0) {
        this.nextMeteor = rand(4, 11);
        this.meteors.push({ x: rand(w * 0.3, w * 1.05), y: rand(h * 0.05, h * 0.4), t: 0, life: 0.9 });
      }
    }
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.t += dt; m.x -= 760 * S * dt; m.y += 300 * S * dt;
      if (m.t >= m.life) this.meteors.splice(i, 1);
    }
  }

  palette() { return paletteAt(this.cycle); }

  /* -------- SKY: gradient, stars, sun/moon, aurora -------- */
  drawSky(ctx) {
    const g = this.game, w = g.w, h = g.h;
    const pal = this.palette();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, pal.top);
    grad.addColorStop(0.55, pal.mid);
    grad.addColorStop(1, pal.bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // stars
    if (pal.starA > 0.02) {
      ctx.fillStyle = '#ffffff';
      for (const s of this.stars) {
        const tw = 0.55 + Math.sin(this.t * s.ts + s.tw) * 0.45;
        ctx.globalAlpha = pal.starA * tw;
        ctx.fillRect(s.rx * w, s.ry * h, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }

    // sun (day) / moon (night)
    const c = this.cycle;
    if (c < 4.6) {
      const sp = clamp(c / 4.2, 0, 1);
      const sx = w * 0.74, sy = h * (0.14 + sp * 0.62);
      const glow = ctx.createRadialGradient(sx, sy, 6, sx, sy, 190 * g.S);
      glow.addColorStop(0, 'rgba(255,244,214,0.85)');
      glow.addColorStop(0.35, 'rgba(255,236,190,0.28)');
      glow.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sx, sy, 190 * g.S, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.sun;
      ctx.beginPath(); ctx.arc(sx, sy, 30 * g.S, 0, TAU); ctx.fill();
    } else {
      const mx = w * 0.72, my = h * 0.16, mr = 24 * g.S;
      const glow = ctx.createRadialGradient(mx, my, 4, mx, my, 110 * g.S);
      glow.addColorStop(0, 'rgba(220,232,255,0.5)');
      glow.addColorStop(1, 'rgba(220,232,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(mx, my, 110 * g.S, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e6ecff';
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(178,192,224,0.7)';
      ctx.beginPath(); ctx.arc(mx - 7 * g.S, my - 4 * g.S, 4.4 * g.S, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(mx + 6 * g.S, my + 7 * g.S, 3 * g.S, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(mx + 9 * g.S, my - 8 * g.S, 2.2 * g.S, 0, TAU); ctx.fill();
    }

    // meteors
    if (this.meteors.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const m of this.meteors) {
        const a = Math.sin((m.t / m.life) * Math.PI);
        const tg = ctx.createLinearGradient(m.x, m.y, m.x + 70 * g.S, m.y - 28 * g.S);
        tg.addColorStop(0, 'rgba(255,255,255,' + (0.85 * a).toFixed(3) + ')');
        tg.addColorStop(1, 'rgba(160,220,255,0)');
        ctx.strokeStyle = tg;
        ctx.lineWidth = 2 * g.S;
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + 70 * g.S, m.y - 28 * g.S); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // aurora ribbons (MYSTICAL phase)
    if (pal.auroraA > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      const cols = ['rgba(53,224,196,', 'rgba(126,120,255,', 'rgba(53,199,216,'];
      for (let r = 0; r < 3; r++) {
        const baseY = h * (0.16 + r * 0.09);
        ctx.strokeStyle = cols[r] + (0.14 * pal.auroraA).toFixed(3) + ')';
        ctx.lineWidth = (26 + r * 10) * g.S;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let x = -20; x <= w + 40; x += 34) {
          const wx = x + this.worldX * 0.1;
          const y = baseY + Math.sin(wx * 0.0022 + this.t * 0.5 + r * 1.7) * 34 * g.S + Math.sin(wx * 0.0007 - this.t * 0.22) * 22 * g.S;
          x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // horizon haze (array-driven: no per-frame color-cache growth)
    const hz = ctx.createLinearGradient(0, h * 0.55, 0, h);
    hz.addColorStop(0, rgbaStr(pal.botArr, 0));
    hz.addColorStop(1, rgbaStr(pal.botArr, 0.2));
    ctx.fillStyle = hz;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
  }

  /* -------- BACK: mountain ranges + far/mid clouds -------- */
  _ridge(x, ph, amp) {
    return Math.sin(x * 0.0016 + ph) * amp * 0.55
         + Math.sin(x * 0.0043 + ph * 1.7) * amp * 0.3
         + Math.sin(x * 0.011 + ph * 2.3) * amp * 0.15;
  }

  _mountains(ctx, baseYFrac, amp, arr, factor, ph) {
    const g = this.game, w = g.w, h = g.h;
    const baseY = h * baseYFrac;
    const grad = ctx.createLinearGradient(0, baseY - amp, 0, h);
    grad.addColorStop(0, rgbaStr(arr, 1));
    grad.addColorStop(1, rgbaStr(arr, 0.55));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-4, h + 4);
    for (let x = -4; x <= w + 44; x += 36) {
      ctx.lineTo(x, baseY + this._ridge(x + this.worldX * factor, ph, amp));
    }
    ctx.lineTo(w + 4, h + 4);
    ctx.closePath();
    ctx.fill();
  }

  drawBack(ctx) {
    const pal = this.palette();
    // far clouds first (behind mountains)
    for (const c of this.cloudsFar) c.draw(ctx, pal);
    this._mountains(ctx, 0.72, this.game.h * 0.16, pal.mountFarArr, 0.1, 1.3);
    // rim light on far range
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const baseY = this.game.h * 0.72, amp = this.game.h * 0.16;
    for (let x = -4; x <= this.game.w + 44; x += 36) {
      const y = baseY + this._ridge(x + this.worldX * 0.1, 1.3, amp);
      x === -4 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    this._mountains(ctx, 0.9, this.game.h * 0.2, pal.mountNearArr, 0.24, 4.1);
    for (const c of this.cloudsMid) c.draw(ctx, pal);
  }

  /* -------- MID: floating islands + near clouds -------- */
  drawMid(ctx) {
    const g = this.game, S = g.S, pal = this.palette();
    for (const isl of this.islands) this._island(ctx, isl, pal, S);
    for (const c of this.cloudsNear) c.draw(ctx, pal);
  }

  _island(ctx, isl, pal, S) {
    const { x, y, w: iw, h: ih } = isl;
    const rng = mulberry32(isl.seed);
    ctx.save();
    ctx.translate(x, y + Math.sin(this.t * 0.6 + isl.seed) * 5 * S);
    ctx.globalAlpha = 0.88;
    // rock body (jagged, tapering down)
    const grad = ctx.createLinearGradient(0, 0, 0, ih);
    grad.addColorStop(0, rgbaStr(pal.mountNearArr, 1));
    grad.addColorStop(1, rgbaStr(pal.mountNearArr, 0.35));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-iw / 2, 0);
    for (let i = 0; i < isl.pts.length; i++) {
      const px = -iw / 2 + (i / (isl.pts.length - 1)) * iw;
      ctx.lineTo(px, ih * isl.pts[i]);
    }
    ctx.lineTo(iw / 2, 0);
    ctx.closePath();
    ctx.fill();
    // grass cap
    ctx.fillStyle = '#3f8f6f';
    ctx.beginPath();
    ctx.moveTo(-iw / 2 - 4 * S, 0);
    ctx.quadraticCurveTo(0, -14 * S, iw / 2 + 4 * S, 0);
    ctx.quadraticCurveTo(0, 8 * S, -iw / 2 - 4 * S, 0);
    ctx.fill();
    // trees
    const tn = 2 + (isl.seed % 2);
    for (let i = 0; i < tn; i++) {
      const tx = (rng() - 0.5) * iw * 0.7;
      const th = (12 + rng() * 14) * S;
      ctx.fillStyle = '#2e6b52';
      ctx.fillRect(tx - 1.4 * S, -th * 0.4, 2.8 * S, th * 0.4);
      ctx.beginPath();
      ctx.arc(tx, -th * 0.55, th * 0.34, 0, TAU);
      ctx.arc(tx - th * 0.22, -th * 0.38, th * 0.24, 0, TAU);
      ctx.arc(tx + th * 0.22, -th * 0.38, th * 0.24, 0, TAU);
      ctx.fill();
    }
    // waterfall
    if (isl.waterfall) {
      ctx.strokeStyle = 'rgba(210,240,255,0.4)';
      ctx.lineWidth = 2.4 * S;
      ctx.setLineDash([9 * S, 7 * S]);
      ctx.lineDashOffset = -isl.wfPhase * 26 * S;
      ctx.beginPath();
      ctx.moveTo((rng() - 0.2) * iw * 0.2, 4 * S);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* -------- FRONT: wisps, dust, rain (always visibility-safe) -------- */
  drawFront(ctx) {
    const g = this.game, S = g.S, w = g.w, pal = this.palette();
    // foreground wisps
    for (const ws of this.wisps) {
      ctx.globalAlpha = ws.a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ws.x, ws.y, ws.w, ws.h, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // glowing dust motes
    ctx.globalCompositeOperation = 'lighter';
    const mystic = pal.auroraA > 0.3 || pal.starA > 0.8;
    for (const d of this.dust) {
      ctx.globalAlpha = 0.16 + Math.sin(this.t * 2 + d.ph) * 0.1;
      ctx.fillStyle = mystic ? '#8feee6' : '#ffe9b8';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // soft rain streaks
    if (this.rain.length) {
      ctx.strokeStyle = 'rgba(200,225,255,0.32)';
      ctx.lineWidth = 1.2 * S;
      ctx.beginPath();
      for (const r of this.rain) {
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - 3, r.y - 14 * S);
      }
      ctx.stroke();
    }
    // event speed lines are drawn by game overlay
  }
}
