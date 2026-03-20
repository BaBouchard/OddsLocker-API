# OddsLocker Scraper — Windows desktop app

Windowed app with:

- **NSIS installer** (desktop shortcut, Start Menu, choose install folder).
- **First-run setup wizard**: pick **VPS 1–6**, enter **central terminal URL**, optional **ingest secret**, import **`.env`** (same book keys as your VPS).
- **Main window**: embedded **hosted OddsLocker terminal** (same site as Railway) so you see the full grid, login, and live feed. Session cookies persist in the app.
- **Background**: packaged **`scraper.exe`** runs with **no console**; reads merged **`.env`** from the app data folder.

> The **installer** copies the application. **Which VPS slot** is chosen in the **setup wizard on first launch** (and can be changed anytime under **File → Settings**). Fully custom NSIS pages are possible later; the wizard is the reliable cross-platform approach.

## Build the Windows installer (from repo root)

Requires Node 18+ on the machine that builds.

```bash
# 1) Root: scraper payload for pkg
cd /path/to/live-odds-ingestion
npm install
npm run build:win

# 2) Desktop: Electron + NSIS
cd desktop
npm install
npm run dist
```

Output: **`desktop/release/OddsLocker Scraper-Setup-1.0.0.exe`** (name follows `artifactName` in `desktop/package.json`).

- **`npm run predist`** runs automatically before `dist` and rebuilds `../dist/live-odds-scraper.exe`.
- Building the **installer** is typically done on **Windows** (electron-builder NSIS). You can run `npm run dist` on macOS only if your toolchain supports it; for fewer surprises, use Windows for release builds.

Quick unpacked folder (no installer): `cd desktop && npm run dist:dir`.

## End-user flow

1. Run **OddsLocker Scraper Setup.exe** → install → launch from desktop shortcut.
2. **Setup wizard**: select **VPS 2** (or any slot), paste terminal **HTTPS URL**, optional **TERMINAL_INGEST_SECRET**, **Choose .env** (copy from a working scraper).
3. **Finish & start** → main window loads your hosted terminal; scraper pushes as `SOURCE_ID=vps2` (or chosen slot).

**File → Settings** reopens the wizard (you can change slot/URL; re-import `.env` only if you need to update book secrets).

**Help → Open data folder** shows `%APPDATA%/oddslocker-scraper-desktop` (or similar) with `config.json` and `.env`.

## Build fails: `Cannot create symbolic link` / `winCodeSign` / 7-Zip

On some Windows accounts, electron-builder’s code-signing helper archive contains **symlinks**; extracting them needs extra permission.

**Fix (pick one):**

1. **Settings → System → For developers → Developer Mode → On** (Windows 11), then delete the bad cache and retry:
   ```bat
   rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign"
   cd C:\path\to\OddsLockerScraper\desktop
   npm run dist
   ```
2. Or open **Command Prompt as Administrator** and run `npm run dist` again.
3. The repo sets **`signAndEditExecutable: false`** for Windows so local builds skip signing (no cert needed). **Pull latest** `desktop/package.json` if you cloned before that change.

## Development

```bash
cd desktop
npm install
npm start
```

On **macOS**, `../dist/live-odds-scraper.exe` may be missing or not runnable; the app still opens the setup window and terminal view. Build the `.exe` on Windows or cross-compile from the repo root for a real scraper spawn test.

## Disengage / move a VPS slot to another PC

The terminal remembers the **last ingest per `SOURCE_ID`**. If two machines both push as `vps3`, they overwrite each other’s data for that slot.

**Before** you bring `vps3` up on a new machine:

1. On the **old** PC: **Scraper → Disengage (stop pushing to terminal)** (or quit the app).  
   - This **kills** the scraper process and sets **`pushingEnabled: false`** in `config.json` so a **restart** of the app still **won’t** push until you choose **Resume pushing**.  
   - The window can stay open; you still see the hosted terminal. Title shows **`(disengaged)`**.

2. On the **new** PC: install/configure with **`SOURCE_ID=vps3`** (same `.env` / wizard) and use **Resume pushing** if that install was copied from a disengaged profile.

**Shortcuts:** `Ctrl+Shift+D` disengage, `Ctrl+Shift+R` resume (Windows).

The dashboard may still show **stale** odds for that slot until the **new** device sends its first successful ingest — that’s expected.

## Notes

- **Terminal login**: If the hosted terminal uses a password, log in inside the embedded window once; cookies are kept in partition `persist:oddslocker-terminal`.
- **SmartScreen**: Unsigned builds may trigger a warning; code-signing removes that for production.
- **Single instance**: A second launch focuses the existing window.
