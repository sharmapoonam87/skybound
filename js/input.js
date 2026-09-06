'use strict';
/* ============================================================
   SKYBOUND · input.js — unified touch/mouse/keyboard.
   Tap anywhere = flap · SPACE = flap · P = pause · ENTER = go
   ============================================================ */
class InputSystem {
  constructor(game) {
    this.game = game;
    const c = game.canvas;

    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.game.audio.unlock();
      this.game.onTap();
    }, { passive: false });

    // block scroll/zoom gestures during play
    document.addEventListener('touchmove', (e) => {
      if (e.target === c) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => {
      if (e.target === c) e.preventDefault();
    });

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      switch (e.code) {
        case 'Space':
        case 'ArrowUp':
          e.preventDefault();
          this.game.audio.unlock();
          this.game.onTap();
          break;
        case 'KeyP':
        case 'Escape':
          e.preventDefault();
          this.game.togglePause();
          break;
        case 'Enter':
          e.preventDefault();
          this.game.audio.unlock();
          this.game.confirm();
          break;
      }
    });
  }
}
