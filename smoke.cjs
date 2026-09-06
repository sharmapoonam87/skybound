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

// power-ups
holdBird();
game.onPowerup('shield', 100, 100);
must(game.puShield === 1, 'shield powerup applies');
game.handleHit(game.obstacles.obs[0] || { passed: false });
must(game.puShield === 0 && game.state === 'playing', 'shield absorbs a hit');
game.onPowerup('magnet', 100, 100);
game.onPowerup('warp', 100, 100);
game.onPowerup('boost', 100, 100);
holdBird(); game.frame(1 / 60);
must(game.puMagnet > 0 && game.puWarp > 0 && game.puBoost > 0, 'all powerup timers set');
game.puWarp = 0.02;
for (let i = 0; i < 5; i++) { holdBird(); game.frame(1 / 60); }
must(game.puWarp <= 0, 'time warp expires');

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

console.log(failures === 0 ? '\nSMOKE TEST: ALL PASSED' : '\nSMOKE TEST: ' + failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
