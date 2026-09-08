'use strict';
/* ============================================================
   SKYBOUND · storage.js — local persistence (no backend) + player
   profiles. Save v2: stats are tracked per player identity ID.
   Signed-in (Google) players get a pseudonymous salted SHA-256 ID
   (pid) — no raw email / Google sub is ever stored. Guests get a
   random local ID. Cross-device sync happens through the
   data/players/registry (see data/players/README.md).
   ============================================================ */
const _pepper = 'skybound::v2::pid';

const Save = {
  KEY: 'skybound.save.v2',
  LEGACY_KEY: 'skybound.save.v1',
  data: {
    best: 0,
    totalFeathers: 0,
    games: 0,
    sound: true,
    music: true,
    shake: true,
    fx: true,
    activePid: null,     // null -> guest pilot
    players: {}          // pid -> profile { pid, provider, name, avatar, best, totalFeathers, games, firstSeen, lastSeen }
  },

  /* ---------- low-level ---------- */
  load() {
    try {
      // migrate legacy v1 save into a guest profile
      const legacy = localStorage.getItem(this.LEGACY_KEY);
      if (legacy) {
        const old = JSON.parse(legacy);
        if (!localStorage.getItem(this.KEY)) {
          const guest = this._makeGuest();
          guest.best = old.best || 0;
          guest.totalFeathers = old.totalFeathers || 0;
          this.data.players[guest.pid] = guest;
          this.data.activePid = guest.pid;
          this.data.best = guest.best;
          this.data.totalFeathers = guest.totalFeathers;
          if (old.sound !== undefined) this.data.sound = old.sound;
          if (old.music !== undefined) this.data.music = old.music;
          if (old.shake !== undefined) this.data.shake = old.shake;
          if (old.fx !== undefined) this.data.fx = old.fx;
        }
        localStorage.removeItem(this.LEGACY_KEY);
      }
    } catch (e) { /* private mode / corrupted — defaults stand */ }

    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const k in this.data) {
          if (parsed[k] !== undefined) this.data[k] = parsed[k];
        }
        if (!this.data.players) this.data.players = {};
      }
    } catch (e) { /* storage unavailable — game still fully playable */ }

    this.save();
    return this.data;
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); }
    catch (e) { /* storage unavailable — game still fully playable */ }
  },

  /* ---------- identity ---------- */
  _makeGuest() {
    const pid = 'guest_' + this._randId();
    const now = Date.now();
    return { pid, provider: 'guest', name: 'SKY PILOT', avatar: null,
             best: 0, totalFeathers: 0, games: 0, firstSeen: now, lastSeen: now };
  },

  _randId() {
    let c;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      c = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
    } else {
      c = '';
      for (let i = 0; i < 16; i++) c += '0123456789abcdef'[(Math.random() * 16) | 0];
    }
    return c;
  },

  /* Active player profile — always exists (guest fallback). */
  profile() {
    const d = this.data;
    if (d.activePid && d.players[d.activePid]) {
      const p = d.players[d.activePid];
      p.lastSeen = Date.now();
      d.best = p.best; d.totalFeathers = p.totalFeathers; d.games = p.games;
      return p;
    }
    const guest = this._makeGuest();
    d.players[guest.pid] = guest;
    d.activePid = guest.pid;
    d.best = 0; d.totalFeathers = 0; d.games = 0;
    return guest;
  },

  /* Adopt an identity (Google sign-in or known pid). Keeps local
     progress if this pid already exists on this device. */
  setPlayer(info) {
    const d = this.data;
    const pid = info.pid;
    const now = Date.now();
    let p = d.players[pid];
    if (!p) {
      p = { pid, provider: info.provider || 'guest', name: info.name || 'SKY PILOT',
            avatar: info.avatar || null, best: 0, totalFeathers: 0, games: 0,
            firstSeen: now, lastSeen: now };
      d.players[pid] = p;
    } else {
      if (info.name && info.name !== p.name) p.name = info.name;
      if (info.avatar) p.avatar = info.avatar;
      p.provider = info.provider || p.provider;
      p.lastSeen = now;
    }
    d.activePid = pid;
    d.best = p.best; d.totalFeathers = p.totalFeathers; d.games = p.games;
    this.save();
    return p;
  },

  signOut() {
    this.data.activePid = null;
    this.save();
  },
/*__CHUNK_B__*/
  /* ---------- run recording ---------- */
  submitRun(score, feathers) {
    const p = this.profile();
    const isRecord = score > this.data.best;
    if (isRecord) { p.best = score; this.data.best = score; }
    p.totalFeathers += feathers;
    p.games++;
    p.lastSeen = Date.now();
    this.data.totalFeathers = p.totalFeathers;
    this.data.games = p.games;
    this.save();
    return isRecord;
  },

  /* Aggregates across every player seen on this device (+ registry). */
  allTotals() {
    let best = 0, feathers = 0, games = 0, count = 0;
    for (const pid in this.data.players) {
      const p = this.data.players[pid];
      count++;
      if (p.best > best) best = p.best;
      feathers += p.totalFeathers;
      games += p.games;
    }
    return { best, totalFeathers: feathers, games, count };
  },

  /* Merge a published registry (data/players/players.json).
     Monotonic merge — never lose progress, never double-count. */
  applyRegistry(players) {
    if (!players || !players.length) return;
    let changed = false;
    for (const rp of players) {
      if (!rp || typeof rp.pid !== 'string' || !rp.pid.length) continue;
      const valid = /^g_[0-9a-f]{64}$/.test(rp.pid) || /^guest_[0-9a-f]{16}$/.test(rp.pid);
      if (!valid) continue;
      const p = this.data.players[rp.pid];
      if (!p) {
        this.data.players[rp.pid] = {
          pid: rp.pid, provider: rp.provider === 'google' ? 'google' : 'guest',
          name: rp.name || 'SKY PILOT', avatar: null,
          best: rp.best || 0, totalFeathers: rp.totalFeathers || 0,
          games: rp.games || 0, firstSeen: rp.firstSeen || Date.now(),
          lastSeen: rp.updatedAt || Date.now()
        };
        changed = true;
      } else {
        if (rp.best > p.best) { p.best = rp.best; changed = true; }
        if (rp.totalFeathers > p.totalFeathers) { p.totalFeathers = rp.totalFeathers; changed = true; }
        if (rp.games > p.games) { p.games = rp.games; changed = true; }
        if (rp.name) p.name = rp.name;
      }
    }
    if (changed) this.save();
  },

  /* ---------- hashing (pseudonymization) ---------- */
  async hashId(raw) {
    const salted = raw + '::' + _pepper;
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salted));
        return Array.from(new Uint8Array(buf), b => ('0' + b.toString(16)).slice(-2)).join('');
      }
    } catch (e) { /* fall through to FNV fallback */ }
    // deterministic 64-bit FNV-1a fallback (offline / file://)
    let h = 0xcbf29ce484222325;
    for (let i = 0; i < salted.length; i++) {
      h ^= salted.charCodeAt(i);
      h = (h * 0x100000001b3) & 0xffffffffffffffff;
    }
    let hex = '';
    for (let shift = 0; shift < 64; shift += 4) hex += '0123456789abcdef'[(h >> shift) & 15];
    return hex.padStart(16, '0') + '000000000000000000000000';
  },
};
Save.load();