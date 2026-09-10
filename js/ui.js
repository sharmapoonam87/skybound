'use strict';
/* ============================================================
   SKYBOUND · ui.js — HUD, screens, banners, power-up chips
   ============================================================ */
class UIManager {
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.els = {
      hud: $('hud'), score: $('hud-score'), best: $('hud-best'), feathers: $('hud-feathers'),
      combo: $('hud-combo'), powerups: $('hud-powerups'),
      banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
      tapHint: $('tap-hint'),
      menu: $('screen-menu'), how: $('screen-how'), settings: $('screen-settings'),
      pause: $('screen-pause'), over: $('screen-over'),
      menuBest: $('menu-best'), menuFeathers: $('menu-feathers'),
      goScore: $('go-score'), goBest: $('go-best'), goDistance: $('go-distance'),
      goFeathers: $('go-feathers'), goRecord: $('go-record')
    };
    this._bannerTimer = null;
  }

  showScreen(name) {
    for (const k of ['menu', 'how', 'settings', 'pause', 'over']) {
      this.els[k].classList.toggle('active', k === name);
    }
  }

  hideAll() { this.showScreen(null); }

  showHUD(v) { this.els.hud.classList.toggle('hidden', !v); }

  setTapHint(v) { this.els.tapHint.classList.toggle('hidden', !v); }

  updateMenuStats() {
    this.els.menuBest.textContent = pad(Save.data.best, 6);
    this.els.menuFeathers.textContent = Save.data.totalFeathers;
  }

  setHUD(score, best, feathers) {
    this.els.score.textContent = pad(score, 6);
    this.els.best.textContent = pad(best, 6);
    this.els.feathers.textContent = pad(feathers, 3);
  }

  setCombo(mult) {
    const el = this.els.combo;
    if (mult >= 2) {
      if (el.textContent !== 'x' + mult) {
        el.textContent = 'x' + mult;
        el.classList.remove('hidden');
        // retrigger pop animation
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
      }
    } else {
      el.classList.add('hidden');
    }
  }

  banner(title, sub) {
    const b = this.els.banner;
    this.els.bannerTitle.textContent = title;
    this.els.bannerSub.textContent = sub || '';
    b.classList.remove('hidden');
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => b.classList.add('hidden'), 2100);
  }

  /* live power-up chips with countdown bars */
  setPowerups(list) {
    const host = this.els.powerups;
    // rebuild only when the set changes
    const sig = list.map(p => p.kind).join(',');
    if (sig === this._puSig) {
      list.forEach((p, i) => {
        const bar = host.children[i] && host.children[i].querySelector('i');
        if (bar) bar.style.width = Math.round(p.frac * 100) + '%';
      });
      return;
    }
    this._puSig = sig;
    host.innerHTML = '';
    for (const p of list) {
      const div = document.createElement('div');
      div.className = 'pu-chip';
      div.style.color = p.color;
      div.innerHTML = '<span>' + p.label + '</span><span class="pu-bar"><i></i></span>';
      div.querySelector('i').style.width = Math.round(p.frac * 100) + '%';
      host.appendChild(div);
    }
  }

  showGameOver(d) {
    this.els.goScore.textContent = d.score;
    this.els.goBest.textContent = d.best;
    this.els.goDistance.textContent = d.distance + 'm';
    this.els.goFeathers.textContent = d.feathers;
    this.els.goRecord.classList.toggle('hidden', !d.record);
    this.showScreen('over');
  }
}