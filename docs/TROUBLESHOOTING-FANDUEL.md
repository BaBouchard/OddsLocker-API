# Troubleshooting FanDuel: No odds when Fetch is clicked

Follow these steps in order.

---

## Step 1: Confirm the API is reachable and the region header

The FanDuel in-play API requires an `x-sportsbook-region` header. The scraper sends it (default `US`). If you get no FanDuel odds:

1. Open **.env** and ensure you have:
   ```bash
   FANDUEL_POLL_URL=https://api.sportsbook.fanduel.com/sbapi/in-play?...
   FANDUEL_REGION=US
   ```
2. From the project root, run:
   ```bash
   node scripts/fetch-fanduel-debug.js
   ```
3. Check the output:
   - **Status: 200** and "Wrote debug-fanduel-response.json" → API is fine; go to Step 2.
   - **Status: 400** and "Missing x-sportsbook-region" or "Invalid x-sportsbook-region" → get the correct header value (Step 1b).
   - **Status: 4xx/5xx** or empty body → note the status and message.

**Why does the link show nothing / download an empty file?**  
The API only returns data when the request looks like it came from the FanDuel site (same headers the page sends). Opening the URL in a new tab doesn’t send `Referer`, `Origin`, or `x-sportsbook-region`, so the server returns nothing or an empty file. The scraper now sends these headers so the request matches the browser.

**Step 1b – Get the correct region from the browser**

1. Open FanDuel Sportsbook in your browser and go to a live/in-play page.
2. Open DevTools (F12 or right‑click → Inspect) → **Network** tab.
3. Reload or switch to in-play. Find a request whose URL contains `in-play` or `sbapi`.
4. Click that request → **Headers** → **Request Headers**.
5. Find `x-sportsbook-region`. Copy its value (e.g. `US`, `US-NJ`, etc.).
6. In **.env** set:
   ```bash
   FANDUEL_REGION=<pasted-value>
   ```
7. Run `node scripts/fetch-fanduel-debug.js` again and confirm Status 200.

---

## Step 2: Capture the real response shape (if Step 1 is 200 but you still see no odds)

If the debug script writes **debug-fanduel-response.json** successfully but the test client still shows no FanDuel rows, the parser may not match the response format.

1. In **.env** add (or set):
   ```bash
   DEBUG_FANDUEL=1
   ```
2. Restart the ingestion server (e.g. `npm start`).
3. In the test client: connect, check **only FanDuel**, click **Fetch once**.
4. In the project folder you should see **debug-fanduel-response.json** (or the path printed in the server log).
5. Open **debug-fanduel-response.json** and note:
   - Top-level keys (e.g. `layout`, `attachments`).
   - Under `attachments`: keys like `events`, `markets`, `competitions`.
   - Structure of one entry in `attachments.events` and one in `attachments.markets` (field names for event id, name, runners, odds).
6. Share that file (or a redacted snippet with the same structure) so the parser can be updated to match.

---

## Step 3: Check server logs when you click Fetch

When you click **Fetch once** with FanDuel checked:

1. Watch the **terminal where the server is running**.
2. If FanDuel returns data but 0 entries are parsed, you’ll see lines like:
   ```text
   [LiveOdds] FanDuel parsed 0 entries. Top keys: ...
   [LiveOdds] FanDuel attachment keys: ...
   [LiveOdds] FanDuel sample event keys: ...
   [LiveOdds] FanDuel sample market keys: ...
   [LiveOdds] FanDuel sample runner keys: ...
   ```
3. Copy those lines (or a screenshot) and share them so we can align the parser with the actual field names.

---

## Step 4: Optional – run the debug script and inspect the file

Without starting the full server:

1. Set **FANDUEL_POLL_URL** and **FANDUEL_REGION** in .env (from Step 1).
2. Run:
   ```bash
   node scripts/fetch-fanduel-debug.js
   ```
3. Open **debug-fanduel-response.json** and confirm it’s valid JSON and has `layout` and/or `attachments` with `events` and `markets`.  
   If the file is empty or not JSON, the API returned an error or non‑JSON (see Step 1).

---

## Summary

| Symptom | Next step |
|--------|-----------|
| Debug script: 400 "Missing x-sportsbook-region" | Set **FANDUEL_REGION** in .env (e.g. `US`). |
| Debug script: 400 "Invalid x-sportsbook-region" | Get the exact value from browser DevTools (Step 1b) and set **FANDUEL_REGION**. |
| Debug script: 200, file written, but no odds in client | Enable **DEBUG_FANDUEL=1**, Fetch once, then inspect **debug-fanduel-response.json** and server log (Steps 2–3). |
| Server log: "FanDuel fetch error" | Check the error message; often network or 4xx/5xx from API (region, URL, or rate limit). |

After any change to **.env**, restart the ingestion server.
