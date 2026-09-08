/* ============================================================
   SKYBOUND · data/players/merge.cjs — owner-side registry builder
   ------------------------------------------------------------
   Usage:
     node data/players/merge.cjs                    # scan cards/
     node data/players/merge.cjs card1.json card2.json

   Reads Skybound player cards (Export Card on the menu), validates
   schema + pid format, merges monotonically into players.json and
   rewrites the published registry (sorted by total feathers).
   No PII is handled anywhere: pids are already salted hashes.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const REG = path.join(__dirname, 'players.json');
const CARD_DIR = path.join(__dirname, 'cards');

const PID_OK = (pid) => /^g_[0-9a-f]{64}$/.test(pid) || /^guest_[0-9a-f]{16}$/.test(pid);

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { throw new Error('cannot read ' + p + ': ' + e.message); }
}

function validateCard(c) {
  if (!c || c.schema !== 'skybound-player-card') return 'not a Skybound player card';
  if (typeof c.pid !== 'string' || !PID_OK(c.pid)) return 'invalid pid format';
  if (!Number.isFinite(c.best) || c.best < 0) return 'invalid best';
  if (!Number.isFinite(c.totalFeathers) || c.totalFeathers < 0) return 'invalid totalFeathers';
  if (!Number.isFinite(c.games) || c.games < 0) return 'invalid games';
  return null;
}

function main() {
  let reg = readJson(REG);
  if (!reg || !Array.isArray(reg.players)) reg = { schema: 'skybound-player-registry', version: 2, players: [] };

  const byPid = new Map(reg.players.map(p => [p.pid, p]));
  const files = process.argv.slice(2);
  const sources = files.length
    ? files
    : (fs.existsSync(CARD_DIR) ? fs.readdirSync(CARD_DIR).filter(f => f.endsWith('.json')).map(f => path.join(CARD_DIR, f)) : []);

  if (!sources.length) { console.log('No cards found. Drop exported cards into data/players/cards/ or pass paths.'); return; }

  let ok = 0, skipped = 0;
  for (const f of sources) {
    let card;
    try { card = readJson(f); } catch (e) { console.log('SKIP  ' + f + ' — ' + e.message); skipped++; continue; }
    const err = validateCard(card);
    if (err) { console.log('SKIP  ' + f + ' — ' + err); skipped++; continue; }

    const prev = byPid.get(card.pid);
    let merged;
    if (!prev) {
      merged = {
        pid: card.pid,
        provider: card.provider === 'google' ? 'google' : 'guest',
        name: card.name || (card.provider === 'google' ? 'Pilot' : 'SKY PILOT'),
        best: Math.floor(card.best),
        totalFeathers: Math.floor(card.totalFeathers),
        games: Math.floor(card.games),
        firstSeen: card.updatedAt || new Date().toISOString(),
        updatedAt: card.updatedAt || new Date().toISOString()
      };
    } else {
      merged = prev;
      if (card.best > prev.best) prev.best = Math.floor(card.best);
      if (card.totalFeathers > prev.totalFeathers) prev.totalFeathers = Math.floor(card.totalFeathers);
      if (card.games > prev.games) prev.games = Math.floor(card.games);
      prev.updatedAt = card.updatedAt || prev.updatedAt;
    }
    byPid.set(card.pid, merged);
    ok++;
    console.log('MERGE ' + f + '  (' + card.name + ' · ' + card.totalFeathers + ' feathers)');
  }

  const players = Array.from(byPid.values()).sort((a, b) => b.totalFeathers - a.totalFeathers || b.best - a.best);
  reg.players = players;
  reg.updatedAt = new Date().toISOString();
  fs.writeFileSync(REG, JSON.stringify(reg, null, 2) + '\n', 'utf8');
  console.log('\nWrote ' + players.length + ' player(s) -> ' + REG);
  if (skipped) console.log('Skipped ' + skipped + ' invalid card(s).');
}

main();