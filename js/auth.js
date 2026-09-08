'use strict';
/* ============================================================
   SKYBOUND · auth.js — Google Sign-In (static-site friendly)
   ------------------------------------------------------------
   Uses Google's official client library (accounts.google.com/gsi/client),
   which performs the OAuth dance and hands back an ID token JWT.
   We decode + validate the token payload (issuer, audience, expiry,
   verified email) and then derive a PSEUDONYMOUS player id:
       pid = 'g_' + SHA-256(google_sub + fixed_salt)
   No raw email or Google subject id is ever written to storage or
   to the published data/players registry — only the hash.
   ------------------------------------------------------------
   NOTE FOR THE OWNER: paste your Google OAuth *Web* client ID into
   GOOGLE_CLIENT_ID (see data/players/README.md for a step-by-step
   guide).  Without it the button hides and the game still runs
   fully in guest mode.  A static GitHub Pages site cannot verify
   tokens server-side; the salted hash protects privacy, not
   anti-cheat — a competitive global leaderboard would need a
   small backend (documented in data/players/README.md).
   ============================================================ */
const GOOGLE_CLIENT_ID = '';
const GOOGLE_ISS = 'https://accounts.google.com';

const Auth = {
  booted: false,

  /* The Google library loads async — retry until it's available. */
  boot(retries = 12) {
    if (this.booted) return;
    if (!GOOGLE_CLIENT_ID) return; // not configured → guest mode
    if (this.ready()) {
      try {
        google.accounts.id.configure({
          client_id: GOOGLE_CLIENT_ID,
          auto_select: true
        });
        this.booted = true;
      } catch (e) { /* retry below */ }
    }
    if (!this.booted && retries > 0) setTimeout(() => this.boot(retries - 1), 400);
  },

  ready() {
    return typeof google !== 'undefined' && google.accounts && google.accounts.id;
  },

  configured() {
    return Boolean(GOOGLE_CLIENT_ID);
  },

  /* Returns { sub, email, name, picture } on success, throws otherwise. */
  async signIn() {
    if (!this.configured()) throw new Error('Google sign-in is not configured yet (missing client ID).');
    if (!this.booted) this.boot();
    if (!this.ready()) throw new Error('Google sign-in service is not available (offline?).');
    const credential = await google.accounts.id.prompt('popup');
    if (!credential || !credential.id_token) throw new Error('No identity received from Google.');
    const payload = this._decodeJwt(credential.id_token);
    if (!this._valid(payload)) throw new Error('Google identity failed verification.');
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: Boolean(payload.email_verified),
      name: payload.name || 'Sky Pilot',
      picture: payload.picture || null
    };
  },

  async playerFor(profile) {
    const hash = await Save.hashId(profile.sub);
    return { pid: 'g_' + hash, provider: 'google', name: profile.name, avatar: profile.picture };
  },

  _decodeJwt(token) {
    try {
      const part = token.split('.')[1];
      const json = decodeURIComponent(
        Array.prototype.map.call(atob(part.replace(/-/g, '+').replace(/_/g, '/')),
          ch => '%' + ('00' + ch.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
      return JSON.parse(json);
    } catch (e) { return null; }
  },

  _valid(p) {
    if (!p || typeof p !== 'object') return false;
    if (p.iss !== GOOGLE_ISS && p.iss !== 'accounts.google.com') return false;
    if (p.aud !== GOOGLE_CLIENT_ID) return false;
    if (!p.exp || p.exp < (Date.now() / 1000) - 30) return false;
    if (!p.email_verified) return false;
    return typeof p.sub === 'string' && p.sub.length > 0;
  }
};