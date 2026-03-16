# Using a Real Sportsbook

You have three ways to plug in a real sportsbook. **Best option is usually (1)** if you can find the API URL.

---

## 1. Use their API URL (recommended)

Many sportsbooks load live odds via a **REST API**. You don’t need to scrape HTML.

1. Open the sportsbook’s **live betting page** in Chrome (or any browser).
2. Open **DevTools** (F12 or right‑click → Inspect).
3. Go to the **Network** tab, filter by **XHR** or **Fetch**.
4. Refresh the page (or switch to the live section) and watch the requests.
5. Find a request whose **Response** is JSON with events/games and odds.
6. Copy that request’s **full URL** (right‑click → Copy → Copy URL).
7. In your `.env` set:
   ```env
   SPORTSBOOK_POLL_URL=https://that-full-url-here
   POLL_INTERVAL_MS=2000
   LEAGUE_KEY=basketball_nba
   SPORTSBOOK_NAME=YourBookName
   ```
8. Restart the server: `npm start`.

If the response shape doesn’t match what the Poll adapter expects (e.g. different field names), you’ll need a small custom adapter that extends `PollAdapter` and overrides `parseResponse()`.

---

## 2. Use the website link (scrape the page)

If you only have a **link to the live page** (e.g. `https://sportsbook.example.com/live`):

1. In `.env` set:
   ```env
   SPORTSBOOK_SCRAPE_URL=https://sportsbook.example.com/live
   POLL_INTERVAL_MS=5000
   LEAGUE_KEY=basketball_nba
   SPORTSBOOK_NAME=YourBookName
   ```
2. Restart: `npm start`.

The app will **fetch that URL** every few seconds and try to pull out JSON from the page (e.g. from `__NEXT_DATA__` or similar). If your sportsbook embeds data that way, it may work without code changes.

If nothing shows up in the test client:

- The site might load odds with **JavaScript** after the initial HTML. Then the data isn’t in the first HTML response; it’s loaded by another request. In that case use **option 1** and find that request’s URL in the Network tab and set `SPORTSBOOK_POLL_URL` to it.
- Or the embedded JSON might use different field names. Then you need a **custom parser**: extend `ScrapeAdapter` in `src/adapters/scrape.js`, override `parseResponse(data, leagueKey)` to map their structure to the normalized format, and wire your adapter in `src/index.js` when `SPORTSBOOK_SCRAPE_URL` is set.

---

## 3. WebSocket (if the sportsbook provides one)

If the sportsbook documents a **WebSocket** URL for live odds:

1. In `.env` set:
   ```env
   SPORTSBOOK_WS_URL=wss://their-websocket-url
   LEAGUE_KEY=basketball_nba
   SPORTSBOOK_NAME=YourBookName
   ```
2. Restart: `npm start`.

If their message format doesn’t match, extend `WebSocketAdapter` and override `parseMessage(data, leagueKey)`.

---

## Summary

| You have…              | Use this in `.env`        | Adapter   |
|------------------------|---------------------------|-----------|
| API URL (from Network) | `SPORTSBOOK_POLL_URL=...` | Poll      |
| Link to live page      | `SPORTSBOOK_SCRAPE_URL=...` | Scrape  |
| WebSocket URL         | `SPORTSBOOK_WS_URL=...`   | WebSocket |

Only one of these should be set; the app picks the first one it finds in that order.

If you tell me the sportsbook name (or that you’re using “scrape” vs “poll”), I can help you with the exact `.env` and, if needed, a custom `parseResponse` or `parseMessage` for their format.
