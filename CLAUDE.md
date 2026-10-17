# Office Royale — notes for contributors

Read `docs/DESIGN.md` first: the game design, decisions made so far (and why), current numbers, and the parked ideas (3rd-person shoulder view, lunch auction, art direction redo, title candidates, multiplayer plan).

- `public/js/sim/*` are the game rules. They must never touch `document`, `window`, `navigator`, timers, or three.js. Talk to the screen only through the `UI` hooks in `00-core.js`; read player input only from `actor.input` / `actor.aim`. The future server (Cloudflare Durable Object) will run these files as-is.
- `public/js/client/*` is browser-only: three.js quarter-view renderer (`20-render.js`), HUD, input, bootstrap. `client/40-main.js` binds the `UI` hooks.
- All scripts are classic `<script defer>` files sharing one global scope, loaded in filename order from `index.html`. Keep top-level code order-safe. No build step.
- Game coordinates are 2D pixels (x right, y down, floor 1540×1064). The renderer maps px → world units with `U = 1/36` (X = x·U, Z = y·U).
- After any rules change run `node tools/headless.mjs 5`: games should end in roughly 4–5 minutes with no errors.
- UI text is Korean.
