# Windows executable (VPS-style instance)

For a **full desktop app** (installer, setup wizard for VPS slot, windowed hosted terminal), see **[DESKTOP-APP.md](./DESKTOP-APP.md)**.

The scraper can also be packaged as a **standalone `.exe`** (Node 18 runtime embedded) so you can run it on a Windows PC without installing Node — useful to simulate **VPS 2**, **VPS 3**, etc., by setting a unique `SOURCE_ID`.

## Build (on Mac or Windows)

From the repo root:

```bash
npm install
npm run build:win
```

Output: **`dist/live-odds-scraper.exe`** (~40MB+).

- You can build the Windows `.exe` **from macOS**; `pkg` cross-compiles.
- Re-run `npm run build:win` after code or env-example changes.

## Run on Windows

1. Copy **`live-odds-scraper.exe`** to a folder, e.g. `C:\OddsLocker\scraper-vps2\`.
2. Copy your **`.env`** into that **same folder** (same variables as on the VPS: poll URLs, cookies, `TERMINAL_URL`, etc.).
3. Set a distinct source id for this machine, e.g. in `.env`:

   ```env
   SOURCE_ID=vps2
   ```

   (Must match a slot your terminal maps — e.g. `vps1` … `vps6` or `scraper2`.)

4. Double-click the exe **or** from `cmd` / PowerShell:

   ```bat
   cd C:\OddsLocker\scraper-vps2
   live-odds-scraper.exe
   ```

5. Leave the window open; logs print like `node src/index.js`. Stop with Ctrl+C.

`dotenv` loads **`.env` from the current working directory** — so always run the exe from the folder that contains `.env`, or use shortcuts that set “Start in” to that folder.

## Firewall

Allow **outbound HTTPS** (books APIs, `TERMINAL_URL`) and optionally **inbound** on `WS_SERVER_PORT` (default **8765**) if you use the local WebSocket.

## SmartScreen / antivirus

Single-file Node binaries are sometimes flagged as **false positives**. If Windows blocks the file, use “More info → Run anyway” or add an exclusion for your folder.

## Debug dumps

With `DEBUG_FANDUEL=1` or PointsBet debug enabled, response dumps are written to the **working directory** as `debug-fanduel-response.json` / `debug-pointsbet-response.json`.

## Alternative: no `.exe`

Installing [Node.js LTS](https://nodejs.org/) on Windows and running `npm install` + `npm start` in the repo is smaller and easier to update; the `.exe` is for convenience on machines without Node.
