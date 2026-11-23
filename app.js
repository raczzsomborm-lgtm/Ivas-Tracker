/* Strigula – buli számláló. A felület és a logika; az adatbázist a backend.js adja. */
(() => {
  "use strict";

  const CATS = [
    { id: "shot", name: "Rövid", emoji: "🥃", quick: "Egyéb", placeholder: "pl. Becherovka",
      defaults: ["Jägermeister", "Unicum", "Pálinka", "Tequila", "Vodka", "Rum", "Whisky", "Gin", "Egyéb"] },
    { id: "wine", name: "Bor", emoji: "🍷", quick: "Egyéb", placeholder: "pl. Tokaji",
      defaults: ["Fehér", "Vörös", "Rozé", "Fröccs", "Pezsgő", "Egyéb"] },
    { id: "beer", name: "Sör", emoji: "🍺", quick: "Egyéb", placeholder: "pl. Cider",
      defaults: ["Világos", "Barna", "Búza", "IPA", "Egyéb"] },
    { id: "water", name: "Víz, üdítő", emoji: "💧", quick: "Víz", placeholder: "pl. Kóla", quiet: true,
      defaults: ["Víz", "Üdítő"] },
  ];
  const CAT_BY_ID = Object.fromEntries(CATS.map(c => [c.id, c]));
  const NAME_MAX = 24;
  const PALETTE = ["#E4572E", "#F3A712", "#3BB273", "#2D9CDB", "#9B5DE5", "#F15BB5", "#00B8A9", "#C0A16B"];
  const SVGNS = "http://www.w3.org/2000/svg";

  const S = {
    phase: "boot",   // boot | loading | onboard | ready | error | noconfig | authoff | offline | bootfail
    started: false, backend: null, myId: null,
    party: null, unsub: null,
    docs: new Map(), myDoc: null,
    stale: false, errorCode: "",
    readOnly: false,
    view: "me", sheet: null, fresh: null,
    writeTimer: null, pending: 0,
    installPrompt: null,
    stats: new Map(), statsDelta: {}, statsTimer: null, statsError: false,
  };

  /* ---------- helpers ---------- */
  const $ = (sel) => document.querySelector(sel);
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : String(v));
    }
    for (const c of children) {
      if (c == null || c === false) continue;
      e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return e;
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function cleanName(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, NAME_MAX); }
  function num(x) { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : 0; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function errCode(e) { return e && e.code ? String(e.code).replace(/^firestore\//, "") : ""; }
  function colorFor(id) {
    let h = 0;
    for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  function ago(t) {
    if (!t) return "";
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return "épp most";
    const m = Math.floor(s / 60);
    if (m < 60) return m + " perce";
    const h = Math.floor(m / 60);
    if (h < 24) return h + " órája";
    return Math.floor(h / 24) + " napja";
  }
  function buzz() { try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {} }
  function byName(a, b) { return (a[1].name || "").localeCompare(b[1].name || "", "hu", { sensitivity: "base" }); }
  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function isStandalone() {
    try { if (window.matchMedia("(display-mode: standalone)").matches) return true; } catch (e) {}
    return navigator.standalone === true;
  }

  /* ---------- party code ---------- */
  function cleanParty(s) {
    if (!s) return null;
    const c = String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    return c.length >= 3 ? c : null;
  }
  function newPartyCode() {
    const a = "abcdefghjkmnpqrstuvwxyz23456789";
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    return "buli-" + Array.from(b, x => a[x % a.length]).join("");
  }
  function inviteUrl() {
    const u = new URL(location.href);
    u.search = "";
    u.hash = "";
    u.searchParams.set("buli", S.party);
    return u.toString();
  }

  /* ---------- data model ---------- */
  function sanitize(src) {
    const d = src && typeof src === "object" ? src : {};
    const out = { v: 1, name: cleanName(typeof d.name === "string" ? d.name : ""), cats: {}, recent: [], updatedAt: num(d.updatedAt) };
    const cats = d.cats && typeof d.cats === "object" ? d.cats : {};
    for (const c of CATS) {
      const s = cats[c.id] && typeof cats[c.id] === "object" ? cats[c.id] : {};
      const map = new Map();
      for (const it of Array.isArray(s.items) ? s.items : []) {
        if (!it || typeof it.name !== "string") continue;
        const name = cleanName(it.name);
        const n = Math.floor(num(it.n));
        if (!name || n <= 0) continue;
        map.set(name, Math.min(9999, (map.get(name) || 0) + n));
      }
      const custom = [];
      for (const x of Array.isArray(s.custom) ? s.custom : []) {
        if (typeof x !== "string") continue;
        const nm = cleanName(x);
        if (nm && !custom.includes(nm) && !c.defaults.includes(nm)) custom.push(nm);
      }
      const q = typeof s.quick === "string" ? cleanName(s.quick) : "";
      out.cats[c.id] = { items: [...map].map(([name, n]) => ({ name, n })), custom: custom.slice(-30), quick: q || null };
    }
    for (const r of Array.isArray(d.recent) ? d.recent : []) {
      if (!r || !CAT_BY_ID[r.c] || typeof r.d !== "string") continue;
      const dn = cleanName(r.d);
      if (!dn) continue;
      out.recent.push({ c: r.c, d: dn, t: num(r.t) });
      if (out.recent.length >= 8) break;
    }
    return out;
  }
  function countIn(cd, name) { const it = cd.items.find(i => i.name === name); return it ? it.n : 0; }
  function catTotal(doc, cat) { return doc.cats[cat.id].items.reduce((s, i) => s + i.n, 0); }
  function alcoholTotal(doc) { return CATS.filter(c => !c.quiet).reduce((s, c) => s + catTotal(doc, c), 0); }

  /* ---------- yearly and all-time stats ---------- */
  function thisYear() { return String(new Date().getFullYear()); }
  function emptyCounts() { const o = {}; for (const c of CATS) o[c.id] = 0; return o; }
  function cleanCounts(src) {
    const o = emptyCounts();
    if (src && typeof src === "object") for (const c of CATS) o[c.id] = Math.floor(Number(src[c.id])) || 0;
    return o;
  }
  function sanitizeStats(src) {
    const d = src && typeof src === "object" ? src : {};
    const years = {};
    if (d.years && typeof d.years === "object") {
      for (const [y, v] of Object.entries(d.years)) if (/^\d{4}$/.test(y)) years[y] = cleanCounts(v);
    }
    return { total: cleanCounts(d.total), years };
  }
  function alcOf(counts) { return CATS.filter(c => !c.quiet).reduce((s, c) => s + Math.max(0, counts[c.id]), 0); }
  function statsOf(id) {
    const st = sanitizeStats(S.stats.get(id));
    if (id === S.myId) {
      for (const [y, d] of Object.entries(S.statsDelta)) {
        const yc = st.years[y] || (st.years[y] = emptyCounts());
        for (const c of CATS) { yc[c.id] += d[c.id] || 0; st.total[c.id] += d[c.id] || 0; }
      }
    }
    return st;
  }
  function groupStats() {
    const ids = new Set(S.stats.keys());
    if (S.myId) ids.add(S.myId);
    const y = thisYear();
    const out = { year: emptyCounts(), total: emptyCounts() };
    for (const id of ids) {
      const st = statsOf(id);
      const yc = st.years[y] || emptyCounts();
      for (const c of CATS) { out.year[c.id] += Math.max(0, yc[c.id]); out.total[c.id] += Math.max(0, st.total[c.id]); }
    }
    return out;
  }
  function statsAdd(cid, delta) {
    const y = thisYear();
    const d = S.statsDelta[y] || (S.statsDelta[y] = emptyCounts());
    d[cid] += delta;
    clearTimeout(S.statsTimer);
    S.statsTimer = setTimeout(flushStats, 300);
  }
  function flushStats() {
    clearTimeout(S.statsTimer);
    S.statsTimer = null;
    const byYear = {};
    for (const [y, d] of Object.entries(S.statsDelta)) {
      const o = {};
      for (const c of CATS) if (d[c.id]) o[c.id] = d[c.id];
      if (Object.keys(o).length) byYear[y] = o;
    }
    S.statsDelta = {};
    if (!Object.keys(byYear).length || !S.backend || S.statsError || typeof S.backend.addStats !== "function") return;
    Promise.resolve().then(() => S.backend.addStats(S.myId, byYear)).catch((e) => {
      if (errCode(e) === "permission-denied") { S.statsError = true; renderAll(); }
      else toast("A statisztikát nem sikerült menteni. Nézd meg a netet.");
    });
  }
  function quickOf(doc, cat) { return doc.cats[cat.id].quick || cat.quick; }
  function label(cid, d) { return d === "Egyéb" ? "egyéb " + CAT_BY_ID[cid].name.toLocaleLowerCase("hu") : d; }
  function drinkList(doc, cat) {
    const cd = doc.cats[cat.id];
    const names = cat.defaults.filter(n => n !== "Egyéb");
    const push = (n) => { if (n !== "Egyéb" && !names.includes(n)) names.push(n); };
    cd.custom.forEach(push);
    cd.items.forEach(i => push(i.name));
    if (cat.defaults.includes("Egyéb") || countIn(cd, "Egyéb") > 0) names.push("Egyéb");
    return names.map(n => ({ name: n, n: countIn(cd, n), custom: !cat.defaults.includes(n) }));
  }
  function allPeople() {
    const m = new Map(S.docs);
    if (S.myDoc) m.set(S.myId, S.myDoc);
    return m;
  }

  /* ---------- writes (only ever my own document) ---------- */
  function isIdle() { return !S.writeTimer && S.pending === 0; }
  function scheduleWrite() {
    if (S.readOnly || !S.myDoc) return;
    clearTimeout(S.writeTimer);
    S.writeTimer = setTimeout(() => { S.writeTimer = null; flush(); }, 300);
  }
  function flushNow() {
    if (S.writeTimer) { clearTimeout(S.writeTimer); S.writeTimer = null; flush(); }
  }
  function flush() {
    if (!S.myDoc || S.readOnly || !S.party || !S.backend) return;
    const party = S.party;
    const body = clone(S.myDoc);
    S.pending++;
    Promise.resolve()
      .then(() => S.backend.setPlayer(party, S.myId, body))
      .catch(onWriteError)
      .finally(() => { S.pending = Math.max(0, S.pending - 1); });
  }
  function onWriteError(e) {
    const code = errCode(e);
    if (code === "permission-denied") {
      S.readOnly = true;
      renderAll();
      toast("A szerver nem engedte a mentést. Ellenőrizd a Firestore szabályokat.");
    } else if (code === "resource-exhausted") {
      toast("Elfogyott a mai ingyenes adatbázis-keret.");
    } else {
      toast("Nem sikerült menteni. Nézd meg a netet, és koppints újra.");
    }
  }
  function flushAll() { flushNow(); if (S.statsTimer) flushStats(); }
  document.addEventListener("visibilitychange", () => { if (document.hidden) flushAll(); });
  window.addEventListener("pagehide", flushAll);

  /* ---------- actions ---------- */
  function bump(cid, name, delta) {
    if (!S.myDoc || S.readOnly) return false;
    const c = S.myDoc.cats[cid];
    let it = c.items.find(i => i.name === name);
    const cur = it ? it.n : 0;
    const next = Math.max(0, Math.min(9999, cur + delta));
    if (next === cur) return false;
    if (!it) { it = { name, n: 0 }; c.items.push(it); }
    it.n = next;
    if (next === 0) c.items = c.items.filter(i => i !== it);
    const now = Date.now();
    if (delta > 0) {
      c.quick = name;
      S.myDoc.recent = [{ c: cid, d: name, t: now }, ...S.myDoc.recent].slice(0, 8);
    } else {
      const k = S.myDoc.recent.findIndex(r => r.c === cid && r.d === name);
      if (k >= 0) S.myDoc.recent.splice(k, 1);
    }
    S.myDoc.updatedAt = now;
    scheduleWrite();
    statsAdd(cid, delta);
    return true;
  }
  function addDrink(cid, name) {
    if (!S.myDoc) return;
    const prevQuick = S.myDoc.cats[cid].quick;
    if (!bump(cid, name, +1)) return;
    buzz();
    S.fresh = cid;
    renderAll();
    S.fresh = null;
    toast("+1 " + label(cid, name), () => {
      if (bump(cid, name, -1)) { if (S.myDoc) S.myDoc.cats[cid].quick = prevQuick; renderAll(); }
    });
  }
  function addCustom(cid, raw) {
    const name = cleanName(raw);
    if (!name || !S.myDoc) return false;
    const cat = CAT_BY_ID[cid];
    const hit = drinkList(S.myDoc, cat).find(d => d.name.toLocaleLowerCase("hu") === name.toLocaleLowerCase("hu"));
    const finalName = hit ? hit.name : name;
    if (!hit) {
      const c = S.myDoc.cats[cid];
      c.custom = [...c.custom, finalName].slice(-30);
    }
    addDrink(cid, finalName);
    return true;
  }
  function removeCustom(cid, name) {
    if (!S.myDoc || S.readOnly) return;
    const c = S.myDoc.cats[cid];
    if (countIn(c, name) > 0) return;
    c.custom = c.custom.filter(n => n !== name);
    if (c.quick === name) c.quick = null;
    S.myDoc.updatedAt = Date.now();
    scheduleWrite();
    renderAll();
  }
  function resetMine() {
    if (!S.myDoc || S.readOnly) return;
    for (const c of CATS) S.myDoc.cats[c.id].items = [];
    S.myDoc.recent = [];
    S.myDoc.updatedAt = Date.now();
    scheduleWrite();
    renderAll();
    toast("Nulláztad a saját számlálóidat.");
  }
  async function invite() {
    if (!S.party) return;
    const url = inviteUrl();
    if (navigator.share) {
      try { await navigator.share({ title: "Strigula", text: "Gyere a buliba! A kód: " + S.party, url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); toast("Link kimásolva, küldd el a barátaidnak."); }
    catch (e) { toast("A meghívó link: " + url); }
  }
  function goOnboard() {
    S.phase = "onboard";
    $("#main").dataset.screen = "";
  }
  function setParty(party) {
    if (S.unsub) { try { S.unsub(); } catch (e) {} S.unsub = null; }
    S.party = party;
    S.docs = new Map();
    S.stale = false;
    lsSet("strigula-party", party);
    try {
      const u = new URL(location.href);
      if (party) u.searchParams.set("buli", party); else u.searchParams.delete("buli");
      history.replaceState(null, "", u.toString());
    } catch (e) {}
    if (party) subscribe();
  }
  function switchParty() {
    flushAll();
    S.myDoc = null;
    S.readOnly = false;
    setParty(null);
    goOnboard();
    renderAll();
  }
  function leaveParty() {
    if (!S.myDoc || !S.party) return;
    const party = S.party;
    clearTimeout(S.writeTimer);
    S.writeTimer = null;
    S.myDoc = null;
    S.backend.deletePlayer(party, S.myId).catch(() => toast("Nem sikerült törölni. Nézd meg a netet, és próbáld újra."));
    goOnboard();
    renderAll();
    toast("Kiléptél ebből a buliból.");
  }
  async function join(rawName, rawCode, msg, btn) {
    const name = cleanName(rawName);
    const party = cleanParty(rawCode);
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    if (!name) { say("Írj be egy nevet.", true); return; }
    if (!party) { say("A buli kódja legalább 3 betű vagy szám legyen.", true); return; }
    btn.disabled = true;
    say("Csatlakozás…");
    if (party !== S.party) setParty(party);
    let existing = null;
    try { existing = await S.backend.getPlayer(party, S.myId); }
    catch (e) {
      btn.disabled = false;
      say(errCode(e) === "permission-denied"
        ? "A szerver nem enged be. Ellenőrizd a Firestore szabályokat."
        : "Nem érem el a szervert. Nézd meg a netet, és próbáld újra.", true);
      return;
    }
    if (S.party !== party) return;
    const doc = sanitize(existing || {});
    doc.name = name;
    doc.updatedAt = Date.now();
    S.myDoc = doc;
    S.readOnly = false;
    lsSet("strigula-name", name);
    flush();
    S.phase = "ready";
    S.view = "me";
    renderAll();
    window.scrollTo(0, 0);
  }

  /* ---------- live data ---------- */
  function subscribe() {
    const party = S.party;
    let fresh = false, gotAny = false;
    const timer = setTimeout(() => {
      if (S.party !== party) return;
      S.stale = true;
      if (S.phase === "loading" && gotAny) { if (S.myDoc) S.phase = "ready"; else goOnboard(); }
      renderAll();
    }, 10000);
    S.unsub = S.backend.watchPlayers(party, (snap) => {
      if (S.party !== party) return;
      gotAny = true;
      if (!snap.fromCache) { fresh = true; clearTimeout(timer); S.stale = false; }
      const m = new Map();
      for (const d of snap.docs) m.set(d.id, sanitize(d.data));
      S.docs = m;
      const mine = m.get(S.myId);
      if (mine && isIdle()) S.myDoc = clone(mine);
      if (S.phase === "loading") {
        if (S.myDoc) { S.phase = "ready"; S.view = "me"; }
        else if (fresh || S.stale) goOnboard();
      } else if (S.phase === "onboard" && S.myDoc) {
        S.phase = "ready"; S.view = "me";
      }
      renderAll();
    }, (e) => {
      if (S.party !== party) return;
      clearTimeout(timer);
      S.errorCode = errCode(e);
      if (S.phase === "ready") { S.stale = true; renderAll(); }
      else { S.phase = "error"; renderAll(); }
    });
  }

  /* ---------- tally marks ---------- */
  function jit(i) { return (((i * 7919) % 11) - 5) * 0.18; }
  function tally(n, fresh) {
    const box = el("span", { class: "tally", "aria-hidden": "true" });
    if (n <= 0) { box.append(el("span", { class: "tally-empty", text: "még semmi" })); return box; }
    const MAX = 30;
    const shown = Math.min(n, MAX);
    for (let g = 0; g * 5 < shown; g++) {
      const inGroup = Math.min(5, shown - g * 5);
      const svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("viewBox", "0 0 36 28");
      svg.setAttribute("width", "36");
      svg.setAttribute("height", "28");
      for (let i = 0; i < inGroup; i++) {
        const idx = g * 5 + i;
        const j = jit(idx);
        const line = document.createElementNS(SVGNS, "line");
        if (i < 4) {
          const x = 6 + i * 7.5;
          line.setAttribute("x1", (x + j).toFixed(2));
          line.setAttribute("y1", (3 + Math.abs(j)).toFixed(2));
          line.setAttribute("x2", (x - j * 0.6).toFixed(2));
          line.setAttribute("y2", (25 - Math.abs(j) * 0.5).toFixed(2));
        } else {
          line.setAttribute("x1", "1");
          line.setAttribute("y1", (21 + j).toFixed(2));
          line.setAttribute("x2", "35");
          line.setAttribute("y2", (7 - j).toFixed(2));
        }
        if (fresh && n <= MAX && idx === shown - 1) line.setAttribute("class", "fresh");
        svg.append(line);
      }
      box.append(svg);
    }
    if (n > MAX) box.append(el("span", { class: "tally-more cond", text: "+" + (n - MAX) }));
    return box;
  }

  /* ---------- rendering ---------- */
  function renderAll() {
    $("#settingsBtn").hidden = S.phase !== "ready";
    renderTabs();
    renderMain();
    renderSheet();
  }
  function renderTabs() {
    const nav = $("#tabs");
    if (S.phase !== "ready") { nav.hidden = true; return; }
    nav.hidden = false;
    const keep = nav.scrollLeft;
    nav.replaceChildren();
    const tab = (view, text, color) => {
      const b = el("button", { type: "button", class: "tab", "aria-current": S.view === view ? "page" : null,
        onclick: () => { S.view = view; renderAll(); window.scrollTo(0, 0); } });
      if (color) b.append(el("span", { class: "dot", style: "background:" + color, "aria-hidden": "true" }));
      b.append(el("span", { text }));
      nav.append(b);
    };
    if (S.myDoc) tab("me", "Én", colorFor(S.myId));
    tab("all", "Mindenki");
    const others = [...S.docs.entries()].filter(([id]) => id !== S.myId).sort(byName);
    for (const [id, d] of others) tab(id, d.name || "Névtelen", colorFor(id));
    nav.scrollLeft = keep;
  }
  function messageView(title, text) {
    return el("section", {}, el("h2", { class: "view-title cond", text: title }), el("p", { text }));
  }
  function renderMain() {
    const main = $("#main");
    if (S.phase === "onboard") {
      if (main.dataset.screen !== "onboard") { main.dataset.screen = "onboard"; main.replaceChildren(onboardView()); }
      return;
    }
    main.dataset.screen = S.phase;
    switch (S.phase) {
      case "boot":
      case "loading":
        main.replaceChildren(el("p", { class: "muted", text: "Betöltés…" }));
        if (S.stale) main.append(el("p", { class: "banner", text: "Még nem érem el az adatokat. Nézd meg a netkapcsolatot, amint visszajön, magától frissül." }));
        break;
      case "noconfig":
        main.replaceChildren(messageView("Hiányzik a beállítás", "Másold be a Firebase konzolból kapott firebaseConfig adatokat a config.js fájlba, majd töltsd fel újra."));
        break;
      case "authoff":
        main.replaceChildren(messageView("Kapcsold be a belépést", "A Firebase konzolban: Authentication, Sign-in method, Anonymous, és kapcsold be. Utána frissítsd az oldalt."));
        break;
      case "offline":
        main.replaceChildren(messageView("Nincs internet", "Az első indításhoz internet kell. Kapcsold be a netet, és frissítsd az oldalt."));
        break;
      case "bootfail":
        main.replaceChildren(messageView("Nem indult el", "Frissítsd az oldalt. Ha így sem megy, nézd meg a netkapcsolatot."));
        break;
      case "error":
        main.replaceChildren(S.errorCode === "permission-denied"
          ? messageView("Nincs hozzáférés", "A Firestore szabályai nem engedik az olvasást. Másold be a firestore.rules tartalmát a Firebase konzolba (Firestore, Rules), és tedd közzé.")
          : messageView("Nem sikerült betölteni", "Frissítsd az oldalt. Ha így sem megy, nézd meg a netkapcsolatot."));
        break;
      case "ready": {
        const y = window.scrollY;
        main.replaceChildren(readyView());
        window.scrollTo(0, y);
        break;
      }
    }
  }
  function installBanner() {
    if (!S.installPrompt || isStandalone() || lsGet("strigula-install-hidden")) return null;
    return el("p", { class: "banner row" },
      el("span", { text: "Tedd ki a kezdőképernyőre, és appként indul." }),
      el("button", { type: "button", class: "btn", onclick: promptInstall }, "Telepítés"),
      el("button", { type: "button", class: "del", "aria-label": "Elrejtés",
        onclick: () => { lsSet("strigula-install-hidden", "1"); renderAll(); } }, "×"));
  }
  async function promptInstall() {
    const p = S.installPrompt;
    if (!p) return;
    S.installPrompt = null;
    try { await p.prompt(); } catch (e) {}
    renderAll();
  }
  function readyView() {
    const wrap = el("div");
    if (S.stale) wrap.append(el("p", { class: "banner", text: "Lehet, hogy nem friss: most nem érem el a szervert. Amit felírsz, elmentem, amint visszajön a net." }));
    const ib = installBanner();
    if (ib) wrap.append(ib);
    let view = S.view;
    if (view === "me" && !S.myDoc) view = "all";
    if (view !== "me" && view !== "all" && !S.docs.has(view)) view = S.myDoc ? "me" : "all";
    S.view = view;
    if (view === "all") wrap.append(allView());
    else if (view === "me") wrap.append(personView(S.myId, S.myDoc, true));
    else wrap.append(personView(view, S.docs.get(view), false));
    return wrap;
  }
  function personView(id, doc, mine) {
    const editable = mine && !S.readOnly;
    const sec = el("section");
    const alc = alcoholTotal(doc);
    const wat = catTotal(doc, CAT_BY_ID.water);
    sec.append(el("div", { class: "p-head" },
      el("h2", { class: "cond", text: doc.name || "Névtelen" }),
      el("p", { text: "Ezen a bulin: " + alc + " alkoholos ital, " + wat + " víz vagy üdítő" + (doc.recent[0] ? ". Utoljára " + ago(doc.recent[0].t) + "." : ".") })));
    if (mine && S.readOnly) {
      sec.append(el("p", { class: "banner", text: "A szerver most nem engedi a mentést. Ellenőrizd a Firestore szabályokat." }));
    }
    for (const cat of CATS) sec.append(catRow(id, doc, cat, editable));
    if (editable) {
      sec.append(el("p", { class: "help", text: "A + gomb az utoljára választott italt írja fel. Koppints egy sorra, és ott fajtánként is felírhatod, például Jägermeister vagy Unicum." }));
    }
    const st = statsOf(id);
    sec.append(statsSection(mine ? "Az én statisztikám" : "Statisztikája", st.years[thisYear()] || emptyCounts(), st.total,
      mine ? "Minden bulidból összeadva, ezen a telefonon. A nullázás és a buliváltás nem törli." : "Minden bulijából összeadva."));
    return sec;
  }
  function statCard(title, counts) {
    return el("div", { class: "stat" },
      el("span", { class: "stat-title", text: title }),
      el("span", { class: "stat-num cond", text: String(alcOf(counts)) }),
      el("span", { class: "stat-sub", text: "alkoholos ital" }),
      el("span", { class: "stat-cats", "aria-label": CATS.map(c => c.name + " " + Math.max(0, counts[c.id])).join(", ") },
        ...CATS.map(c => el("span", { class: "pc", style: "--c: var(--" + c.id + ")", "aria-hidden": "true" },
          el("span", { class: "e", text: c.emoji }),
          el("span", { class: "n cond", text: String(Math.max(0, counts[c.id])) })))));
  }
  function statsSection(heading, yearCounts, totalCounts, note) {
    const sec = el("section", { class: "stats" }, el("h3", { class: "feed-title cond", text: heading }));
    if (S.statsError) {
      sec.append(el("p", { class: "banner", text: "A statisztikához frissíteni kell a Firestore szabályokat: másold be újra a firestore.rules tartalmát a Firebase konzolba." }));
      return sec;
    }
    sec.append(el("div", { class: "stat-grid" }, statCard("Idén (" + thisYear() + ")", yearCounts), statCard("Összesen", totalCounts)));
    if (note) sec.append(el("p", { class: "stat-note", text: note }));
    return sec;
  }
  function catRow(pid, doc, cat, editable) {
    const total = catTotal(doc, cat);
    const quick = quickOf(doc, cat);
    const row = el("div", { class: "cat" + (cat.quiet ? " quiet" : ""), style: "--c: var(--" + cat.id + ")" });
    let hint = "";
    if (editable) hint = "A + gomb: " + label(cat.id, quick);
    else {
      const top = [...doc.cats[cat.id].items].sort((a, b) => b.n - a.n).slice(0, 3);
      hint = top.map(i => i.name + " " + i.n).join(", ");
    }
    row.append(el("button", { type: "button", class: "cat-open", "aria-label": cat.name + ": " + total + ". Részletek",
      onclick: () => openSheet({ type: "detail", pid, cid: cat.id }) },
      el("span", { class: "cat-title" }, el("span", { class: "emoji", "aria-hidden": "true", text: cat.emoji }), el("span", { text: cat.name })),
      el("span", { class: "cat-num cond", text: String(total) }),
      tally(total, editable && S.fresh === cat.id),
      hint ? el("span", { class: "cat-hint", text: hint }) : null));
    if (editable) {
      row.append(el("button", { type: "button", class: "plus cond", "aria-label": "Még egy: " + label(cat.id, quick),
        onclick: () => addDrink(cat.id, quickOf(S.myDoc, cat)) }, "+1"));
    }
    return row;
  }
  function allView() {
    const sec = el("section");
    const people = [...allPeople().entries()].sort(byName);
    sec.append(el("h2", { class: "view-title cond", text: people.length ? people.length + " fő a buliban" : "Még senki sincs itt" }));
    sec.append(el("p", { class: "muted" }, "A buli kódja: ", el("span", { class: "code", text: S.party || "" })));
    sec.append(el("div", { class: "top-actions" },
      el("button", { type: "button", class: "btn secondary", onclick: invite }, "Barátok meghívása")));
    const ul = el("ul", { class: "people" });
    for (const [id, d] of people) {
      const me = id === S.myId;
      const counts = CATS.map(c => c.name + " " + catTotal(d, c)).join(", ");
      const last = d.recent[0];
      const sub = last ? label(last.c, last.d) + ", " + ago(last.t) : "Még nem írt fel semmit";
      const b = el("button", { type: "button", class: "person-row", "aria-label": (d.name || "Névtelen") + (me ? " (te)" : "") + ". " + counts,
        onclick: () => { S.view = me ? "me" : id; renderAll(); window.scrollTo(0, 0); } },
        el("span", { class: "dot big", style: "background:" + colorFor(id), "aria-hidden": "true" }),
        el("span", { class: "p-main" },
          el("span", { class: "p-name", text: (d.name || "Névtelen") + (me ? " (te)" : "") }),
          el("span", { class: "p-sub", text: sub })),
        el("span", { class: "p-counts", "aria-hidden": "true" },
          ...CATS.map(c => el("span", { class: "pc", style: "--c: var(--" + c.id + ")" },
            el("span", { class: "e", text: c.emoji }),
            el("span", { class: "n cond", text: String(catTotal(d, c)) })))));
      ul.append(el("li", {}, b));
    }
    sec.append(ul);
    const g = groupStats();
    sec.append(statsSection("Mindenki együtt", g.year, g.total, "Az összes buliból, mindenkit beleszámolva, aki valaha használta az appot."));
    const feed = [];
    for (const [id, d] of people) for (const r of d.recent) feed.push({ who: d.name || "Névtelen", me: id === S.myId, ...r });
    feed.sort((a, b) => b.t - a.t);
    if (feed.length) {
      sec.append(el("h3", { class: "feed-title cond", text: "Legutóbb" }));
      const ol = el("ol", { class: "feed" });
      for (const f of feed.slice(0, 15)) {
        ol.append(el("li", {},
          el("span", { class: "f-who", text: f.me ? "Te" : f.who }),
          el("span", { text: CAT_BY_ID[f.c].emoji + " " + label(f.c, f.d) }),
          el("span", { class: "f-when", text: ago(f.t) })));
      }
      sec.append(ol);
    }
    return sec;
  }
  function onboardView() {
    const sec = el("section", { class: "onboard" });
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 72 56");
    svg.setAttribute("width", "92");
    svg.setAttribute("height", "72");
    svg.setAttribute("class", "hero-tally");
    svg.setAttribute("aria-hidden", "true");
    [["12", "6", "12", "50", "var(--shot)"], ["27", "6", "27", "50", "var(--wine)"],
     ["42", "6", "42", "50", "var(--beer)"], ["57", "6", "57", "50", "var(--water)"],
     ["3", "42", "69", "14", "currentColor"]].forEach((s, i) => {
      const l = document.createElementNS(SVGNS, "line");
      l.setAttribute("x1", s[0]); l.setAttribute("y1", s[1]); l.setAttribute("x2", s[2]); l.setAttribute("y2", s[3]);
      l.setAttribute("stroke", s[4]);
      l.setAttribute("class", "draw");
      l.setAttribute("style", "animation-delay:" + (i * 0.12) + "s");
      svg.append(l);
    });
    sec.append(svg);
    sec.append(el("h2", { class: "hero cond", text: "Ki iszik ma?" }));
    sec.append(el("p", { class: "lead", text: "Add meg a neved és a buli kódját. Utána egy koppintással felírod, mit ittál, és mindenki élőben látja." }));
    if (isIOS() && !isStandalone()) {
      sec.append(el("p", { class: "note", text: "iPhone-on előbb tedd ki az appot a kezdőképernyőre (Megosztás ikon, majd Főképernyőhöz adás), és onnan indítva lépj be. Különben kétszer szerepelnél." +
        (S.party ? " A buli kódja: " + S.party : "") }));
    }
    const name = el("input", { id: "nameInput", class: "field big", type: "text", maxlength: NAME_MAX, autocomplete: "nickname",
      enterkeyhint: "next", placeholder: "pl. Zsombi" });
    name.value = lsGet("strigula-name") || "";
    const code = el("input", { id: "codeInput", class: "field", type: "text", maxlength: 40, autocomplete: "off",
      autocapitalize: "none", spellcheck: "false", enterkeyhint: "go", placeholder: "pl. buli-k7m2p9qa" });
    code.value = S.party || "";
    const btn = el("button", { type: "button", class: "btn big wide" }, "Belépek a buliba");
    const msg = el("p", { id: "joinMsg", class: "msg", role: "status" });
    const go = () => join(name.value, code.value, msg, btn);
    btn.addEventListener("click", go);
    name.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); code.focus(); } });
    code.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    const fresh = el("button", { type: "button", class: "link-btn",
      onclick: () => { code.value = newPartyCode(); msg.textContent = "Új buli kód kész. Belépés után a Mindenki fülön tudod elküldeni a barátaidnak."; msg.classList.remove("err"); } },
      "Új bulit indítok, kérek egy kódot");
    sec.append(el("div", { class: "stack" },
      el("label", { class: "lbl", for: "nameInput", text: "A neved" }), name,
      el("label", { class: "lbl", for: "codeInput", text: "A buli kódja" }), code,
      el("p", { class: "hint", text: "Ha linkkel kaptad, már ki van töltve." }),
      btn), msg, fresh);
    return sec;
  }

  /* ---------- bottom sheets ---------- */
  function openSheet(sheet) {
    S.sheet = sheet;
    const root = $("#sheetRoot");
    root.replaceChildren();
    const close = el("button", { type: "button", class: "icon-btn", "aria-label": "Bezárás", onclick: closeSheet });
    close.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
    const title = el("h2", { id: "sheetTitle", class: "sheet-title cond" });
    const body = el("div", { id: "sheetBody", class: "sheet-body" });
    const panel = el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": "sheetTitle" },
      el("div", { class: "grab", "aria-hidden": "true" }),
      el("div", { class: "sheet-head" }, title, close),
      body);
    if (sheet.type === "detail") {
      panel.style.setProperty("--c", "var(--" + sheet.cid + ")");
      if (sheet.pid === S.myId && S.myDoc && !S.readOnly) panel.append(addForm(sheet.cid));
    } else if (sheet.type === "settings") {
      title.textContent = "Beállítások";
      body.append(settingsBody());
    } else if (sheet.type === "confirm") {
      title.textContent = "Biztos?";
      body.append(
        el("p", { class: "confirm-text", text: sheet.text }),
        el("div", { class: "btn-row" },
          el("button", { type: "button", class: "btn secondary", onclick: closeSheet }, "Mégse"),
          el("button", { type: "button", class: "btn danger", onclick: () => { const a = sheet.action; closeSheet(); a(); } }, sheet.label)));
    }
    root.append(el("div", { class: "backdrop", onclick: closeSheet }), panel);
    document.body.classList.add("locked");
    renderSheet();
    try { close.focus({ preventScroll: true }); } catch (e) {}
  }
  function closeSheet() {
    S.sheet = null;
    $("#sheetRoot").replaceChildren();
    document.body.classList.remove("locked");
  }
  function confirmSheet(text, lbl, action) { openSheet({ type: "confirm", text, label: lbl, action }); }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.sheet) closeSheet(); });

  function renderSheet() {
    const s = S.sheet;
    if (!s || s.type !== "detail") return;
    const cat = CAT_BY_ID[s.cid];
    const mine = s.pid === S.myId && !!S.myDoc;
    const doc = mine ? S.myDoc : S.docs.get(s.pid);
    if (!doc || S.phase !== "ready") { closeSheet(); return; }
    const editable = mine && !S.readOnly;
    const body = $("#sheetBody");
    $("#sheetTitle").replaceChildren(
      document.createTextNode(cat.emoji + " " + cat.name + " "),
      el("span", { class: "sheet-total", text: String(catTotal(doc, cat)) }));
    let list = drinkList(doc, cat);
    if (!editable) list = list.filter(d => d.n > 0).sort((a, b) => b.n - a.n);
    const keep = body.scrollTop;
    const who = mine ? null : el("p", { class: "muted", text: (doc.name || "Névtelen") + " számlálója, csak nézheted." });
    if (!list.length) { body.replaceChildren(...(who ? [who] : []), el("p", { class: "empty", text: "Ebből még nincs semmi felírva." })); return; }
    const quick = quickOf(doc, cat);
    const ul = el("ul", { class: "drinks" });
    for (const d of list) {
      const li = el("li", { class: "drink" + (d.n > 0 ? " has" : "") });
      li.append(el("span", { class: "d-name" },
        el("span", { class: "nm", text: d.name }),
        editable && d.name === quick ? el("span", { class: "q-tag", text: "+ gomb" }) : null));
      if (editable) {
        if (d.custom && d.n === 0) {
          li.append(el("button", { type: "button", class: "del", "aria-label": d.name + " törlése a listából", onclick: () => removeCustom(cat.id, d.name) }, "×"));
        }
        li.append(el("span", { class: "d-actions" },
          el("button", { type: "button", class: "mini", "aria-label": "Egy " + d.name + " levonása", disabled: d.n === 0,
            onclick: () => { if (bump(cat.id, d.name, -1)) renderAll(); } }, "−"),
          el("span", { class: "d-n cond", text: String(d.n) }),
          el("button", { type: "button", class: "mini mini-plus", "aria-label": "Még egy " + d.name, onclick: () => addDrink(cat.id, d.name) }, "+")));
      } else {
        li.append(el("span", { class: "d-n cond", text: String(d.n) }));
      }
      ul.append(li);
    }
    body.replaceChildren(...(who ? [who, ul] : [ul]));
    body.scrollTop = keep;
  }
  function addForm(cid) {
    const cat = CAT_BY_ID[cid];
    const input = el("input", { id: "customInput", class: "field", type: "text", maxlength: NAME_MAX, placeholder: cat.placeholder,
      autocomplete: "off", enterkeyhint: "done" });
    const btn = el("button", { type: "button", class: "btn" }, "Felírom");
    const go = () => {
      if (!cleanName(input.value)) { input.focus(); return; }
      if (addCustom(cid, input.value)) { input.value = ""; input.blur(); }
    };
    btn.addEventListener("click", go);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    return el("div", { class: "add-row" },
      el("label", { class: "lbl", for: "customInput", text: "Nincs a listán? Írd be, és felírom:" }),
      el("div", { class: "add-inline" }, input, btn));
  }
  function settingsBody() {
    const wrap = el("div", { class: "settings" });
    if (S.myDoc && !S.readOnly) {
      const input = el("input", { id: "setName", class: "field", type: "text", maxlength: NAME_MAX, autocomplete: "nickname", enterkeyhint: "done" });
      input.value = S.myDoc.name;
      const save = el("button", { type: "button", class: "btn" }, "Név mentése");
      const doSave = () => {
        const n = cleanName(input.value);
        if (!n || !S.myDoc) { input.focus(); return; }
        S.myDoc.name = n;
        S.myDoc.updatedAt = Date.now();
        lsSet("strigula-name", n);
        scheduleWrite();
        renderAll();
        input.blur();
        toast("Név elmentve.");
      };
      save.addEventListener("click", doSave);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSave(); } });
      wrap.append(el("div", {}, el("label", { class: "lbl", for: "setName", text: "A neved a buliban" }), el("div", { class: "add-inline" }, input, save)));
    }
    wrap.append(
      el("p", { class: "muted" }, "A buli kódja: ", el("span", { class: "code", text: S.party || "" })),
      el("button", { type: "button", class: "btn wide", onclick: invite }, "Barátok meghívása"));
    if (S.myDoc && !S.readOnly) {
      wrap.append(el("button", { type: "button", class: "btn secondary wide",
        onclick: () => confirmSheet("Nullázod a saját számlálóidat. A többiekét ez nem érinti.", "Nullázom", resetMine) }, "Saját számlálóim nullázása"));
    }
    wrap.append(
      el("h3", { class: "settings-sub cond", text: "Új buli" }),
      el("p", { class: "muted", text: "Új bulihoz kérj új kódot, és küldd el a linket a többieknek. Ez a buli megmarad, a kódjával bármikor visszajöhetsz." }),
      el("button", { type: "button", class: "btn secondary wide", onclick: () => { closeSheet(); switchParty(); } }, "Másik buli vagy új kód"));
    if (S.myDoc) {
      wrap.append(el("button", { type: "button", class: "btn danger wide",
        onclick: () => confirmSheet("Kilépsz ebből a buliból, és a számlálóid törlődnek belőle.", "Kilépek", leaveParty) }, "Kilépek ebből a buliból"));
    }
    if (!isStandalone()) {
      wrap.append(el("h3", { class: "settings-sub cond", text: "Telepítés" }));
      if (S.installPrompt) wrap.append(el("button", { type: "button", class: "btn wide", onclick: () => { closeSheet(); promptInstall(); } }, "Telepítés a telefonra"));
      else if (isIOS()) wrap.append(el("p", { class: "muted", text: "Safariban koppints a Megosztás ikonra, majd a Főképernyőhöz adás pontra." }));
      else wrap.append(el("p", { class: "muted", text: "Chrome-ban nyisd meg a ⋮ menüt, és válaszd az Alkalmazás telepítése vagy a Hozzáadás a kezdőképernyőhöz pontot." }));
    }
    return wrap;
  }
  $("#settingsBtn").addEventListener("click", () => openSheet({ type: "settings" }));

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(text, undo) {
    $("#toastText").textContent = text;
    const u = $("#toastUndo");
    u.hidden = !undo;
    u.onclick = undo ? () => { hideToast(); undo(); } : null;
    $("#toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, undo ? 5000 : 4000);
  }
  function hideToast() { $("#toast").hidden = true; clearTimeout(toastTimer); }

  /* ---------- install + offline shell ---------- */
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    S.installPrompt = e;
    if (S.phase === "ready") renderAll();
  });
  window.addEventListener("appinstalled", () => { S.installPrompt = null; if (S.phase === "ready") renderAll(); });
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }

  /* ---------- start ---------- */
  const bootTimer = setTimeout(() => { if (!S.started) { S.phase = "bootfail"; renderAll(); } }, 20000);
  window.strigulaStart = function (backend, problem) {
    if (S.started) return;
    S.started = true;
    clearTimeout(bootTimer);
    if (!backend) { S.phase = problem || "error"; renderAll(); return; }
    S.backend = backend;
    S.myId = backend.uid;
    try {
      backend.watchStats((snap) => {
        const m = new Map();
        for (const d of snap.docs) m.set(d.id, sanitizeStats(d.data));
        S.stats = m;
        S.statsError = false;
        if (S.phase === "ready") renderAll();
      }, (e) => {
        if (errCode(e) === "permission-denied") { S.statsError = true; if (S.phase === "ready") renderAll(); }
      });
    } catch (e) {}
    let urlParty = null;
    try { urlParty = cleanParty(new URLSearchParams(location.search).get("buli")); } catch (e) {}
    const party = urlParty || cleanParty(lsGet("strigula-party"));
    if (party) { S.phase = "loading"; setParty(party); }
    else goOnboard();
    renderAll();
  };
  setInterval(() => { if (S.phase === "ready" && !document.hidden) renderMain(); }, 30000);
  renderAll();
  if (window.strigulaPending) window.strigulaStart(window.strigulaPending[0], window.strigulaPending[1]);
})();
