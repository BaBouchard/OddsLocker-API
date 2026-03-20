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

**Taskbar icon (optional):** Plain **`npm run dist`** avoids a Windows symlink issue but the **taskbar** may show Electron’s default icon. To **embed the OL icon in the `.exe`** (correct taskbar), first enable **Developer Mode** or use an **admin** shell (see **Build fails: symlink / winCodeSign** below), clear the `winCodeSign` cache, then run:

```bat
cd desktop
npm run dist:exe-icon
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
- **Title bar vs taskbar:** The **title bar** uses our PNG (`BrowserWindow.icon`). The **taskbar** reads the icon **inside `OddsLocker Scraper.exe`**, which is only patched when the build runs with **`signAndEditExecutable: true`**. Because that step downloads **winCodeSign** and extracts an archive that contains **symlinks**, many PCs fail unless you use **Developer Mode** or an **admin** prompt. So:
  - **`npm run dist`** — works on normal accounts; **taskbar** may show the **Electron** icon.
  - **`npm run dist:exe-icon`** — same installer, but enables exe patching so the **taskbar** can show **OL**; run **after** fixing symlink permissions (below).

## Build fails: `Cannot create symbolic link` / `winCodeSign` / 7-Zip

electron-builder downloads **winCodeSign** and 7-Zip extracts it. The archive includes **symlinks** (e.g. under `darwin/...`). Windows returns **“A required privilege is not held by the client”** if your user cannot create symlinks.

**Fix (pick one), then delete the broken cache and rebuild:**

1. **Developer Mode (recommended):** **Settings → System → For developers → Developer Mode → On** (wording may vary slightly on Windows 10 vs 11). Sign out/in if needed.
2. **Elevated shell:** Open **Command Prompt** or **PowerShell as Administrator** and run the build from there.

Then clear the cache and run the **icon** build:

```bat
rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign"
cd C:\path\to\OddsLockerScraper\desktop
npm run dist:exe-icon
```

If you only need a working installer and don’t care about the taskbar icon, use **`npm run dist`** (no symlink step; default **`signAndEditExecutable: false`** in `desktop/package.json`).

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
