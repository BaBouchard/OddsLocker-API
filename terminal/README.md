# Live Odds Terminal

Central aggregator for the scraper: receives odds from one or more scrapers (e.g. on VPS), merges by source, and broadcasts a single live feed to website clients over WebSocket.

## Run locally

```bash
cd terminal
npm install
npm start
```

- **HTTP:** `http://localhost:3000`
- **Ingest (scrapers):** `POST http://localhost:3000/ingest`  
  Body: `{ "sourceId": "vps1", "data": [ ...normalized odds entries ] }`
- **Live feed (website):** `ws://localhost:3000`
- **Health:** `GET http://localhost:3000/health`

## Scraper → Terminal

In the scraper (repo root) set:

- `TERMINAL_URL=http://localhost:3000` (or your terminal’s public URL)
- `SOURCE_ID=vps1` (unique per scraper instance)

Then run the scraper as usual; it will POST each update to the terminal. The terminal merges all sources and broadcasts to WebSocket viewers in the same format as the scraper’s local WebSocket (`{ type: 'odds', data, ts }`).

## WebSocket auth (main website / paid access)

Set **`TERMINAL_WS_ALLOWED_TOKENS`** on the terminal to a **comma-separated** list of secret strings (no commas inside a token). Each string is one revocable “seat” you can give a customer.

**Connect using either:**

1. **Query string (typical in browsers):**  
   `wss://<your-host>/?token=<customer_token>`
2. **Header (Node/scripts):**  
   `Authorization: Bearer <customer_token>`

Validation uses **constant-time** comparison per token.

**Dashboard (this repo’s HTML):** If **`TERMINAL_LOGIN_PASSWORD`** is set, open the UI after login; the browser sends the **`ol_auth` cookie** on the WebSocket handshake (no token in the URL).

If you use **tokens but no login password**, the public HTML page cannot open a socket without a token — use **`https://<host>/?token=<one-of-your-tokens>`** when you want to view the dashboard, or rely on your main site for the live feed.

**Operational notes:**

- Rotate a single customer: remove their token from the list and redeploy (or hot-reload env).
- Tokens in URLs may appear in **access logs**; prefer **`Authorization: Bearer`** for server-side clients when possible.
- **`POST /ingest`** is unchanged (still **`TERMINAL_INGEST_SECRET`** for scrapers only).

### Troubleshooting: single-VPS snapshot

By default the terminal **keeps** the last payload per `sourceId` and **merges** them (so VPS1 + VPS3 both appear). To debug one scraper in isolation, set on the **terminal** host:

`TERMINAL_REPLACE_ALL_ON_INGEST=1`

Then **every** `POST /ingest` clears all stored odds (and league watcher) before applying that body, so the live feed shows **only** that request. Remove or unset the variable to restore multi-VPS merge.

If **other** VPS scrapers are still posting (including empty payloads), their ingests can **overwrite** yours—pause them or unset this flag when not troubleshooting.

While this flag is on, **empty** `data: []` ingests are **ignored** (no clear, no update) so a stale worker cannot wipe the feed. To clear the board, turn the flag off or POST from a client that sends real rows.

## Deploy (e.g. Railway)

Deploy the `terminal` folder as its own service. Set `PORT` if needed (Railway sets it). Use the service’s public URL as `TERMINAL_URL` in your scrapers, and connect your website to `wss://<that-url>` for the live feed.

### Blank table but scrapers “push OK”?

1. Open **`/health`** — check `ws.tokenAuthEnabled` and `ws.tokenSlots`. If `sources` &gt; 0, data is in memory; the issue is usually **WebSocket auth** (not ingest).
2. If **`TERMINAL_WS_ALLOWED_TOKENS`** is set: external sites must use **`wss://host/?token=…`** or **`Authorization: Bearer`**. The hosted dashboard still works with the **login cookie** if **`TERMINAL_LOGIN_PASSWORD`** is set.
3. If only **`TERMINAL_LOGIN_PASSWORD`** is set (no tokens): log in, then **hard-refresh** so the `Secure` cookie is sent on `wss://`. The app uses **`trust proxy`** (disable with `TRUST_PROXY=0` only for local HTTP).
4. Try **Export CSV** — if rows appear, ingest works; fix WebSocket/auth as above.
5. Scrapers must get **HTTP 200** from `POST /ingest`. **401** on ingest = fix `TERMINAL_INGEST_SECRET` (no extra spaces).
