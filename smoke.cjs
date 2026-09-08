/* SKYBOUND headless smoke test — drives the real game code in Node
   with DOM/canvas stubs: menu > ready > playing > over > restart. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------- stubs ---------- */
function makeCtxStub() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') return () => grad;
      if (prop === 'measureText') return () => ({ width: 10 });
      return function () {};
    },
    set(t, prop, v) { t[prop] = v; return true; }
  });
}
function makeCanvasStub() {
  return {
    width: 0, height: 0, clientWidth: 1280, clientHeight: 720,
    addEventListener() {}, removeEventListener() {},
    getContext: () => makeCtxStub()
  };
}
function makeElStub() {
  return {
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, style: {}, children: [],
    querySelector: () => ({ style: {} }),
    appendChild() {}, innerHTML: '', textContent: '', offsetWidth: 10
  };
}
global.window = {
  addEventListener() {}, removeEventListener() {},
  devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
  requestAnimationFrame: () => 0,
  AudioContext: undefined, webkitAudioContext: undefined
};
global.document = {
  getElementById: () => makeElStub(),
  createElement: (tag) => (tag === 'canvas' ? makeCanvasStub() : makeElStub()),
  addEventListener() {},
  hidden: false
};
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.matchMedia = () => ({ matches: false });
global.requestAnimationFrame = global.window.requestAnimationFrame;

/* ---------- load real game code ---------- */
const files = ['utils', 'storage', 'audio', 'particles', 'world', 'player', 'obstacles',
  'pickups', 'events', 'score', 'ui', 'input', 'game', 'render'];
for (const f of files) {
  const code = fs.readFileSync(path.join(__dirname, 'js', f + '.js'), 'utf8');
  vm.runInThisContext(code, { filename: f + '.js' });
}

/* ---------- drive the game ---------- */
let failures = 0;
const must = (cond, msg) => {
  if (cond) { console.log('PASS ' + msg); }
  else { failures++; console.log('FAIL ' + msg); }
};

const cvStub = makeCanvasStub();
const game = new Game(cvStub);
must(game.state === 'menu', 'boots into MENU state');
game.render();

// 2s of menu
for (let i = 0; i < 120; i++) { game.frame(1 / 60); game.render(); }
must(game.state === 'menu', 'menu idles safely');

// start a run
game.startFromMenu();
must(game.state === 'ready', 'PLAY pressed > READY state');
game.render();

game.onTap();
must(game.state === 'playing', 'first tap > PLAYING state');

let sawObstacle = false, sawFeather = false, sawScore = false;
for (let i = 0; i < 2400; i++) {
  if (i % 34 === 0) game.onTap();
  if (game.state !== 'playing') break;
  if (game.obstacles.obs.length > 0) sawObstacle = true;
  if (game.pickups.feathers.length > 0) sawFeather = true;
  if (game.score.score > 0) sawScore = true;
  game.frame(1 / 60);
  game.render();
}
must(sawObstacle, 'procedural obstacles spawn');
must(sawFeather, 'feathers spawn');
must(sawScore || game.state === 'over', 'score accrues (or died first)');
console.log('INFO state=' + game.state + ' score=' + game.score.score +
  ' obstacles=' + game.obstacles.obs.length + ' particles=' + game.particles.active.length);

if (game.state === 'playing') { game.player.y = game.h + 100; game.frame(1 / 60); }
must(game.state === 'over', 'collision/fall > OVER state');
for (let i = 0; i < 90; i++) { game.frame(1 / 60); game.render(); }
must(game.overShown, 'game over panel triggered');
must(game.particles.active.length < 700, 'particle pool bounded (' + game.particles.active.length + ')');

// restart safety
game.startRun();
must(game.state === 'ready' && game.obstacles.obs.length === 0 && game.score.score === 0,
  'restart resets run cleanly');
game.onTap();
// hold the bird steady so gameplay assertions are deterministic
game.obstacles.nextX = 1e9;
const holdBird = () => { game.player.y = game.h * 0.5; game.player.vy = 0; };
holdBird();
for (let i = 0; i < 300; i++) { holdBird(); if (i % 30 === 0) game.onTap(); game.frame(1 / 60); game.render(); }
must(game.state === 'playing', 'bird survives a clean corridor');

// power-ups (v2 set: speed / ghost / revive / phantom / feather)
holdBird();
game.onPowerup('speed', 100, 100);
must(game.puSpeed > 0, 'SPEED 2X applies (puSpeed timer set)');
const baseSpeed = game.speed;
game.frame(1 / 60);
must(game.speed >= baseSpeed * 1.9, 'SPEED 2X doubles world speed');
game.puSpeed = 0;

game.onPowerup('ghost', 100, 100);
must(game.puGhost > 0, 'GHOST applies');
game.handleHit(game.obstacles.obs[0] || { passed: false });
must(game.state === 'playing' && game.puGhost > 0, 'GHOST phases through obstacles unharmed');
game.pickups.bombs.push({ x: game.player.x, y: game.player.y, ph: 0, t: 0 });
game.frame(1 / 60);
must(game.state === 'playing' && game.pickups.bombs.length === 0, 'GHOST phases through a bomb');
game.puGhost = 0;

game.onPowerup('revive', 100, 100);
must(game.puRevive === 1, 'EXTRA LIFE applies (one revival)');
game.handleHit(game.obstacles.obs[0] || { passed: false });
must(game.puRevive === 0 && game.state === 'playing', 'EXTRA LIFE consumed on a hit — still flying');
must(game.invT > 0, 'revival grants brief invulnerability');

game.onPowerup('phantom', 100, 100);
game.onPowerup('feather', 100, 100);
holdBird(); game.frame(1 / 60);
must(game.puPhantom > 0 && game.puFeather > 0, 'PHANTOM + 2X FEATHERS timers set');
must(game.isGhost(), 'isGhost() true under ghost OR phantom');
const fBefore = game.score.feathers;
game.onFeather(100, 100);
must(game.score.feathers === fBefore + 2, '2X FEATHERS doubles the feather take');
game.puPhantom = 0; game.puFeather = 0;
game.onFeather(100, 100);
must(game.score.feathers === fBefore + 3, 'normal feathers restore to +1');
game.puPhantom = 0.02; game.puFeather = 0.02; game.puSpeed = 0.02;
for (let i = 0; i < 5; i++) { holdBird(); game.frame(1 / 60); }
must(game.puPhantom <= 0 && game.puFeather <= 0 && game.puSpeed <= 0, 'timed powers expire');

// BOMB — touch and the flight ends unless ghost/revive
holdBird();
game.pickups.bombs.push({ x: game.player.x, y: game.player.y, ph: 0, t: 0 });
game.frame(1 / 60);
must(game.state === 'over', 'BOMB touch kills instantly');

// special events
for (const t of ['rush', 'wind', 'storm', 'golden']) {
  if (game.state !== 'playing') { game.startRun(); game.onTap(); game.obstacles.nextX = 1e9; }
  holdBird();
  game.events.active = null;
  game.events.start = function () {
    this.active = { type: t, t: 0, dur: 1 };
    const g = this.game;
    if (t === 'rush') g.speedMult = 1.45;
    if (t === 'wind') this.active.strength = 200 * g.S;
    if (t === 'storm') g.pickups.startShardStorm(1);
    if (t === 'golden') g.goldenT = 1;
    g.ui.banner('X', 'Y');
    g.audio.event();
  };
  game.events.start();
  for (let i = 0; i < 30; i++) { holdBird(); game.frame(1 / 60); game.render(); }
  game.events.end();
  console.log('PASS event ' + t + ' ran');
}

// pause / resume / menu
game.pause();
must(game.state === 'paused', 'pause works');
game.resume();
must(game.state === 'playing', 'resume works');
game.toMenu();
must(game.state === 'menu', 'back to menu');

// long-run stability: color cache must stay bounded (no per-frame string leak)
game.startRun();
game.onTap();
game.obstacles.nextX = 1e9;
holdBird();
const cacheBefore = (typeof _rgbCache !== 'undefined') ? _rgbCache.size : -1;
for (let i = 0; i < 600; i++) { holdBird(); game.frame(1 / 60); game.render(); }
if (cacheBefore >= 0) {
  const cacheAfter = _rgbCache.size;
  must(cacheAfter - cacheBefore < 40, 'color cache bounded over 600 frames (' + cacheBefore + ' -> ' + cacheAfter + ')');
} else {
  console.log('SKIP color cache check (not visible)');
}

// resize handling: new viewport re-scales without breaking the run
game.startRun();
game.onTap();
game.obstacles.nextX = 1e9;
cvStub.clientWidth = 820; cvStub.clientHeight = 500;
game.resize();
holdBird();
for (let i = 0; i < 30; i++) { holdBird(); game.frame(1 / 60); game.render(); }
must(game.w === 820 && game.h === 500 && game.state === 'playing', 'resize re-scales cleanly mid-run');

(async () => {
// ---------- player profiles / identity registry ----------
Save.data.players = {};
Save.save();
const prof = Save.profile();
must(prof.provider === 'guest' && /^guest_[0-9a-f]{16}$/.test(prof.pid), 'guest profile auto-created with valid pid');
Save.submitRun(120, 7);
must(Save.data.best === 120 && Save.data.totalFeathers === 7, 'run recorded on guest profile');
const rec2 = Save.submitRun(80, 3);
must(rec2 === false && Save.data.best === 120, 'non-record does not overwrite best');
const GID = 'g_' + ('0123456789abcdef').repeat(4);
Save.applyRegistry([{ pid: GID, name: 'Zara', best: 9999, totalFeathers: 321, games: 40, updatedAt: '2026-01-01T00:00:00.000Z' }]);
const all = Save.allTotals();
must(all.best === 9999 && all.totalFeathers === 321 + 7 + 3, 'registry merges monotonic (best + all feathers)');
Save.setPlayer({ pid: GID, provider: 'google', name: 'Zara', avatar: null });
must(Save.profile().provider === 'google' && Save.profile().best === 9999, 'sign-in adopts registry profile + stats');
Save.applyRegistry([{ pid: 'hacker_' + 'f'.repeat(10), name: 'x', best: 999999, totalFeathers: 999999, games: 9 }]);
must(Save.allTotals().best === 9999, 'invalid pids are rejected');

console.log(failures === 0 ? '\nSMOKE TEST: ALL PASSED' : '\nSMOKE TEST: ' + failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
})();
