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

### Troubleshooting: single-VPS snapshot

By default the terminal **keeps** the last payload per `sourceId` and **merges** them (so VPS1 + VPS3 both appear). To debug one scraper in isolation, set on the **terminal** host:

`TERMINAL_REPLACE_ALL_ON_INGEST=1`

Then **every** `POST /ingest` clears all stored odds (and league watcher) before applying that body, so the live feed shows **only** that request. Remove or unset the variable to restore multi-VPS merge.

If **other** VPS scrapers are still posting (including empty payloads), their ingests can **overwrite** yours—pause them or unset this flag when not troubleshooting.

While this flag is on, **empty** `data: []` ingests are **ignored** (no clear, no update) so a stale worker cannot wipe the feed. To clear the board, turn the flag off or POST from a client that sends real rows.

## Deploy (e.g. Railway)

Deploy the `terminal` folder as its own service. Set `PORT` if needed (Railway sets it). Use the service’s public URL as `TERMINAL_URL` in your scrapers, and connect your website to `wss://<that-url>` for the live feed.
