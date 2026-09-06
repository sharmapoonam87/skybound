# SKYBOUND — Infinity Flight

An original endless flying arcade game. Pilot **Lumivane**, a mystical skybird,
through floating ruins, crystal gates, sky temples, giant vines and cloud
caverns across a cinematic 7-phase day cycle — dawn to the aurora-lit mystical
night.

Pure HTML + CSS + JavaScript (Canvas 2D, WebAudio-synthesized sound). No
build step, no dependencies, no backend, no tracking.

## Run it

Double-click **`index.html`** — or serve the folder with any static server
(`npx serve .`, `python -m http.server`) and open it. Works offline (fonts
fall back gracefully).

## Controls

| Input | Action |
|---|---|
| Tap / Click / **SPACE** / **↑** | Flap |
| **P** / **ESC** | Pause |
| **ENTER** | Start · Retry · Resume |

## Systems

- **Constant flight speed** — the world accelerates by +36 px/s at every
  1000-point milestone (announced with a SPEED UP banner), capped at max speed.
- **Procedural generation** — obstacle type, gap position/size, decoration and
  movement are randomized with fairness guarantees (gap always reachable,
  moving gates clamped to safe bounds).
- **Combo** — chain gate passes within 6s for up to a x5 score multiplier.
- **Power-ups** — Sky Shield (absorbs one hit), Time Warp (slows the world),
  Feather Magnet, Score Boost.
- **Special events** — Sky Rush, Wind Zone, Crystal Storm, Golden Sky.
- **Environment** — 7 blended sky phases with parallax mountains, sprite-baked
  clouds, floating islands, weather, shooting stars and aurora.
- **Persistence** — best score, lifetime feathers and settings in
  `localStorage`.

## Project layout

```
index.html        canvas + HUD + screens
css/style.css     premium game UI
js/               utils · storage · audio · particles · world · player ·
                  obstacles · pickups · events · score · ui · input ·
                  game · render · main
smoke.cjs         headless Node smoke test (node smoke.cjs)
```
