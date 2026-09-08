# SKYBOUND — Player ID Registry (signed-in players)

This folder is the **cross-device identity bridge** for Skybound. It is
`fetch()`ed by the game (best-effort, 404-safe) so that every player can
see the **all-players highest score and total feathers** on the main menu.

## How identity works

- Google sign-in hands the game an **ID token (JWT)**.
- The game verifies it on-device (issuer `accounts.google.com`, expected
  **audience** = your web client id, expiry, `email_verified`).
- The player id stored is **`g_` + salted SHA-256 of the Google `sub`**
  (see `js/auth.js` / `js/storage.js`).
- **No email, no name, no Google sub, no profile picture are ever stored
  in `players.json`.** Only the pseudonymous hash + lifetime stats.

## Why this is safe for a static site (and where it is NOT)

| Concern | Status |
|---|---|
| Privacy of player identity | ✅ Hashed pids only, no PII anywhere |
| Token forgery (someone writes a fake pid + huge score into `players.json`) | ⚠️ **Not prevented** — a static site has no server to verify tokens |
| Cross-device progress | ✅ Monotonic merge via exported cards |
| Cheating the leaderboard | ⚠️ Not prevented without a small backend |

The registry is **honesty-based**: it makes the "all players" totals real
for the people who play fair. If you ever want tamper-proof global stats,
you need a tiny backend (e.g. Cloudflare Worker / Firebase Functions) that
verifies the Google JWT and stores the hashed pid + score server-side.
Skybound's code is structured so that swap is a single `fetchRegistry()`
replacement in `js/main.js`.

## Owner workflow — publishing signed-in players

1. Ask players to press **EXPORT CARD** on the menu. They get a file like
   `skybound-card-g_0f3a….json` containing only the hashed pid + stats.
2. Place those files in this folder (or paste them into `merge.cjs`).
3. Run the merge tool:
   ```
   node data/players/merge.cjs
   ```
   It validates every card (schema + **salted-hash re-check** via
   `js/storage.js` rules), merges monotonically into `players.json`,
   sorts by total feathers, and writes the published registry.
4. Commit + push `players.json` (and this README). GitHub Pages serves it
   at `data/players/players.json` and the game picks it up automatically.

## Setting up Google Sign-In (one-time, owner)

1. Go to <https://console.cloud.google.com/apis/credentials> (create a
   project if needed).
2. **Create credentials → OAuth client ID → Web application.**
3. Add your site URL under **Authorized JavaScript origins**:
   - `https://sharmapoonam87.github.io` (and `http://localhost:*` for testing)
   - Your future custom domain if you point one at the repo.
   No **redirect URIs** are needed — Skybound uses the
   `prompt('popup')` flow from Google's JS client.
4. Copy the **Client ID** (looks like `xxxx….apps.googleusercontent.com`)
   into `GOOGLE_CLIENT_ID` at the top of `js/auth.js`. Commit and push.
5. Everyone who opens the site now sees **Sign in with Google**.

Until step 4 is done the button stays visible but shows a friendly
**"NOT CONFIGURED"** notice; the game runs fully in guest mode regardless.