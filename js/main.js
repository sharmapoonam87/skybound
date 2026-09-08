'use strict';
/* ============================================================
   SKYBOUND · main.js — bootstrap & UI wiring
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  window.SKYBOUND = game; // debugging handle

  const $ = (id) => document.getElementById(id);

  const on = (id, fn) => {
    $(id).addEventListener('click', (e) => {
      e.stopPropagation();
      game.audio.unlock();
      game.audio.click();
      fn();
    });
  };

  on('btn-play', () => game.startFromMenu());
  on('btn-how', () => game.ui.showScreen('how'));
  on('btn-how-back', () => game.ui.showScreen(game.state === 'menu' ? 'menu' : null));
  on('btn-settings', () => game.ui.showScreen('settings'));
  on('btn-set-back', () => game.ui.showScreen(game.state === 'menu' ? 'menu' : null));
  on('btn-pause', () => game.togglePause());
  on('btn-resume', () => game.resume());
  on('btn-restart', () => game.restart());
  on('btn-menu3', () => game.toMenu());
  on('btn-retry', () => game.startRun());
  on('btn-menu2', () => game.toMenu());

  /* settings toggles */
  const syncToggles = () => {
    $('tg-sound').classList.toggle('on', Save.data.sound);
    $('tg-music').classList.toggle('on', Save.data.music);
    $('tg-shake').classList.toggle('on', Save.data.shake);
    $('tg-fx').classList.toggle('on', Save.data.fx);
  };
  syncToggles();
  game._syncToggles = syncToggles;

  on('tg-sound', () => { game.audio.setSound(!Save.data.sound); syncToggles(); });
  on('tg-music', () => { game.audio.setMusic(!Save.data.music); syncToggles(); });
  on('tg-shake', () => { Save.data.shake = !Save.data.shake; Save.save(); syncToggles(); });
  on('tg-fx', () => { Save.data.fx = !Save.data.fx; Save.save(); syncToggles(); });

  /* ---------- identity: Google sign-in + player registry ---------- */
  Auth.boot();

  const updateAuthUI = () => {
    const p = Save.profile();
    const btn = $('btn-google');
    if (p.provider === 'google') {
      btn.textContent = 'SIGN OUT';
      btn.className = 'btn btn-ghost btn-g';
    } else {
      btn.textContent = 'Sign in with Google';
      btn.className = 'btn btn-g';
    }
    game.ui.updateMenuStats();
  };

  on('btn-google', async () => {
    const p = Save.profile();
    if (p.provider === 'google') {
      Save.signOut();
      updateAuthUI();
      game.ui.updateMenuStats();
      return;
    }
    if (!Auth.configured()) {
      game.ui.banner('GOOGLE SIGN-IN', 'NOT CONFIGURED — ADD YOUR CLIENT ID');
      return;
    }
    try {
      const cred = await Auth.signIn();
      const player = await Auth.playerFor(cred);
      Save.setPlayer(player);
      updateAuthUI();
      game.ui.banner('WELCOME BACK', cred.name || 'SKY PILOT');
    } catch (e) {
      game.ui.banner('SIGN-IN FAILED', e.message || 'Try again');
    }
  });

  on('btn-export', () => {
    const card = Save.exportCard();
    try {
      const blob = new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'skybound-card-' + card.pid.slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      prompt('Your SKYBOUND player card (paste me into the merge tool):', JSON.stringify(card, null, 2));
    }
  });

  /* load published all-players totals (best effort — 404-safe) */
  const fetchRegistry = () => {
    fetch('data/players/players.json', { cache: 'no-cache' })
      .then(r => {
        if (!r.ok) throw new Error('no registry');
        return r.json();
      })
      .then(data => { Save.applyRegistry(data && data.players ? data.players : []); updateAuthUI(); })
      .catch(() => { /* no registry published — guest mode works fine */ })
      .finally(() => { updateAuthUI(); game.ui.updateMenuStats(); });
  };
  fetchRegistry();

  /* auto-pause when tab loses focus mid-flight */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (game.state === 'playing' || game.state === 'ready')) {
      game.pause();
    }
  });

  /* menu stats + first frame */
  game.ui.updateMenuStats();
  game.ui.showScreen('menu');
  game.ui.showHUD(false);
});