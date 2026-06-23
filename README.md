# Quiet Tab

Custom Brave/Chrome new tab page with clock, favorites, rotating backgrounds,
and a **POST-based DuckDuckGo search** so the query never appears in the URL.

## Load it in Brave

1. Open `brave://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this `custom-new-tab/` folder
5. Open a new tab — you should see Quiet Tab

To verify the search privacy property: type a query, hit enter, and check the
address bar on the results page — it should be `https://duckduckgo.com/` with
no `?q=...` after it.

## Files

- `manifest.json` — Manifest V3 entry, overrides the new tab page
- `newtab.html` — page markup (clock, search form, favorites grid)
- `newtab.css` — styling
- `newtab.js` — clock tick, favorites CRUD via `chrome.storage.local`, background rotation
- `test-post-search.html` — standalone feasibility test (not part of the extension)

## Notes

- Favicons come from `icons.duckduckgo.com/ip3/<host>.ico`, with a letter
  fallback if the icon fails to load.
- Backgrounds rotate by hour-of-day from a small curated Unsplash list. To use
  your own, edit the `BACKGROUNDS` array in `newtab.js`.
- No icon PNGs are bundled. Brave will show a default puzzle-piece icon for the
  extension itself; the new tab page is unaffected. Drop `icon16.png`,
  `icon48.png`, `icon128.png` into `icons/` if you want a custom toolbar icon.
