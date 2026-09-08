'use strict';
/* ============================================================
   SKYBOUND · game.js — orchestrator: states, loop, collisions
   States: MENU > READY > PLAYING > PAUSED > OVER
   Single rAF loop; restart-safe (no duplicate listeners/timers).
   ============================================================ */
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0; this.h = 0; this.dpr = 1; this.S = 1;

    // systems
    this.audio = new AudioSystem();
    this.score = new ScoreSystem(this);
    this.particles = new ParticleSystem(this);
    this.world = new World(this);
    this.player = new Player(this);
    this.obstacles = new ObstacleManager(this);
    this.pickups = new PickupManager(this);
    this.events = new EventsManager(this);
    this.ui = new UIManager(this);
    this.input = new InputSystem(this);

    // dynamic state
    this.state = 'menu';
    this.speed = 0;
    this.speedMult = 1;      // Sky Rush multiplier
    this.windY = 0;          // Wind Zone acceleration
    this.goldenT = 0;        // Golden Sky timer
    this.puSpeed = 0; this.puGhost = 0; this.puRevive = 0; this.puPhantom = 0; this.puFeather = 0;
    this.invT = 0;           // post-revival / post-hit invulnerability
    this.timeScale = 1; this.tsTarget = 1; this.slowT = 0;
    this.shake = 0; this.flash = 0;
    this.overT = 0; this.overShown = false;
    this.runDistance = 0;
    this.t = 0;

    this._prePause = 'playing';
    this._vig = null;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.last = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sNew = clamp(Math.min(h / 720, w / 480), 0.55, 1.5);
    const sChanged = Math.abs(sNew - this.S) > 0.01;
    const first = this._built !== true;
    this.S = sNew;
    this._vig = null; // the vignette gradient is sized to the viewport — always rebuild it
    if (sChanged || first) {
      // rebuild pools for the new scale, but keep the day-cycle position
      const wx = this.world ? this.world.worldX : 0;
      const wt = this.world ? this.world.t : 0;
      this.world.build();
      this.world.worldX = wx;
      this.world.t = wt;
      this.player.x = w * 0.32;
      this.player.y = h * 0.44;
      this._built = true;
    }
  }

  /* ---------------- main loop ---------------- */
  loop(ts) {
    requestAnimationFrame((t2) => this.loop(t2));
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (dt > 0.033) dt = 0.033; // clamp hiccups
    if (dt <= 0) return;

    if (this.state !== 'paused') {
      this.t += dt;
      this.frame(dt);
    }
    this.render();
  }

  frame(dt) {
    // death slow-motion (time-warp power removed in v2 power set)
    let target = 1;
    if (this.slowT > 0) { this.slowT -= dt; target = 0.28; }
    this.timeScale = damp(this.timeScale, target, 8, dt);
    const dtw = dt * this.timeScale;

    switch (this.state) {
      case 'menu':
        this.world.update(dtw, 55 * this.S);
        this.player.update(dtw);
        this.particles.update(dtw);
        break;
      case 'ready':
        this.world.update(dtw, this.score.speedFor(this.S) * 0.35);
        this.player.update(dtw);
        this.particles.update(dtw);
        break;
      case 'playing':
        this.updatePlaying(dt, dtw);
        break;
      case 'over':
        this.updateOver(dt, dtw);
        break;
    }

    // decay effects
    this.shake = Math.max(0, this.shake - dt * 34);
    this.flash = Math.max(0, this.flash - dt * 2.4);
    if (this.goldenT > 0) this.goldenT -= dt;
  }

  /* ---------------- gameplay update ---------------- */
  updatePlaying(dt, dtw) {
    const S = this.S, p = this.player;

    // milestone: constant speed, stepped every 1000 score
    const ms = this.score.milestone();
    if (ms > 0) {
      this.ui.banner('SPEED UP', 'THE SKY QUICKENS');
      this.audio.milestone();
      this.particles.burst(p.x, p.y, { count: 16, color: '#ffc857', speed: 240 * S, life: 0.8, size: 3.4 });
      this.shake = Math.max(this.shake, 5);
    }

    // speed powers multiply the base world speed
    const spdBase = (this.puSpeed > 0 ? 2 : 1) * (this.puPhantom > 0 ? 1.6 : 1);
    this.speed = this.score.speedFor(S) * this.speedMult * spdBase;
    this.runDistance += this.speed * dtw;
    this.world.update(dtw, this.speed);
    this.score.update(dtw);
    this.ui.setCombo(this.score.comboT > 0 ? this.score.mult : 0);
    this.events.update(dt);
    this.player.update(dtw);
    this.obstacles.update(dtw, this.speed);
    this.pickups.update(dtw, this.speed);
    this.particles.update(dtw);

    // power-up timers
    if (this.puSpeed > 0) this.puSpeed -= dt;
    if (this.puGhost > 0) this.puGhost -= dt;
    if (this.puPhantom > 0) this.puPhantom -= dt;
    if (this.puFeather > 0) this.puFeather -= dt;
    if (this.invT > 0) this.invT -= dt;

    // gate passes → score + combo
    for (const ob of this.obstacles.obs) {
      if (!ob.passed && ob.x + ob.w < p.x - p.r) {
        ob.passed = true;
        const gained = this.score.addPass();
        this.particles.text(p.x + 10 * S, p.y - 30 * S, '+' + gained, '#bfeaff', 15);
        this.audio.combo(Math.min(8, this.score.combo));
        if (this.score.mult >= 3) {
          this.particles.burst(p.x, p.y, { count: 8, color: '#ffc857', speed: 150 * S, life: 0.6, size: 2.6 });
        }
      }
    }

    // collisions — GHOST / PHANTOM powers phase clean through
    if (this.invT <= 0 && p.alive && !this.isGhost()) {
      const hit = this.obstacles.hitTest(p.x, p.y, p.r);
      if (hit) this.handleHit(hit);
    }

    // soft ceiling / fatal fall
    if (p.y < p.r + 2) { p.y = p.r + 2; if (p.vy < 0) p.vy = 0; }
    if (p.y > this.h + 60 * S) {
      if (this.puRevive > 0) {
        // the extra life yanks Lumivane back into the sky
        this.puRevive = 0;
        p.y = this.h * 0.28;
        p.vy = -520 * S;
        this.invT = 2.5;
        this.audio.revive();
        this.particles.burst(p.x, p.y, { count: 20, color: '#43d17a', speed: 300 * S, life: 0.9, size: 3.6 });
        this.particles.text(p.x, p.y - 36 * S, 'EXTRA LIFE!', '#6dff9e', 16);
        this.shake = Math.max(this.shake, 6);
      } else {
        this.die();
      }
    }

    // HUD
    this.ui.setHUD(this.score.score, Math.max(this.score.best, this.score.score), this.score.feathers);
    const chips = [];
    if (this.puSpeed > 0) chips.push({ kind: 'speed', color: PU_KINDS.speed.color, label: 'SPEED 2X', frac: this.puSpeed / 8 });
    if (this.puGhost > 0) chips.push({ kind: 'ghost', color: PU_KINDS.ghost.color, label: 'GHOST', frac: this.puGhost / 15 });
    if (this.puPhantom > 0) chips.push({ kind: 'phantom', color: PU_KINDS.phantom.color, label: 'PHANTOM', frac: this.puPhantom / 30 });
    if (this.puFeather > 0) chips.push({ kind: 'feather', color: PU_KINDS.feather.color, label: '2X FEATHERS', frac: this.puFeather / 30 });
    if (this.puRevive > 0) chips.push({ kind: 'revive', color: PU_KINDS.revive.color, label: 'EXTRA LIFE', frac: 1 });
    this.ui.setPowerups(chips);
  }

  updateOver(dt, dtw) {
    this.overT += dt;
    this.speed = this.score.speedFor(this.S) * 0.25;
    this.world.update(dtw, this.speed);
    this.player.update(dtw);
    this.obstacles.update(dtw, this.speed);
    this.pickups.update(dtw, this.speed);
    this.particles.update(dtw);
    if (this.overT >= 1.05 && !this.overShown) {
      this.overShown = true;
      const isRec = Save.submitRun(this.score.score, this.score.feathers);
      this.score.best = Save.data.best;
      this.ui.showGameOver({
        score: this.score.score, best: Save.data.best,
        distance: Math.round(this.runDistance / (52 * this.S)),
        feathers: this.score.feathers, record: isRec
      });
      if (isRec) {
        this.audio.record();
        this.particles.confetti(this.w, this.h);
      }
    }
  }

  /* ---------------- state transitions ---------------- */
  startFromMenu() {
    this.ui.updateMenuStats();
    this.startRun();
  }

  startRun() {
    this.score.reset();
    this.obstacles.reset();
    this.pickups.reset();
    this.events.reset();
    this.particles.texts.length = 0;
    this.player.reset();
    this.speedMult = 1; this.windY = 0; this.goldenT = 0;
    this.puSpeed = 0; this.puGhost = 0; this.puRevive = 0; this.puPhantom = 0; this.puFeather = 0;
    this.invT = 0; this.overT = 0; this.overShown = false;
    this.timeScale = 1; this.tsTarget = 1; this.slowT = 0;
    this.shake = 0; this.flash = 0;
    this.runDistance = 0;
    this.state = 'ready';
    this.ui.hideAll();
    this.ui.showHUD(true);
    this.ui.setTapHint(true);
    this.ui.setCombo(0);
    this.ui.setPowerups([]);
    this.ui.setHUD(0, this.score.best, 0);
  }

  onTap() {
    if (this.state === 'ready') {
      this.state = 'playing';
      this.ui.setTapHint(false);
      this.player.flap();
    } else if (this.state === 'playing') {
      this.player.flap();
    }
  }

  confirm() {
    if (this.state === 'menu') this.startFromMenu();
    else if (this.state === 'over' && this.overShown) this.startRun();
    else if (this.state === 'paused') this.resume();
  }

  togglePause() {
    if (this.state === 'playing' || this.state === 'ready') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'ready') return;
    this._prePause = this.state;
    this.state = 'paused';
    this.ui.showScreen('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this._prePause;
    this.ui.hideAll();
    this.last = performance.now();
  }

  restart() {
    this.startRun();
  }

  toMenu() {
    this.state = 'menu';
    this.obstacles.reset();
    this.pickups.reset();
    this.events.reset();
    this.player.reset();
    this.speedMult = 1; this.windY = 0; this.goldenT = 0;
    this.puSpeed = 0; this.puGhost = 0; this.puRevive = 0; this.puPhantom = 0; this.puFeather = 0;
    this.ui.showHUD(false);
    this.ui.setTapHint(false);
    this.ui.setPowerups([]);
    this.ui.updateMenuStats();
    this.ui.showScreen('menu');
  }

  /* ---------------- gameplay events ---------------- */
  /* RED GHOST / WHITE PHANTOM → phase through any obstacle */
  isGhost() { return this.puGhost > 0 || this.puPhantom > 0; }

  handleHit(ob) {
    const S = this.S, p = this.player;
    if (this.isGhost()) {
      // spectral — nothing to hit
      this.particles.spawn({
        x: p.x, y: p.y, life: 0.35, size: 10 * S, sizeEnd: 24 * S,
        r: 150, g: 170, b: 255, alpha: 0.5, shape: 'ring'
      });
      return;
    }
    if (this.puRevive > 0) { this._revive(); return; }
    this.die();
  }

  /* BOMB — touch and it's over (ghost phases through, extra life saves). */
  handleBomb(x, y) {
    if (this.state !== 'playing') return;
    const S = this.S, p = this.player;
    this.particles.burst(x, y, { count: 26, color: '#ff5b45', speed: 330 * S, life: 0.9, size: 4.2, add: false });
    this.particles.burst(x, y, { count: 14, color: '#3a2b33', speed: 200 * S, life: 0.7, size: 3, add: false });
    if (this.puRevive > 0) {
      p.vy = -300 * S; // soften the bounce first
      this._revive('BOMB! EXTRA LIFE!');
      return;
    }
    this.audio.bomb();
    this.die();
  }

  /* Ghost flying through a bomb just sparks — no damage. */
  phasedBomb(x, y) {
    const S = this.S;
    this.audio.phased();
    this.particles.burst(x, y, { count: 8, color: '#b9c6ff', speed: 220 * S, life: 0.5, size: 2.4 });
    this.particles.text(x, y - 24 * S, 'PHASED!', '#dbe3ff', 13);
  }

  /* GREEN EXTRA LIFE — consume and carry on flying. */
  _revive(text) {
    const S = this.S, p = this.player;
    this.puRevive = 0;
    this.invT = 2.5;
    p.alive = true;
    p.vy = -430 * S;
    p.hitFlash = 1;
    this.score.breakCombo();
    this.ui.setCombo(0);
    this.ui.setPowerups([]);
    this.audio.revive();
    this.particles.burst(p.x, p.y, { count: 26, color: '#43d17a', speed: 300 * S, life: 0.9, size: 3.6 });
    this.particles.text(p.x, p.y - 34 * S, text || 'EXTRA LIFE!', '#6dff9e', 16);
    this.shake = Math.max(this.shake, 6);
    if (this.state === 'over') {
      this.state = 'playing';
      this.overShown = true;
    }
  }

  die() {
    if (this.state !== 'playing') return;
    const S = this.S, p = this.player;
    this.state = 'over';
    p.alive = false;
    p.vy = Math.min(p.vy, -260 * S); // impact bounce
    p.hitFlash = 1;
    this.slowT = 0.55;
    this.shake = Save.data.shake ? 16 : 0;
    this.flash = 1;
    this.audio.hit();
    setTimeout(() => this.audio.gameover(), 420);
    this.particles.burst(p.x, p.y, { count: 22, color: '#ffd9a0', speed: 340 * S, life: 0.9, size: 3.8 });
    this.particles.burst(p.x, p.y, { count: 10, color: '#7fe3da', speed: 200 * S, life: 1.1, size: 2.6 });
    this.ui.setCombo(0);
    this.ui.setPowerups([]);
  }

  onFeather(x, y, isShard) {
    const S = this.S;
    // YELLOW 2X FEATHERS (and GOLDEN SKY) double the take
    const mult = (this.puFeather > 0 || this.goldenT > 0) ? 2 : 1;
    this.score.addFeather(mult);
    this.audio.collect();
    this.particles.burst(x, y, {
      count: isShard ? 8 : 10, color: isShard ? '#8cf0ff' : '#bfeee6',
      speed: 180 * S, life: 0.6, size: 3, sizeEnd: 0.5
    });
    this.particles.text(x, y - 14 * S, '+' + (1 * mult), '#8feee6', 14);
    this.particles.spawn({
      x, y, life: 0.45, size: 8 * S, sizeEnd: 26 * S, r: 160, g: 240, b: 230,
      alpha: 0.7, shape: 'ring'
    });
  }

  onPowerup(kind, x, y) {
    const S = this.S;
    const cfg = PU_KINDS[kind];
    if (kind === 'speed') this.puSpeed = cfg.dur;
    if (kind === 'ghost') this.puGhost = cfg.dur;
    if (kind === 'revive') this.puRevive = 1;
    if (kind === 'phantom') this.puPhantom = cfg.dur;
    if (kind === 'feather') this.puFeather = cfg.dur;
    this.audio.powerup();
    this.particles.burst(x, y, { count: 16, color: cfg.color, speed: 260 * S, life: 0.8, size: 3.4 });
    this.particles.text(x, y - 20 * S, cfg.label, cfg.color, 15);
    this.shake = Math.max(this.shake, 4);
  }
}
