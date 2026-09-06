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