// ---------- Background ----------

// Seed images shown on first-ever load (beautiful landscapes to start with)
const SEED_URLS = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=2400&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=2400&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=2400&q=80",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=2400&q=80",
  "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=2400&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=2400&q=80",
];

// History stores full URLs (max 10), persisted across tab opens
let bgHistory = [];
let bgHistoryPos = -1;  // -1 = at the live (newest) end
let bgPinned = false;
let bgPinnedUrl = null;

const SPINNER_SVG = `<svg class="spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-opacity="0.25"/><path d="M12 3a9 9 0 0 1 9 9"/></svg>`;

// Generate a fresh Picsum URL, avoiding IDs already in history
function newPicsumUrl() {
  const usedIds = new Set(
    bgHistory.flatMap((u) => {
      const m = u.match(/picsum\.photos\/id\/(\d+)/);
      return m ? [parseInt(m[1])] : [];
    })
  );
  let id;
  let tries = 0;
  do { id = Math.floor(Math.random() * 1000) + 1; tries++; }
  while (usedIds.has(id) && tries < 50);
  return `https://picsum.photos/id/${id}/2400/1350`;
}

// Once a Picsum request fails (DNS/network unreachable), stop hammering that
// domain for the rest of this session and serve seeds instead.
let picsumUnreachable = false;

function randomSeedUrl() {
  const current = liveUrl();
  const choices = SEED_URLS.filter((u) => u !== current);
  return choices[Math.floor(Math.random() * choices.length)] || SEED_URLS[0];
}

// Next "fresh" background to try — a new Picsum image normally, or a seed
// once Picsum has proven unreachable this session.
function nextFreshUrl() {
  return picsumUnreachable ? randomSeedUrl() : newPicsumUrl();
}

function saveHistoryState() {
  chrome.storage.local.set({ bgHistory, bgHistoryPos, bgPinned, bgPinnedUrl });
}

function applyBg(url, triggerBtn, onFail) {
  let originalHTML;
  if (triggerBtn) {
    originalHTML = triggerBtn.innerHTML;
    triggerBtn.innerHTML = SPINNER_SVG;
    triggerBtn.disabled = true;
  }
  const img = new Image();
  img.onload = () => {
    document.getElementById("bg").style.backgroundImage = `url("${url}")`;
    if (triggerBtn) { triggerBtn.innerHTML = originalHTML; triggerBtn.disabled = false; }
  };
  img.onerror = () => {
    if (triggerBtn) { triggerBtn.innerHTML = originalHTML; triggerBtn.disabled = false; }
    if (onFail) onFail();
  };
  img.src = url;
}

// Last-resort background so the page is never left blank
function applySeedFallback() {
  const url = SEED_URLS[new Date().getHours() % SEED_URLS.length];
  applyBg(url, null);
}

function pushUrl(url) {
  // Trim any forward history when branching from a past position
  if (bgHistoryPos >= 0) {
    bgHistory = bgHistory.slice(0, bgHistoryPos + 1);
    bgHistoryPos = -1;
  }
  if (bgHistory[bgHistory.length - 1] !== url) {
    bgHistory.push(url);
    if (bgHistory.length > 10) bgHistory.shift();
  }
}

function liveUrl() {
  return bgHistory.length > 0 ? bgHistory[bgHistory.length - 1] : null;
}

function setPinUI(pinned) {
  const btn = document.getElementById("bg-pin");
  btn.classList.toggle("pinned", pinned);
  btn.title = pinned ? "Unpin background" : "Pin this background";
}

// Initial load
chrome.storage.local.get(["bgHistory", "bgHistoryPos", "bgPinned", "bgPinnedUrl"], (d) => {
  bgHistory = Array.isArray(d.bgHistory) ? d.bgHistory : [];
  bgHistoryPos = typeof d.bgHistoryPos === "number" ? d.bgHistoryPos : -1;
  bgPinned = !!d.bgPinned;
  bgPinnedUrl = d.bgPinnedUrl || null;
  setPinUI(bgPinned);

  if (bgPinned && bgPinnedUrl) {
    applyBg(bgPinnedUrl, null, applySeedFallback);
  } else if (bgHistory.length > 0) {
    // Resume at the live end of the saved history
    bgHistoryPos = -1;
    applyBg(liveUrl(), null, () => {
      // Saved image is no longer reachable — if it was a Picsum URL, treat
      // the whole domain as unreachable rather than retrying it again.
      if (/picsum\.photos/.test(liveUrl() || "")) picsumUnreachable = true;
      const url = nextFreshUrl();
      pushUrl(url);
      saveHistoryState();
      applyBg(url, null, applySeedFallback);
    });
  } else {
    // First ever open — pick a seed by hour
    const url = SEED_URLS[new Date().getHours() % SEED_URLS.length];
    pushUrl(url);
    applyBg(url, null);
    saveHistoryState();
  }
});

document.getElementById("bg-prev").addEventListener("click", (e) => {
  if (bgHistory.length === 0) return;
  if (bgHistoryPos === -1) bgHistoryPos = bgHistory.length - 1;
  bgHistoryPos = Math.max(0, bgHistoryPos - 1);
  applyBg(bgHistory[bgHistoryPos], e.currentTarget);
  saveHistoryState();
});

document.getElementById("bg-next").addEventListener("click", (e) => {
  const btn = e.currentTarget;
  if (bgHistoryPos === -1) {
    // At the live end — fetch a brand-new image
    const url = nextFreshUrl();
    pushUrl(url);
    applyBg(url, btn, () => {
      // That one failed — if it was Picsum, stop trying that domain for the
      // rest of this session and fall back to a seed instead of retrying it.
      if (/picsum\.photos/.test(url)) picsumUnreachable = true;
      bgHistory.pop();
      const retryUrl = nextFreshUrl();
      pushUrl(retryUrl);
      applyBg(retryUrl, btn, applySeedFallback);
      saveHistoryState();
    });
    saveHistoryState();
  } else {
    // Stepping forward through existing history
    bgHistoryPos++;
    if (bgHistoryPos >= bgHistory.length) bgHistoryPos = -1;
    const url = bgHistoryPos === -1 ? liveUrl() : bgHistory[bgHistoryPos];
    applyBg(url, btn);
    saveHistoryState();
  }
});

document.getElementById("bg-pin").addEventListener("click", () => {
  bgPinned = !bgPinned;
  bgPinnedUrl = bgPinned
    ? (bgHistoryPos === -1 ? liveUrl() : bgHistory[bgHistoryPos])
    : null;
  setPinUI(bgPinned);
  saveHistoryState();
});

// ---------- Clock ----------
function tick() {
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, "0");
  const h12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "AM" : "PM";
  document.getElementById("time").textContent = `${h12}:${m}${ampm}`;
  document.getElementById("date").textContent = now.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
}

// ---------- Widget order ----------
const DEFAULT_ORDER = ["search-web", "clock", "favorites"];

function loadOrder() {
  return new Promise((res) =>
    chrome.storage.local.get("widgetOrder", (d) => res(d.widgetOrder || [...DEFAULT_ORDER]))
  );
}
function saveOrder(order) {
  chrome.storage.local.set({ widgetOrder: order });
}

function applyOrder(order) {
  const main = document.querySelector("main");
  for (const id of order) {
    const el = main.querySelector(`[data-widget="${id}"]`);
    if (el) main.appendChild(el);
  }
}

// ---------- Edit / drag-and-drop layout ----------
let editMode = false;
let dragSrc = null;

const editBtn = document.getElementById("edit-layout");

// Add the hint element
const hint = document.createElement("div");
hint.id = "edit-hint";
hint.textContent = "Drag widgets to reorder · Click ☰ again to exit";
document.body.appendChild(hint);

function setEditMode(on) {
  editMode = on;
  document.body.classList.toggle("edit-mode", on);
  editBtn.classList.toggle("active", on);
  document.querySelectorAll(".widget").forEach((w) => { w.draggable = on; });
  document.querySelectorAll(".fav").forEach((f) => { f.draggable = on; });
}

editBtn.addEventListener("click", () => setEditMode(!editMode));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && editMode) setEditMode(false);
});

const main = document.querySelector("main");

main.addEventListener("dragstart", (e) => {
  const widget = e.target.closest(".widget");
  if (!widget || !editMode) return;
  dragSrc = widget;
  e.dataTransfer.effectAllowed = "move";
  // Delay so the drag image captures the element before opacity drops
  requestAnimationFrame(() => widget.classList.add("dragging"));
});

main.addEventListener("dragend", (e) => {
  const widget = e.target.closest(".widget");
  if (widget) widget.classList.remove("dragging");
  document.querySelectorAll(".widget.drag-over").forEach((w) => w.classList.remove("drag-over"));
  dragSrc = null;
});

main.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  const widget = e.target.closest(".widget");
  if (!widget || widget === dragSrc) return;
  document.querySelectorAll(".widget.drag-over").forEach((w) => w.classList.remove("drag-over"));
  widget.classList.add("drag-over");
});

main.addEventListener("dragleave", (e) => {
  const widget = e.target.closest(".widget");
  if (widget && !widget.contains(e.relatedTarget)) widget.classList.remove("drag-over");
});

main.addEventListener("drop", (e) => {
  e.preventDefault();
  const target = e.target.closest(".widget");
  if (!target || target === dragSrc || !dragSrc) return;
  target.classList.remove("drag-over");

  const widgets = [...main.querySelectorAll(".widget")];
  const srcIdx = widgets.indexOf(dragSrc);
  const tgtIdx = widgets.indexOf(target);

  if (srcIdx < tgtIdx) {
    main.insertBefore(dragSrc, target.nextSibling);
  } else {
    main.insertBefore(dragSrc, target);
  }

  const newOrder = [...main.querySelectorAll(".widget")].map((w) => w.dataset.widget);
  saveOrder(newOrder);
});

// ---------- Favorites drag-to-reorder ----------
let dragSrcFav = null;
const favGrid = document.getElementById("favorites");

favGrid.addEventListener("click", (e) => {
  if (editMode) e.preventDefault();
});

favGrid.addEventListener("dragstart", (e) => {
  const fav = e.target.closest(".fav");
  if (!fav || !editMode) return;
  dragSrcFav = fav;
  e.stopPropagation(); // don't bubble up to widget drag handler
  requestAnimationFrame(() => fav.classList.add("fav-dragging"));
});

favGrid.addEventListener("dragend", () => {
  document.querySelectorAll(".fav").forEach((f) =>
    f.classList.remove("fav-dragging", "fav-drag-over")
  );
  dragSrcFav = null;
});

favGrid.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
  const fav = e.target.closest(".fav");
  if (!fav || fav === dragSrcFav) return;
  document.querySelectorAll(".fav.fav-drag-over").forEach((f) => f.classList.remove("fav-drag-over"));
  fav.classList.add("fav-drag-over");
});

favGrid.addEventListener("dragleave", (e) => {
  const fav = e.target.closest(".fav");
  if (fav && !fav.contains(e.relatedTarget)) fav.classList.remove("fav-drag-over");
});

favGrid.addEventListener("drop", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const target = e.target.closest(".fav");
  if (!target || target === dragSrcFav || !dragSrcFav) return;
  target.classList.remove("fav-drag-over");

  const items = [...favGrid.querySelectorAll(".fav")];
  const srcIdx = items.indexOf(dragSrcFav);
  const tgtIdx = items.indexOf(target);
  if (srcIdx < tgtIdx) favGrid.insertBefore(dragSrcFav, target.nextSibling);
  else favGrid.insertBefore(dragSrcFav, target);

  // Persist new order
  const allFavs = await loadFavs();
  const newOrder = [...favGrid.querySelectorAll(".fav")].map((el) => el.dataset.id);
  const reordered = newOrder.map((id) => allFavs.find((f) => f.id === id)).filter(Boolean);
  await saveFavs(reordered);
});

// ---------- Favorites width resize ----------
const favWidget = document.querySelector('.widget[data-widget="favorites"]');
const MIN_FAV_WIDTH = 280;
let favWidth = 700;

function maxFavWidth() {
  return Math.min(900, window.innerWidth - 48);
}

function applyFavWidth(w) {
  favWidth = Math.round(Math.max(MIN_FAV_WIDTH, Math.min(maxFavWidth(), w)));
  favGrid.style.maxWidth = `${favWidth}px`;
  favWidget.style.setProperty("--fav-half-width", `${favWidth / 2}px`);
}

function saveFavWidth() {
  chrome.storage.local.set({ favWidth });
}

chrome.storage.local.get("favWidth", (d) => {
  applyFavWidth(typeof d.favWidth === "number" ? d.favWidth : 700);
});

window.addEventListener("resize", () => applyFavWidth(favWidth));

function setupResizeHandle(handle, sign) {
  handle.draggable = false;
  handle.addEventListener("pointerdown", (e) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = favWidth;
    handle.classList.add("resizing");
    handle.setPointerCapture(e.pointerId);

    function onMove(ev) {
      const dx = ev.clientX - startX;
      applyFavWidth(startWidth + sign * dx * 2);
    }
    function onUp() {
      handle.classList.remove("resizing");
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      saveFavWidth();
    }
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });
}

const resizeLeft = document.createElement("div");
resizeLeft.className = "resize-handle left";
resizeLeft.title = "Drag to resize favorites";
const resizeRight = document.createElement("div");
resizeRight.className = "resize-handle right";
resizeRight.title = "Drag to resize favorites";
favWidget.append(resizeLeft, resizeRight);

setupResizeHandle(resizeLeft, -1);
setupResizeHandle(resizeRight, 1);

// ---------- Favorites ----------
const DEFAULT_FAVS = [
  { id: "yt", name: "YouTube", url: "https://youtube.com" },
  { id: "gh", name: "GitHub", url: "https://github.com" },
  { id: "gm", name: "Gmail", url: "https://mail.google.com" },
  { id: "dr", name: "Drive", url: "https://drive.google.com" },
];

function loadFavs() {
  return new Promise((res) =>
    chrome.storage.local.get("favorites", (d) => res(d.favorites || DEFAULT_FAVS))
  );
}
function saveFavs(favs) {
  return new Promise((res) => chrome.storage.local.set({ favorites: favs }, res));
}

function faviconUrl(siteUrl) {
  try {
    return `https://icons.duckduckgo.com/ip3/${new URL(siteUrl).hostname}.ico`;
  } catch {
    return null;
  }
}

function renderFavs(favs) {
  const grid = document.getElementById("favorites");
  grid.innerHTML = "";
  for (const fav of favs) {
    const a = document.createElement("a");
    a.className = "fav";
    a.href = fav.url;
    a.dataset.id = fav.id;

    const icon = document.createElement("div");
    icon.className = "icon";
    const img = document.createElement("img");
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.src = faviconUrl(fav.url) || "";
    img.onerror = () => {
      icon.innerHTML = `<span class="letter">${(fav.name[0] || "?").toUpperCase()}</span>`;
    };
    icon.appendChild(img);

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = fav.name;

    const editFavBtn = document.createElement("button");
    editFavBtn.className = "edit-btn";
    editFavBtn.textContent = "✎";
    editFavBtn.title = "Edit";
    editFavBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!editMode) openDialog(fav);
    });

    a.draggable = editMode;
    a.append(icon, name, editFavBtn);
    grid.appendChild(a);
  }
}

// ---------- Favorite dialog ----------
const dialog = document.getElementById("fav-dialog");
const form = document.getElementById("fav-form");

function openDialog(fav) {
  document.getElementById("fav-dialog-title").textContent = fav ? "Edit favorite" : "Add favorite";
  form.elements.name.value = fav?.name || "";
  form.elements.url.value = fav?.url || "";
  form.elements.id.value = fav?.id || "";
  document.getElementById("fav-delete").hidden = !fav;
  dialog.showModal();
  form.elements.name.focus();
}

document.getElementById("add-fav").addEventListener("click", () => openDialog(null));
document.getElementById("fav-cancel").addEventListener("click", () => dialog.close());

document.getElementById("fav-save").addEventListener("click", async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const favs = await loadFavs();
  const id = form.elements.id.value;
  const entry = {
    id: id || `f${Date.now()}`,
    name: form.elements.name.value.trim(),
    url: form.elements.url.value.trim(),
  };
  const idx = favs.findIndex((f) => f.id === id);
  if (idx >= 0) favs[idx] = entry; else favs.push(entry);
  await saveFavs(favs);
  renderFavs(favs);
  dialog.close();
});

document.getElementById("fav-delete").addEventListener("click", async () => {
  const id = form.elements.id.value;
  if (!id) return;
  const favs = (await loadFavs()).filter((f) => f.id !== id);
  await saveFavs(favs);
  renderFavs(favs);
  dialog.close();
});

// ---------- Search: Shift+Enter opens in new tab ----------
document.querySelector(".search-form input[name='q']").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    const q = e.target.value.trim();
    if (!q) return;
    // Open a named blank tab, then POST into it from the current page.
    // Targeting a named window avoids any script injection or CSP issues.
    const tabName = `ddg_${Date.now()}`;
    window.open("", tabName);
    const f = document.createElement("form");
    f.method = "POST";
    f.action = "https://duckduckgo.com/";
    f.target = tabName;
    const inp = document.createElement("input");
    inp.type = "hidden";
    inp.name = "q";
    inp.value = q;
    f.appendChild(inp);
    document.body.appendChild(f);
    f.submit();
    f.remove();
  }
});

// ---------- Init ----------
tick();

// Brave steals focus to the address bar after the NTP page loads.
// Three strategies in combination to reliably reclaim it:
const searchInput = document.querySelector(".search-form input[name='q']");

// 1. Try at multiple delays (Brave's timing varies by machine)
[50, 150, 300, 600].forEach((ms) => setTimeout(() => searchInput.focus(), ms));

// 2. Whenever the window/document itself receives focus, redirect to the input
window.addEventListener("focus", () => searchInput.focus());

// 3. Capture the first keydown on the page (fires once page has focus) and
//    ensure the input receives it — handles the "user starts typing immediately" case
window.addEventListener("keydown", (e) => {
  if (document.activeElement !== searchInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
    searchInput.focus();
  }
}, { capture: true });
setInterval(tick, 1000);
loadFavs().then(renderFavs);
loadOrder().then(applyOrder);
