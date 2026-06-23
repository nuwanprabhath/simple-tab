# Simple Tab

Custom Chrome/Brave new tab page with a clock, favorites, rotating backgrounds,
and a **POST-based DuckDuckGo search** so the query never appears in the URL.

## Load it (developer mode)

1. Open `chrome://extensions` (or `brave://extensions`)
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this `simple-tab/` folder
5. Open a new tab — you should see Simple Tab

To verify the search privacy property: type a query, hit enter, and check the
address bar on the results page — it should be `https://duckduckgo.com/` with
no `?q=...` after it.

## Files

- `manifest.json` — Manifest V3 entry, overrides the new tab page
- `newtab.html` — page markup (clock, search form, favorites grid)
- `newtab.css` — styling
- `newtab.js` — clock tick, favorites CRUD, background rotation, drag-to-reorder
- `icon.svg` — tab favicon
- `icons/` — packaged extension icons (16/32/48/128px PNGs, generated from `icon.svg`)
- `test-post-search.html` — standalone feasibility test, not part of the packaged extension

## Notes

- Favicons come from `icons.duckduckgo.com/ip3/<host>.ico`, with a letter
  fallback if the icon fails to load.
- Backgrounds rotate through unlimited random images from Picsum Photos, with
  a 10-image back/forward history and an option to pin one. First-ever load
  falls back to a small curated Unsplash seed list (`SEED_URLS` in `newtab.js`).
- Click the hamburger button to enter edit mode: drag widgets to reorder them
  vertically, drag favorites to reorder them horizontally, and drag the edges
  of the favorites block to resize it.

## Publishing to the Chrome Web Store

1. Bump `"version"` in `manifest.json`.
2. Build a clean package that excludes dev-only files:
   ```sh
   zip -r simple-tab.zip manifest.json newtab.html newtab.css newtab.js icon.svg icons
   ```
3. Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole), pay the one-time $5 registration fee if you haven't, and click **New item**.
4. Upload `simple-tab.zip`.
5. Fill in the store listing: description, at least one 1280×800 (or 640×400) screenshot, and a 128×128 icon (use `icons/icon128.png`).
6. Under **Privacy practices**, declare that the extension only uses `chrome.storage.local` for on-device settings (favorites, layout, background history) and does not collect or transmit user data.
7. Submit for review.
