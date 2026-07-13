# OddsLocker Scraper v2.0.0 (Windows desktop)

Electron shell around `odds-engine` (channel / batch / residential proxy control UI).

## Dev

```bash
# terminal 1
cd odds-engine && npm start

# or let Electron spawn the engine:
cd desktop-v2
npm install
npm start
```

## Build Windows installer

From repo root (or `desktop-v2`):

```bash
cd desktop-v2
npm install
npm run dist
```

Output:

- `desktop-v2/release/OddsLocker-Scraper-Setup-2.0.0.exe`

Same logo as v1 (`desktop/assets` icons). App id remains `com.oddslocker.scraper`.

## Notes

- Engine runs on `http://127.0.0.1:3100` inside Electron.
- User `.env` is seeded into Electron userData from `bundled/default.env`.
- State / proxies persist under userData `engine-data/`.
- Legacy v1 desktop stays in `desktop/` (1.2.x). This package is the v2 channel-engine product.
