# OddsLocker Engine (channel-based)

Standalone **brain + channels + batches + residential proxies + control UI**.

This package replaces the multi-VPS → Railway terminal hub flow for your new architecture. The legacy scraper (`src/index.js`) and `terminal/` are left untouched so you can roll back via:

- git tag `v-pre-channel-engine`
- git branch `backup/vps-terminal-era`

## What it does

1. **Channels** — adaptive pool (add/remove count). Each sync session picks the coldest enabled channels.
2. **Batches** — group sportsbooks. Session needs **one channel per non-empty batch**, all fired together (sync snapshot).
3. **Proxies** — residential pool. A channel acquires one proxy per batch run; failures auto-rotate / mark bad.
4. **Pages** — Channels (fleet deck), Batches, Proxies, Live feed, League watcher, JSON, Settings.
5. **Webhook** — optional `WEBHOOK_URL` push of the finished JSON snapshot to your website.

## Run

```bash
cd odds-engine
cp .env.example .env
# Point book URLs at repo root .env OR copy keys into odds-engine/.env
npm install
npm start
```

Open **http://localhost:3100**

Book adapters are imported from the repo’s `src/adapters/` (shared parsers). The engine’s *application spine* does not use the old VPS ingest hub.

## Sync model

```
poll tick
  → need N = number of batches
  → pick N coldest channels
  → each channel + 1 proxy + 1 batch (books) in parallel
  → merge → one snapshot → UI/WS (+ webhook)
```

## Mess control

- New code lives only under `odds-engine/`
- Do not wire this into `terminal/src` ingest as the primary path
- When this engine is proven, retire old hub usage deliberately — don’t half-migrate
