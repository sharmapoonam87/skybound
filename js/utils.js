'use strict';
/* ============================================================
   SKYBOUND · utils.js — shared math & helper toolkit
   ============================================================ */
const TAU = Math.PI * 2;

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const pad = (n, len) => String(Math.max(0, Math.floor(n))).padStart(len, '0');

/* Frame-rate independent exponential smoothing */
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

/* Deterministic PRNG for per-obstacle decoration */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* --- Color helpers (parsed, cached) — accepts '#hex' and 'rgb(r,g,b)' --- */
const _rgbCache = new Map();
function hexRGB(color) {
  let c = _rgbCache.get(color);
  if (c) return c;
  if (color.charAt(0) === '#') {
    const n = parseInt(color.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else {
    const m = color.match(/(\d+(\.\d+)?)/g);
    c = m ? [+m[0], +m[1], +m[2]] : [255, 255, 255];
  }
  _rgbCache.set(color, c);
  return c;
}
function lerpColor(h1, h2, t) {
  const a = hexRGB(h1), b = hexRGB(h2);
  const r = (a[0] + (b[0] - a[0]) * t) | 0;
  const g = (a[1] + (b[1] - a[1]) * t) | 0;
  const bl = (a[2] + (b[2] - a[2]) * t) | 0;
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}
function rgbaStr(rgbArr, a) {
  return 'rgba(' + (rgbArr[0] | 0) + ',' + (rgbArr[1] | 0) + ',' + (rgbArr[2] | 0) + ',' + a + ')';
}

/* Circle vs axis-aligned rect */
function circleRect(cx, cy, r, x, y, w, h) {
  const nx = clamp(cx, x, x + w);
  const ny = clamp(cy, y, y + h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

const IS_TOUCH = (typeof matchMedia !== 'undefined') && matchMedia('(pointer:coarse)').matches;
