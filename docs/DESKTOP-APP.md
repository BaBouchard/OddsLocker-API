# OddsLocker Scraper — Windows desktop app

Windowed app with:

- **NSIS installer** (desktop shortcut, Start Menu, choose install folder).
- **First-run setup wizard**: pick **VPS 1–6**, enter **central terminal URL**, optional **ingest secret**, import **`.env`** (same book keys as your VPS).
- **Main window**: **scraper dashboard** — connects to **`ws://127.0.0.1:<WS_SERVER_PORT>`** (default **8765**, from your merged `.env`) and shows the same **odds / auto-poll / fetch-once / book checkboxes** behavior as `test-client.html`. This is **this machine’s** scraper, not the hosted site. **Auto poll** defaults **off** until you enable it in the UI (each scraper process starts with auto poll off).
- **App icon**: Windows installer / window icon uses the same artwork as the hosted terminal logo (`terminal/public/logo.png`), copied into **`desktop/assets/icon.png`** for Electron.
- **Hosted terminal**: open in your **system browser** via **Help → Open hosted terminal in browser** (or the link on the dashboard). Login and cookies stay in the browser.
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

Output: **`desktop/release/OddsLocker Scraper-Setup-<version>.exe`** — `<version>` is **`version`** in `desktop/package.json` (bump it before each installer release so filenames match what you shipped).

The dashboard shows **App v…** (same number as `desktop/package.json`) under the subtitle so you can confirm the running build.

### Installer version

Before each release build, bump **`version`** in **`desktop/package.json`** (e.g. `1.1.0` → `1.2.0`). Electron Builder names the file **`OddsLocker Scraper-Setup-<version>.exe`**. Use **semver**: patch for small fixes, minor for new features, major for breaking changes.

- **`npm run predist`** runs automatically before `dist` and rebuilds `../dist/live-odds-scraper.exe`.
- Building the **installer** is typically done on **Windows** (electron-builder NSIS). You can run `npm run dist` on macOS only if your toolchain supports it; for fewer surprises, use Windows for release builds.

Quick unpacked folder (no installer): `cd desktop && npm run dist:dir`.

## End-user flow

1. Run **OddsLocker Scraper Setup.exe** → install → launch from desktop shortcut.
2. **Setup wizard**: select **VPS 2** (or any slot), paste terminal **HTTPS URL**, optional **TERMINAL_INGEST_SECRET**, **Choose .env** (copy from a working scraper).
3. **Finish & start** → main window shows the **local scraper dashboard**; scraper pushes as `SOURCE_ID=vps2` (or chosen slot).

**File → Settings** reopens the wizard (you can change slot/URL; re-import `.env` only if you need to update book secrets).

**Help → Open data folder** shows `%APPDATA%/oddslocker-scraper-desktop` (or similar) with `config.json` and `.env`.

## Shortcuts & taskbar icon (Windows)

- **Desktop / Start Menu:** The NSIS installer is set to create **Start Menu** and **desktop** shortcuts named **OddsLocker Scraper** when you run the setup wizard. If you don’t see one on the desktop, open **Start**, type **OddsLocker**, open the app once, then **right‑click the taskbar icon → Pin to taskbar**, or **right‑click the Start menu entry → More → Open file location** and copy a shortcut to your desktop.
- **Taskbar shows the Electron atom:** The **title bar** can use our PNG via `BrowserWindow`, but the **taskbar** uses the icon **embedded in `OddsLocker Scraper.exe`**. The build must run **resource editing** (`signAndEditExecutable: true` in `desktop/package.json`) so electron-builder patches the exe with `assets/icon.png`. After installing a build made that way, the taskbar should show the **OL** logo. **`npm start` / dev mode** still uses Electron’s generic icon on the taskbar — that’s normal.

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
3. The repo uses **`signAndEditExecutable: true`** so the **Windows exe gets your app icon** (taskbar) and metadata; you still **don’t need a code-signing certificate**. If `npm run dist` fails only on symlink extraction, use **Developer Mode** or an **admin** prompt (steps 1–2 above)—don’t flip this to `false` unless you accept the **default Electron taskbar icon** again.

## Development

```bash
cd desktop
npm install
npm start
```

On **macOS**, `../dist/live-odds-scraper.exe` may be missing or not runnable; the app still opens the setup window and dashboard (WebSocket will not connect until a scraper is listening on the port). Build the `.exe` on Windows or cross-compile from the repo root for a real scraper spawn test.

## Disengage / move a VPS slot to another PC

The terminal remembers the **last ingest per `SOURCE_ID`**. If two machines both push as `vps3`, they overwrite each other’s data for that slot.

**Before** you bring `vps3` up on a new machine:

1. On the **old** PC: **Scraper → Disengage (stop pushing to terminal)** (or quit the app).  
   - This **kills** the scraper process and sets **`pushingEnabled: false`** in `config.json` so a **restart** of the app still **won’t** push until you choose **Resume pushing**.  
   - The window can stay open; the dashboard shows **disengaged** (no local WebSocket until you resume). Title shows **`(disengaged)`**.

2. On the **new** PC: install/configure with **`SOURCE_ID=vps3`** (same `.env` / wizard) and use **Resume pushing** if that install was copied from a disengaged profile.

**Shortcuts:** `Ctrl+Shift+D` disengage, `Ctrl+Shift+R` resume (Windows).

The dashboard may still show **stale** odds for that slot until the **new** device sends its first successful ingest — that’s expected.

## Notes

- **Terminal login**: If the hosted terminal uses a password, log in in your **browser** after **Help → Open hosted terminal in browser**.
- **SmartScreen**: Unsigned builds may trigger a warning; code-signing removes that for production.
- **Single instance**: A second launch focuses the existing window.
