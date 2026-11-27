/* Másnapló – „Ami tegnap még jó ötletnek tűnt”.
   A felület és a logika. Az adatbázist és a fiókokat a backend.js adja. */
(() => {
  "use strict";

  /* ---------- alapbeállítások ---------- */
  const CATS = [
    { id: "shot", name: "Rövid", short: "Rövid", emoji: "🥃", ml: 40, pts: 5, quick: "Egyéb", placeholder: "pl. Becherovka",
      defaults: ["Jägermeister", "Unicum", "Pálinka", "Tequila", "Vodka", "Rum", "Whisky", "Gin", "Egyéb"] },
    { id: "wine", name: "Bor", short: "Bor", emoji: "🍷", ml: 100, pts: 3, quick: "Egyéb", placeholder: "pl. Tokaji",
      defaults: ["Fehér", "Vörös", "Rozé", "Fröccs", "Pezsgő", "Egyéb"] },
    { id: "beer", name: "Sör", short: "Sör", emoji: "🍺", ml: 500, pts: 2, quick: "Egyéb", placeholder: "pl. Cider",
      defaults: ["Világos", "Barna", "Búza", "IPA", "Egyéb"] },
    { id: "water", name: "Víz, üdítő", short: "Víz", emoji: "💧", ml: 300, pts: 0.25, quick: "Víz", placeholder: "pl. Kóla", quiet: true,
      defaults: ["Víz", "Üdítő"] },
  ];
  const CAT_BY_ID = Object.fromEntries(CATS.map(c => [c.id, c]));
  const VOMIT_PTS = 20;
  const DAY_START_HOUR = 6;
  const NAME_MAX = 24;
  const PARTY_NAME_MAX = 40;
  const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,19}$/;
  const USERNAME_HINT = "3–20 karakter: angol betűk, számok, pont, kötőjel vagy aláhúzás, ékezet nélkül.";
  const FLOZ_ML = 28.4130625;
  const PALETTE = ["#E4572E", "#F3A712", "#3BB273", "#2D9CDB", "#9B5DE5", "#F15BB5", "#00B8A9", "#C0A16B"];
  const SVGNS = "http://www.w3.org/2000/svg";
  // A hozzájárulás verziója: ha változik, mindenki újra látja a hozzájárulási képernyőt (a feltételek lényeges módosításakor is emelni kell).
  const CONSENT_V = "2026-11-27";
  // A Felhasználási feltételek és az Adatkezelési tájékoztató „Utolsó módosítás” dátuma.
  const TERMS_DATE = "2026. november 27.";
  const PRIVACY_DATE = "2026. november 27.";
  const MIGRATION_V = 1;
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const RECENT_DAY = 10;
  const GAME_MAX = { name: 60, players: 30, tools: 300, desc: 2000 };
  // Kocsmák: a 10 választható profilkép, a név és az üzenet hossza, a meghívókód és az azonosító formája.
  const KICONS = [
    { id: "01", file: "01-koccinto-korsok.svg", name: "Koccintó korsók" },
    { id: "02", file: "02-sorcsap.svg", name: "Sörcsap" },
    { id: "03", file: "03-hordo.svg", name: "Hordó" },
    { id: "04", file: "04-harom-kupica.svg", name: "Három kupica" },
    { id: "05", file: "05-tequila.svg", name: "Tequila" },
    { id: "06", file: "06-martini.svg", name: "Martini" },
    { id: "07", file: "07-bor-es-pohar.svg", name: "Bor és pohár" },
    { id: "08", file: "08-koccinto-borospoharak.svg", name: "Koccintó borospoharak" },
    { id: "09", file: "09-diszkogomb.svg", name: "Diszkógömb" },
    { id: "10", file: "10-ejszakai-sor.svg", name: "Éjszakai sör" },
  ];
  const KICON_BY_ID = Object.fromEntries(KICONS.map(i => [i.id, i]));
  const KNAME_MAX = 40;
  const MSG_MAX = 500;
  const MSG_PAGE = 50;
  const KCODE_RE = /^[a-z0-9]{8}$/;
  const KID_RE = /^[A-Za-z0-9]{10,40}$/;
  const TABS = ["games", "calendar", "kocsma", "map", "profile"];
  const OWNER_UID = (() => {
    const u = window.MASNAPLO_OWNER_UID;
    return typeof u === "string" && /^[A-Za-z0-9]{10,64}$/.test(u.trim()) ? u.trim() : "";
  })();
  const OWNER_WINDOW_MS = 14 * 60 * 1000;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const RULES_MSG = "A Firestore szabályai elavultak. Másold be az új firestore.rules tartalmát a Firebase konzolba (Firestore, Rules), és nyomj Publish-t.";

  /* ---------- segédfüggvények ---------- */
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
  function svgEl(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) e.setAttribute(k, String(v));
    return e;
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function cleanName(s) {
    const n = String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
    // A Firestore nem enged „__valami__” alakú mezőnevet; az italneveket mezőnévként tároljuk.
    return /^__.*__$/.test(n) ? n.replace(/^_+/, "_") : n;
  }
  function num(x) { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : 0; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function errCode(e) { return e && e.code ? String(e.code).replace(/^firestore\//, "") : ""; }
  function colorFor(id) {
    let h = 0;
    for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  // Sötét vagy világos betű a színes monogramhoz, hogy jól olvasható legyen.
  function inkOn(hex) {
    const v = parseInt(String(hex).slice(1), 16);
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin((v >> 16) & 255) + 0.7152 * lin((v >> 8) & 255) + 0.0722 * lin(v & 255);
    return L > 0.3 ? "#17221D" : "#FFFFFF";
  }
  function monogram(name) {
    const s = String(name || "").trim();
    if (!s) return "?";
    const parts = s.split(/[\s._-]+/).filter(Boolean);
    const first = (p) => Array.from(p)[0] || "";
    const m = parts.length > 1 ? first(parts[0]) + first(parts[1]) : first(s);
    return m.toLocaleUpperCase("hu");
  }
  function avatar(id, name, size) {
    const bg = colorFor(id);
    return el("span", { class: "avatar" + (size ? " " + size : ""), style: "background:" + bg + ";color:" + inkOn(bg), "aria-hidden": "true", text: monogram(name) });
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
  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function isStandalone() {
    try { if (window.matchMedia("(display-mode: standalone)").matches) return true; } catch (e) {}
    return navigator.standalone === true;
  }
  function fmtNum(n, digits) { return Number(n).toLocaleString("hu-HU", { maximumFractionDigits: digits }); }
  function fmtPts(p) { return fmtNum(p, 2).replace(/^-/, "−"); }
  function fmtVol(ml) {
    if (!ml) return S.units === "imperial" ? "0 fl oz" : "0 l";
    if (S.units === "imperial") {
      const oz = ml / FLOZ_ML;
      return oz < 20 ? fmtNum(oz, 1) + " fl oz" : fmtNum(oz / 20, 1) + " pint";
    }
    if (ml < 100) return fmtNum(ml / 10, 1) + " cl";
    if (ml < 1000) return fmtNum(ml / 100, 1) + " dl";
    return fmtNum(ml / 1000, 2) + " l";
  }
  function fmtDate(t) {
    try { return new Date(t).toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" }); }
    catch (e) { return ""; }
  }
  /* ---------- napok ---------- */
  // Egy „buli-nap” hajnali 6-tól másnap hajnali 6-ig tart.
  function keyOf(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dayKey(ts) { return keyOf(new Date(ts - DAY_START_HOUR * 3600 * 1000)); }
  function todayKey() { return dayKey(Date.now()); }
  function thisYear() { return todayKey().slice(0, 4); }
  function keyDate(key) { const p = key.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
  function shiftDay(key, n) { const d = keyDate(key); d.setDate(d.getDate() + n); return keyOf(d); }
  // A nap dele: ehhez az időponthoz tartozó buli-nap mindig maga a nap.
  function dayNoon(key) { return keyDate(key).getTime(); }
  function dayLabel(key) {
    try { return keyDate(key).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }); }
    catch (e) { return key.slice(5); }
  }
  function dayLong(key) {
    try { return keyDate(key).toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric", weekday: "long" }); }
    catch (e) { return key; }
  }
  function dayRel(key) {
    const t = todayKey();
    if (key === t) return "Ma";
    if (key === shiftDay(t, -1)) return "Tegnap";
    let wd = "";
    try { wd = keyDate(key).toLocaleDateString("hu-HU", { weekday: "long" }); } catch (e) {}
    return wd ? wd.charAt(0).toLocaleUpperCase("hu") + wd.slice(1) : "";
  }
  function passwordChecks(p) {
    const s = String(p || "");
    return { len: s.length >= 8, lower: /\p{Ll}/u.test(s), upper: /\p{Lu}/u.test(s), digit: /\p{Nd}/u.test(s) };
  }
  function passwordOk(p) { const c = passwordChecks(p); return c.len && c.lower && c.upper && c.digit; }
  function fold(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  /* ---------- állapot ---------- */
  const S = {
    phase: "boot", // boot | auth | pickname | consent | banned | loading | ready | error | noconfig | authoff | offline | bootfail | rulesold
    started: false, backend: null, myId: null,
    username: "", usernameKey: "", legacy: false, authMode: "signup", pickMsg: "",
    email: "", emailReal: false, emailVerified: false,
    isOwner: false, ownerUntil: 0, bans: new Set(), banned: false, privParties: null,
    tab: "kocsma", partyOpen: null, person: null,
    // a megnyitott buli (élő adatok)
    party: null, unsub: null, metaUnsub: null, votesUnsub: null,
    docs: new Map(), votes: new Map(), partyMeta: null, partyLoaded: false,
    stale: false, errorCode: "", readOnly: false, votesError: false,
    // napi napló
    days: new Map(), daysLoaded: false, daysSynced: false, daysError: false, dayShow: 30, pastShow: 8,
    prefs: null, prefsTimer: null,
    derivePending: new Set(), deriveTimer: null, deriveError: false,
    migrated: 0, migrating: false, migrationDone: false, migrationError: false, migrationTimer: null,
    // ivós játékok
    games: new Map(), gamesLoaded: false, gamesError: false, gameQuery: "",
    sheet: null, fresh: null, invite: null, deleting: false,
    stats: new Map(), statsDelta: { years: {}, days: {} }, statsTimer: null, statsError: false,
    installPrompt: null,
    units: lsGet("strigula-units") === "imperial" ? "imperial" : "metric",
    chartTip: null, chartScroll: {},
    // kocsmák
    privK: null,                 // a private.kocsmak: kocsma azonosító → belépés ideje (a kocsmáim)
    kocsmak: new Map(),          // kocsma azonosító → { name, icon, code, owner, party, createdAt } (élő)
    kUnsubs: new Map(),
    kocsma: null,                // az aktív kocsma
    kMembers: new Map(), kMembersLoaded: false, kMembersUnsub: null,
    kMsgs: [], kMsgsLoaded: false, kMsgsFull: false, kMsgsError: false, kMsgsUnsub: null, kMsgLimit: MSG_PAGE,
    kScreen: null, kUser: null, kMonth: null, kLeaving: new Set(), kInvite: null, chatScrollDown: false,
    kMembersServer: null, kClaiming: false, kClaimTimer: null, kRepaired: new Set(),
    // barátok
    friends: new Map(), friendsLoaded: false, reqIn: new Map(), reqOut: new Map(), socialError: false,
    dismissing: new Set(), profUser: null,
  };

  /* ---------- buli kódok és a Bulijaim lista (ezen a telefonon) ---------- */
  function cleanParty(s) {
    if (!s) return null;
    const c = String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    return c.length >= 3 ? c : null;
  }
  function newPartyCode() {
    const a = "abcdefghjkmnpqrstuvwxyz23456789";
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    return "buli-" + Array.from(b, x => a[x % a.length]).join("");
  }
  function cleanPartyName(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, PARTY_NAME_MAX); }
  function defaultPartyName(key) { return "Buli, " + fmtDate(dayNoon(key || todayKey())); }
  function loadParties() {
    let a = [];
    try { a = JSON.parse(lsGet("strigula-parties") || "[]"); } catch (e) {}
    if (!Array.isArray(a)) return [];
    return a.filter(p => p && typeof p.code === "string" && cleanParty(p.code) === p.code)
      .map(p => ({ code: p.code, name: typeof p.name === "string" ? cleanPartyName(p.name) : "", at: num(p.at), created: num(p.created) }));
  }
  function saveParties(list) { lsSet("strigula-parties", JSON.stringify(list.slice(0, 80))); }
  function rememberParty(code, patch) {
    if (!code) return;
    const list = loadParties();
    let p = list.find(x => x.code === code);
    if (!p) { p = { code, name: "", at: 0, created: 0 }; list.push(p); }
    for (const [k, v] of Object.entries(patch || {})) {
      if (k === "at") p.at = Math.max(p.at, num(v));
      else if (v != null && v !== "") p[k] = v;
    }
    list.sort((a, b) => b.at - a.at);
    saveParties(list);
  }
  function loadHidden() {
    try { const a = JSON.parse(lsGet("strigula-hidden-parties") || "[]"); return new Set(Array.isArray(a) ? a.filter(x => typeof x === "string") : []); }
    catch (e) { return new Set(); }
  }
  function saveHidden(set) { lsSet("strigula-hidden-parties", JSON.stringify([...set].slice(-200))); }
  // Levétel a listáról: csak ezen a telefonon, és a szerverről sem töltjük vissza.
  function forgetParty(code) {
    saveParties(loadParties().filter(p => p.code !== code));
    const h = loadHidden(); h.add(code); saveHidden(h);
  }
  function unhideParty(code) {
    const h = loadHidden();
    if (h.delete(code)) saveHidden(h);
  }
  // Belépés után a szerveren tárolt bulikat visszatesszük a listába (pl. újratelepítés után).
  function restoreParties() {
    const srv = S.privParties;
    if (!srv || typeof srv !== "object") return;
    const hidden = loadHidden();
    const local = new Set(loadParties().map(p => p.code));
    const missing = Object.entries(srv)
      .filter(([c]) => cleanParty(c) === c && !local.has(c) && !hidden.has(c))
      .sort((a, b) => num(b[1]) - num(a[1]))
      .slice(0, 40);
    for (const [c, t] of missing) rememberParty(c, { at: num(t) });
    fetchPartyNames(missing.map(([c]) => c));
  }
  // A napjaimban szereplő bulik is kerüljenek a listába.
  function learnParties() {
    const hidden = loadHidden();
    const local = new Map(loadParties().map(p => [p.code, p]));
    const latest = new Map();
    for (const [key, d] of S.days) {
      if (!d.party) continue;
      const t = dayNoon(key);
      if (!latest.has(d.party) || latest.get(d.party) < t) latest.set(d.party, t);
    }
    const need = [];
    for (const [code, t] of latest) {
      const p = local.get(code);
      if (!hidden.has(code) && (!p || p.at < t)) rememberParty(code, { at: t });
      if ((!p || !p.name) && !partyNames.has(code)) need.push(code);
    }
    fetchPartyNames(need);
  }
  const nameAsked = new Set();
  const partyNames = new Map();
  function fetchPartyNames(codes) {
    if (!S.backend || typeof S.backend.getPartyMeta !== "function") return;
    const todo = [...new Set(codes)].filter(c => !nameAsked.has(c)).slice(0, 40);
    if (!todo.length) return;
    todo.forEach(c => nameAsked.add(c));
    Promise.all(todo.map(c => Promise.resolve().then(() => S.backend.getPartyMeta(c)).then((m) => {
      const name = m && typeof m.name === "string" ? cleanPartyName(m.name) : "";
      if (!name) return;
      partyNames.set(c, name);
      if (!loadHidden().has(c)) rememberParty(c, { name, created: num(m.createdAt) });
    }).catch(() => {}))).then(() => { if (S.phase === "ready") renderAll(); });
  }
  function partyName(code) {
    if (!code) return "";
    if (code === S.party && S.partyMeta && S.partyMeta.name) return S.partyMeta.name;
    const saved = loadParties().find(p => p.code === code);
    return (saved && saved.name) || partyNames.get(code) || code;
  }
  function inviteUrl(code) {
    const u = new URL(location.href);
    u.search = "";
    u.hash = "";
    u.searchParams.set("buli", code);
    return u.toString();
  }

  /* ---------- egy ember egy bulin (a buli résztvevői dokumentuma) ---------- */
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
  function catTotal(doc, cat) { return doc.cats[cat.id].items.reduce((s, i) => s + i.n, 0); }
  function catMl(doc, cat) { return catTotal(doc, cat) * cat.ml; }
  function alcoholTotal(doc) { return CATS.filter(c => !c.quiet).reduce((s, c) => s + catTotal(doc, c), 0); }
  function alcoholMl(doc) { return CATS.filter(c => !c.quiet).reduce((s, c) => s + catMl(doc, c), 0); }
  function label(cid, d) { return d === "Egyéb" ? "egyéb " + CAT_BY_ID[cid].name.toLocaleLowerCase("hu") : d; }
  function allPeople() { return S.docs; }
  function displayName(id, doc) {
    if (id === S.myId && S.username) return S.username;
    const st = S.stats.get(id);
    return (st && st.username) || (doc && doc.name) || "Névtelen";
  }

  /* ---------- saját italnevek és az utoljára választott fajta ---------- */
  function emptyPrefs() { const o = {}; for (const c of CATS) o[c.id] = { custom: [], quick: null }; return o; }
  function sanitizePrefs(src) {
    const out = emptyPrefs();
    const d = src && typeof src === "object" ? src : {};
    for (const c of CATS) {
      const s = d[c.id] && typeof d[c.id] === "object" ? d[c.id] : {};
      const custom = [];
      for (const x of Array.isArray(s.custom) ? s.custom : []) {
        if (typeof x !== "string") continue;
        const nm = cleanName(x);
        if (nm && !custom.includes(nm) && !c.defaults.includes(nm)) custom.push(nm);
      }
      out[c.id].custom = custom.slice(-30);
      const q = typeof s.quick === "string" ? cleanName(s.quick) : "";
      out[c.id].quick = q || null;
    }
    return out;
  }
  function prefs() { return S.prefs || (S.prefs = emptyPrefs()); }
  function quickOf(cid) { return prefs()[cid].quick || CAT_BY_ID[cid].quick; }
  function savePrefsSoon() { clearTimeout(S.prefsTimer); S.prefsTimer = setTimeout(savePrefs, 800); }
  function savePrefs() {
    clearTimeout(S.prefsTimer);
    S.prefsTimer = null;
    if (!S.backend || typeof S.backend.savePrefs !== "function" || S.readOnly) return;
    Promise.resolve().then(() => S.backend.savePrefs(clone(prefs()))).catch(() => {});
  }

  /* ---------- napi napló ---------- */
  // Az italnevek mezőnevek: prototípus nélküli objektum, hogy egy „constructor” nevű ital se okozzon gondot.
  function emptyDay() { const cats = {}; for (const c of CATS) cats[c.id] = Object.create(null); return { cats, recent: [], party: null, updatedAt: 0 }; }
  function sanitizeDay(src) {
    const d = src && typeof src === "object" ? src : {};
    const out = emptyDay();
    const cats = d.cats && typeof d.cats === "object" ? d.cats : {};
    for (const c of CATS) {
      const m = cats[c.id] && typeof cats[c.id] === "object" ? cats[c.id] : {};
      for (const [name, v] of Object.entries(m)) {
        const n = Math.floor(Number(v));
        if (!name || name.length > 60 || !(n > 0)) continue;
        out.cats[c.id][name] = Math.min(9999, n);
      }
    }
    for (const r of Array.isArray(d.recent) ? d.recent : []) {
      if (!r || !CAT_BY_ID[r.c] || typeof r.d !== "string" || !r.d) continue;
      out.recent.push({ c: r.c, d: r.d, t: num(r.t) });
    }
    out.recent.sort((a, b) => b.t - a.t);
    out.recent = out.recent.slice(0, RECENT_DAY);
    out.party = typeof d.party === "string" && cleanParty(d.party) === d.party ? d.party : null;
    out.updatedAt = num(d.updatedAt);
    return out;
  }
  function dayCount(day, cid) { let s = 0; for (const n of Object.values(day.cats[cid])) s += n; return s; }
  function dayItem(day, cid, name) { const v = day.cats[cid][name]; return typeof v === "number" ? v : 0; }
  function dayCounts(day) { const o = emptyCounts(); for (const c of CATS) o[c.id] = dayCount(day, c.id); return o; }
  function dayHasItems(day) { return CATS.some(c => dayCount(day, c.id) > 0); }
  function getDay(key) { return S.days.get(key) || null; }
  function ensureDay(key) { let d = S.days.get(key); if (!d) { d = emptyDay(); S.days.set(key, d); } return d; }
  function todayParty() { const d = getDay(todayKey()); return d ? d.party : null; }
  function myPartyDays(code) { return [...S.days.entries()].filter(([, d]) => d.party === code).map(([k]) => k).sort(); }
  function drinkList(day, cat) {
    const p = prefs()[cat.id];
    const names = cat.defaults.filter(n => n !== "Egyéb");
    const push = (n) => { if (n !== "Egyéb" && !names.includes(n)) names.push(n); };
    p.custom.forEach(push);
    Object.keys(day.cats[cat.id]).forEach(push);
    if (cat.defaults.includes("Egyéb") || dayItem(day, cat.id, "Egyéb") > 0) names.push("Egyéb");
    return names.map(n => ({ name: n, n: dayItem(day, cat.id, n), custom: !cat.defaults.includes(n) }));
  }

  /* ---------- a buli összesítése a napokból ----------
     A parties/{kód}/players/{uid} dokumentum a felhasználó azon napjainak összege, amelyek ehhez a bulihoz tartoznak.
     Ugyanez a számolás van a backend.js-ben is (deriveFromDays); a kettőnek egyeznie kell. */
  function deriveParty(code) {
    const sums = {};
    for (const c of CATS) sums[c.id] = new Map();
    let recent = [];
    let n = 0;
    for (const d of S.days.values()) {
      if (d.party !== code) continue;
      n++;
      for (const c of CATS) {
        for (const [nm, v] of Object.entries(d.cats[c.id])) sums[c.id].set(nm, Math.min(9999, (sums[c.id].get(nm) || 0) + v));
      }
      recent = recent.concat(d.recent);
    }
    if (!n) return null;
    recent.sort((a, b) => b.t - a.t);
    const out = { v: 1, name: cleanName(S.username) || "Névtelen", cats: {}, recent: recent.slice(0, 8).map(r => ({ c: r.c, d: r.d, t: r.t })), updatedAt: Date.now() };
    for (const c of CATS) {
      out.cats[c.id] = { items: [...sums[c.id]].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([name, k]) => ({ name, n: k })), custom: [], quick: null };
    }
    return out;
  }
  function canonItems(doc) {
    return CATS.map(c => doc.cats[c.id].items.filter(i => i.n > 0).map(i => i.name + "\u0000" + i.n).sort().join("\u0001")).join("\u0002");
  }
  function samePlayer(have, want) { const w = sanitize(want); return have.name === w.name && canonItems(have) === canonItems(w); }
  function canDerive() {
    return !!S.backend && S.phase === "ready" && S.daysSynced && S.migrationDone && !S.deriveError && !S.readOnly;
  }
  function scheduleDerive(code) {
    if (!code) return;
    S.derivePending.add(code);
    clearTimeout(S.deriveTimer);
    S.deriveTimer = setTimeout(flushDerive, 600);
  }
  // Csak akkor írunk, ha a napok a szerverről is megjöttek és az átállás kész, különben hiányos adatból számolnánk.
  function flushDerive() {
    clearTimeout(S.deriveTimer);
    S.deriveTimer = null;
    if (!S.derivePending.size || !canDerive()) return;
    const codes = [...S.derivePending];
    S.derivePending.clear();
    for (const code of codes) {
      const doc = deriveParty(code);
      Promise.resolve()
        .then(() => (doc ? S.backend.setPlayer(code, S.myId, doc) : S.backend.deletePlayer(code, S.myId)))
        .catch((e) => {
          if (errCode(e) === "permission-denied") { S.deriveError = true; renderAll(); }
          else toast("A buli összesítését nem sikerült frissíteni. Nézd meg a netet.");
        });
    }
  }
  // Önjavítás: ha a megnyitott buliban a saját összesítésem nem egyezik a napjaimmal, újraírjuk.
  // Ha nincs ehhez a bulihoz rendelt napom (régi buli), nem nyúlunk hozzá.
  function checkMyParty() {
    const code = S.party;
    if (!code || !S.partyLoaded || !canDerive() || S.derivePending.has(code)) return;
    const want = deriveParty(code);
    if (!want) return;
    const have = S.docs.get(S.myId);
    if (!have || !samePlayer(have, want)) scheduleDerive(code);
  }

  /* ---------- éves, összesített és napi statisztika ---------- */
  function emptyCounts() { const o = {}; for (const c of CATS) o[c.id] = 0; return o; }
  function cleanCounts(src) {
    const o = emptyCounts();
    if (src && typeof src === "object") for (const c of CATS) o[c.id] = Math.floor(Number(src[c.id])) || 0;
    return o;
  }
  function sanitizeStats(src) {
    const d = src && typeof src === "object" ? src : {};
    const years = {}, days = {};
    if (d.years && typeof d.years === "object") {
      for (const [y, v] of Object.entries(d.years)) if (/^\d{4}$/.test(y)) years[y] = cleanCounts(v);
    }
    if (d.days && typeof d.days === "object") {
      for (const [k, v] of Object.entries(d.days)) if (DAY_RE.test(k)) days[k] = cleanCounts(v);
    }
    const username = typeof d.username === "string" && USERNAME_RE.test(d.username) ? d.username : "";
    return { total: cleanCounts(d.total), years, days, username };
  }
  function alcOf(counts) { return CATS.filter(c => !c.quiet).reduce((s, c) => s + Math.max(0, counts[c.id]), 0); }
  function alcMlOf(counts) { return CATS.filter(c => !c.quiet).reduce((s, c) => s + Math.max(0, counts[c.id]) * c.ml, 0); }
  function statsOf(id) {
    const st = sanitizeStats(S.stats.get(id));
    if (id === S.myId) {
      for (const part of ["years", "days"]) {
        for (const [k, d] of Object.entries(S.statsDelta[part])) {
          const c = st[part][k] || (st[part][k] = emptyCounts());
          for (const cat of CATS) c[cat.id] += d[cat.id] || 0;
        }
      }
      for (const d of Object.values(S.statsDelta.years)) for (const cat of CATS) st.total[cat.id] += d[cat.id] || 0;
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
  function statsAdd(cid, delta, key) {
    const dk = DAY_RE.test(key || "") ? key : todayKey();
    for (const [part, k] of [["years", dk.slice(0, 4)], ["days", dk]]) {
      const c = S.statsDelta[part][k] || (S.statsDelta[part][k] = emptyCounts());
      c[cid] += delta;
    }
    clearTimeout(S.statsTimer);
    S.statsTimer = setTimeout(flushStats, 300);
  }
  function flushStats() {
    clearTimeout(S.statsTimer);
    S.statsTimer = null;
    const out = { years: {}, days: {} };
    let any = false;
    for (const part of ["years", "days"]) {
      for (const [k, c] of Object.entries(S.statsDelta[part])) {
        const o = {};
        for (const cat of CATS) if (c[cat.id]) { o[cat.id] = c[cat.id]; any = true; }
        if (Object.keys(o).length) out[part][k] = o;
      }
    }
    S.statsDelta = { years: {}, days: {} };
    if (!any || !S.backend || S.statsError || typeof S.backend.addStats !== "function") return;
    Promise.resolve().then(() => S.backend.addStats(S.myId, out)).catch((e) => {
      if (errCode(e) === "permission-denied") { S.statsError = true; renderAll(); }
      else toast("A statisztikát nem sikerült menteni. Nézd meg a netet.");
    });
  }

  /* ---------- verseny és hányás-szavazás ---------- */
  function sanitizeVotes(d) {
    const on = {};
    const src = d && d.on && typeof d.on === "object" ? d.on : {};
    for (const [k, v] of Object.entries(src)) {
      if (!v || typeof v !== "object") continue;
      const e = {};
      if (v.v === true || v.v === false) e.v = v.v;
      const n = Math.floor(Number(v.n));
      if (Number.isFinite(n) && n >= 1 && n <= 50) e.n = n;
      if ("v" in e || "n" in e) on[k] = e;
    }
    return on;
  }
  function myVote(subject) { const on = S.votes.get(S.myId); return (on && on[subject]) || null; }
  // A többiek szavaznak (aki hányt, az nem). Büntetés, ha a többiek több mint fele igennel szavaz.
  function vomitInfo(subject) {
    const eligible = [...allPeople().keys()].filter(id => id !== subject);
    let yes = 0, no = 0;
    const ns = [];
    for (const id of eligible) {
      const on = S.votes.get(id);
      const e = on && on[subject];
      if (!e) continue;
      if (e.v === true) yes++;
      else if (e.v === false) no++;
      if (e.n >= 1) ns.push(e.n);
    }
    const need = Math.floor(eligible.length / 2) + 1;
    const confirmed = eligible.length > 0 && yes >= need;
    const agreed = ns.length > 0 && ns.every(n => n === ns[0]);
    const count = confirmed ? (agreed ? ns[0] : 1) : 0;
    return { eligible: eligible.length, yes, no, need, confirmed, submitted: ns.sort((a, b) => a - b), agreed, count };
  }
  function basePoints(doc) { return CATS.reduce((s, c) => s + c.pts * catTotal(doc, c), 0); }
  function ranking() {
    const rows = [...allPeople().entries()].map(([id, doc]) => {
      const v = vomitInfo(id);
      return { id, doc, vomits: v.count, pts: basePoints(doc) - VOMIT_PTS * v.count };
    });
    rows.sort((a, b) => b.pts - a.pts
      || displayName(a.id, a.doc).localeCompare(displayName(b.id, b.doc), "hu", { sensitivity: "base" }));
    for (const r of rows) r.rank = 1 + rows.filter(o => o.pts > r.pts).length;
    return rows;
  }
  function onVoteError(e) {
    if (errCode(e) === "permission-denied") { S.votesError = true; renderAll(); }
    else toast("A szavazatot nem sikerült elmenteni. Nézd meg a netet.");
  }
  function isMember() { return !!S.party && S.docs.has(S.myId); }
  function castVote(subject, value) {
    if (!S.party || !S.backend || subject === S.myId || !isMember() || typeof S.backend.setVote !== "function") return;
    const cur = myVote(subject);
    const next = cur && cur.v === value ? null : value;
    const on = Object.assign({}, S.votes.get(S.myId) || {});
    if (next === null) delete on[subject];
    else if (next === true) on[subject] = Object.assign({}, on[subject] || {}, { v: true });
    else on[subject] = { v: false };
    S.votes.set(S.myId, on);
    renderAll();
    Promise.resolve().then(() => S.backend.setVote(S.party, subject, next)).catch(onVoteError);
  }
  function setVomitCount(subject, n) {
    if (!S.party || !S.backend || subject === S.myId || !isMember() || typeof S.backend.setVoteCount !== "function") return;
    n = Math.max(1, Math.min(50, Math.floor(n) || 1));
    const on = Object.assign({}, S.votes.get(S.myId) || {});
    on[subject] = Object.assign({}, on[subject] || {}, { n });
    S.votes.set(S.myId, on);
    renderAll();
    Promise.resolve().then(() => S.backend.setVoteCount(S.party, subject, n)).catch(onVoteError);
  }

  /* ---------- mentés ---------- */
  function canEdit() { return !!S.backend && !S.readOnly && S.phase === "ready"; }
  function onWriteError(e) {
    const code = errCode(e);
    if (code === "permission-denied") {
      if (!S.readOnly) {
        S.readOnly = true;
        renderAll();
        toast("A szerver nem engedte a mentést. Ellenőrizd a Firestore szabályokat.");
      }
    } else if (code === "resource-exhausted") {
      toast("Elfogyott a mai ingyenes adatbázis-keret.");
    } else {
      toast("Nem sikerült menteni. Nézd meg a netet, és koppints újra.");
    }
  }
  function flushAll() {
    if (S.statsTimer) flushStats();
    if (S.prefsTimer) savePrefs();
    if (S.deriveTimer) flushDerive();
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) flushAll(); });
  window.addEventListener("pagehide", flushAll);

  /* ---------- italok felírása egy napra ---------- */
  function changeDrink(key, cid, name, delta) {
    if (!canEdit() || !DAY_RE.test(key) || !CAT_BY_ID[cid] || !name) return false;
    const day = ensureDay(key);
    const cur = dayItem(day, cid, name);
    const next = Math.max(0, Math.min(9999, cur + delta));
    if (next === cur) return false;
    if (next) day.cats[cid][name] = next; else delete day.cats[cid][name];
    let recent = null;
    if (delta > 0 && key === todayKey()) {
      day.recent = [{ c: cid, d: name, t: Date.now() }, ...day.recent].slice(0, RECENT_DAY);
      recent = day.recent;
    } else if (delta < 0) {
      const i = day.recent.findIndex(r => r.c === cid && r.d === name);
      if (i >= 0) { day.recent.splice(i, 1); recent = day.recent; }
    }
    day.updatedAt = Date.now();
    const recentOut = recent ? clone(recent) : null;
    Promise.resolve().then(() => S.backend.addToDay(key, [{ cid, name, delta: next - cur }], recentOut)).catch(onWriteError);
    statsAdd(cid, next - cur, key);
    if (day.party) scheduleDerive(day.party);
    return true;
  }
  function addDrink(key, cid, name) {
    const p = prefs()[cid];
    const prevQuick = p.quick;
    if (!changeDrink(key, cid, name, +1)) return;
    if (p.quick !== name) { p.quick = name; savePrefsSoon(); }
    buzz();
    S.fresh = key + "|" + cid;
    renderAll();
    S.fresh = null;
    toast("+1 " + label(cid, name) + (key === todayKey() ? "" : " (" + dayLabel(key) + ")"), () => {
      if (changeDrink(key, cid, name, -1)) {
        if (prefs()[cid].quick !== prevQuick) { prefs()[cid].quick = prevQuick; savePrefsSoon(); }
        renderAll();
      }
    });
  }
  function removeDrink(key, cid, name) { if (changeDrink(key, cid, name, -1)) renderAll(); }
  function quickAdd(cid) { addDrink(todayKey(), cid, quickOf(cid)); }
  function addCustom(key, cid, raw) {
    const name = cleanName(raw);
    if (!name || !canEdit()) return false;
    const cat = CAT_BY_ID[cid];
    const hit = drinkList(getDay(key) || emptyDay(), cat).find(d => d.name.toLocaleLowerCase("hu") === name.toLocaleLowerCase("hu"));
    const finalName = hit ? hit.name : name;
    if (!hit) {
      const p = prefs()[cid];
      p.custom = [...p.custom, finalName].slice(-30);
      savePrefsSoon();
    }
    addDrink(key, cid, finalName);
    return true;
  }
  function removeCustom(key, cid, name) {
    const day = getDay(key);
    if (!canEdit() || (day && dayItem(day, cid, name) > 0)) return;
    const p = prefs()[cid];
    p.custom = p.custom.filter(n => n !== name);
    if (p.quick === name) p.quick = null;
    savePrefsSoon();
    renderAll();
  }

  /* ---------- bulik ---------- */
  function setParty(party) {
    if (S.unsub) { try { S.unsub(); } catch (e) {} S.unsub = null; }
    if (S.metaUnsub) { try { S.metaUnsub(); } catch (e) {} S.metaUnsub = null; }
    if (S.votesUnsub) { try { S.votesUnsub(); } catch (e) {} S.votesUnsub = null; }
    S.party = party;
    S.docs = new Map();
    S.votes = new Map();
    S.votesError = false;
    S.stale = false;
    S.partyMeta = null;
    S.partyLoaded = false;
    S.errorCode = "";
    S.chartTip = null;
    S.person = null;
    if (party) {
      subscribe();
      watchMeta();
      watchVotes();
    }
  }
  function desiredParty() { return S.partyOpen || todayParty() || null; }
  function syncParty() {
    if (S.phase !== "ready" || !S.backend) return;
    if (S.partyOpen && S.partyOpen === todayParty()) S.partyOpen = null;
    const want = desiredParty();
    if (want !== S.party) setParty(want);
  }
  function watchMeta() {
    const party = S.party;
    if (!party || typeof S.backend.watchParty !== "function") return;
    try {
      S.metaUnsub = S.backend.watchParty(party, (data) => {
        if (S.party !== party) return;
        const name = data ? cleanPartyName(data.name) : "";
        S.partyMeta = name ? { name, createdAt: num(data.createdAt) } : null;
        if (S.partyMeta) {
          partyNames.set(party, name);
          if (!loadHidden().has(party)) rememberParty(party, { name, created: S.partyMeta.createdAt });
        }
        renderAll();
      }, () => {});
    } catch (e) {}
  }
  function watchVotes() {
    const party = S.party;
    if (!party || typeof S.backend.watchVotes !== "function") return;
    try {
      S.votesUnsub = S.backend.watchVotes(party, (snap) => {
        if (S.party !== party) return;
        const m = new Map();
        for (const d of snap.docs) m.set(d.id, sanitizeVotes(d.data));
        S.votes = m;
        S.votesError = false;
        if (S.phase === "ready") renderAll();
      }, (e) => {
        if (S.party !== party) return;
        if (errCode(e) === "permission-denied") { S.votesError = true; if (S.phase === "ready") renderAll(); }
      });
    } catch (e) {}
  }
  function guessStart() {
    let t = Infinity;
    for (const d of allPeople().values()) for (const r of d.recent) if (r.t && r.t < t) t = r.t;
    if (Number.isFinite(t)) return t;
    const mine = S.party ? myPartyDays(S.party) : [];
    return mine.length ? dayNoon(mine[0]) : Date.now();
  }
  function savePartyName(raw) {
    const name = cleanPartyName(raw);
    if (!name || !S.party) return false;
    const party = S.party;
    const now = Date.now();
    const createdAt = (S.partyMeta && S.partyMeta.createdAt) || guessStart();
    S.partyMeta = { name, createdAt };
    partyNames.set(party, name);
    rememberParty(party, { name, created: createdAt });
    renderAll();
    if (typeof S.backend.setPartyMeta !== "function") return true;
    Promise.resolve().then(() => S.backend.setPartyMeta(party, { name, createdAt, updatedAt: now })).catch((e) => {
      toast(errCode(e) === "permission-denied"
        ? "A buli nevéhez frissíteni kell a Firestore szabályokat."
        : "A buli nevét nem sikerült elmenteni. Nézd meg a netet.");
    });
    return true;
  }
  function openParty(code) {
    closeSheet();
    flushAll();
    S.tab = "kocsma";
    S.partyOpen = code && code !== todayParty() ? code : null;
    S.person = null;
    S.kUser = null;
    S.kScreen = null;
    if (code) { unhideParty(code); rememberParty(code, { at: Date.now() }); }
    renderAll();
    window.scrollTo(0, 0);
  }
  function backToToday() {
    S.partyOpen = null;
    S.person = null;
    renderAll();
    window.scrollTo(0, 0);
  }
  function recordParties(codes) {
    if (!S.backend || typeof S.backend.recordParties !== "function") return;
    Promise.resolve().then(() => S.backend.recordParties(codes)).catch(() => {});
  }
  // Egy nap buliba rendelése (code = null: kivétel a buliból). Egy naphoz egy buli tartozik.
  async function assignDay(key, code, opts) {
    if (!canEdit() || !DAY_RE.test(key)) return false;
    const prev = getDay(key) ? getDay(key).party : null;
    if (prev === code) return true;
    if (code && !(opts && opts.fresh) && !myPartyDays(code).length) {
      // Ha ebben a buliban régi (napokhoz nem rendelt) számlálóm van, azt nem írhatjuk felül.
      let legacy = false;
      try {
        const p = await S.backend.getPlayer(code, S.myId);
        legacy = !!p && CATS.some(c => catTotal(sanitize(p), c) > 0);
      } catch (e) {
        toast(errCode(e) === "permission-denied" ? RULES_MSG : "Ehhez internet kell. Nézd meg a netet, és próbáld újra.");
        return false;
      }
      if (legacy) {
        toast("Ebben a régi buliban már van régi számlálód, ezért ehhez a bulihoz nem rendelhető új nap.");
        return false;
      }
      if ((getDay(key) ? getDay(key).party : null) !== prev) return false;
    }
    const day = ensureDay(key);
    day.party = code || null;
    Promise.resolve().then(() => S.backend.setDayParty(key, code || null)).catch(onWriteError);
    if (code) {
      unhideParty(code);
      rememberParty(code, { at: Math.max(Date.now(), dayNoon(key)) });
      recordParties([code]);
      fetchPartyNames([code]);
      scheduleDerive(code);
    }
    if (prev) scheduleDerive(prev);
    if (key === todayKey()) { S.partyOpen = null; S.person = null; }
    renderAll();
    return true;
  }
  async function createParty(key, rawName) {
    if (!canEdit()) return false;
    const code = newPartyCode();
    const name = cleanPartyName(rawName) || defaultPartyName(key);
    const now = Date.now();
    const createdAt = key === todayKey() ? now : dayNoon(key);
    partyNames.set(code, name);
    rememberParty(code, { name, created: createdAt, at: now });
    if (typeof S.backend.setPartyMeta === "function") {
      Promise.resolve().then(() => S.backend.setPartyMeta(code, { name, createdAt, updatedAt: now })).catch((e) => {
        toast(errCode(e) === "permission-denied" ? RULES_MSG : "A buli nevét nem sikerült elmenteni. Nézd meg a netet.");
      });
    }
    return assignDay(key, code, { fresh: true });
  }
  function leaveParty(code) {
    if (!canEdit() || !code) return;
    const keys = myPartyDays(code);
    for (const k of keys) {
      getDay(k).party = null;
      Promise.resolve().then(() => S.backend.setDayParty(k, null)).catch(onWriteError);
    }
    if (keys.length) scheduleDerive(code);
    else Promise.resolve().then(() => S.backend.deletePlayer(code, S.myId)).catch(() => toast("Nem sikerült törölni. Nézd meg a netet, és próbáld újra."));
    forgetParty(code);
    if (S.partyOpen === code) S.partyOpen = null;
    S.person = null;
    renderAll();
    toast("Kiléptél ebből a buliból. A napi naplód megmaradt.");
  }
  async function invite(code) {
    if (!code) return;
    const url = inviteUrl(code);
    if (navigator.share) {
      try { await navigator.share({ title: "Másnapló", text: "Gyere a buliba! A kód: " + code, url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); toast("Link kimásolva, küldd el a barátaidnak."); }
    catch (e) { toast("A meghívó link: " + url); }
  }

  /* ---------- átállás a régi buli-számlálókról a napi naplóra ----------
     Minden ismert buliból a saját számlálót a buli napjára írjuk (a buli kezdete, vagy a legkorábbi ismert ital alapján).
     Ismételhető: a nap dokumentuma megjegyzi, mely bulikat írtuk már át. A statisztikához nem nyúlunk (abban már benne van). */
  async function runMigration() {
    if (S.migrationDone || S.migrating || !S.backend) return;
    if (S.migrated >= MIGRATION_V || typeof S.backend.migrateParty !== "function") { S.migrationDone = true; return; }
    S.migrating = true;
    S.migrationError = false;
    try {
      const codes = new Set();
      if (S.privParties && typeof S.privParties === "object") for (const c of Object.keys(S.privParties)) if (cleanParty(c) === c) codes.add(c);
      for (const p of loadParties()) codes.add(p.code);
      const cur = cleanParty(lsGet("strigula-party"));
      if (cur) codes.add(cur);
      const found = await Promise.all([...codes].map(async (code) => {
        const raw = await S.backend.getPlayerFresh(code, S.myId);
        if (!raw) return null;
        const doc = sanitize(raw);
        const total = CATS.reduce((s, c) => s + catTotal(doc, c), 0);
        let meta = null;
        if (total) meta = await S.backend.getPartyMetaFresh(code);
        return { code, doc, total, meta };
      }));
      const add = emptyPrefs();
      const quickAt = {};
      const jobs = [];
      for (const f of found) {
        if (!f) continue;
        const { code, doc, total, meta } = f;
        for (const c of CATS) {
          for (const nm of doc.cats[c.id].custom) if (!add[c.id].custom.includes(nm)) add[c.id].custom.push(nm);
          const q = doc.cats[c.id].quick;
          if (q && (!quickAt[c.id] || doc.updatedAt > quickAt[c.id].t)) quickAt[c.id] = { t: doc.updatedAt, name: q };
        }
        if (!total) continue;
        let t = meta ? num(meta.createdAt) : 0;
        if (!t) for (const r of doc.recent) if (r.t && (!t || r.t < t)) t = r.t;
        if (!t) t = doc.updatedAt || Date.now();
        const cats = {};
        for (const c of CATS) { cats[c.id] = Object.create(null); for (const it of doc.cats[c.id].items) cats[c.id][it.name] = it.n; }
        jobs.push({ code, day: dayKey(t), cats, recent: doc.recent, total, at: doc.updatedAt });
      }
      // Ha két buli ugyanarra a napra esik, a nagyobbik kapja a napot; a másik régi buliként érintetlen marad.
      jobs.sort((a, b) => b.total - a.total || b.at - a.at || (a.code < b.code ? -1 : 1));
      const merged = [];
      for (const j of jobs) {
        const r = await S.backend.migrateParty(j.code, j.day, j.cats, j.recent);
        if (r === "merged") merged.push(j.code);
      }
      const p = prefs();
      for (const c of CATS) {
        for (const nm of add[c.id].custom) if (!p[c.id].custom.includes(nm)) p[c.id].custom.push(nm);
        p[c.id].custom = p[c.id].custom.slice(-30);
        if (!p[c.id].quick && quickAt[c.id]) p[c.id].quick = quickAt[c.id].name;
      }
      const drinks = clone(p);
      Promise.resolve().then(() => S.backend.finishMigration(MIGRATION_V, drinks)).catch(() => {});
      S.migrated = MIGRATION_V;
      S.migrationDone = true;
      lsSet("strigula-party", null);
      for (const c of merged) S.derivePending.add(c);
    } catch (e) {
      console.error(e);
      S.migrationError = errCode(e) === "permission-denied" ? "rules" : true;
    } finally {
      S.migrating = false;
    }
    if (S.migrationDone) { flushDerive(); checkMyParty(); }
    if (S.phase === "ready") renderAll();
  }
  window.addEventListener("online", () => { if (S.phase === "ready" && !S.migrationDone) runMigration(); });

  /* ---------- fiók ---------- */
  function restart(ms) { setTimeout(() => { try { location.reload(); } catch (e) {} }, ms || 60); }
  function consentRecord() { return { v: CONSENT_V, at: Date.now(), adult: true, health: true, terms: true }; }
  function consentValid(c) { return !!(c && c.v === CONSENT_V && c.terms === true); }
  // Az üzemeltető (adatkezelő) neve és elérhetősége a config.js-ből; a „missing” a ki nem töltött mezők listája.
  function privacyInfo() {
    const p = window.MASNAPLO_PRIVACY || {};
    const ok = (v) => typeof v === "string" && !!v.trim() && !/IDE_/.test(v);
    const missing = [];
    if (!ok(p.controller)) missing.push("controller");
    if (!ok(p.contact)) missing.push("contact");
    return { controller: ok(p.controller) ? p.controller.trim() : "nincs megadva", contact: ok(p.contact) ? p.contact.trim() : "nincs megadva", missing };
  }
  function privacyMissingText() {
    const m = privacyInfo().missing;
    if (!m.length) return "";
    const both = m.length === 2, name = m[0] === "controller";
    const what = both ? "az üzemeltető neve és elérhetősége" : name ? "az üzemeltető neve" : "az üzemeltető elérhetősége";
    const lack = both ? "nem nevezi meg az üzemeltetőt, és nem ad elérhetőséget" : name ? "nem nevezi meg az üzemeltetőt" : "nem ad elérhetőséget";
    return "A config.js-ben (MASNAPLO_PRIVACY) nincs kitöltve " + what + ". Enélkül a Felhasználási feltételek és az Adatkezelési tájékoztató " + lack + ". Töltsd ki, és töltsd fel újra a config.js-t.";
  }
  function authErrorText(e) {
    const c = errCode(e);
    if (["app/no-user", "auth/invalid-credential", "auth/wrong-password", "auth/user-not-found",
      "auth/invalid-login-credentials", "auth/user-disabled"].includes(c)) return "Hibás felhasználónév, e-mail-cím vagy jelszó.";
    if (c === "auth/invalid-email") return "Az e-mail-cím nem tűnik érvényesnek.";
    if (c === "auth/too-many-requests") return "Túl sok próbálkozás. Várj pár percet, és próbáld újra.";
    if (c === "auth/operation-not-allowed" || c === "auth/admin-restricted-operation") {
      return "A Firebase-ben nincs bekapcsolva az Email/Password belépés (Authentication, Sign-in method).";
    }
    if (c === "auth/network-request-failed" || c === "unavailable") return "Nem érem el a szervert. Nézd meg a netet, és próbáld újra.";
    if (c === "permission-denied") return RULES_MSG;
    if (c === "auth/weak-password") return "Túl gyenge a jelszó.";
    if (c === "auth/email-already-in-use" || c === "auth/credential-already-in-use") return "Ez az e-mail-cím már egy másik fiókhoz tartozik.";
    if (c === "app/use-email") return "Ehhez a fiókhoz e-mail-cím tartozik: azzal lépj be.";
    if (c === "app/maybe-email") return "Ha már megerősítetted az e-mail-címedet, azzal lépj be. Ha nem, hibás a jelszó.";
    if (c === "auth/requires-recent-login") return "A biztonság kedvéért jelentkezz ki és be, majd próbáld újra.";
    return "Valami nem sikerült. Próbáld újra.";
  }
  async function doSignup(rawUser, rawEmail, p1, p2, adult, terms, agree, msg, btn) {
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    const username = String(rawUser || "").trim();
    const email = String(rawEmail || "").trim();
    if (!USERNAME_RE.test(username)) { say("A felhasználónév: " + USERNAME_HINT, true); return; }
    if (email && !EMAIL_RE.test(email)) { say("Az e-mail-cím nem tűnik érvényesnek. Ha nem szeretnél megadni, hagyd üresen.", true); return; }
    if (!passwordOk(p1)) { say("A jelszó nem felel meg a feltételeknek.", true); return; }
    if (p1 !== p2) { say("A két jelszó nem egyezik.", true); return; }
    if (!adult) { say("Az appot csak 18 éven felüliek használhatják.", true); return; }
    if (!terms) { say("A regisztrációhoz el kell fogadnod a Felhasználási feltételeket.", true); return; }
    if (!agree) { say("A regisztrációhoz hozzá kell járulnod az adatkezeléshez.", true); return; }
    const key = username.toLowerCase();
    btn.disabled = true;
    say("Fiók létrehozása…");
    try {
      const taken = await S.backend.lookupUsername(key);
      if (taken) { btn.disabled = false; say("Ez a felhasználónév már foglalt. Válassz másikat.", true); return; }
      await S.backend.signUp(username, key, p1, email || null, consentRecord());
      say(email ? "Kész! Küldtünk egy megerősítő levelet az e-mail-címedre. Indul az app…" : "Kész, indul az app…");
      restart(email ? 1800 : 60);
    } catch (e) {
      console.error(e);
      if (errCode(e) === "app/claim-failed") {
        S.pickMsg = "A fiókod elkészült, de közben valaki elvitte ezt a felhasználónevet. Válassz másikat.";
        S.phase = "pickname";
        renderAll();
        return;
      }
      btn.disabled = false;
      say(authErrorText(e), true);
    }
  }
  async function doLogin(rawUser, pw, msg, btn) {
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    const id = String(rawUser || "").trim();
    const isEmail = id.includes("@");
    if ((isEmail ? !EMAIL_RE.test(id) : !USERNAME_RE.test(id)) || !pw) { say("Hibás felhasználónév, e-mail-cím vagy jelszó.", true); return; }
    btn.disabled = true;
    say("Belépés…");
    try {
      await S.backend.signIn(isEmail ? id : id.toLowerCase(), pw);
      say("Sikerült, indul az app…");
      restart();
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      say(authErrorText(e), true);
    }
  }
  async function doPickname(rawUser, msg, btn) {
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    const username = String(rawUser || "").trim();
    if (!USERNAME_RE.test(username)) { say("A felhasználónév: " + USERNAME_HINT, true); return; }
    const key = username.toLowerCase();
    btn.disabled = true;
    say("Mentés…");
    try {
      const taken = await S.backend.lookupUsername(key);
      if (taken && taken.uid !== S.myId) { btn.disabled = false; say("Ez a felhasználónév már foglalt. Válassz másikat.", true); return; }
      await S.backend.claimUsername(username, key);
      say("Kész, indul az app…");
      restart();
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      say(errCode(e) === "permission-denied" ? "Nem sikerült: lehet, hogy közben foglalt lett a név, vagy elavultak a Firestore szabályok." : authErrorText(e), true);
    }
  }
  async function doReset(rawEmail, msg, btn) {
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    const email = String(rawEmail || "").trim();
    if (!EMAIL_RE.test(email)) { say("Add meg a fiókodhoz tartozó e-mail-címet.", true); return; }
    btn.disabled = true;
    say("Küldés…");
    try {
      await S.backend.sendReset(email);
      say("Ha ehhez az e-mail-címhez tartozik fiók, küldtünk egy levelet. A benne lévő linkkel új jelszót adhatsz meg, utána az e-mail-címeddel lépj be. Nézd meg a levélszemét mappát is.");
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      if (errCode(e) === "auth/user-not-found") { say("Ha ehhez az e-mail-címhez tartozik fiók, küldtünk egy levelet. Nézd meg a levélszemét mappát is."); return; }
      say(authErrorText(e), true);
    }
  }
  function doConsent(adult, terms, agree, msg) {
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    if (!adult) { say("Az appot csak 18 éven felüliek használhatják.", true); return; }
    if (!terms) { say("A folytatáshoz el kell fogadnod a Felhasználási feltételeket. Ha nem szeretnéd, törölheted a fiókodat.", true); return; }
    if (!agree) { say("A folytatáshoz hozzá kell járulnod az adatkezeléshez. Ha nem szeretnéd, törölheted a fiókodat.", true); return; }
    Promise.resolve().then(() => S.backend.saveConsent(consentRecord())).catch((e) => {
      toast(errCode(e) === "permission-denied" ? RULES_MSG : "A hozzájárulást nem sikerült elmenteni. Nézd meg a netet.");
    });
    startData();
  }
  async function doAddEmail(rawEmail, pw, msg, btn) {
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    const email = String(rawEmail || "").trim();
    if (!EMAIL_RE.test(email)) { say("Az e-mail-cím nem tűnik érvényesnek.", true); return; }
    if (!pw) { say("Add meg a jelszavadat a megerősítéshez.", true); return; }
    if (navigator.onLine === false) { say("Ehhez internet kell.", true); return; }
    btn.disabled = true;
    say("Küldés…");
    try {
      await S.backend.addEmail(email, pw);
      lsSet("strigula-pending-email", email);
      btn.disabled = false;
      say("Elküldtük a megerősítő levelet ide: " + email + ". Kattints a benne lévő linkre; utána ezzel az e-mail-címmel lépj be. Nézd meg a levélszemét mappát is.");
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      const c = errCode(e);
      if (["auth/invalid-credential", "auth/wrong-password", "auth/invalid-login-credentials"].includes(c)) say("Hibás jelszó.", true);
      else say(authErrorText(e), true);
    }
  }
  async function doResend(btn) {
    btn.disabled = true;
    try { await S.backend.resendVerification(); toast("Elküldtük újra a megerősítő levelet."); }
    catch (e) { console.error(e); btn.disabled = false; toast(authErrorText(e)); }
  }
  async function doDelete(pw, msg, btn) {
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    if (!pw) { say("Add meg a jelszavadat a megerősítéshez.", true); return; }
    if (navigator.onLine === false) { say("A törléshez internet kell.", true); return; }
    btn.disabled = true;
    say("Törlés folyamatban…");
    clearTimeout(S.statsTimer);
    S.statsTimer = null;
    S.statsDelta = { years: {}, days: {} };
    clearTimeout(S.prefsTimer);
    S.prefsTimer = null;
    clearTimeout(S.deriveTimer);
    S.deriveTimer = null;
    S.derivePending.clear();
    const codes = new Set(loadParties().map(p => p.code));
    if (S.party) codes.add(S.party);
    for (const d of S.days.values()) if (d.party) codes.add(d.party);
    S.deleting = true;
    try {
      const kids = new Set([...Object.keys(S.privK || {}), ...S.kocsmak.keys()]);
      await S.backend.deleteAccount(pw, [...codes], [...kids]);
    } catch (e) {
      console.error(e);
      S.deleting = false;
      btn.disabled = false;
      const c = errCode(e);
      if (["auth/invalid-credential", "auth/wrong-password", "auth/invalid-login-credentials"].includes(c)) say("Hibás jelszó.", true);
      else if (c === "auth/admin-restricted-operation" || c === "auth/operation-not-allowed") say("A Firebase-ben ki van kapcsolva a fióktörlés (Authentication, Settings, User actions).", true);
      else say(authErrorText(e), true);
      return;
    }
    for (const k of ["strigula-party", "strigula-parties", "strigula-hidden-parties", "strigula-units", "strigula-install-hidden", "strigula-pending-email", "strigula-id", "strigula-name", "masnaplo-kocsma", "masnaplo-chat-read"]) lsSet(k, null);
    S.phase = "boot";
    say("A fiókodat és az adataidat töröltük. Viszlát!");
    restart(1800);
  }
  async function saveUsername(raw, input) {
    const username = String(raw || "").trim();
    if (!USERNAME_RE.test(username)) { toast("A felhasználónév: " + USERNAME_HINT); input.focus(); return; }
    if (username === S.username) { input.blur(); return; }
    const key = username.toLowerCase();
    try {
      if (key !== S.usernameKey) {
        const taken = await S.backend.lookupUsername(key);
        if (taken && taken.uid !== S.myId) { toast("Ez a felhasználónév már foglalt."); return; }
      }
      await S.backend.changeUsername(username, key, S.usernameKey);
      S.username = username;
      S.usernameKey = key;
      checkMyParty();
      renderAll();
      input.blur();
      toast("Felhasználónév elmentve.");
    } catch (e) {
      console.error(e);
      toast(errCode(e) === "permission-denied" ? "Ez a felhasználónév közben foglalt lett. Válassz másikat." : "Nem sikerült menteni. Nézd meg a netet.");
    }
  }
  async function logout() {
    flushAll();
    lsSet("masnaplo-kocsma", null);
    lsSet("masnaplo-chat-read", null);
    try { await S.backend.signOut(); } catch (e) {}
    restart();
  }


  /* ---------- élő adatok ---------- */
  function subscribe() {
    const party = S.party;
    const timer = setTimeout(() => {
      if (S.party !== party) return;
      S.stale = true;
      renderAll();
    }, 10000);
    S.unsub = S.backend.watchPlayers(party, (snap) => {
      if (S.party !== party) return;
      if (!snap.fromCache) { clearTimeout(timer); S.stale = false; }
      const m = new Map();
      for (const d of snap.docs) m.set(d.id, sanitize(d.data));
      S.docs = m;
      S.partyLoaded = true;
      checkMyParty();
      renderAll();
    }, (e) => {
      if (S.party !== party) return;
      clearTimeout(timer);
      S.errorCode = errCode(e);
      if (S.errorCode === "permission-denied") checkBanned();
      S.stale = true;
      S.partyLoaded = true;
      renderAll();
    });
  }
  function checkBanned() {
    if (!S.backend || S.deleting || typeof S.backend.isBanned !== "function") return;
    Promise.resolve().then(() => S.backend.isBanned()).then((b) => {
      if (b && S.phase !== "banned") { closeSheet(); S.phase = "banned"; renderAll(); }
    }).catch(() => {});
  }
  function subscribeStats() {
    if (typeof S.backend.watchStats !== "function") return;
    try {
      S.backend.watchStats((snap) => {
        const m = new Map();
        for (const d of snap.docs) m.set(d.id, sanitizeStats(d.data));
        S.stats = m;
        S.statsError = false;
        if (S.phase === "ready") renderAll();
      }, (e) => {
        if (errCode(e) === "permission-denied") { S.statsError = true; if (S.phase === "ready") renderAll(); }
      });
    } catch (e) {}
  }
  function subscribeDays() {
    if (typeof S.backend.watchDays !== "function") { S.daysLoaded = true; return; }
    try {
      S.backend.watchDays((snap) => {
        const m = new Map();
        for (const d of snap.docs) if (DAY_RE.test(d.id)) m.set(d.id, sanitizeDay(d.data));
        S.days = m;
        S.daysLoaded = true;
        S.daysError = false;
        const was = S.daysSynced;
        if (!snap.fromCache) S.daysSynced = true;
        learnParties();
        if (S.daysSynced) { if (!was) flushDerive(); checkMyParty(); }
        if (S.phase === "ready") { renderAll(); maybeInvite(); }
      }, (e) => {
        S.daysLoaded = true;
        if (errCode(e) === "permission-denied") { S.daysError = true; checkBanned(); }
        if (S.phase === "ready") renderAll();
      });
    } catch (e) {}
  }
  function cleanText(s, max) {
    return String(s == null ? "" : s).replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
  }
  function cleanLine(s, max) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max); }
  function sanitizeGame(src) {
    const d = src && typeof src === "object" ? src : {};
    const str = (v) => (typeof v === "string" ? v : "");
    return {
      name: cleanLine(str(d.name), GAME_MAX.name), players: cleanLine(str(d.players), GAME_MAX.players),
      tools: cleanLine(str(d.tools), GAME_MAX.tools), desc: cleanText(str(d.desc), GAME_MAX.desc),
      createdAt: num(d.createdAt), updatedAt: num(d.updatedAt),
    };
  }
  function subscribeGames() {
    if (typeof S.backend.watchGames !== "function") { S.gamesLoaded = true; return; }
    try {
      S.backend.watchGames((snap) => {
        const m = new Map();
        for (const d of snap.docs) m.set(d.id, sanitizeGame(d.data));
        S.games = m;
        S.gamesLoaded = true;
        S.gamesError = false;
        if (S.phase === "ready") renderAll();
      }, (e) => {
        S.gamesLoaded = true;
        if (errCode(e) === "permission-denied") S.gamesError = true;
        if (S.phase === "ready") renderAll();
      });
    } catch (e) {}
  }
  /* ---------- barátok és kocsmák: adatok ---------- */
  function cleanKName(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, KNAME_MAX); }
  // Meghívókód: 8 kisbetű vagy szám. Egy bemásolt meghívó linkből is kiolvassuk.
  function cleanKCode(raw) {
    let s = String(raw == null ? "" : raw).trim();
    const m = s.match(/[?&]kocsma=([^&#\s]+)/i);
    if (m) s = decodeURIComponent(m[1]);
    s = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    return KCODE_RE.test(s) ? s : null;
  }
  function kIcon(id, size) {
    const ic = KICON_BY_ID[id] || KICONS[0];
    const px = size === "xl" ? 76 : size === "lg" ? 56 : size === "md" ? 44 : 32;
    return el("img", { class: "kicon" + (size ? " " + size : ""), src: "icons/kocsma/" + ic.file, alt: "", width: px, height: px, draggable: "false" });
  }
  function sanitizeKocsma(d) {
    const src = d && typeof d === "object" ? d : {};
    const p = src.party && typeof src.party === "object" ? src.party : null;
    const party = p && typeof p.code === "string" && cleanParty(p.code) === p.code && typeof p.day === "string" && DAY_RE.test(p.day)
      ? { code: p.code, day: p.day, by: typeof p.by === "string" ? p.by : "" } : null;
    return {
      name: cleanKName(src.name) || "Névtelen kocsma",
      icon: KICON_BY_ID[src.icon] ? src.icon : "01",
      code: typeof src.code === "string" && KCODE_RE.test(src.code) ? src.code : "",
      owner: typeof src.owner === "string" ? src.owner : "",
      party, createdAt: num(src.createdAt),
    };
  }
  function sanitizeMsg(id, d) {
    if (!d || typeof d.uid !== "string" || typeof d.text !== "string") return null;
    const text = cleanText(d.text, MSG_MAX);
    return text ? { id, uid: d.uid, text, at: num(d.at) } : null;
  }
  function sanitizeInvite(v) {
    if (!v || typeof v !== "object" || typeof v.kid !== "string" || !KID_RE.test(v.kid) || typeof v.code !== "string" || !KCODE_RE.test(v.code)) return null;
    return { kid: v.kid, code: v.code, name: cleanKName(v.name) || "Kocsma", icon: KICON_BY_ID[v.icon] ? v.icon : "01", at: num(v.at) };
  }
  function userName(uid) {
    if (uid === S.myId && S.username) return S.username;
    const st = S.stats.get(uid);
    return (st && st.username) || "Ismeretlen";
  }
  function byName(a, b) { return userName(a).localeCompare(userName(b), "hu", { sensitivity: "base" }); }
  function kocsmaList() {
    return [...S.kocsmak.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, "hu", { sensitivity: "base" }) || (a[0] < b[0] ? -1 : 1));
  }
  function activeK() { return S.kocsma ? S.kocsmak.get(S.kocsma) || null : null; }
  function isKFounder() { const k = activeK(); return !!k && k.owner === S.myId; }
  // A kocsmáim még töltődnek (van a listában, de egyik sem jött meg).
  function kLoading() { return !!S.privK && Object.keys(S.privK).length > 0 && !S.kocsmak.size; }
  function kRead() {
    try { const o = JSON.parse(lsGet("masnaplo-chat-read") || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; }
  }
  function lastRead(kid) {
    const v = num(kRead()[kid]);
    return v || (S.privK && num(S.privK[kid])) || 0;
  }
  function markRead() {
    const kid = S.kocsma;
    if (!kid || !S.kMsgsLoaded || !S.kMsgs.length) return;
    const top = S.kMsgs[S.kMsgs.length - 1].at;
    const o = kRead();
    if (num(o[kid]) >= top) return;
    o[kid] = top;
    lsSet("masnaplo-chat-read", JSON.stringify(o));
  }
  function unreadCount() {
    if (!S.kocsma || !S.kMsgsLoaded) return 0;
    const lr = lastRead(S.kocsma);
    return S.kMsgs.filter(m => m.at > lr && m.uid !== S.myId).length;
  }
  function pendingInvites() {
    return [...S.friends.entries()].filter(([, f]) => f.invite && !S.kocsmak.has(f.invite.kid));
  }

  function subscribePrivate() {
    if (typeof S.backend.watchPrivate !== "function") return;
    try {
      S.backend.watchPrivate((data) => {
        const src = data && data.kocsmak && typeof data.kocsmak === "object" ? data.kocsmak : {};
        const next = {};
        for (const [kid, at] of Object.entries(src)) if (KID_RE.test(kid)) next[kid] = num(at) || 1;
        S.privK = next;
        syncKocsmak();
        if (S.phase === "ready") renderAll();
      }, (e) => { if (errCode(e) === "permission-denied") checkBanned(); });
    } catch (e) {}
  }
  // A kocsmáim figyelése: amelyik a listában van, azt figyeljük; amelyik kikerült, azt elengedjük.
  function syncKocsmak() {
    if (!S.backend || typeof S.backend.watchKocsma !== "function") return;
    const want = S.privK || {};
    for (const kid of Object.keys(want)) if (!S.kUnsubs.has(kid)) watchK(kid);
    for (const kid of [...S.kUnsubs.keys()]) if (!(kid in want)) stopK(kid);
    ensureActive();
  }
  function watchK(kid) {
    let unsub = null;
    try {
      unsub = S.backend.watchKocsma(kid, (data) => {
        if (!S.kUnsubs.has(kid)) return;
        if (!data) { lostKocsma(kid); return; }
        S.kocsmak.set(kid, sanitizeKocsma(data));
        ensureActive();
        if (S.kocsma === kid) maybeClaimKocsma();
        if (S.kocsma === kid && data.party && data.party.code) fetchPartyNames([data.party.code]);
        if (S.phase === "ready") renderAll();
      }, (e) => {
        if (!S.kUnsubs.has(kid)) return;
        if (errCode(e) === "permission-denied") lostKocsma(kid);
      });
    } catch (e) {}
    S.kUnsubs.set(kid, unsub || (() => {}));
  }
  function stopK(kid) {
    const u = S.kUnsubs.get(kid);
    S.kUnsubs.delete(kid);
    if (u) { try { u(); } catch (e) {} }
    S.kocsmak.delete(kid);
    if (S.kocsma === kid) setActiveKocsma(null);
  }
  // Kikerültem egy kocsmából (az alapító eltávolított, vagy megszűnt): eltakarítjuk a nyomait.
  function lostKocsma(kid) {
    const k = S.kocsmak.get(kid);
    const leaving = S.kLeaving.has(kid);
    stopK(kid);
    if (S.privK) delete S.privK[kid];
    if (!leaving) {
      checkBanned();
      if (typeof S.backend.cleanupKocsma === "function") Promise.resolve().then(() => S.backend.cleanupKocsma(kid)).catch(() => {});
      if (k) toast("A(z) „" + k.name + "” kocsmának már nem vagy tagja: megszűnt, vagy az alapító eltávolított.");
    }
    ensureActive();
    if (S.phase === "ready") renderAll();
  }
  function ensureActive() {
    if (S.kocsma && S.kocsmak.has(S.kocsma)) return;
    const saved = lsGet("masnaplo-kocsma");
    // Ha a legutóbb választott kocsma még töltődik, megvárjuk.
    if (saved && S.privK && saved in S.privK && S.kUnsubs.has(saved) && !S.kocsmak.has(saved)) {
      if (S.kocsma) setActiveKocsma(null);
      return;
    }
    let pick = saved && S.kocsmak.has(saved) ? saved : null;
    if (!pick) {
      const ids = [...S.kocsmak.keys()].sort((a, b) => num(S.privK && S.privK[b]) - num(S.privK && S.privK[a]) || (a < b ? -1 : 1));
      pick = ids[0] || null;
    }
    setActiveKocsma(pick);
  }
  function setActiveKocsma(kid, remember) {
    if (remember && kid) lsSet("masnaplo-kocsma", kid);
    if (S.kocsma === kid) return;
    if (S.kMembersUnsub) { try { S.kMembersUnsub(); } catch (e) {} S.kMembersUnsub = null; }
    if (S.kMsgsUnsub) { try { S.kMsgsUnsub(); } catch (e) {} S.kMsgsUnsub = null; }
    S.kocsma = kid;
    S.kMembers = new Map();
    S.kMembersLoaded = false;
    S.kMembersServer = null;
    S.kMsgs = [];
    S.kMsgsLoaded = false;
    S.kMsgsFull = false;
    S.kMsgsError = false;
    S.kMsgLimit = MSG_PAGE;
    S.kUser = null;
    if (!kid) { S.kScreen = null; return; }
    subscribeKMembers();
    subscribeKMsgs();
  }
  function subscribeKMembers() {
    const kid = S.kocsma;
    if (!kid || typeof S.backend.watchKMembers !== "function") return;
    try {
      S.kMembersUnsub = S.backend.watchKMembers(kid, (snap) => {
        if (S.kocsma !== kid) return;
        const m = new Map();
        for (const d of snap.docs) m.set(d.id, { at: num(d.data && d.data.at) });
        S.kMembers = m;
        S.kMembersLoaded = true;
        // A szerver szerint már nem vagyok tag (pl. az alapító eltávolított).
        if (!snap.fromCache && !m.has(S.myId) && !S.kLeaving.has(kid)) { lostKocsma(kid); return; }
        if (!snap.fromCache) S.kMembersServer = kid;
        maybeClaimKocsma();
        maybeRepairKCode();
        if (S.phase === "ready") renderAll();
      }, (e) => {
        if (S.kocsma !== kid) return;
        if (errCode(e) === "permission-denied") lostKocsma(kid);
      });
    } catch (e) {}
  }
  // Ha az alapító már nem tag (pl. letiltva törölte a fiókját), a legrégebbi tag telefonja átveszi a kocsmát.
  function orphanedForMe() {
    const kid = S.kocsma;
    const k = activeK();
    if (!k || !k.owner || S.kMembersServer !== kid || !S.kMembers.size || S.kMembers.has(k.owner)) return null;
    const oldest = [...S.kMembers.entries()].sort((a, b) => a[1].at - b[1].at || (a[0] < b[0] ? -1 : 1))[0][0];
    return oldest === S.myId ? kid : null;
  }
  // Egy alapítói szerep átadásakor a tagság és a kocsma pár pillanat eltéréssel érkezhet: csak akkor lépünk,
  // ha néhány másodperc múlva is alapító nélküli a kocsma.
  function maybeClaimKocsma() {
    if (S.kClaiming || S.kClaimTimer || !orphanedForMe()) return;
    S.kClaimTimer = setTimeout(() => { S.kClaimTimer = null; claimKocsma(); }, 3000);
  }
  function claimKocsma() {
    const kid = orphanedForMe();
    const k = activeK();
    if (!kid || !k || S.kClaiming || typeof S.backend.claimKocsma !== "function" || !canEdit()) return;
    S.kClaiming = true;
    Promise.resolve().then(() => S.backend.claimKocsma(kid))
      .then(() => {
        const kk = S.kocsmak.get(kid);
        if (kk) kk.owner = S.myId;
        toast("A(z) „" + k.name + "” kocsma alapítója már nem tag, ezért mostantól te kezeled.");
        renderAll();
        maybeRepairKCode();
      })
      .catch(() => {})
      .finally(() => { S.kClaiming = false; });
  }
  // Alapítóként munkamenetenként egyszer ellenőrizzük, hogy a meghívókód előnézetében csak a mostani tagok vannak.
  function maybeRepairKCode() {
    const kid = S.kocsma;
    const k = activeK();
    if (!k || k.owner !== S.myId || S.kMembersServer !== kid || S.kRepaired.has(kid) || !canEdit() || typeof S.backend.repairKCode !== "function") return;
    S.kRepaired.add(kid);
    Promise.resolve().then(() => S.backend.repairKCode(kid)).catch(() => S.kRepaired.delete(kid));
  }
  function subscribeKMsgs() {
    const kid = S.kocsma;
    const n = S.kMsgLimit;
    if (!kid || typeof S.backend.watchKMessages !== "function") return;
    if (S.kMsgsUnsub) { try { S.kMsgsUnsub(); } catch (e) {} S.kMsgsUnsub = null; }
    try {
      S.kMsgsUnsub = S.backend.watchKMessages(kid, n, (snap) => {
        if (S.kocsma !== kid || S.kMsgLimit !== n) return;
        S.kMsgs = snap.docs.map(d => sanitizeMsg(d.id, d.data)).filter(Boolean)
          .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
        S.kMsgsLoaded = true;
        S.kMsgsFull = snap.docs.length < n;
        S.kMsgsError = false;
        if (S.kScreen === "chat" && S.tab === "kocsma" && !document.hidden) markRead();
        if (S.phase === "ready") renderAll();
      }, (e) => {
        if (S.kocsma !== kid) return;
        if (errCode(e) === "permission-denied") { S.kMsgsError = true; S.kMsgsLoaded = true; if (S.phase === "ready") renderAll(); }
      });
    } catch (e) {}
  }
  function moreMsgs() {
    S.kMsgLimit += MSG_PAGE;
    subscribeKMsgs();
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && S.kScreen === "chat" && S.tab === "kocsma") { markRead(); if (S.phase === "ready") renderAll(); }
  });

  function subscribeSocial() {
    if (typeof S.backend.watchFriends !== "function") { S.friendsLoaded = true; return; }
    const onErr = (e) => { if (errCode(e) === "permission-denied") { S.socialError = true; checkBanned(); if (S.phase === "ready") renderAll(); } };
    try {
      S.backend.watchFriends((snap) => {
        const m = new Map();
        for (const d of snap.docs) m.set(d.id, { at: num(d.data && d.data.at), invite: sanitizeInvite(d.data && d.data.invite) });
        S.friends = m;
        S.friendsLoaded = true;
        if (S.phase === "ready") renderAll();
      }, onErr);
      S.backend.watchFriendReqs("to", (snap) => {
        const m = new Map();
        for (const d of snap.docs) if (d.data && typeof d.data.from === "string" && d.data.to === S.myId) m.set(d.data.from, { at: num(d.data.at) });
        S.reqIn = m;
        if (S.phase === "ready") renderAll();
      }, onErr);
      S.backend.watchFriendReqs("from", (snap) => {
        const m = new Map();
        for (const d of snap.docs) if (d.data && typeof d.data.to === "string" && d.data.from === S.myId) m.set(d.data.to, { at: num(d.data.at) });
        S.reqOut = m;
        if (S.phase === "ready") renderAll();
      }, onErr);
    } catch (e) {}
  }

  /* ---------- barátok: műveletek ---------- */
  function socialErrorText(e) {
    return errCode(e) === "permission-denied" ? RULES_MSG : "Nem sikerült. Nézd meg a netet, és próbáld újra.";
  }
  async function sendFriendRequest(uid) {
    if (!canEdit() || !uid || uid === S.myId) return false;
    if (S.friends.has(uid)) { toast("Már barátok vagytok."); return false; }
    if (S.reqIn.has(uid)) return acceptFriend(uid);
    if (S.reqOut.has(uid)) { toast("Már jelölted, válaszra vár."); return false; }
    try {
      await S.backend.sendFriendRequest(uid);
      S.reqOut.set(uid, { at: Date.now() });
      renderAll();
      toast("Barátkérés elküldve: " + userName(uid));
      return true;
    } catch (e) { console.error(e); toast(socialErrorText(e)); return false; }
  }
  async function sendFriendRequestByName(raw, say) {
    const name = String(raw || "").trim();
    if (!USERNAME_RE.test(name)) { say("A felhasználónév: " + USERNAME_HINT, true); return false; }
    const key = name.toLowerCase();
    if (key === S.usernameKey) { say("Saját magadat nem jelölheted barátnak.", true); return false; }
    say("Keresés…");
    let found = null;
    try { found = await S.backend.lookupUsername(key); }
    catch (e) { say(socialErrorText(e), true); return false; }
    if (!found || typeof found.uid !== "string") { say("Nincs ilyen felhasználó.", true); return false; }
    if (found.uid === S.myId) { say("Saját magadat nem jelölheted barátnak.", true); return false; }
    if (S.friends.has(found.uid)) { say("Már barátok vagytok.", true); return false; }
    if (S.reqOut.has(found.uid)) { say("Már jelölted, válaszra vár.", true); return false; }
    const ok = await sendFriendRequest(found.uid);
    if (!ok) say("");
    return ok;
  }
  async function acceptFriend(uid) {
    if (!canEdit()) return false;
    try {
      await S.backend.acceptFriend(uid, S.reqOut.has(uid));
      S.reqIn.delete(uid);
      S.reqOut.delete(uid);
      if (!S.friends.has(uid)) S.friends.set(uid, { at: Date.now(), invite: null });
      renderAll();
      toast("Mostantól barátok vagytok: " + userName(uid));
      return true;
    } catch (e) { console.error(e); toast(socialErrorText(e)); return false; }
  }
  async function declineFriend(uid) {
    try { await S.backend.declineFriend(uid); S.reqIn.delete(uid); renderAll(); toast("Barátkérés elutasítva."); }
    catch (e) { console.error(e); toast(socialErrorText(e)); }
  }
  async function cancelFriendRequest(uid) {
    try { await S.backend.cancelFriendRequest(uid); S.reqOut.delete(uid); renderAll(); toast("Barátkérés visszavonva."); }
    catch (e) { console.error(e); toast(socialErrorText(e)); }
  }
  async function removeFriend(uid) {
    try { await S.backend.removeFriend(uid); S.friends.delete(uid); renderAll(); toast(userName(uid) + " már nem a barátod."); }
    catch (e) { console.error(e); toast(socialErrorText(e)); }
  }
  async function sendKInvite(fid, kid) {
    const k = S.kocsmak.get(kid);
    if (!k || !k.code || !canEdit()) return false;
    try {
      await S.backend.sendKInvite(fid, { kid, code: k.code, name: k.name, icon: k.icon, at: Date.now() });
      toast("Meghívó elküldve: " + userName(fid) + " → " + k.name);
      return true;
    } catch (e) { console.error(e); toast(socialErrorText(e)); return false; }
  }
  function inviteFriend(fid) {
    const list = kocsmaList().filter(([kid]) => !(kid === S.kocsma && S.kMembers.has(fid)));
    if (!list.length) { toast("Még nincs kocsmád. Alapíts egyet a Kocsma fülön."); return; }
    if (list.length === 1) { sendKInvite(fid, list[0][0]); return; }
    openSheet({ type: "kPick", uid: fid });
  }
  function dismissInvite(fid, quiet) {
    if (S.dismissing.has(fid)) return;
    S.dismissing.add(fid);
    const f = S.friends.get(fid);
    if (f) f.invite = null;
    Promise.resolve().then(() => S.backend.dismissKInvite(fid))
      .catch((e) => { if (!quiet) toast(socialErrorText(e)); })
      .finally(() => S.dismissing.delete(fid));
    if (!quiet) renderAll();
  }

  /* ---------- kocsmák: műveletek ---------- */
  function kErrorText(e) {
    const c = errCode(e);
    if (c === "permission-denied") return "A szerver nem engedte. Lehet, hogy közben változott a kocsma (vagy a meghívókódja), vagy elavultak a Firestore szabályok.";
    if (c === "app/no-kocsma") return "Ez a kocsma már nem létezik.";
    return "Nem sikerült. Nézd meg a netet, és próbáld újra.";
  }
  function openKocsmaTab(kid) {
    if (kid) setActiveKocsma(kid, true);
    closeSheet();
    S.tab = "kocsma";
    S.partyOpen = null;
    S.person = null;
    S.kUser = null;
    S.kScreen = null;
    renderAll();
    window.scrollTo(0, 0);
  }
  async function createKocsma(rawName, icon, say, btn) {
    const name = cleanKName(rawName);
    if (!name) { say("Adj nevet a kocsmának.", true); return; }
    if (!KICON_BY_ID[icon]) { say("Válassz profilképet.", true); return; }
    if (!canEdit()) return;
    btn.disabled = true;
    say("Alapítás…");
    try {
      const r = await S.backend.createKocsma(name, icon);
      S.privK = Object.assign({}, S.privK || {}, { [r.kid]: Date.now() });
      S.kocsmak.set(r.kid, { name, icon, code: r.code, owner: S.myId, party: null, createdAt: Date.now() });
      syncKocsmak();
      openKocsmaTab(r.kid);
      toast("Megalapítottad a(z) „" + name + "” kocsmát. A Meghívás gombbal hívhatod meg a barátaidat.");
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      say(errCode(e) === "permission-denied" ? RULES_MSG : kErrorText(e), true);
    }
  }
  async function joinKocsma(kid, code, preview, from, say, btn) {
    if (!canEdit()) return;
    if (S.kocsmak.has(kid)) { if (from) dismissInvite(from, true); openKocsmaTab(kid); return; }
    btn.disabled = true;
    say("Belépés…");
    try {
      await S.backend.joinKocsma(kid, code);
      S.privK = Object.assign({}, S.privK || {}, { [kid]: Date.now() });
      S.kocsmak.set(kid, { name: preview.name, icon: preview.icon, code, owner: "", party: null, createdAt: 0 });
      syncKocsmak();
      if (from) dismissInvite(from, true);
      openKocsmaTab(kid);
      toast("Beléptél a(z) „" + preview.name + "” kocsmába.");
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      let still = null;
      try { still = await S.backend.getKCode(code); } catch (e2) {}
      if (!still || still.kid !== kid) say("Ezt a meghívókódot közben lecserélték. Kérj új meghívót a kocsma alapítójától.", true);
      else say(errCode(e) === "permission-denied" ? "A szerver nem engedte a belépést. Lehet, hogy elavultak a Firestore szabályok." : kErrorText(e), true);
    }
  }
  function afterKLeave(kid) {
    stopK(kid);
    if (S.privK) delete S.privK[kid];
    ensureActive();
    setTimeout(() => S.kLeaving.delete(kid), 15000);
  }
  async function leaveKocsma(kid) {
    const k = S.kocsmak.get(kid);
    if (!k || !canEdit()) return;
    S.kLeaving.add(kid);
    try {
      const r = await S.backend.leaveKocsma(kid);
      afterKLeave(kid);
      openKocsmaTab(null);
      toast(r === "deleted" ? "Kiléptél, és mivel te voltál az utolsó tag, a(z) „" + k.name + "” kocsma megszűnt."
        : r === "transferred" ? "Kiléptél a(z) „" + k.name + "” kocsmából. A kocsmát a legrégebbi tag kapta meg."
          : "Kiléptél a(z) „" + k.name + "” kocsmából.");
    } catch (e) {
      console.error(e);
      S.kLeaving.delete(kid);
      toast(kErrorText(e));
    }
  }
  async function deleteKocsma(kid) {
    const k = S.kocsmak.get(kid);
    if (!k || k.owner !== S.myId || !canEdit()) return;
    S.kLeaving.add(kid);
    toast("A kocsma törlése folyamatban…");
    try {
      await S.backend.deleteKocsma(kid);
      afterKLeave(kid);
      openKocsmaTab(null);
      toast("A(z) „" + k.name + "” kocsma minden adatával együtt törölve.");
    } catch (e) {
      console.error(e);
      S.kLeaving.delete(kid);
      toast(kErrorText(e));
    }
  }
  async function kickMember(kid, uid) {
    try {
      const code = await S.backend.rotateKCode(kid, uid);
      toast(userName(uid) + " kikerült a kocsmából. Az új meghívókód: " + code);
      if (S.sheet && S.sheet.type === "kSet") openSheet({ type: "kSet" });
    } catch (e) { console.error(e); toast(kErrorText(e)); }
  }
  async function newKCode(kid) {
    try {
      const code = await S.backend.rotateKCode(kid, null);
      toast("Új meghívókód: " + code + ". A régi kód és a régi linkek már nem működnek.");
      if (S.sheet && (S.sheet.type === "kSet" || S.sheet.type === "kInvite")) openSheet({ type: S.sheet.type });
    } catch (e) { console.error(e); toast(kErrorText(e)); }
  }
  async function updateKocsma(kid, patch) {
    try {
      await S.backend.updateKocsma(kid, patch);
      const k = S.kocsmak.get(kid);
      if (k) Object.assign(k, patch);
      renderAll();
      toast(patch.name ? "A kocsma neve elmentve." : "A kocsma profilképe elmentve.");
      return true;
    } catch (e) { console.error(e); toast(kErrorText(e)); return false; }
  }
  function kInviteUrl(code) {
    const u = new URL(location.href);
    u.search = "";
    u.hash = "";
    u.searchParams.set("kocsma", code);
    return u.toString();
  }
  async function shareKInvite(k) {
    if (!k || !k.code) return;
    const url = kInviteUrl(k.code);
    if (navigator.share) {
      try { await navigator.share({ title: "Másnapló", text: "Gyere a(z) „" + k.name + "” kocsmába! A meghívókód: " + k.code, url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); toast("Link kimásolva, küldd el a barátaidnak."); }
    catch (e) { toast("A meghívó link: " + url); }
  }

  /* ---------- kocsmás buli ---------- */
  function kPartyToday(k) { return k && k.party && k.party.day === todayKey() ? k.party : null; }
  function joinKParty(k) {
    const p = kPartyToday(k);
    if (!p || !canEdit()) return;
    const cur = todayParty();
    const go = async () => { if (await assignDay(todayKey(), p.code)) toast("Csatlakoztál a kocsmás buliba: " + partyName(p.code)); };
    if (cur && cur !== p.code) {
      openSheet({ type: "confirm", title: "Kocsmás buli", safe: true, label: "Átteszem",
        text: "A mai napod most a(z) „" + partyName(cur) + "” bulihoz tartozik. Átkerül a kocsmás buliba („" + partyName(p.code) + "”).", action: go });
    } else go();
  }
  function kPartyAction() {
    const kid = S.kocsma;
    const k = activeK();
    if (!k || !canEdit()) return;
    const p = kPartyToday(k);
    if (p) {
      if (todayParty() === p.code) { toast("Már a kocsmás buliban vagy: lent látod a versenyt."); return; }
      joinKParty(k);
      return;
    }
    const name = cleanPartyName(k.name + ", " + dayLabel(todayKey()));
    const cur = todayParty();
    openSheet({ type: "confirm", title: "Kocsmás buli", safe: true, label: "Indítás",
      text: "Indul a(z) „" + name + "” buli. A mai napod ebbe kerül, a kocsma tagjai pedig a Kocsma fülön egy gombbal csatlakozhatnak."
        + (cur ? " Most a(z) „" + partyName(cur) + "” buliban vagy: a mai napod átkerül." : ""),
      action: () => startKParty(kid, name) });
  }
  async function startKParty(kid, name) {
    const ok = await createParty(todayKey(), name);
    const code = todayParty();
    if (!ok || !code) return;
    try {
      await S.backend.setKocsmaParty(kid, { code, day: todayKey(), by: S.myId });
      const k = S.kocsmak.get(kid);
      if (k) k.party = { code, day: todayKey(), by: S.myId };
      renderAll();
      toast("Kocsmás buli indult. A tagok a Kocsma fülön csatlakozhatnak.");
    } catch (e) {
      console.error(e);
      toast(errCode(e) === "permission-denied" ? RULES_MSG : "A buli elindult, de a kocsmába nem sikerült beírni. Nézd meg a netet.");
    }
  }

  /* ---------- havi ranglista ---------- */
  function curMonth() { return todayKey().slice(0, 7); }
  function shiftMonth(ym, n) {
    const p = ym.split("-").map(Number);
    const d = new Date(p[0], p[1] - 1 + n, 1, 12);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }
  function monthLabel(ym) {
    const p = ym.split("-").map(Number);
    try { return new Date(p[0], p[1] - 1, 1, 12).toLocaleDateString("hu-HU", { year: "numeric", month: "long" }); }
    catch (e) { return ym; }
  }
  function monthCounts(uid, ym) {
    const st = statsOf(uid);
    const o = emptyCounts();
    for (const [k, c] of Object.entries(st.days)) {
      if (!k.startsWith(ym + "-")) continue;
      for (const cat of CATS) o[cat.id] += Math.max(0, c[cat.id]);
    }
    return o;
  }
  function countsPts(c) { return CATS.reduce((s, cat) => s + cat.pts * Math.max(0, c[cat.id]), 0); }
  function monthRows(ym) {
    const rows = [...S.kMembers.keys()].map(uid => { const c = monthCounts(uid, ym); return { uid, c, pts: countsPts(c) }; });
    rows.sort((a, b) => b.pts - a.pts || byName(a.uid, b.uid));
    for (const r of rows) r.rank = 1 + rows.filter(o => o.pts > r.pts).length;
    return rows;
  }

  // Meghívó link (?buli=kód): rákérdezünk, hogy a mai nap ehhez a bulihoz kerüljön-e.
  function maybeInvite() {
    if (!S.invite && S.kInvite && S.phase === "ready" && !S.sheet) {
      const code = S.kInvite;
      S.kInvite = null;
      S.tab = "kocsma";
      renderAll();
      openSheet({ type: "kJoin", code });
      return;
    }
    if (!S.invite || S.phase !== "ready" || !S.daysLoaded || S.sheet) return;
    const code = S.invite;
    S.invite = null;
    S.tab = "kocsma";
    if (todayParty() === code) { S.partyOpen = null; S.person = null; renderAll(); toast("Már ebben a buliban vagy."); return; }
    // Egy már ismert buli kódja a címben (pl. a korábbi változat oda írta a megnyitott bulit): csak megnyitjuk,
    // és onnan egy gombbal a mai nap is hozzárendelhető. Ismeretlen kódnál a meghívó lapot mutatjuk.
    if (loadParties().some(p => p.code === code)) { openParty(code); return; }
    openSheet({ type: "join", day: todayKey(), mode: "code", code, invite: true });
  }
  async function startData() {
    S.phase = "loading";
    renderAll();
    try {
      const u = new URL(location.href);
      const c = cleanParty(u.searchParams.get("buli"));
      if (c) S.invite = c;
      const kc = cleanKCode(u.searchParams.get("kocsma"));
      if (kc) S.kInvite = kc;
      if (u.searchParams.has("buli") || u.searchParams.has("kocsma")) {
        u.searchParams.delete("buli");
        u.searchParams.delete("kocsma");
        history.replaceState(null, "", u.toString());
      }
    } catch (e) {}
    restoreParties();
    subscribeStats();
    subscribeDays();
    subscribeGames();
    subscribePrivate();
    syncKocsmak();
    subscribeSocial();
    if (S.isOwner && typeof S.backend.watchBans === "function") {
      try { S.backend.watchBans((ids) => { S.bans = new Set(ids); }, () => {}); } catch (e) {}
    }
    const known = loadParties().map(p => p.code);
    if (known.length) recordParties(known);
    renderAll();
    await Promise.race([runMigration(), new Promise((r) => setTimeout(r, 15000))]);
    if (S.phase !== "loading") return;
    S.phase = "ready";
    renderAll();
    flushDerive();
    checkMyParty();
    maybeInvite();
  }

  /* ---------- ikonok ---------- */
  const SVG_OPEN = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  const ICON_CLOSE = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
  const ICON_DICE = SVG_OPEN + '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/></svg>';
  const ICON_CAL = SVG_OPEN + '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><line x1="3.5" y1="10" x2="20.5" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>';
  const ICON_MUG = '<svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h10v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M15 11.5h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2"/><path d="M5 9a2.5 2.5 0 0 1 2.5-3 3 3 0 0 1 5 0A2.5 2.5 0 0 1 15 9"/><line x1="8.5" y1="12" x2="8.5" y2="18"/><line x1="11.5" y1="12" x2="11.5" y2="18"/></svg>';
  const ICON_PIN = SVG_OPEN + '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>';
  const ICON_BACK = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 5 8 12 15 19"/></svg>';
  const ICON_NEXT = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19"/></svg>';
  const ICON_SEARCH = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><line x1="16" y1="16" x2="20.5" y2="20.5"/></svg>';
  const ICON_CHAT = SVG_OPEN + '<path d="M20 12.5a7.5 7.5 0 0 1-10.9 6.7L4 20.5l1.4-4.6A7.5 7.5 0 1 1 20 12.5z"/></svg>';
  const ICON_PARTY = SVG_OPEN + '<path d="M4 20l4.5-12 7.5 7.5z"/><line x1="14" y1="4" x2="14.5" y2="6"/><line x1="18.5" y1="5.5" x2="17" y2="7"/><line x1="20" y1="10" x2="18" y2="10.5"/><path d="M11.5 3.5c.8 1.5.2 3-1 3.8"/></svg>';
  const ICON_INVITE = SVG_OPEN + '<circle cx="9.5" cy="8" r="3.5"/><path d="M3 20a6.5 6.5 0 0 1 13 0"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>';
  const ICON_GEAR = SVG_OPEN + '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>';
  const ICON_SWAP = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 9 12 4 17 9"/><polyline points="7 15 12 20 17 15"/></svg>';
  function iconSpan(html, cls) { const s = el("span", { class: cls || "ico", "aria-hidden": "true" }); s.innerHTML = html; return s; }

  /* ---------- keret: alsó sáv és lebegő gombok ---------- */
  const NAV = [
    { tab: "games", text: "Ivós játékok", icon: ICON_DICE },
    { tab: "calendar", text: "Naptár", icon: ICON_CAL },
    { tab: "kocsma", text: "Kocsma", icon: ICON_MUG, center: true },
    { tab: "map", text: "Térkép", icon: ICON_PIN },
    { tab: "profile", text: "Profil", icon: null },
  ];
  function buildChrome() {
    const nav = $("#nav");
    if (nav && !nav.dataset.ready) {
      nav.dataset.ready = "1";
      const inner = el("div", { class: "nav-inner" });
      for (const n of NAV) {
        const ico = n.icon ? iconSpan(n.icon, "nav-ico") : el("span", { class: "nav-ico" }, el("span", { class: "avatar sm nav-avatar", "aria-hidden": "true" }));
        const dot = n.tab === "profile" || n.tab === "kocsma" ? el("span", { class: "nav-dot", hidden: true, "aria-hidden": "true" }) : null;
        inner.append(el("button", { type: "button", class: "nav-btn" + (n.center ? " center" : ""), "data-tab": n.tab, onclick: () => setTab(n.tab) },
          ico, el("span", { class: "nav-text", text: n.text }), dot));
      }
      nav.append(inner);
    }
    const fab = $("#fab");
    if (fab && !fab.dataset.ready) { fab.dataset.ready = "1"; fab.addEventListener("click", () => openSheet({ type: "add" })); }
    const gfab = $("#gameFab");
    if (gfab && !gfab.dataset.ready) { gfab.dataset.ready = "1"; gfab.addEventListener("click", () => openSheet({ type: "game", id: null })); }
  }
  function renderChrome() {
    buildChrome();
    const ready = S.phase === "ready";
    const inChat = ready && S.tab === "kocsma" && S.kScreen === "chat" && !!activeK();
    document.body.classList.toggle("has-nav", ready);
    document.body.classList.toggle("has-gamefab", ready && S.tab === "games");
    document.body.classList.toggle("in-chat", inChat);
    if (!inChat) document.body.classList.remove("chat-typing");
    const nav = $("#nav");
    if (nav) {
      nav.hidden = !ready;
      for (const b of nav.querySelectorAll(".nav-btn")) {
        if (b.dataset.tab === S.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
      }
      const av = nav.querySelector(".nav-avatar");
      if (av && S.myId) {
        const bg = colorFor(S.myId);
        av.textContent = monogram(S.username);
        av.style.background = bg;
        av.style.color = inkOn(bg);
      }
      // Jelzőpötty: új barátkérés (Profil), meghívó vagy olvasatlan üzenet (Kocsma).
      const dots = { profile: ready ? S.reqIn.size : 0, kocsma: ready ? pendingInvites().length + unreadCount() : 0 };
      for (const [tab, n] of Object.entries(dots)) {
        const b = nav.querySelector('.nav-btn[data-tab="' + tab + '"]');
        const d = b && b.querySelector(".nav-dot");
        if (!d) continue;
        d.hidden = !n;
        const base = tab === "profile" ? "Profil" : "Kocsma";
        b.setAttribute("aria-label", n ? base + (tab === "profile" ? ", új barátkérés" : ", újdonság") : base);
      }
    }
    const fab = $("#fab");
    if (fab) fab.hidden = !ready || S.readOnly || inChat;
    const gfab = $("#gameFab");
    if (gfab) gfab.hidden = !(ready && S.tab === "games");
  }
  function setTab(t) {
    if (!TABS.includes(t)) return;
    if (S.tab === t && t === "kocsma") { S.partyOpen = null; S.person = null; S.kUser = null; S.kScreen = null; }
    if (S.tab === t && t === "profile") S.profUser = null;
    S.tab = t;
    S.chartTip = null;
    closeSheet();
    renderAll();
    window.scrollTo(0, 0);
  }

  /* ---------- megjelenítés ---------- */
  function renderAll() {
    syncParty();
    renderChrome();
    renderMain();
    renderSheet();
  }
  function messageView(title, text) {
    return el("section", {}, el("h2", { class: "view-title cond", text: title }), el("p", { text }));
  }
  const STATIC_VIEWS = { auth: () => authView(), pickname: () => pickView(), consent: () => consentView(), banned: () => bannedView() };
  function renderMain() {
    const main = $("#main");
    if (STATIC_VIEWS[S.phase]) {
      if (main.dataset.screen !== S.phase) { main.dataset.screen = S.phase; main.replaceChildren(STATIC_VIEWS[S.phase]()); }
      return;
    }
    if (S.phase === "ready") {
      const screen = "ready:" + S.tab;
      // Az Ivós játékok fülön keresőmező van: azt nem rajzoljuk újra, csak a listát.
      if (S.tab === "games") {
        if (main.dataset.screen !== screen) { main.dataset.screen = screen; main.replaceChildren(gamesView()); }
        updateGames();
        return;
      }
      // A chatben a beviteli mező megmarad, csak az üzenetek frissülnek.
      if (S.tab === "kocsma" && S.kScreen === "chat" && activeK()) {
        const cs = screen + ":chat:" + S.kocsma;
        if (main.dataset.screen !== cs) { main.dataset.screen = cs; main.replaceChildren(chatView()); }
        updateChat();
        return;
      }
      if (S.kScreen === "chat" && !activeK()) S.kScreen = null;
      const y = window.scrollY;
      main.dataset.screen = screen;
      main.replaceChildren(tabView());
      afterRender(main);
      window.scrollTo(0, y);
      return;
    }
    main.dataset.screen = S.phase;
    switch (S.phase) {
      case "boot":
      case "loading":
        main.replaceChildren(el("p", { class: "muted", text: S.migrating ? "Átírom a korábbi bulijaidat az új napi naplóba…" : "Betöltés…" }));
        break;
      case "noconfig":
        main.replaceChildren(messageView("Hiányzik a beállítás", "Másold be a Firebase konzolból kapott firebaseConfig adatokat a config.js fájlba, majd töltsd fel újra."));
        break;
      case "authoff":
        main.replaceChildren(messageView("Kapcsold be a belépést", "A Firebase konzolban: Authentication, Sign-in method. Az Anonymous és az Email/Password is legyen bekapcsolva. Utána frissítsd az oldalt."));
        break;
      case "offline":
        main.replaceChildren(messageView("Nincs internet", "Az induláshoz internet kell. Kapcsold be a netet, és frissítsd az oldalt."));
        break;
      case "bootfail":
        main.replaceChildren(messageView("Nem indult el", "Frissítsd az oldalt. Ha így sem megy, nézd meg a netkapcsolatot."));
        break;
      case "rulesold":
        main.replaceChildren(messageView("Frissíteni kell a szabályokat", RULES_MSG));
        break;
      default:
        main.replaceChildren(S.errorCode === "permission-denied"
          ? messageView("Nincs hozzáférés", RULES_MSG)
          : messageView("Nem sikerült betölteni", "Frissítsd az oldalt. Ha így sem megy, nézd meg a netkapcsolatot."));
    }
  }
  function afterRender(root) {
    for (const sc of root.querySelectorAll(".chart-scroll")) {
      const k = sc.dataset.owner;
      const saved = S.chartScroll[k];
      sc.scrollLeft = saved == null ? sc.scrollWidth : saved;
      sc.addEventListener("scroll", () => {
        const atEnd = sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 4;
        S.chartScroll[k] = atEnd ? null : sc.scrollLeft;
      }, { passive: true });
    }
  }
  function tabView() {
    if (S.tab === "profile") return profileView();
    if (S.tab === "calendar") return calendarView();
    if (S.tab === "map") return mapView();
    return kocsmaView();
  }
  function banner(text) { return el("p", { class: "banner", text }); }
  function banners() {
    const out = [];
    if (S.readOnly) out.push(banner("A szerver most nem engedi a mentést. Ellenőrizd a Firestore szabályokat."));
    if (S.daysError || S.migrationError === "rules" || S.deriveError) out.push(banner(RULES_MSG));
    else if (S.migrationError && !S.migrationDone) out.push(banner("A korábbi bulijaid átírása a napi naplóba még nem fejeződött be. Amint lesz net, magától folytatom."));
    return out;
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
  function backBtn(text, fn) {
    return el("button", { type: "button", class: "back", onclick: fn }, iconSpan(ICON_BACK, "back-ico"), el("span", { text }));
  }
  function openPerson(id) { S.person = id; renderAll(); window.scrollTo(0, 0); }
  function closePerson() { S.person = null; renderAll(); window.scrollTo(0, 0); }

  /* ---------- Kocsma fül ---------- */
  function kocsmaView() {
    const wrap = el("div", { class: "view kocsma" });
    for (const b of banners()) wrap.append(b);
    if (S.partyOpen) {
      if (S.person) wrap.append(backBtn(partyName(S.partyOpen), closePerson), personView(S.person));
      else wrap.append(backBtn("Vissza a mai naphoz", backToToday), partyView(S.partyOpen, false));
      return wrap;
    }
    if (S.person && S.party) {
      wrap.append(backBtn(partyName(S.party), closePerson), personView(S.person));
      return wrap;
    }
    const k = activeK();
    if (S.kUser) {
      wrap.append(backBtn(k ? k.name : "Kocsma", () => { S.kUser = null; renderAll(); window.scrollTo(0, 0); }), userView(S.kUser));
      return wrap;
    }
    const ib = installBanner();
    if (ib) wrap.append(ib);
    const inv = invitesCard();
    if (inv) wrap.append(inv);
    if (k) wrap.append(kocsmaHead(k));
    wrap.append(todayBar());
    const kp = k ? kPartyBanner(k) : null;
    if (kp) wrap.append(kp);
    const tp = S.daysLoaded ? todayParty() : null;
    if (!S.daysLoaded) wrap.append(el("p", { class: "muted", text: "Betöltés…" }));
    else if (tp) wrap.append(partyView(tp, true));
    if (k) wrap.append(monthRanking());
    if (S.daysLoaded && !tp) wrap.append(noPartyCard());
    if (!k) wrap.append(kocsmaIntro());
    wrap.append(pastParties());
    const g = groupStats();
    wrap.append(statsSection("Mindenki együtt", g.year, g.total, "Mindenki napi naplójából összeadva, aki valaha használta az appot."));
    return wrap;
  }
  function weekday(key) {
    try { return keyDate(key).toLocaleDateString("hu-HU", { weekday: "long" }); } catch (e) { return ""; }
  }
  function todayBar() {
    const key = todayKey();
    const day = getDay(key) || emptyDay();
    const sec = el("section", { class: "today", "aria-label": "Ma" });
    sec.append(el("div", { class: "today-head" },
      el("h2", { class: "cond", text: "Ma" }),
      el("span", { class: "today-date", text: dayLabel(key) + ", " + weekday(key) }),
      el("button", { type: "button", class: "link-btn today-more", onclick: () => openSheet({ type: "day", day: key }) }, "A mai napom")));
    const grid = el("div", { class: "today-grid" });
    for (const cat of CATS) {
      const n = dayCount(day, cat.id);
      const q = quickOf(cat.id);
      grid.append(el("div", { class: "tile" + (cat.quiet ? " quiet" : ""), style: "--c: var(--" + cat.id + ")" },
        el("button", { type: "button", class: "tile-open", "aria-label": cat.name + ", ma " + n + " darab. Fajta választása",
          onclick: () => openSheet({ type: "daycat", day: key, cid: cat.id }) },
          el("span", { class: "tile-emoji", "aria-hidden": "true", text: cat.emoji }),
          el("span", { class: "tile-num cond" + (S.fresh === key + "|" + cat.id ? " pop" : ""), text: String(n) }),
          el("span", { class: "tile-name", text: cat.short }),
          el("span", { class: "tile-q", text: q === "Egyéb" ? "egyéb" : q })),
        el("button", { type: "button", class: "tile-plus cond", disabled: !canEdit(), "aria-label": "Még egy: " + label(cat.id, q),
          onclick: () => quickAdd(cat.id) }, "+1")));
    }
    sec.append(grid);
    sec.append(el("p", { class: "today-hint", text: "A +1 a kiírt fajtát írja fel. Másik fajtához koppints a kategóriára vagy a jobb alsó + gombra." }));
    return sec;
  }
  function noPartyCard() {
    const sec = el("section", { class: "card noparty" });
    sec.append(el("h3", { class: "feed-title cond", text: "Ma még nem vagy buliban" }),
      el("p", { class: "muted", text: "Az italaid buli nélkül is a napi naplódba kerülnek. Ha bulizol, indíts egy bulit, vagy lépj be a barátaidéba a kódjával: így látjátok egymást, és versenyeztek." }));
    const y = getDay(shiftDay(todayKey(), -1));
    if (y && y.party && canEdit()) {
      sec.append(el("button", { type: "button", class: "btn wide", onclick: () => assignDay(todayKey(), y.party) },
        "Folytatom a tegnapi bulit: " + partyName(y.party)));
    }
    sec.append(el("div", { class: "btn-row" },
      el("button", { type: "button", class: "btn", disabled: !canEdit(), onclick: () => openSheet({ type: "join", day: todayKey(), mode: "new" }) }, "Új buli"),
      el("button", { type: "button", class: "btn secondary", disabled: !canEdit(), onclick: () => openSheet({ type: "join", day: todayKey(), mode: "code" }) }, "Belépés kóddal")));
    return sec;
  }
  function daysText(days) {
    if (!days.length) return "";
    if (days.length <= 2) return days.map(dayLabel).join(", ");
    return dayLabel(days[0]) + " – " + dayLabel(days[days.length - 1]) + " (" + days.length + " nap)";
  }
  function partyView(code, isToday) {
    const sec = el("section", { class: "party" });
    const loaded = S.party === code && S.partyLoaded;
    const rows = loaded ? ranking() : [];
    const mine = myPartyDays(code);
    let eyebrow = isToday ? "Mai buli" : "Buli";
    if (!isToday && mine.length) eyebrow += ", " + daysText(mine);
    else if (!isToday && S.party === code && S.partyMeta && S.partyMeta.createdAt) eyebrow += ", indult: " + fmtDate(S.partyMeta.createdAt);
    sec.append(el("div", { class: "party-head" },
      el("p", { class: "eyebrow", text: eyebrow }),
      el("h2", { class: "view-title cond", text: partyName(code) }),
      el("p", { class: "muted" }, (loaded ? rows.length + " fő · " : "") + "A buli kódja: ", el("span", { class: "code", text: code }))));
    sec.append(el("div", { class: "top-actions" },
      el("button", { type: "button", class: "btn secondary", onclick: () => invite(code) }, "Meghívás"),
      el("button", { type: "button", class: "btn secondary", disabled: !loaded || !canEdit(), onclick: () => openSheet({ type: "partyName" }) }, "Átnevezés")));
    if (S.stale) sec.append(banner("Lehet, hogy nem friss: most nem érem el a szervert. Amit felírsz, elmentem, amint visszajön a net."));
    if (!loaded) { sec.append(el("p", { class: "muted", text: "Betöltés…" })); return sec; }

    sec.append(el("h3", { class: "feed-title cond", text: "Verseny" }));
    if (!rows.length) sec.append(el("p", { class: "muted", text: "Még senki sincs ebben a buliban." }));
    const ol = el("ol", { class: "rank-list" });
    for (const r of rows) {
      const me = r.id === S.myId;
      const nm = displayName(r.id, r.doc);
      const counts = CATS.map(c => c.emoji + " " + catTotal(r.doc, c)).join("   ") + (r.vomits ? "   🤮 " + r.vomits : "");
      ol.append(el("li", {}, el("button", { type: "button", class: "rank-row" + (r.rank === 1 ? " first-place" : ""),
        "aria-label": r.rank + ". hely: " + nm + (me ? " (te)" : "") + ", " + fmtPts(r.pts) + " pont. Részletek",
        onclick: () => openPerson(r.id) },
        el("span", { class: "rank-no cond", "aria-hidden": "true", text: r.rank + "." }),
        avatar(r.id, nm),
        el("span", { class: "p-main", "aria-hidden": "true" },
          el("span", { class: "p-name", text: nm + (me ? " (te)" : "") }),
          el("span", { class: "p-sub", text: counts })),
        el("span", { class: "rank-pts", "aria-hidden": "true" },
          el("span", { class: "cond", text: fmtPts(r.pts) }),
          el("span", { class: "rank-unit", text: "pont" })))));
    }
    sec.append(ol);
    sec.append(el("p", { class: "rules-note", text: "Pontozás: rövid +5, bor +3, sör +2, víz vagy üdítő +0,25. Hányás −20, ha a többiek több mint fele megszavazza. Szavazni egy emberre koppintva lehet." }));

    const pc = emptyCounts();
    for (const r of rows) for (const c of CATS) pc[c.id] += catTotal(r.doc, c);
    sec.append(el("section", { class: "stats first" },
      el("h3", { class: "feed-title cond", text: "Ezen a bulin együtt" }),
      el("div", { class: "stat-grid one" }, statCard(partyName(code), pc))));

    const feed = [];
    for (const r of rows) for (const x of r.doc.recent) feed.push({ who: displayName(r.id, r.doc), me: r.id === S.myId, ...x });
    feed.sort((a, b) => b.t - a.t);
    if (feed.length) {
      sec.append(el("h3", { class: "feed-title cond", text: "Legutóbb" }));
      const list = el("ol", { class: "feed" });
      for (const f of feed.slice(0, 12)) {
        list.append(el("li", {},
          el("span", { class: "f-who", text: f.me ? "Te" : f.who }),
          el("span", { text: CAT_BY_ID[f.c].emoji + " " + label(f.c, f.d) }),
          el("span", { class: "f-when", text: ago(f.t) })));
      }
      sec.append(list);
    }
    const actions = el("div", { class: "party-foot" });
    if (!isToday && canEdit() && todayParty() !== code) {
      actions.append(el("button", { type: "button", class: "btn secondary wide", onclick: () => assignDay(todayKey(), code) }, "A mai napom is ehhez a bulihoz tartozik"));
    }
    if (isMember() && canEdit()) {
      actions.append(el("button", { type: "button", class: "link-btn",
        onclick: () => confirmSheet("Kilépsz ebből a buliból: a napjaid kikerülnek belőle, és a buli-összesítésed törlődik. A napi naplód és a statisztikád megmarad.", "Kilépek", () => leaveParty(code)) },
        "Kilépek ebből a buliból"));
    }
    if (actions.childNodes.length) sec.append(actions);
    return sec;
  }
  function pastParties() {
    const tp = todayParty();
    const list = loadParties().filter(p => p.code !== tp);
    const sec = el("section", { class: "past" });
    sec.append(el("h3", { class: "feed-title cond", text: "Korábbi bulijaim" }));
    if (!list.length) { sec.append(el("p", { class: "muted", text: "Még nincs korábbi bulid." })); return sec; }
    const ul = el("ul", { class: "party-list" });
    for (const p of list.slice(0, S.pastShow || 8)) {
      const days = myPartyDays(p.code);
      const when = days.length ? daysText(days) : (p.created ? "Indult: " + fmtDate(p.created) : (p.at ? "Megnyitva: " + fmtDate(p.at) : ""));
      const title = partyName(p.code);
      ul.append(el("li", { class: "party-item" },
        el("button", { type: "button", class: "party-open", onclick: () => openParty(p.code) },
          el("span", { class: "pi-name", text: title }),
          el("span", { class: "pi-sub", text: when })),
        el("button", { type: "button", class: "del", "aria-label": title + " levétele a listáról",
          onclick: () => { forgetParty(p.code); renderAll(); } }, "×")));
    }
    sec.append(ul);
    if (list.length > (S.pastShow || 8)) {
      sec.append(el("button", { type: "button", class: "link-btn", onclick: () => { S.pastShow = (S.pastShow || 8) + 20; renderAll(); } }, "További bulik"));
    }
    sec.append(el("p", { class: "muted small", text: "Az × csak erről a listáról veszi le, ezen a telefonon." }));
    return sec;
  }
  function personView(id) {
    const sec = el("section", { class: "person" });
    if (!S.partyLoaded) { sec.append(el("p", { class: "muted", text: "Betöltés…" })); return sec; }
    const doc = S.docs.get(id);
    if (!doc) { sec.append(el("p", { class: "muted", text: "Ez a résztvevő már nincs ebben a buliban." })); return sec; }
    const mine = id === S.myId;
    const rows = ranking();
    const me = rows.find(r => r.id === id);
    const alc = alcoholTotal(doc);
    const wat = catTotal(doc, CAT_BY_ID.water);
    sec.append(el("div", { class: "p-head" },
      avatar(id, displayName(id, doc), "lg"),
      el("div", { class: "p-head-text" },
        el("h2", { class: "cond", text: displayName(id, doc) }),
        el("p", { text: "Ezen a bulin: " + alc + " alkoholos ital (" + fmtVol(alcoholMl(doc)) + "), " + wat + " víz vagy üdítő ("
          + fmtVol(catMl(doc, CAT_BY_ID.water)) + ")." + (doc.recent[0] ? " Utoljára " + ago(doc.recent[0].t) + "." : "") }),
        me ? el("p", { class: "p-score" },
          el("span", { class: "score-num cond", text: fmtPts(me.pts) }),
          " pont, " + me.rank + ". hely " + rows.length + " főből") : null)));
    for (const cat of CATS) sec.append(catRow(id, doc, cat));
    if (mine) {
      const days = myPartyDays(S.party);
      if (days.length) {
        sec.append(el("button", { type: "button", class: "btn secondary wide", disabled: !canEdit(),
          onclick: () => (days.length === 1 ? openSheet({ type: "day", day: days[0] }) : openSheet({ type: "daysPick", code: S.party })) },
          days.length === 1 ? "A napom szerkesztése (" + dayLabel(days[0]) + ")" : "A napjaim szerkesztése"));
        sec.append(el("p", { class: "help", text: "Itt a bulihoz rendelt napjaid összege látszik. Felírni a Kocsma fül „Ma” sávjával vagy a jobb alsó + gombbal tudsz." }));
      } else {
        sec.append(el("p", { class: "help", text: "Ez egy régi buli: a számlálóid itt még nem egy naphoz tartoznak, ezért nem szerkeszthetők." }));
      }
    }
    sec.append(vomitCard(id, doc, mine));
    const st = statsOf(id);
    sec.append(statsSection(mine ? "Az én statisztikám" : "Statisztikája", st.years[thisYear()] || emptyCounts(), st.total,
      mine ? "Minden napodból összeadva, bulival vagy anélkül." : "Minden napjából összeadva."));
    sec.append(el("section", { class: "stats" },
      el("h3", { class: "feed-title cond", text: "Fogyasztás naponta" }),
      S.statsError && !mine ? banner(RULES_MSG) : chartView(id, mine ? { days: myDayCounts() } : st),
      el("p", { class: "stat-note", text: "Egy oszlop egy nap: hajnali 6-tól másnap hajnali 6-ig. Koppints egy színre a részletekért." })));
    return sec;
  }
  function catRow(pid, doc, cat) {
    const total = catTotal(doc, cat);
    const top = [...doc.cats[cat.id].items].sort((a, b) => b.n - a.n).slice(0, 3);
    const hint = top.map(i => i.name + " " + i.n).join(", ");
    const row = el("div", { class: "cat" + (cat.quiet ? " quiet" : ""), style: "--c: var(--" + cat.id + ")" });
    row.append(el("button", { type: "button", class: "cat-open", "aria-label": cat.name + ": " + total + " darab, " + fmtVol(total * cat.ml) + ". Részletek",
      onclick: () => openSheet({ type: "pcat", pid, cid: cat.id }) },
      el("span", { class: "cat-title" }, el("span", { class: "emoji", "aria-hidden": "true", text: cat.emoji }), el("span", { text: cat.name })),
      el("span", { class: "cat-num cond", text: String(total) }),
      tally(total, false),
      hint ? el("span", { class: "cat-hint", text: hint }) : null,
      el("span", { class: "cat-vol", text: fmtVol(total * cat.ml) })));
    return row;
  }
  function vomitCard(id, doc, mine) {
    const v = vomitInfo(id);
    const sec = el("section", { class: "vomit" });
    sec.append(el("h3", { class: "feed-title cond", text: mine ? "Hányás-szavazás rólad" : "Hányt " + displayName(id, doc) + "?" }));
    if (S.votesError) { sec.append(banner(RULES_MSG)); return sec; }
    if (!v.eligible) {
      sec.append(el("p", { class: "vote-tally", text: "Amint mások is belépnek a buliba, ők szavazhatnak." }));
      return sec;
    }
    const canVote = !mine && isMember();
    if (canVote) {
      const my = myVote(id);
      sec.append(el("div", { class: "vote-row", role: "group", "aria-label": "A szavazatod" },
        el("button", { type: "button", class: "vote-btn yes", "aria-pressed": my && my.v === true ? "true" : "false", onclick: () => castVote(id, true) }, "Igen, hányt"),
        el("button", { type: "button", class: "vote-btn no", "aria-pressed": my && my.v === false ? "true" : "false", onclick: () => castVote(id, false) }, "Nem")));
    } else if (!mine) {
      sec.append(el("p", { class: "vote-tally", text: "Szavazni a buli résztvevői tudnak." }));
    }
    sec.append(el("p", { class: "vote-tally", text: v.yes + " igen, " + v.no + " nem. Szavazók: " + v.eligible + ", a büntetéshez legalább " + v.need + " igen kell." }));
    if (v.confirmed) {
      sec.append(el("p", { class: "vote-result bad", text: (mine ? "A többiek szerint hánytál: " : "Megszavazva, hányt: ")
        + v.count + " hányás, " + fmtPts(-VOMIT_PTS * v.count) + " pont." }));
      if (canVote) {
        const my = myVote(id);
        const n = my && my.n ? my.n : 1;
        sec.append(el("div", { class: "stepper-row" },
          el("span", { class: "lbl-inline", text: "Szerinted hányszor?" }),
          el("div", { class: "stepper" },
            el("button", { type: "button", class: "mini", "aria-label": "Eggyel kevesebb", disabled: !!(my && my.n === 1), onclick: () => setVomitCount(id, n - 1) }, "−"),
            el("span", { class: "d-n cond", "aria-live": "polite", text: String(n) }),
            el("button", { type: "button", class: "mini mini-plus", "aria-label": "Eggyel több", onclick: () => setVomitCount(id, n + 1) }, "+"))));
      }
      const s = v.submitted;
      let detail;
      if (!s.length) detail = "Még senki nem adott meg számot, ezért 1 hányás számít.";
      else if (v.agreed) detail = "Beküldött számok: " + s.join(", ") + ". Egyeznek.";
      else detail = "Beküldött számok: " + s.join(", ") + ". Nem egyeznek, ezért 1 hányás számít.";
      sec.append(el("p", { class: "vote-tally", text: detail }));
    } else if (v.yes) {
      sec.append(el("p", { class: "vote-result", text: "Még nincs meg a többség, nincs büntetés." }));
    }
    return sec;
  }
  function statCard(title, counts) {
    return el("div", { class: "stat" },
      el("span", { class: "stat-title", text: title }),
      el("span", { class: "stat-num cond", text: String(alcOf(counts)) }),
      el("span", { class: "stat-sub", text: "alkoholos ital, " + fmtVol(alcMlOf(counts)) }),
      el("span", { class: "stat-cats", "aria-label": CATS.map(c => c.name + " " + Math.max(0, counts[c.id])).join(", ") },
        ...CATS.map(c => el("span", { class: "pc", style: "--c: var(--" + c.id + ")", "aria-hidden": "true" },
          el("span", { class: "e", text: c.emoji }),
          el("span", { class: "n cond", text: String(Math.max(0, counts[c.id])) })))));
  }
  function statsSection(heading, yearCounts, totalCounts, note) {
    const sec = el("section", { class: "stats" }, el("h3", { class: "feed-title cond", text: heading }));
    if (S.statsError) { sec.append(banner(RULES_MSG)); return sec; }
    sec.append(el("div", { class: "stat-grid" }, statCard("Idén (" + thisYear() + ")", yearCounts), statCard("Összesen", totalCounts)));
    if (note) sec.append(el("p", { class: "stat-note", text: note }));
    return sec;
  }
  function myDayCounts() { const o = {}; for (const [k, d] of S.days) o[k] = dayCounts(d); return o; }

  /* ---------- Kocsma fül: a kocsma ---------- */
  function kocsmaHead(k) {
    const n = S.kMembersLoaded ? S.kMembers.size : null;
    const unread = unreadCount();
    const multi = S.kocsmak.size > 1;
    const sec = el("section", { class: "khead" });
    sec.append(el("button", { type: "button", class: "khead-main", "aria-label": "Kocsma: " + k.name + (n == null ? "" : ", " + n + " tag") + ". Kocsmák váltása, új kocsma",
      onclick: () => openSheet({ type: "kList" }) },
      kIcon(k.icon, "lg"),
      el("span", { class: "kh-text", "aria-hidden": "true" },
        el("span", { class: "eyebrow", text: "Kocsma" }),
        el("span", { class: "kh-name cond", text: k.name }),
        el("span", { class: "kh-sub", text: (n == null ? "Betöltés…" : n + " tag") + (multi ? " · " + S.kocsmak.size + " kocsmád van" : "") })),
      iconSpan(ICON_SWAP, "kh-chev")));
    const btn = (text, ico, fn, aria, badge) => el("button", { type: "button", class: "kbtn", "aria-label": aria || text, onclick: fn },
      iconSpan(ico, "kb-ico"), el("span", { class: "kb-text", text }),
      badge ? el("span", { class: "kb-badge", "aria-hidden": "true", text: badge > 9 ? "9+" : String(badge) }) : null);
    sec.append(el("div", { class: "kbtns" },
      btn("Chat", ICON_CHAT, openChat, unread ? "Chat, " + unread + " új üzenet" : "Chat", unread),
      btn("Buli", ICON_PARTY, kPartyAction, "Kocsmás buli"),
      btn("Meghívás", ICON_INVITE, () => openSheet({ type: "kInvite" })),
      btn("Kezelés", ICON_GEAR, () => openSheet({ type: "kSet" }), "A kocsma kezelése és a tagok")));
    return sec;
  }
  function kPartyBanner(k) {
    const p = kPartyToday(k);
    if (!p || todayParty() === p.code) return null;
    fetchPartyNames([p.code]);
    return el("section", { class: "card kparty" },
      el("p", { class: "eyebrow", text: "Ma kocsmás buli van" }),
      el("h3", { class: "feed-title cond", text: partyName(p.code) }),
      el("p", { class: "muted", text: (p.by ? "Indította: " + userName(p.by) + ". " : "") + "Ha csatlakozol, a mai napod ehhez a bulihoz kerül." }),
      el("button", { type: "button", class: "btn wide", disabled: !canEdit(), onclick: () => joinKParty(k) }, "Csatlakozom"));
  }
  function monthRanking() {
    const ym = S.kMonth || curMonth();
    const cur = curMonth();
    const sec = el("section", { class: "kmonth" });
    sec.append(el("h3", { class: "feed-title cond", text: "Havi ranglista" }),
      el("div", { class: "month-nav" },
        el("button", { type: "button", class: "icon-btn sm", "aria-label": "Előző hónap", onclick: () => { S.kMonth = shiftMonth(ym, -1); renderAll(); } }, iconSpan(ICON_BACK)),
        el("span", { class: "month-lbl", "aria-live": "polite", text: monthLabel(ym) }),
        el("button", { type: "button", class: "icon-btn sm", "aria-label": "Következő hónap", disabled: ym >= cur,
          onclick: () => { const n = shiftMonth(ym, 1); S.kMonth = n >= cur ? null : n; renderAll(); } }, iconSpan(ICON_NEXT))));
    if (S.statsError) { sec.append(banner(RULES_MSG)); return sec; }
    if (!S.kMembersLoaded) { sec.append(el("p", { class: "muted", text: "Betöltés…" })); return sec; }
    const rows = monthRows(ym);
    const ol = el("ol", { class: "rank-list" });
    for (const r of rows) {
      const me = r.uid === S.myId;
      const nm = userName(r.uid);
      const counts = CATS.map(c => c.emoji + " " + r.c[c.id]).join("   ");
      ol.append(el("li", {}, el("button", { type: "button", class: "rank-row" + (r.rank === 1 && r.pts > 0 ? " first-place" : ""),
        "aria-label": r.rank + ". hely: " + nm + (me ? " (te)" : "") + ", " + fmtPts(r.pts) + " pont. Profil",
        onclick: () => { S.kUser = r.uid; renderAll(); window.scrollTo(0, 0); } },
        el("span", { class: "rank-no cond", "aria-hidden": "true", text: r.rank + "." }),
        avatar(r.uid, nm),
        el("span", { class: "p-main", "aria-hidden": "true" },
          el("span", { class: "p-name", text: nm + (me ? " (te)" : "") }),
          el("span", { class: "p-sub", text: counts })),
        el("span", { class: "rank-pts", "aria-hidden": "true" },
          el("span", { class: "cond", text: fmtPts(r.pts) }),
          el("span", { class: "rank-unit", text: "pont" })))));
    }
    sec.append(ol);
    sec.append(el("p", { class: "rules-note", text: "Pontozás: rövid +5, bor +3, sör +2, víz vagy üdítő +0,25, a hónap minden napjából (bulival vagy anélkül). A hányás itt nem számít bele." }));
    return sec;
  }
  function kocsmaIntro() {
    if (kLoading()) return el("p", { class: "muted kintro-wait", text: "A kocsmáid betöltése…" });
    return el("section", { class: "card kintro" },
      el("h3", { class: "feed-title cond", text: "Kocsma" }),
      el("p", { class: "muted", text: "Állandó baráti társaság: közös chat, havi ranglista, és egy gombbal indítható kocsmás buli. Egyszerre több kocsmának is tagja lehetsz." }),
      el("div", { class: "btn-row" },
        el("button", { type: "button", class: "btn", disabled: !canEdit(), onclick: () => openSheet({ type: "kNew" }) }, "Kocsma alapítása"),
        el("button", { type: "button", class: "btn secondary", disabled: !canEdit(), onclick: () => openSheet({ type: "kJoin" }) }, "Belépés kocsmába")));
  }
  function invitesCard() {
    // Ha már tagja vagyok, a meghívó magától eltűnik.
    for (const [fid, f] of S.friends) if (f.invite && S.kocsmak.has(f.invite.kid)) dismissInvite(fid, true);
    const list = pendingInvites();
    if (!list.length) return null;
    const sec = el("section", { class: "card invites" }, el("h3", { class: "feed-title cond", text: list.length > 1 ? "Meghívók" : "Meghívó" }));
    for (const [fid, f] of list) {
      const inv = f.invite;
      sec.append(el("div", { class: "invite-row" },
        kIcon(inv.icon, "md"),
        el("span", { class: "ir-text" },
          el("span", { class: "ir-name", text: inv.name }),
          el("span", { class: "ir-sub", text: userName(fid) + " meghívott a kocsmájába." })),
        el("button", { type: "button", class: "btn small", onclick: () => openSheet({ type: "kJoin", code: inv.code, from: fid }) }, "Megnézem"),
        el("button", { type: "button", class: "del", "aria-label": inv.name + ": meghívó elutasítása", onclick: () => dismissInvite(fid) }, "×")));
    }
    return sec;
  }

  /* ---------- egy felhasználó profilja (barátok, kocsma) ---------- */
  function relationText(uid) {
    const parts = [];
    if (S.friends.has(uid)) parts.push("A barátod.");
    else if (S.reqIn.has(uid)) parts.push("Barátnak jelölt téged.");
    else if (S.reqOut.has(uid)) parts.push("Barátnak jelölted, válaszra vár.");
    const k = activeK();
    if (k && S.kMembers.has(uid)) parts.push("A(z) „" + k.name + "” kocsma " + (k.owner === uid ? "alapítója." : "tagja."));
    return parts.join(" ");
  }
  function friendBox(uid) {
    const box = el("div", { class: "friend-box" });
    const nm = userName(uid);
    if (S.socialError) { box.append(banner(RULES_MSG)); return box; }
    if (S.friends.has(uid)) {
      const list = kocsmaList().filter(([kid]) => !(kid === S.kocsma && S.kMembers.has(uid)));
      if (list.length) {
        box.append(el("button", { type: "button", class: "btn wide", disabled: !canEdit(), onclick: () => inviteFriend(uid) },
          list.length === 1 ? "Meghívás ide: " + list[0][1].name : "Meghívás a kocsmámba"));
      }
      box.append(el("button", { type: "button", class: "link-btn",
        onclick: () => confirmSheet(nm + " kikerül a barátaid közül, és te is az övéi közül.", "Törlöm", () => removeFriend(uid)) }, "Barát törlése"));
    } else if (S.reqIn.has(uid)) {
      box.append(el("div", { class: "btn-row" },
        el("button", { type: "button", class: "btn", disabled: !canEdit(), onclick: () => acceptFriend(uid) }, "Elfogadom"),
        el("button", { type: "button", class: "btn secondary", onclick: () => declineFriend(uid) }, "Elutasítom")));
    } else if (S.reqOut.has(uid)) {
      box.append(el("button", { type: "button", class: "btn secondary wide", onclick: () => cancelFriendRequest(uid) }, "Barátkérés visszavonása"));
    } else {
      box.append(el("button", { type: "button", class: "btn wide", disabled: !canEdit(), onclick: () => sendFriendRequest(uid) }, "Barátnak jelölöm"));
    }
    return box;
  }
  function userView(uid) {
    const sec = el("section", { class: "person user" });
    const mine = uid === S.myId;
    const name = userName(uid);
    const st = statsOf(uid);
    const rel = mine ? "" : relationText(uid);
    sec.append(el("div", { class: "p-head" },
      avatar(uid, name, "lg"),
      el("div", { class: "p-head-text" },
        el("h2", { class: "cond", text: name + (mine ? " (te)" : "") }),
        rel ? el("p", { text: rel }) : null)));
    if (!mine) sec.append(friendBox(uid));
    const k = activeK();
    if (k && S.kMembers.has(uid)) {
      const c = monthCounts(uid, curMonth());
      sec.append(el("p", { class: "user-month" }, el("span", { class: "score-num cond", text: fmtPts(countsPts(c)) }),
        " pont ebben a hónapban (" + monthLabel(curMonth()) + ")"));
    }
    sec.append(statsSection(mine ? "Az én statisztikám" : "Statisztikája", st.years[thisYear()] || emptyCounts(), st.total,
      mine ? "Minden napodból összeadva, bulival vagy anélkül." : "Minden napjából összeadva, bulival vagy anélkül."));
    sec.append(el("section", { class: "stats" },
      el("h3", { class: "feed-title cond", text: "Fogyasztás naponta" }),
      S.statsError && !mine ? banner(RULES_MSG) : chartView("u:" + uid, mine ? { days: myDayCounts() } : st),
      el("p", { class: "stat-note", text: "Egy oszlop egy nap: hajnali 6-tól másnap hajnali 6-ig. Koppints egy színre a részletekért." })));
    return sec;
  }

  /* ---------- Profil fül: barátok ---------- */
  function personRow(uid, sub, onOpen, ...actions) {
    const nm = userName(uid);
    return el("li", { class: "f-item" },
      el("button", { type: "button", class: "f-open", onclick: onOpen, "aria-label": nm + (sub ? ", " + sub : "") + ". Profil" },
        avatar(uid, nm),
        el("span", { class: "p-main", "aria-hidden": "true" },
          el("span", { class: "p-name", text: nm }),
          sub ? el("span", { class: "p-sub", text: sub }) : null)),
      ...actions);
  }
  function openProfUser(uid) { S.profUser = uid; renderAll(); window.scrollTo(0, 0); }
  function friendsSection() {
    const sec = el("section", { class: "friends" });
    sec.append(el("div", { class: "sec-head" },
      el("h3", { class: "feed-title cond", text: "Barátaim" }),
      el("button", { type: "button", class: "btn secondary small", disabled: !canEdit() || S.socialError, onclick: () => openSheet({ type: "fAdd" }) }, "Barát hozzáadása")));
    if (S.socialError) { sec.append(banner(RULES_MSG)); return sec; }
    const incoming = [...S.reqIn.keys()].sort((a, b) => S.reqIn.get(b).at - S.reqIn.get(a).at);
    if (incoming.length) {
      sec.append(el("h4", { class: "f-sub", text: "Barátkérések" }));
      sec.append(el("ul", { class: "f-list" }, ...incoming.map(uid => personRow(uid, "barátnak jelölt", () => openProfUser(uid),
        el("button", { type: "button", class: "btn small", disabled: !canEdit(), onclick: () => acceptFriend(uid) }, "Elfogadom"),
        el("button", { type: "button", class: "del", "aria-label": userName(uid) + ": barátkérés elutasítása", onclick: () => declineFriend(uid) }, "×")))));
    }
    const fr = [...S.friends.keys()].sort(byName);
    if (!S.friendsLoaded) sec.append(el("p", { class: "muted", text: "Betöltés…" }));
    else if (!fr.length) sec.append(el("p", { class: "muted", text: "Még nincs barátod. A „Barát hozzáadása” gombbal jelölhetsz valakit a felhasználóneve alapján; ha elfogadja, meghívhatod a kocsmádba." }));
    else sec.append(el("ul", { class: "f-list" }, ...fr.map(uid => personRow(uid, "", () => openProfUser(uid), iconSpan(ICON_NEXT, "dr-chev")))));
    const outgoing = [...S.reqOut.keys()].sort(byName);
    if (outgoing.length) {
      sec.append(el("h4", { class: "f-sub", text: "Elküldött jelölések" }));
      sec.append(el("ul", { class: "f-list" }, ...outgoing.map(uid => personRow(uid, "válaszra vár", () => openProfUser(uid),
        el("button", { type: "button", class: "btn secondary small", onclick: () => cancelFriendRequest(uid) }, "Visszavonás")))));
    }
    return sec;
  }

  /* ---------- kocsma chat ---------- */
  function openChat() {
    if (!S.kocsma) return;
    S.kScreen = "chat";
    S.kUser = null;
    S.chatScrollDown = true;
    markRead();
    renderAll();
  }
  function closeChat() { S.kScreen = null; renderAll(); window.scrollTo(0, 0); }
  function autoGrow(t) { t.style.height = "auto"; t.style.height = Math.min(140, t.scrollHeight + 2) + "px"; }
  function chatView() {
    const k = activeK();
    const sec = el("section", { class: "view chat" });
    sec.append(el("div", { class: "chat-top" },
      backBtn(k ? k.name : "Kocsma", closeChat),
      el("p", { class: "muted small chat-note", text: "Csak a kocsma tagjai látják. A saját üzenetedet rákoppintva törölheted." })));
    sec.append(el("div", { id: "chatList", class: "chat-list" }));
    const input = el("textarea", { id: "chatInput", class: "field chat-input", rows: 1, maxlength: MSG_MAX, placeholder: "Üzenet a kocsmának…",
      "aria-label": "Üzenet a kocsmának", enterkeyhint: "send", autocomplete: "off" });
    const send = el("button", { type: "button", class: "btn chat-send" }, "Küldés");
    const go = () => sendMsg(input);
    send.addEventListener("click", go);
    // A Küldés gomb ne vegye el a fókuszt (különben a billentyűzet bezárul, és a gomb elmozdulna a koppintás alatt).
    send.addEventListener("pointerdown", (e) => { if (document.activeElement === input) e.preventDefault(); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); go(); } });
    input.addEventListener("input", () => autoGrow(input));
    // Gépelés közben az alsó sáv eltűnik, és a mező a billentyűzet fölé kerül.
    input.addEventListener("focus", () => { document.body.classList.add("chat-typing"); updateKb(); });
    input.addEventListener("blur", () => { document.body.classList.remove("chat-typing"); updateKb(); });
    sec.append(el("div", { class: "composer" }, input, send));
    return sec;
  }
  // A képernyő-billentyűzet magassága (iOS: a látható terület kisebb, mint az ablak); a beviteli sáv ennyivel feljebb kerül.
  function updateKb() {
    const vv = window.visualViewport;
    const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    document.body.style.setProperty("--kb", kb + "px");
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateKb);
    window.visualViewport.addEventListener("scroll", updateKb);
  }
  function chatDayLabel(t) {
    const d = new Date(t);
    const now = new Date();
    const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (same(d, now)) return "Ma";
    if (same(d, y)) return "Tegnap";
    try { return d.toLocaleDateString("hu-HU", { month: "long", day: "numeric", weekday: "long" }); } catch (e) { return ""; }
  }
  function msgRow(m, grouped) {
    const mine = m.uid === S.myId;
    const name = userName(m.uid);
    const canDel = canEdit() && (mine || isKFounder() || ownerUnlocked());
    let time = "";
    try { time = new Date(m.at).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" }); } catch (e) {}
    const parts = [
      !mine && !grouped ? el("span", { class: "b-name", text: name }) : null,
      el("span", { class: "b-text", text: m.text }),
      el("span", { class: "b-time", text: time }),
    ];
    const bubble = canDel
      ? el("button", { type: "button", class: "bubble", "aria-label": (mine ? "Te" : name) + ", " + time + ": " + m.text + ". Törlés", onclick: () => askDeleteMsg(m) }, ...parts)
      : el("div", { class: "bubble" }, ...parts);
    return el("div", { class: "msg" + (mine ? " mine" : "") + (grouped ? " grouped" : "") },
      mine ? null : (grouped ? el("span", { class: "msg-gap", "aria-hidden": "true" }) : avatar(m.uid, name, "sm")),
      bubble);
  }
  function updateChat() {
    const list = document.getElementById("chatList");
    if (!list) return;
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120;
    const out = [];
    if (S.kMsgsError) out.push(banner(RULES_MSG));
    if (!S.kMsgsLoaded) out.push(el("p", { class: "muted", text: "Betöltés…" }));
    else {
      if (!S.kMsgsFull) out.push(el("button", { type: "button", class: "link-btn chat-more", onclick: moreMsgs }, "Korábbi üzenetek"));
      if (!S.kMsgs.length) out.push(el("p", { class: "muted chat-empty", text: "Még nincs üzenet. Írj elsőként!" }));
      let lastDay = "", lastUid = "", lastAt = 0;
      for (const m of S.kMsgs) {
        const dk = keyOf(new Date(m.at));
        if (dk !== lastDay) { out.push(el("p", { class: "chat-day", text: chatDayLabel(m.at) })); lastDay = dk; lastUid = ""; }
        const grouped = m.uid === lastUid && m.at - lastAt < 5 * 60 * 1000;
        out.push(msgRow(m, grouped));
        lastUid = m.uid;
        lastAt = m.at;
      }
    }
    const first = !list.dataset.filled && S.kMsgsLoaded;
    list.replaceChildren(...out);
    if (S.kMsgsLoaded) list.dataset.filled = "1";
    if (first || atBottom || S.chatScrollDown) {
      if (S.kMsgsLoaded) S.chatScrollDown = false;
      window.scrollTo(0, document.documentElement.scrollHeight);
    }
  }
  function sendMsg(input) {
    // Karakterenként (nem UTF-16 egységenként) vágunk, hogy egy emoji se törjön ketté.
    const text = Array.from(cleanText(input.value, MSG_MAX * 2)).slice(0, MSG_MAX).join("").trim();
    const kid = S.kocsma;
    if (!text || !kid || !canEdit() || typeof S.backend.sendKMessage !== "function") return;
    input.value = "";
    autoGrow(input);
    S.chatScrollDown = true;
    try {
      const r = S.backend.sendKMessage(kid, text);
      Promise.resolve(r.done).catch((e) => {
        console.error(e);
        if (!input.value) input.value = text;
        toast(errCode(e) === "permission-denied" ? "Az üzenetet a szerver nem engedte (lehet, hogy már nem vagy tagja)." : "Az üzenetet nem sikerült elküldeni. Nézd meg a netet.");
      });
    } catch (e) { input.value = text; toast("Az üzenetet nem sikerült elküldeni."); }
    try { input.focus({ preventScroll: true }); } catch (e) {}
  }
  function askDeleteMsg(m) {
    const kid = S.kocsma;
    const mine = m.uid === S.myId;
    const short = m.text.length > 80 ? m.text.slice(0, 80) + "…" : m.text;
    confirmSheet((mine ? "Törlöd ezt az üzenetedet? " : "Törlöd " + userName(m.uid) + " üzenetét? ") + "„" + short + "”", "Törlöm", () => {
      if (!mine && !isKFounder() && ownerUnlocked()) {
        ownerAction(() => S.backend.adminDeleteKMessage(kid, m.id, (activeK() ? activeK().name + ": " : "") + userName(m.uid) + ": " + short), "Üzenet törölve.");
        return;
      }
      Promise.resolve().then(() => S.backend.deleteKMessage(kid, m.id)).then(() => toast("Üzenet törölve."))
        .catch((e) => { console.error(e); toast(kErrorText(e)); });
    });
  }

  /* ---------- kocsma lapok ---------- */
  function iconPicker(current, onPick) {
    const grid = el("div", { class: "icon-grid", role: "radiogroup", "aria-label": "Profilkép" });
    for (const ic of KICONS) {
      const b = el("button", { type: "button", class: "icon-pick", role: "radio", "aria-checked": ic.id === current ? "true" : "false", "aria-label": ic.name, "data-icon": ic.id,
        onclick: () => {
          for (const x of grid.children) x.setAttribute("aria-checked", x === b ? "true" : "false");
          onPick(ic.id);
        } }, kIcon(ic.id, "md"));
      grid.append(b);
    }
    return grid;
  }
  function kListBody() {
    const wrap = el("div", { class: "settings" });
    const list = kocsmaList();
    if (list.length) {
      const ul = el("ul", { class: "k-list" });
      for (const [kid, k] of list) {
        const on = kid === S.kocsma;
        ul.append(el("li", {}, el("button", { type: "button", class: "k-row" + (on ? " on" : ""), "aria-current": on ? "true" : null,
          onclick: () => openKocsmaTab(kid) },
          kIcon(k.icon, "md"),
          el("span", { class: "k-name", text: k.name }),
          on ? el("span", { class: "k-on", text: "most ez" }) : iconSpan(ICON_NEXT, "dr-chev"))));
      }
      wrap.append(ul);
    } else {
      wrap.append(el("p", { class: "muted", text: "Még nem vagy egy kocsmának sem a tagja." }));
    }
    wrap.append(el("div", { class: "btn-row" },
      el("button", { type: "button", class: "btn", disabled: !canEdit(), onclick: () => openSheet({ type: "kNew", back: { type: "kList" } }) }, "Új kocsma"),
      el("button", { type: "button", class: "btn secondary", disabled: !canEdit(), onclick: () => openSheet({ type: "kJoin", back: { type: "kList" } }) }, "Belépés kocsmába")));
    return wrap;
  }
  function kNewBody() {
    const wrap = el("div", { class: "stack" });
    const name = el("input", { id: "kName", class: "field", type: "text", maxlength: KNAME_MAX, autocomplete: "off", enterkeyhint: "done", placeholder: "pl. Sárga Rózsa" });
    let icon = KICONS[Math.floor(Math.random() * KICONS.length)].id;
    const msg = el("p", { class: "msg", role: "status" });
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    const btn = el("button", { type: "button", class: "btn wide" }, "Kocsma alapítása");
    btn.addEventListener("click", () => createKocsma(name.value, icon, say, btn));
    name.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); name.blur(); } });
    wrap.append(el("label", { class: "lbl", for: "kName", text: "A kocsma neve" }), name,
      el("span", { class: "lbl", text: "Profilkép" }), iconPicker(icon, (id) => { icon = id; }),
      el("p", { class: "hint", text: "Te leszel az alapító: átnevezheted, tagot eltávolíthatsz, új meghívókódot kérhetsz, és törölheted. Később bármikor módosíthatod a nevét és a képét." }),
      btn, msg);
    return wrap;
  }
  function kJoinBody(s) {
    const wrap = el("div", { class: "stack" });
    const input = el("input", { id: "kCode", class: "field big", type: "text", maxlength: 120, autocomplete: "off", autocapitalize: "none",
      spellcheck: "false", enterkeyhint: "go", placeholder: "pl. k7m2p9qa" });
    if (s.code) input.value = s.code;
    const prev = el("div", { class: "k-preview", "aria-live": "polite" });
    const msg = el("p", { class: "msg", role: "status" });
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    const lookBtn = el("button", { type: "button", class: "btn secondary wide" }, "Megnézem");
    let asked = "";
    const look = async () => {
      const code = cleanKCode(input.value);
      if (!code) { asked = ""; prev.replaceChildren(); say(input.value.trim() ? "A meghívókód 8 betűből és számból áll." : "", !!input.value.trim()); return; }
      if (code === asked) return;
      asked = code;
      say("");
      prev.replaceChildren(el("p", { class: "muted", text: "Keresés…" }));
      let d = null;
      try { d = await S.backend.getKCode(code); }
      catch (e) { asked = ""; prev.replaceChildren(); say(errCode(e) === "permission-denied" ? RULES_MSG : "Nem érem el a szervert. Nézd meg a netet.", true); return; }
      if (cleanKCode(input.value) !== code) return;
      if (!d || typeof d.kid !== "string") {
        prev.replaceChildren();
        say("Nincs ilyen meghívókód. Lehet, hogy elírtad, vagy az alapító közben újat kért.", true);
        return;
      }
      const pv = { name: cleanKName(d.name) || "Kocsma", icon: KICON_BY_ID[d.icon] ? d.icon : "01" };
      const uids = Object.keys(d.m && typeof d.m === "object" ? d.m : {}).filter(u => S.stats.has(u) || u === S.myId).sort(byName);
      const member = S.kocsmak.has(d.kid);
      const join = el("button", { type: "button", class: "btn wide" }, member ? "Megnyitom" : "Belépek");
      join.addEventListener("click", () => joinKocsma(d.kid, code, pv, s.from || null, say, join));
      prev.replaceChildren(el("div", { class: "card k-prev" },
        el("div", { class: "kp-head" }, kIcon(pv.icon, "lg"),
          el("span", { class: "kp-text" }, el("span", { class: "kh-name cond", text: pv.name }), el("span", { class: "kh-sub", text: uids.length + " tag" }))),
        uids.length ? el("ul", { class: "kp-members" }, ...uids.map(u => el("li", {}, avatar(u, userName(u), "sm"), el("span", { text: userName(u) })))) : null,
        member ? el("p", { class: "note small", text: "Már tagja vagy ennek a kocsmának." }) : null,
        join));
    };
    lookBtn.addEventListener("click", look);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); look(); } });
    let t = null;
    input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { if (cleanKCode(input.value)) look(); }, 400); });
    wrap.append(el("p", { class: "muted", text: s.from ? userName(s.from) + " meghívott egy kocsmába. Nézd meg, és ha szeretnéd, lépj be." : "Írd be a meghívókódot, vagy másold be a meghívó linket. Belépés előtt látod a kocsma nevét és a tagjait." }),
      el("label", { class: "lbl", for: "kCode", text: "Meghívókód" }), input, lookBtn, prev, msg);
    if (cleanKCode(input.value)) setTimeout(look, 0);
    return wrap;
  }
  function kSetBody() {
    const wrap = el("div", { class: "settings" });
    const kid = S.kocsma;
    const k = activeK();
    if (!k) { wrap.append(el("p", { class: "muted", text: "Nincs kiválasztott kocsma." })); return wrap; }
    const founder = k.owner === S.myId;
    wrap.append(el("div", { class: "kp-head" }, kIcon(k.icon, "lg"),
      el("span", { class: "kp-text" }, el("span", { class: "kh-name cond", text: k.name }),
        el("span", { class: "kh-sub", text: (k.owner ? "Alapító: " + userName(k.owner) : "") + (k.createdAt ? ", " + fmtDate(k.createdAt) : "") }))));
    if (founder) {
      const name = el("input", { id: "kRename", class: "field", type: "text", maxlength: KNAME_MAX, autocomplete: "off", enterkeyhint: "done" });
      name.value = k.name;
      const save = el("button", { type: "button", class: "btn" }, "Mentés");
      const doSave = () => {
        const n = cleanKName(name.value);
        if (!n) { toast("Adj nevet a kocsmának."); return; }
        if (n === k.name) { name.blur(); return; }
        updateKocsma(kid, { name: n });
      };
      save.addEventListener("click", doSave);
      name.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSave(); } });
      wrap.append(el("h3", { class: "settings-sub cond", text: "Név és profilkép" }),
        el("div", {}, el("label", { class: "lbl", for: "kRename", text: "A kocsma neve" }), el("div", { class: "add-inline" }, name, save)),
        iconPicker(k.icon, (id) => updateKocsma(kid, { icon: id })));
    }
    wrap.append(el("h3", { class: "settings-sub cond", text: "Meghívókód" }),
      el("p", {}, el("span", { class: "code big-code", text: k.code || "…" })),
      el("p", { class: "muted small", text: "Akinek megvan a kód (vagy a meghívó link), belépés előtt látja a kocsma nevét, képét és tagjait, és beléphet." }));
    if (founder) {
      wrap.append(el("button", { type: "button", class: "btn secondary wide", disabled: !canEdit(),
        onclick: () => confirmSheet("Új meghívókód készül. A régi kód és a korábban elküldött linkek ezután nem működnek; a tagok maradnak.", "Új kódot kérek", () => newKCode(kid)) }, "Új meghívókód"));
    }
    const ids = [...S.kMembers.keys()].sort((a, b) => (a === k.owner ? -1 : b === k.owner ? 1 : 0) || byName(a, b));
    wrap.append(el("h3", { class: "settings-sub cond", text: "Tagok (" + ids.length + ")" }));
    const ul = el("ul", { class: "f-list" });
    for (const uid of ids) {
      const tags = [];
      if (uid === k.owner) tags.push("alapító");
      if (uid === S.myId) tags.push("te");
      const at = S.kMembers.get(uid).at;
      const sub = tags.join(", ") + (at ? (tags.length ? " · " : "") + "belépett: " + fmtDate(at) : "");
      ul.append(personRow(uid, sub, () => { closeSheet(); S.kUser = uid; renderAll(); window.scrollTo(0, 0); },
        founder && uid !== S.myId ? el("button", { type: "button", class: "btn secondary small", disabled: !canEdit(),
          onclick: () => confirmSheet(userName(uid) + " kikerül a kocsmából. Hogy a régi kóddal ne tudjon visszalépni, új meghívókód készül. Az eddigi üzenetei megmaradnak.", "Eltávolítom", () => kickMember(kid, uid)) }, "Eltávolítás") : null));
    }
    wrap.append(ul);
    const others = ids.filter(u => u !== S.myId);
    const leaveText = founder
      ? (others.length ? "Kilépsz a(z) „" + k.name + "” kocsmából. Te vagy az alapító, ezért a kocsmát a legrégebbi tag kapja meg. Az üzeneteid megmaradnak." : "Te vagy az utolsó tag: ha kilépsz, a kocsma minden adatával (üzenetekkel együtt) törlődik.")
      : "Kilépsz a(z) „" + k.name + "” kocsmából. Az üzeneteid megmaradnak; visszalépni csak érvényes meghívókóddal tudsz.";
    wrap.append(el("h3", { class: "settings-sub cond", text: "Kilépés" }),
      el("button", { type: "button", class: "btn secondary wide", disabled: !canEdit(), onclick: () => confirmSheet(leaveText, "Kilépek", () => leaveKocsma(kid)) }, "Kilépés a kocsmából"));
    if (founder) {
      wrap.append(el("button", { type: "button", class: "btn danger wide", disabled: !canEdit(),
        onclick: () => confirmSheet("A(z) „" + k.name + "” kocsma minden adatával együtt végleg törlődik: a tagság, a chat összes üzenete és a meghívókód. A tagok napi naplója és statisztikája megmarad. Ezt nem lehet visszavonni.", "Törlöm a kocsmát", () => deleteKocsma(kid)) }, "A kocsma törlése"));
    }
    return wrap;
  }
  function kInviteBody() {
    const wrap = el("div", { class: "settings" });
    const kid = S.kocsma;
    const k = activeK();
    if (!k) { wrap.append(el("p", { class: "muted", text: "Nincs kiválasztott kocsma." })); return wrap; }
    const copy = el("button", { type: "button", class: "btn secondary" }, "Másolás");
    copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(k.code); toast("Meghívókód kimásolva."); } catch (e) { toast("A meghívókód: " + k.code); } });
    wrap.append(el("p", { class: "muted", text: "Küldd el a linket vagy a kódot, vagy hívd meg egy barátodat egy koppintással." }),
      el("div", { class: "code-row" }, el("span", { class: "code big-code", text: k.code || "…" }), copy),
      el("button", { type: "button", class: "btn wide", onclick: () => shareKInvite(k) }, "Meghívó link küldése"));
    wrap.append(el("h3", { class: "settings-sub cond", text: "Barátaim" }));
    if (S.socialError) { wrap.append(banner(RULES_MSG)); return wrap; }
    const fr = [...S.friends.keys()].filter(uid => !S.kMembers.has(uid)).sort(byName);
    if (!S.friends.size) wrap.append(el("p", { class: "muted", text: "Még nincs barátod. A Profil fülön jelölhetsz barátot a felhasználóneve alapján." }));
    else if (!fr.length) wrap.append(el("p", { class: "muted", text: "Minden barátod tagja már ennek a kocsmának." }));
    else {
      const ul = el("ul", { class: "f-list" });
      for (const uid of fr) {
        const b = el("button", { type: "button", class: "btn small", disabled: !canEdit() }, "Meghívom");
        b.addEventListener("click", async () => { b.disabled = true; if (await sendKInvite(uid, kid)) b.textContent = "Meghívva"; else b.disabled = false; });
        ul.append(personRow(uid, "", () => { closeSheet(); S.tab = "profile"; openProfUser(uid); }, b));
      }
      wrap.append(ul);
    }
    return wrap;
  }
  function kPickBody(s) {
    const wrap = el("div", { class: "settings" });
    wrap.append(el("p", { class: "muted", text: "Melyik kocsmádba hívod meg " + userName(s.uid) + " barátodat?" }));
    const ul = el("ul", { class: "k-list" });
    for (const [kid, k] of kocsmaList()) {
      ul.append(el("li", {}, el("button", { type: "button", class: "k-row", onclick: async () => { if (await sendKInvite(s.uid, kid)) closeSheet(); } },
        kIcon(k.icon, "md"), el("span", { class: "k-name", text: k.name }), iconSpan(ICON_NEXT, "dr-chev"))));
    }
    wrap.append(ul);
    return wrap;
  }
  function fAddBody() {
    const wrap = el("div", { class: "stack" });
    const input = el("input", { id: "fName", class: "field big", type: "text", maxlength: 20, autocomplete: "off", autocapitalize: "none",
      spellcheck: "false", enterkeyhint: "send", placeholder: "pl. bence" });
    const msg = el("p", { class: "msg", role: "status" });
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    const btn = el("button", { type: "button", class: "btn wide" }, "Barátnak jelölöm");
    const go = async () => {
      btn.disabled = true;
      const ok = await sendFriendRequestByName(input.value, say);
      btn.disabled = false;
      if (ok) closeSheet();
    };
    btn.addEventListener("click", go);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    wrap.append(el("label", { class: "lbl", for: "fName", text: "A barátod felhasználóneve" }), input,
      el("p", { class: "hint", text: "Ha elfogadja, egymás barátlistáján lesztek, és egy koppintással meghívhatjátok egymást a kocsmátokba." }),
      btn, msg);
    return wrap;
  }

  /* ---------- tulajdonos: kocsmák ---------- */
  function ownerKocsmakBody() {
    const wrap = el("div", { class: "settings" });
    if (!ownerUnlocked()) {
      wrap.append(el("p", { text: "Lejárt a feloldás." }), el("button", { type: "button", class: "btn wide", onclick: () => openSheet({ type: "owner" }) }, "Feloldás"));
      return wrap;
    }
    const box = el("div", {}, el("p", { class: "muted", text: "Betöltés…" }));
    wrap.append(el("p", { class: "muted", text: "Az összes kocsma. Egy kocsmára koppintva látod a tagjait és az utolsó üzeneteit, és törölhetsz. Minden művelet bekerül a naplóba." }), box);
    Promise.resolve().then(() => S.backend.adminListKocsmak()).then((rows) => {
      if (!rows.length) { box.replaceChildren(el("p", { class: "muted", text: "Még nincs kocsma." })); return; }
      const ul = el("ul", { class: "k-list" });
      for (const r of rows.map(x => ({ id: x.id, k: sanitizeKocsma(x.data) })).sort((a, b) => a.k.name.localeCompare(b.k.name, "hu", { sensitivity: "base" }))) {
        ul.append(el("li", {}, el("button", { type: "button", class: "k-row", onclick: () => openSheet({ type: "ownerKocsma", kid: r.id, back: { type: "ownerKocsmak", back: { type: "owner" } } }) },
          kIcon(r.k.icon, "md"),
          el("span", { class: "k-name" }, el("span", { text: r.k.name }), el("span", { class: "k-sub", text: "alapító: " + userName(r.k.owner) })),
          iconSpan(ICON_NEXT, "dr-chev"))));
      }
      box.replaceChildren(ul);
    }).catch((e) => { box.replaceChildren(el("p", { class: "msg err", text: ownerErrorText(e) })); });
    return wrap;
  }
  function ownerKocsmaBody(s) {
    const wrap = el("div", { class: "settings" });
    const kid = s.kid;
    const back = s.back;
    if (!ownerUnlocked()) {
      wrap.append(el("p", { text: "Lejárt a feloldás." }), el("button", { type: "button", class: "btn wide", onclick: () => openSheet({ type: "owner" }) }, "Feloldás"));
      return wrap;
    }
    const box = el("div", { class: "settings" }, el("p", { class: "muted", text: "Betöltés…" }));
    wrap.append(box);
    const reopen = () => openSheet({ type: "ownerKocsma", kid, back });
    Promise.resolve().then(() => S.backend.adminKocsmaDetail(kid)).then((d) => {
      if (!d.kocsma) { box.replaceChildren(el("p", { class: "muted", text: "Ez a kocsma már nem létezik." })); return; }
      const k = sanitizeKocsma(d.kocsma);
      const out = [el("div", { class: "kp-head" }, kIcon(k.icon, "lg"),
        el("span", { class: "kp-text" }, el("span", { class: "kh-name cond", text: k.name }),
          el("span", { class: "kh-sub", text: "Alapító: " + userName(k.owner) + " · kód: " + (k.code || "–") })))];
      out.push(el("h3", { class: "settings-sub cond", text: "Tagok (" + d.members.length + ")" }));
      const ul = el("ul", { class: "f-list" });
      for (const m of d.members.slice().sort((a, b) => byName(a.id, b.id))) {
        ul.append(el("li", { class: "f-item" },
          el("span", { class: "f-open static" }, avatar(m.id, userName(m.id)),
            el("span", { class: "p-main" }, el("span", { class: "p-name", text: userName(m.id) }), el("span", { class: "p-sub", text: m.id === k.owner ? "alapító" : "" }))),
          el("button", { type: "button", class: "btn secondary small",
            onclick: () => confirmSheet(userName(m.id) + " kikerül a(z) „" + k.name + "” kocsmából" + (m.id === k.owner ? " (az alapítói szerepet a legrégebbi tag kapja meg)" : "") + ", és új meghívókód készül.", "Eltávolítom",
              () => ownerAction(() => S.backend.adminRemoveKMember(kid, m.id, k.name + ": " + userName(m.id)), "Eltávolítva.", reopen)) }, "Eltávolítás")));
      }
      out.push(ul);
      out.push(el("h3", { class: "settings-sub cond", text: "Utolsó üzenetek" }));
      if (!d.messages.length) out.push(el("p", { class: "muted", text: "Nincs üzenet." }));
      const ml = el("ul", { class: "owner-msgs" });
      for (const raw of d.messages) {
        const m = sanitizeMsg(raw.id, raw.data);
        if (!m) continue;
        let when = "";
        try { when = new Date(m.at).toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) {}
        const short = m.text.length > 60 ? m.text.slice(0, 60) + "…" : m.text;
        ml.append(el("li", {},
          el("span", { class: "om-main" }, el("span", { class: "om-who", text: userName(m.uid) + " · " + when }), el("span", { class: "om-text", text: m.text })),
          el("button", { type: "button", class: "del", "aria-label": "Üzenet törlése",
            onclick: () => confirmSheet("Törlöd " + userName(m.uid) + " üzenetét? „" + short + "”", "Törlöm",
              () => ownerAction(() => S.backend.adminDeleteKMessage(kid, m.id, k.name + ": " + userName(m.uid) + ": " + short), "Üzenet törölve.", reopen)) }, "×")));
      }
      out.push(ml);
      out.push(el("button", { type: "button", class: "btn danger wide",
        onclick: () => confirmSheet("A(z) „" + k.name + "” kocsma minden adata (tagság, üzenetek, meghívókód) véglegesen törlődik.", "Törlöm a kocsmát",
          () => ownerAction(() => S.backend.adminDeleteKocsma(kid, k.name), "A kocsma törölve.", () => openSheet(back || { type: "owner" }))) }, "A kocsma törlése"));
      box.replaceChildren(...out);
    }).catch((e) => { box.replaceChildren(el("p", { class: "msg err", text: ownerErrorText(e) })); });
    return wrap;
  }

  /* ---------- Profil fül ---------- */
  function profileView() {
    const wrap = el("div", { class: "view profile" });
    for (const b of banners()) wrap.append(b);
    if (S.profUser) {
      wrap.append(backBtn("Profil", () => { S.profUser = null; renderAll(); window.scrollTo(0, 0); }), userView(S.profUser));
      return wrap;
    }
    wrap.append(el("div", { class: "prof-head" },
      avatar(S.myId, S.username, "xl"),
      el("div", { class: "prof-text" },
        el("h2", { class: "cond", text: S.username }),
        el("p", { class: "muted", text: "A napi naplód, a statisztikád és a beállításaid." }))));
    const st = statsOf(S.myId);
    wrap.append(statsSection("Az én statisztikám", st.years[thisYear()] || emptyCounts(), st.total, "Minden napodból összeadva, bulival vagy anélkül."));
    wrap.append(el("section", { class: "stats" },
      el("h3", { class: "feed-title cond", text: "Fogyasztás naponta" }),
      chartView("me", { days: myDayCounts() }),
      el("p", { class: "stat-note", text: "Egy oszlop egy nap: hajnali 6-tól másnap hajnali 6-ig. Koppints egy színre a részletekért." }),
      el("p", { class: "stat-note care", text: "A számok becslések: nem mérik a véralkoholszintet, és nem alkalmasak annak eldöntésére, hogy vezethetsz-e." })));
    wrap.append(daysSection());
    wrap.append(friendsSection());
    wrap.append(settingsSection());
    return wrap;
  }
  function dayCountsText(d) {
    const c = dayCounts(d);
    return CATS.filter(cat => c[cat.id] > 0).map(cat => cat.emoji + " " + c[cat.id]).join("   ");
  }
  function daysSection() {
    const sec = el("section", { class: "days" });
    sec.append(el("div", { class: "sec-head" },
      el("h3", { class: "feed-title cond", text: "Napjaim" }),
      el("button", { type: "button", class: "btn secondary small", disabled: !canEdit(), onclick: () => openSheet({ type: "otherDay" }) }, "Másik nap")));
    if (!S.daysLoaded) { sec.append(el("p", { class: "muted", text: "Betöltés…" })); return sec; }
    const keys = [...S.days.entries()].filter(([, d]) => dayHasItems(d) || d.party).map(([k]) => k).sort().reverse();
    if (!keys.length) {
      sec.append(el("p", { class: "muted", text: "Még nincs felírt napod. Amit a Kocsma fülön vagy a + gombbal felírsz, itt jelenik meg naponként." }));
      return sec;
    }
    sec.append(el("p", { class: "stat-note top", text: "Koppints egy napra: utólag javíthatod, és bármelyik napot buliba rendelheted." }));
    const ul = el("ul", { class: "day-list" });
    for (const k of keys.slice(0, S.dayShow)) {
      const d = getDay(k);
      ul.append(el("li", {}, el("button", { type: "button", class: "day-row", onclick: () => openSheet({ type: "day", day: k }) },
        el("span", { class: "dr-date" }, el("span", { class: "dr-day cond", text: dayLabel(k) }), el("span", { class: "dr-wd", text: dayRel(k) })),
        el("span", { class: "dr-main" },
          el("span", { class: "dr-party" + (d.party ? "" : " none"), text: d.party ? partyName(d.party) : "Nincs buli" }),
          el("span", { class: "dr-counts", text: dayCountsText(d) || "Nincs felírt ital" })),
        iconSpan(ICON_NEXT, "dr-chev"))));
    }
    sec.append(ul);
    if (keys.length > S.dayShow) {
      sec.append(el("button", { type: "button", class: "link-btn", onclick: () => { S.dayShow += 60; renderAll(); } }, "Korábbi napok"));
    }
    return sec;
  }
  function settingsSection() {
    const sec = el("section", { class: "settings-list" });
    sec.append(el("h3", { class: "feed-title cond", text: "Beállítások" }));
    const row = (text, sub, fn, cls) => el("button", { type: "button", class: "set-row" + (cls ? " " + cls : ""), onclick: fn },
      el("span", { class: "sr-main" }, el("span", { class: "sr-title", text }), sub ? el("span", { class: "sr-sub", text: sub }) : null),
      iconSpan(ICON_NEXT, "sr-chev"));
    sec.append(row("Fiók és e-mail", "Felhasználónév, e-mail-cím, fiókazonosító", () => openSheet({ type: "account" })));
    const seg = el("div", { class: "seg", role: "radiogroup", "aria-label": "Mértékegység" });
    const opt = (val, text) => el("button", { type: "button", class: "seg-btn", role: "radio", "aria-checked": S.units === val ? "true" : "false",
      onclick: () => { S.units = val; lsSet("strigula-units", val); renderAll(); } }, text);
    seg.append(opt("metric", "Metrikus"), opt("imperial", "Imperial"));
    sec.append(el("div", { class: "set-block" },
      el("span", { class: "sr-title", text: "Mértékegység" }), seg,
      el("span", { class: "sr-sub", text: "Metrikus: cl, dl, l. Imperial: brit fl oz és pint. Egy adag: rövid 4 cl, bor 1 dl, sör 5 dl, víz vagy üdítő 3 dl." })));
    sec.append(row("Felhasználási feltételek", null, () => openSheet({ type: "terms" })));
    sec.append(row("Adatkezelési tájékoztató", null, () => openSheet({ type: "privacy" })));
    if (S.isOwner) {
      const r = row("Tulajdonos", "Felhasználók, bulik, napló", () => openSheet({ type: "owner" }));
      if (privacyInfo().missing.length) {
        r.querySelector(".sr-main").append(el("span", { class: "sr-sub warn", text: "Figyelem: a config.js-ben hiányzik az üzemeltető adata." }));
      }
      sec.append(r);
    }
    if (!isStandalone()) {
      if (S.installPrompt) sec.append(row("Telepítés a telefonra", null, promptInstall));
      else sec.append(el("div", { class: "set-block" }, el("span", { class: "sr-title", text: "Telepítés" }),
        el("span", { class: "sr-sub", text: isIOS()
          ? "Safariban koppints a Megosztás ikonra, majd a Főképernyőhöz adás pontra."
          : "Chrome-ban nyisd meg a ⋮ menüt, és válaszd az Alkalmazás telepítése vagy a Hozzáadás a kezdőképernyőhöz pontot." })));
    }
    sec.append(row("Kijelentkezés", null, () => confirmSheet("Kijelentkezel ebből a fiókból ezen a telefonon.", "Kijelentkezem", logout)));
    sec.append(row("Fiókom törlése", "Minden adatod törlődik, és ezzel a hozzájárulásodat is visszavonod.", () => openSheet({ type: "delete" }), "danger"));
    return sec;
  }

  /* ---------- Ivós játékok fül ---------- */
  function gamesView() {
    const sec = el("section", { class: "view games" });
    sec.append(el("h2", { class: "view-title cond", text: "Ivós játékok" }));
    sec.append(el("p", { class: "note", text: "Ivós játék adatbázis, fejlesztés alatt." }));
    sec.append(el("p", { class: "care", text: "Minden játékot a saját felelősségedre játszol. Senkit ne kényszeríts ivásra." }));
    const input = el("input", { id: "gameSearch", class: "field search", type: "search", placeholder: "Keresés név alapján",
      autocomplete: "off", autocapitalize: "none", spellcheck: "false", enterkeyhint: "search", maxlength: 60, "aria-label": "Keresés név alapján" });
    input.value = S.gameQuery;
    input.addEventListener("input", () => { S.gameQuery = input.value; updateGames(); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); input.blur(); } });
    sec.append(el("div", { class: "search-wrap" }, iconSpan(ICON_SEARCH, "search-ico"), input));
    sec.append(el("div", { id: "gameList", class: "game-list" }));
    return sec;
  }
  function updateGames() {
    const box = document.getElementById("gameList");
    if (!box) return;
    const q = fold(S.gameQuery.trim());
    const all = [...S.games.entries()];
    const list = all.filter(([, g]) => !q || fold(g.name || "Névtelen játék").includes(q))
      .sort((a, b) => (a[1].name ? 0 : 1) - (b[1].name ? 0 : 1)
        || a[1].name.localeCompare(b[1].name, "hu", { sensitivity: "base" })
        || b[1].createdAt - a[1].createdAt);
    const out = [];
    if (S.gamesError) out.push(banner(RULES_MSG));
    if (!S.gamesLoaded) out.push(el("p", { class: "muted", text: "Betöltés…" }));
    else if (!all.length) out.push(el("p", { class: "muted", text: "Még nincs saját játékod. A jobb alsó „+ játék” gombbal adhatsz hozzá egyet. A saját játékaidat csak te látod." }));
    else if (!list.length) out.push(el("p", { class: "muted", text: "Nincs ilyen nevű játék." }));
    else {
      out.push(el("p", { class: "muted small", text: all.length + " saját játék" + (q ? ", ebből " + list.length + " illik a keresésre" : "") + ". Csak te látod őket." }));
      for (const [id, g] of list) out.push(gameCard(id, g));
    }
    box.replaceChildren(...out);
  }
  function gameCard(id, g) {
    const meta = [];
    if (g.players) meta.push("👥 " + g.players + (/\d$/.test(g.players) ? " fő" : ""));
    if (g.tools) meta.push("🧰 " + g.tools);
    return el("button", { type: "button", class: "game-card", onclick: () => openSheet({ type: "game", id }) },
      el("span", { class: "gc-name cond", text: g.name || "Névtelen játék" }),
      meta.length ? el("span", { class: "gc-meta", text: meta.join("    ") }) : null,
      g.desc ? el("span", { class: "gc-desc", text: g.desc }) : null);
  }

  /* ---------- Naptár és Térkép: hamarosan ---------- */
  function soonView(title, icon, lead, items) {
    return el("section", { class: "view soon" },
      iconSpan(icon, "soon-ico"),
      el("h2", { class: "view-title cond", text: title }),
      el("p", { class: "soon-tag", text: "Hamarosan" }),
      el("p", { class: "lead", text: lead }),
      el("ul", { class: "soon-list" }, ...items.map(t => el("li", { text: t }))));
  }
  function calendarView() {
    return soonView("Naptár", ICON_CAL, "Itt lesznek a bulik és a saját eseményeid, havi és heti nézetben.", [
      "Buli előre bejelentése egy napra vagy egy időszakra",
      "A Google Naptárad importálása, csak a te engedélyeddel",
      "Kocsmás buli: a kocsma minden tagja automatikusan bekerül",
    ]);
  }
  function mapView() {
    return soonView("Térkép", ICON_PIN, "Egy földgömbön látod majd, hol ittál. Csak akkor, ha engedélyezed a helymeghatározást, és a helyadataidat csak te látod.", [
      "A közeli ivások egy jelölőbe csoportosítva",
      "Egy jelölőre koppintva: mit, mennyit, mikor",
    ]);
  }

  /* ---------- strigulák ---------- */
  function jit(i) { return (((i * 7919) % 11) - 5) * 0.18; }
  function tally(n, fresh) {
    const box = el("span", { class: "tally", "aria-hidden": "true" });
    if (n <= 0) { box.append(el("span", { class: "tally-empty", text: "még semmi" })); return box; }
    const MAX = 30;
    const shown = Math.min(n, MAX);
    for (let g = 0; g * 5 < shown; g++) {
      const inGroup = Math.min(5, shown - g * 5);
      const svg = svgEl("svg", { viewBox: "0 0 36 28", width: 36, height: 28 });
      for (let i = 0; i < inGroup; i++) {
        const idx = g * 5 + i;
        const j = jit(idx);
        const line = i < 4
          ? svgEl("line", { x1: (6 + i * 7.5 + j).toFixed(2), y1: (3 + Math.abs(j)).toFixed(2), x2: (6 + i * 7.5 - j * 0.6).toFixed(2), y2: (25 - Math.abs(j) * 0.5).toFixed(2) })
          : svgEl("line", { x1: 1, y1: (21 + j).toFixed(2), x2: 35, y2: (7 - j).toFixed(2) });
        if (fresh && n <= MAX && idx === shown - 1) line.setAttribute("class", "fresh");
        svg.append(line);
      }
      box.append(svg);
    }
    if (n > MAX) box.append(el("span", { class: "tally-more cond", text: "+" + (n - MAX) }));
    return box;
  }
  function heroMark() {
    const svg = svgEl("svg", { viewBox: "0 0 512 512", width: 96, height: 96, class: "hero-mark", "aria-hidden": "true" });
    svg.append(
      svgEl("rect", { width: 512, height: 512, rx: 112, fill: "#18231F" }),
      svgEl("path", { class: "echo", fill: "#F2A24E", d: "M144,380 L144,156 L208,156 L268,272 L328,156 L392,156 L392,380 L338,380 L338,258 L288,352 L248,352 L198,258 L198,380 Z" }),
      svgEl("path", { fill: "#ECEDE4", d: "M124,360 L124,136 L188,136 L248,252 L308,136 L372,136 L372,360 L318,360 L318,238 L268,332 L228,332 L178,238 L178,360 Z" }));
    return svg;
  }


  /* ---------- grafikon ---------- */
  function niceStep(max) {
    for (const s of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) if (max / s <= 4) return s;
    return Math.ceil(max / 4);
  }
  function chartView(owner, st) {
    const box = el("div", { class: "chart-box" });
    const days = Object.entries(st.days)
      .map(([k, c]) => [k, c, CATS.reduce((s, cat) => s + Math.max(0, c[cat.id]), 0)])
      .filter(x => x[2] > 0)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .slice(-60);
    if (!days.length) {
      box.append(el("p", { class: "muted chart-empty", text: "Az első felírás után itt látod naponta, mit és mennyit ittál." }));
      return box;
    }
    const max = Math.max(...days.map(d => d[2]));
    const step = niceStep(max);
    const top = Math.max(step, Math.ceil(max / step) * step);
    const H = 200, PT = 12, PB = 30, PH = H - PT - PB, BW = 28, GAP = 18, PL = 12;
    const W = PL + days.length * (BW + GAP) - GAP + PL;
    const yOf = (v) => PT + PH - (v / top) * PH;

    const axis = svgEl("svg", { class: "chart-axis", width: 30, height: H, "aria-hidden": "true" });
    const plot = svgEl("svg", { class: "chart-plot", width: "100%", height: H, role: "group",
      "aria-label": "Fogyasztás naponta, " + days.length + " nap. Koppints egy színre a részletekért." });
    for (let t = 0; t <= top; t += step) {
      const t1 = svgEl("text", { x: 26, y: (yOf(t) + 4).toFixed(1), "text-anchor": "end" });
      t1.textContent = String(t);
      axis.append(t1);
      plot.append(svgEl("line", { x1: 0, x2: 4000, y1: yOf(t).toFixed(1), y2: yOf(t).toFixed(1), class: t === 0 ? "chart-base" : "chart-grid" }));
    }
    const inner = el("div", { class: "chart-inner", style: "width:" + W + "px" });
    const showTip = (key, cat, n, x, mid) => {
      inner.querySelectorAll(".chart-tip").forEach(t => t.remove());
      const TW = 156;
      const right = x + BW + 8;
      const left = (right + TW > Math.max(W, 300) && x - 8 - TW >= 0) ? x - 8 - TW : right;
      const tip = el("div", { class: "chart-tip", role: "status", style: "left:" + left + "px;top:" + Math.min(Math.max(0, mid - 26), H - 60) + "px" },
        el("span", { class: "tip-dot", style: "background: var(--" + cat.id + ")" }),
        el("span", { class: "tip-main", text: cat.name + ": " + n + " db" }),
        el("span", { class: "tip-sub", text: dayLabel(key) + ", " + fmtVol(n * cat.ml) }));
      inner.append(tip);
    };
    days.forEach(([key, c], i) => {
      const x = PL + i * (BW + GAP);
      let cum = 0;
      for (const cat of CATS) {
        const n = Math.max(0, c[cat.id]);
        if (!n) continue;
        const y1 = yOf(cum + n), y0 = yOf(cum);
        const mid = (y0 + y1) / 2;
        const seg = svgEl("rect", { x, y: y1.toFixed(1), width: BW, height: Math.max(1, y0 - y1).toFixed(1), rx: 2,
          class: "chart-seg", style: "fill: var(--" + cat.id + ")", tabindex: 0, role: "button",
          "aria-label": dayLabel(key) + ": " + cat.name + ", " + n + " darab" });
        const toggle = () => {
          const same = S.chartTip && S.chartTip.owner === owner && S.chartTip.day === key && S.chartTip.cat === cat.id;
          if (same) { S.chartTip = null; inner.querySelectorAll(".chart-tip").forEach(t => t.remove()); return; }
          S.chartTip = { owner, day: key, cat: cat.id };
          showTip(key, cat, n, x, mid);
        };
        seg.addEventListener("click", toggle);
        seg.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
        plot.append(seg);
        if (S.chartTip && S.chartTip.owner === owner && S.chartTip.day === key && S.chartTip.cat === cat.id) {
          setTimeout(() => showTip(key, cat, n, x, mid), 0);
        }
        cum += n;
      }
      const lbl = svgEl("text", { x: (x + BW / 2).toFixed(1), y: H - 10, "text-anchor": "middle", class: "chart-x" });
      lbl.textContent = dayLabel(key);
      plot.append(lbl);
    });
    inner.append(plot);
    box.append(el("div", { class: "chart" }, axis, el("div", { class: "chart-scroll", "data-owner": owner }, inner)));
    box.append(el("div", { class: "chart-legend", "aria-hidden": "true" },
      ...CATS.map(c => el("span", {}, el("i", { style: "background: var(--" + c.id + ")" }), c.name))));
    return box;
  }
  document.addEventListener("click", (e) => {
    if (!S.chartTip) return;
    const t = e.target;
    if (t && t.closest && t.closest(".chart-seg, .chart-tip")) return;
    S.chartTip = null;
    document.querySelectorAll(".chart-tip").forEach(n => n.remove());
  });


  /* ---------- alsó lapok ---------- */
  const DYNAMIC_SHEETS = ["add", "day", "daycat", "pcat"];
  function updateLock() { document.body.classList.toggle("locked", !!S.sheet); }
  function openSheet(sheet) {
    S.sheet = sheet;
    const root = $("#sheetRoot");
    root.replaceChildren();
    const close = el("button", { type: "button", class: "icon-btn", "aria-label": "Bezárás", onclick: closeSheet });
    close.innerHTML = ICON_CLOSE;
    const title = el("h2", { id: "sheetTitle", class: "sheet-title cond" });
    const body = el("div", { id: "sheetBody", class: "sheet-body" });
    const head = el("div", { class: "sheet-head" });
    if (sheet.back) {
      const b = el("button", { type: "button", class: "icon-btn sheet-back", "aria-label": "Vissza", onclick: () => openSheet(sheet.back) });
      b.innerHTML = ICON_BACK;
      head.append(b);
    }
    head.append(title, close);
    const panel = el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": "sheetTitle" },
      el("div", { class: "grab", "aria-hidden": "true" }), head, body);
    let focus = null;
    switch (sheet.type) {
      case "daycat":
        panel.style.setProperty("--c", "var(--" + sheet.cid + ")");
        if (canEdit()) { const f = addForm(sheet.day, sheet.cid); panel.append(f.row); if (sheet.focus) focus = f.input; }
        break;
      case "pcat":
        panel.style.setProperty("--c", "var(--" + sheet.cid + ")");
        break;
      case "daysPick":
        title.textContent = "Melyik napod?";
        body.append(daysPickBody(sheet));
        break;
      case "join":
        title.textContent = sheet.invite ? "Meghívó" : (sheet.day === todayKey() ? "Mai buli" : "Buliba rendelés");
        body.append(joinBody(sheet));
        break;
      case "partyName":
        title.textContent = "A buli neve";
        body.append(partyNameBody());
        break;
      case "otherDay":
        title.textContent = "Másik nap";
        body.append(otherDayBody());
        break;
      case "game":
        title.textContent = sheet.id ? "Játék" : "Új játék";
        body.append(gameBody(sheet));
        break;
      case "account":
        title.textContent = "Fiók és e-mail";
        body.append(accountBody());
        break;
      case "owner":
        title.textContent = "Tulajdonos";
        body.append(ownerBody());
        break;
      case "ownerUser":
        title.textContent = displayName(sheet.uid, S.docs.get(sheet.uid));
        body.append(ownerUserBody(sheet.uid));
        break;
      case "privacy":
        title.textContent = "Adatkezelési tájékoztató";
        body.append(privacyContent());
        break;
      case "terms":
        title.textContent = "Felhasználási feltételek";
        body.append(termsContent());
        break;
      case "kList":
        title.textContent = "Kocsmáim";
        body.append(kListBody());
        break;
      case "kNew":
        title.textContent = "Új kocsma";
        body.append(kNewBody());
        break;
      case "kJoin":
        title.textContent = sheet.from ? "Meghívó" : "Belépés kocsmába";
        body.append(kJoinBody(sheet));
        break;
      case "kSet":
        title.textContent = "A kocsma";
        body.append(kSetBody());
        break;
      case "kInvite":
        title.textContent = "Meghívás";
        body.append(kInviteBody());
        break;
      case "kPick":
        title.textContent = "Melyik kocsmába?";
        body.append(kPickBody(sheet));
        break;
      case "fAdd":
        title.textContent = "Barát hozzáadása";
        body.append(fAddBody());
        break;
      case "ownerKocsmak":
        title.textContent = "Kocsmák";
        body.append(ownerKocsmakBody());
        break;
      case "ownerKocsma":
        title.textContent = "Kocsma";
        body.append(ownerKocsmaBody(sheet));
        break;
      case "delete": {
        title.textContent = "Fiók törlése";
        const pw = el("input", { id: "delPw", class: "field", type: "password", maxlength: 128, autocomplete: "current-password", enterkeyhint: "done" });
        const msg = el("p", { class: "msg", role: "status" });
        const btn = el("button", { type: "button", class: "btn danger wide" }, "Fiókom végleges törlése");
        btn.addEventListener("click", () => doDelete(pw.value, msg, btn));
        pw.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doDelete(pw.value, msg, btn); } });
        body.append(el("div", { class: "stack" },
          el("p", { class: "confirm-text", text: "Ezzel végleg törlöd a fiókodat, a felhasználónevedet, a statisztikádat, a napi naplódat, az ivós játékaidat, a buli-összesítéseidet és a szavazataidat minden buliból, a chat-üzeneteidet, a barátságaidat és a barátkéréseidet. A kocsmáidból kilépsz: ahol alapító vagy, a kocsmát a legrégebbi tag kapja meg; ahol te vagy az utolsó tag, a kocsma törlődik. Ezt nem lehet visszavonni." }),
          el("label", { class: "lbl", for: "delPw", text: "A jelszavad a megerősítéshez" }), pw, btn, msg,
          el("button", { type: "button", class: "btn secondary wide", onclick: closeSheet }, "Mégse")));
        break;
      }
      case "confirm":
        title.textContent = sheet.title || "Biztos?";
        body.append(
          el("p", { class: "confirm-text", text: sheet.text }),
          el("div", { class: "btn-row" },
            el("button", { type: "button", class: "btn secondary", onclick: closeSheet }, "Mégse"),
            el("button", { type: "button", class: sheet.safe ? "btn" : "btn danger", onclick: () => { const a = sheet.action; closeSheet(); a(); } }, sheet.label)));
        break;
    }
    root.append(el("div", { class: "backdrop", onclick: closeSheet }), panel);
    updateLock();
    renderSheet();
    try { (focus || close).focus({ preventScroll: true }); } catch (e) {}
  }
  function closeSheet() {
    if (!S.sheet) return;
    S.sheet = null;
    $("#sheetRoot").replaceChildren();
    updateLock();
  }
  function confirmSheet(text, lbl, action) { openSheet({ type: "confirm", text, label: lbl, action }); }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.sheet) closeSheet(); });

  function renderSheet() {
    const s = S.sheet;
    if (!s || !DYNAMIC_SHEETS.includes(s.type)) return;
    if (S.phase !== "ready") { closeSheet(); return; }
    if (s.type === "add") renderAddSheet();
    else if (s.type === "day") renderDaySheet(s);
    else if (s.type === "daycat") renderDayCatSheet(s);
    else if (s.type === "pcat") renderPartyCatSheet(s);
  }
  // A jobb alsó + gomb lapja: a mai napra, fajtánként egy koppintással.
  function renderAddSheet() {
    const key = todayKey();
    const day = getDay(key) || emptyDay();
    $("#sheetTitle").textContent = "Mit iszol?";
    const body = $("#sheetBody");
    const keep = body.scrollTop;
    const out = [el("p", { class: "muted small sheet-sub", text: "Ma, " + dayLabel(key) + (day.party ? " · " + partyName(day.party) : "") + ". Koppints egy italra, és felírom." })];
    for (const cat of CATS) {
      const sec = el("section", { class: "pick", style: "--c: var(--" + cat.id + ")" });
      sec.append(el("h3", { class: "pick-title" },
        el("span", { class: "pick-name" }, el("span", { "aria-hidden": "true", text: cat.emoji + " " }), cat.name),
        el("span", { class: "pick-total cond", text: String(dayCount(day, cat.id)) })));
      const chips = el("div", { class: "chips" });
      const quick = quickOf(cat.id);
      for (const d of drinkList(day, cat)) {
        chips.append(el("button", { type: "button", class: "chip" + (d.n ? " has" : "") + (d.name === quick ? " quick" : ""), disabled: !canEdit(),
          "aria-label": label(cat.id, d.name) + " felírása. Ma eddig: " + d.n,
          onclick: () => addDrink(key, cat.id, d.name) },
          el("span", { class: "chip-name", text: d.name }), d.n ? el("span", { class: "chip-n", text: String(d.n) }) : null));
      }
      chips.append(el("button", { type: "button", class: "chip more", disabled: !canEdit(),
        onclick: () => openSheet({ type: "daycat", day: key, cid: cat.id, back: { type: "add" }, focus: true }) }, "Más…"));
      sec.append(chips);
      out.push(sec);
    }
    body.replaceChildren(...out);
    body.scrollTop = keep;
  }
  function renderDaySheet(s) {
    const key = s.day;
    const day = getDay(key) || emptyDay();
    const isToday = key === todayKey();
    $("#sheetTitle").textContent = isToday ? "Ma" : dayLabel(key);
    const body = $("#sheetBody");
    const keep = body.scrollTop;
    const c = dayCounts(day);
    const out = [
      el("p", { class: "muted sheet-sub", text: dayLong(key) }),
      el("p", { class: "day-sum", text: alcOf(c) + " alkoholos ital (" + fmtVol(alcMlOf(c)) + "), " + c.water + " víz vagy üdítő (" + fmtVol(c.water * CAT_BY_ID.water.ml) + ")." }),
    ];
    for (const cat of CATS) {
      const n = c[cat.id];
      const hint = Object.entries(day.cats[cat.id]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nm, k]) => nm + " " + k).join(", ");
      out.push(el("div", { class: "cat" + (cat.quiet ? " quiet" : ""), style: "--c: var(--" + cat.id + ")" },
        el("button", { type: "button", class: "cat-open", "aria-label": cat.name + ": " + n + " darab. Javítás",
          onclick: () => openSheet({ type: "daycat", day: key, cid: cat.id, back: { type: "day", day: key } }) },
          el("span", { class: "cat-title" }, el("span", { class: "emoji", "aria-hidden": "true", text: cat.emoji }), el("span", { text: cat.name })),
          el("span", { class: "cat-num cond", text: String(n) }),
          tally(n, S.fresh === key + "|" + cat.id),
          el("span", { class: "cat-hint", text: hint || (canEdit() ? "Koppints a javításhoz" : "") }),
          el("span", { class: "cat-vol", text: fmtVol(n * cat.ml) }))));
    }
    if (!isToday) out.push(el("p", { class: "help", text: "Múltbeli nap: amit itt javítasz, azt a statisztikádban és a buli összesítésében is átvezetem." }));
    const ps = el("section", { class: "day-party" });
    ps.append(el("h3", { class: "feed-title cond", text: "Buli" }));
    if (day.party) {
      const code = day.party;
      ps.append(el("p", {}, "Ez a nap ehhez a bulihoz tartozik: ", el("strong", { text: partyName(code) })),
        el("div", { class: "stack" },
          el("button", { type: "button", class: "btn wide", onclick: () => openParty(code) }, "A buli megnyitása"),
          el("button", { type: "button", class: "btn secondary wide", disabled: !canEdit(),
            onclick: () => openSheet({ type: "join", day: key, back: { type: "day", day: key } }) }, "Másik buliba teszem"),
          el("button", { type: "button", class: "btn secondary wide", disabled: !canEdit(),
            onclick: () => confirmSheet("Ez a nap kikerül a(z) „" + partyName(code) + "” buliból. Az italaid a napi naplódban maradnak.", "Kiveszem", () => assignDay(key, null)) },
            "Kiveszem a buliból")));
    } else {
      ps.append(el("p", { class: "muted", text: "Ez a nap nincs bulihoz rendelve. Ha buliban voltál, rendeld hozzá: így a többiek is látják, és beszámít a versenybe." }),
        el("button", { type: "button", class: "btn wide", disabled: !canEdit(),
          onclick: () => openSheet({ type: "join", day: key, back: { type: "day", day: key } }) }, "Buliba rendelés"));
    }
    out.push(ps);
    body.replaceChildren(...out);
    body.scrollTop = keep;
  }
  function renderDayCatSheet(s) {
    const cat = CAT_BY_ID[s.cid];
    const key = s.day;
    const day = getDay(key) || emptyDay();
    const editable = canEdit();
    const total = dayCount(day, cat.id);
    $("#sheetTitle").replaceChildren(
      document.createTextNode(cat.emoji + " " + cat.name + " "),
      el("span", { class: "sheet-total", text: String(total) }),
      el("span", { class: "sheet-vol", text: " " + fmtVol(total * cat.ml) }));
    const body = $("#sheetBody");
    const keep = body.scrollTop;
    const isToday = key === todayKey();
    const sub = el("p", { class: "muted small sheet-sub", text: (isToday ? "Ma, " + dayLabel(key) : dayLong(key)) + (day.party ? " · " + partyName(day.party) : "") });
    const quick = quickOf(cat.id);
    const ul = el("ul", { class: "drinks" });
    for (const d of drinkList(day, cat)) {
      const li = el("li", { class: "drink" + (d.n > 0 ? " has" : "") });
      li.append(el("span", { class: "d-name" },
        el("span", { class: "nm", text: d.name }),
        editable && isToday && d.name === quick ? el("span", { class: "q-tag", text: "+1 gomb" }) : null));
      if (editable) {
        if (d.custom && d.n === 0) {
          li.append(el("button", { type: "button", class: "del", "aria-label": d.name + " törlése a listából", onclick: () => removeCustom(key, cat.id, d.name) }, "×"));
        }
        li.append(el("span", { class: "d-actions" },
          el("button", { type: "button", class: "mini", "aria-label": "Egy " + d.name + " levonása", disabled: d.n === 0,
            onclick: () => removeDrink(key, cat.id, d.name) }, "−"),
          el("span", { class: "d-n cond", text: String(d.n) }),
          el("button", { type: "button", class: "mini mini-plus", "aria-label": "Még egy " + d.name, onclick: () => addDrink(key, cat.id, d.name) }, "+")));
      } else {
        li.append(el("span", { class: "d-n cond", text: String(d.n) }));
      }
      ul.append(li);
    }
    const out = [sub];
    if (!isToday) out.push(el("p", { class: "note small", text: "Múltbeli nap: a javítás a statisztikádat és a buli összesítését is frissíti." }));
    out.push(ul);
    body.replaceChildren(...out);
    body.scrollTop = keep;
  }
  function addForm(key, cid) {
    const cat = CAT_BY_ID[cid];
    const input = el("input", { id: "customInput", class: "field", type: "text", maxlength: NAME_MAX, placeholder: cat.placeholder,
      autocomplete: "off", enterkeyhint: "done" });
    const btn = el("button", { type: "button", class: "btn" }, "Felírom");
    const go = () => {
      if (!cleanName(input.value)) { input.focus(); return; }
      if (addCustom(key, cid, input.value)) { input.value = ""; input.blur(); }
    };
    btn.addEventListener("click", go);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    const row = el("div", { class: "add-row" },
      el("label", { class: "lbl", for: "customInput", text: "Nincs a listán? Írd be, és felírom:" }),
      el("div", { class: "add-inline" }, input, btn));
    return { row, input };
  }
  // A buli egy résztvevőjének egy kategóriája (csak nézni lehet; a tulajdonos javíthat).
  function partyDrinkList(doc, cat) {
    const cd = doc.cats[cat.id];
    const names = cat.defaults.filter(n => n !== "Egyéb");
    const push = (n) => { if (n !== "Egyéb" && !names.includes(n)) names.push(n); };
    cd.custom.forEach(push);
    cd.items.forEach(i => push(i.name));
    if (cat.defaults.includes("Egyéb") || cd.items.some(i => i.name === "Egyéb")) names.push("Egyéb");
    return names.map(n => { const it = cd.items.find(i => i.name === n); return { name: n, n: it ? it.n : 0 }; });
  }
  function renderPartyCatSheet(s) {
    const cat = CAT_BY_ID[s.cid];
    const doc = S.docs.get(s.pid);
    if (!doc) { closeSheet(); return; }
    const mine = s.pid === S.myId;
    const ownerEdit = !mine && S.isOwner && ownerUnlocked();
    const total = catTotal(doc, cat);
    $("#sheetTitle").replaceChildren(
      document.createTextNode(cat.emoji + " " + cat.name + " "),
      el("span", { class: "sheet-total", text: String(total) }),
      el("span", { class: "sheet-vol", text: " " + fmtVol(total * cat.ml) }));
    const body = $("#sheetBody");
    const keep = body.scrollTop;
    let list = partyDrinkList(doc, cat);
    if (!ownerEdit) list = list.filter(d => d.n > 0).sort((a, b) => b.n - a.n);
    const who = mine
      ? el("p", { class: "muted", text: "A bulihoz rendelt napjaid összege. Javítani a napodnál tudsz (Profil, Napjaim)." })
      : ownerEdit
        ? el("p", { class: "note", text: "Tulajdonosként javítod " + displayName(s.pid, doc) + " számlálóját. A napi naplójában és a statisztikájában is átvezetem, és a napló rögzíti." })
        : el("p", { class: "muted", text: displayName(s.pid, doc) + " számlálója, csak nézheted." });
    if (!list.length) {
      body.replaceChildren(who, el("p", { class: "empty", text: "Ebből még nincs semmi felírva." }));
      return;
    }
    const ul = el("ul", { class: "drinks" });
    for (const d of list) {
      const li = el("li", { class: "drink" + (d.n > 0 ? " has" : "") });
      li.append(el("span", { class: "d-name" }, el("span", { class: "nm", text: d.name })));
      if (ownerEdit) {
        li.append(el("span", { class: "d-actions" },
          el("button", { type: "button", class: "mini", "aria-label": "Egy " + d.name + " levonása", disabled: d.n === 0,
            onclick: () => ownerBump(s.pid, cat.id, d.name, -1) }, "−"),
          el("span", { class: "d-n cond", text: String(d.n) }),
          el("button", { type: "button", class: "mini mini-plus", "aria-label": "Még egy " + d.name, onclick: () => ownerBump(s.pid, cat.id, d.name, +1) }, "+")));
      } else {
        li.append(el("span", { class: "d-n cond", text: String(d.n) }));
      }
      ul.append(li);
    }
    body.replaceChildren(who, ul);
    body.scrollTop = keep;
  }
  function daysPickBody(s) {
    const wrap = el("div", { class: "settings" });
    const days = myPartyDays(s.code).reverse();
    if (!days.length) { wrap.append(el("p", { class: "muted", text: "Ehhez a bulihoz nincs napod." })); return wrap; }
    const ul = el("ul", { class: "day-list" });
    for (const k of days) {
      const d = getDay(k);
      ul.append(el("li", {}, el("button", { type: "button", class: "day-row", onclick: () => openSheet({ type: "day", day: k, back: s }) },
        el("span", { class: "dr-date" }, el("span", { class: "dr-day cond", text: dayLabel(k) }), el("span", { class: "dr-wd", text: dayRel(k) })),
        el("span", { class: "dr-main" }, el("span", { class: "dr-counts", text: dayCountsText(d) || "Nincs felírt ital" })),
        iconSpan(ICON_NEXT, "dr-chev"))));
    }
    wrap.append(ul);
    return wrap;
  }
  // Egy nap buliba rendelése: kóddal, új bulival vagy egy meglévő bulimmal.
  function joinBody(s) {
    const key = s.day;
    const isToday = key === todayKey();
    const cur = getDay(key) ? getDay(key).party : null;
    const wrap = el("div", { class: "settings join" });
    const msg = el("p", { class: "msg", role: "status" });
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    const done = (code) => {
      if (s.back && !isToday) openSheet(s.back);
      else closeSheet();
      if (isToday) { S.tab = "kocsma"; S.partyOpen = null; S.person = null; renderAll(); window.scrollTo(0, 0); }
      toast((isToday ? "A mai napod" : dayLabel(key)) + " a(z) „" + partyName(code) + "” bulihoz került.");
    };
    const busy = (btns, on) => { for (const b of btns) b.disabled = on; };
    wrap.append(el("p", { class: "muted", text: (isToday ? "A mai napod (" + dayLabel(key) + ")" : dayLong(key)) + " ebbe a buliba kerül. Egy naphoz egy buli tartozik." }));
    if (cur) wrap.append(el("p", { class: "note", text: "Most a(z) „" + partyName(cur) + "” bulihoz tartozik. Ha másikat választasz, átkerül oda." }));

    // Kóddal (vagy meghívóval)
    const code = el("input", { id: "joinCode", class: "field big", type: "text", maxlength: 40, autocomplete: "off",
      autocapitalize: "none", spellcheck: "false", enterkeyhint: "go", placeholder: "pl. buli-k7m2p9qa" });
    if (s.code) code.value = s.code;
    const preview = el("p", { class: "party-hint", "aria-live": "polite" });
    const codeBtn = el("button", { type: "button", class: "btn wide" }, s.invite ? "Belépek" : "Belépek a kóddal");
    let pt = null, asked = "";
    const look = () => {
      const c = cleanParty(code.value);
      if (!c) { preview.textContent = ""; return; }
      if (c === asked) return;
      asked = c;
      Promise.resolve().then(() => S.backend.getPartyMeta(c)).then((m) => {
        if (cleanParty(code.value) !== c) return;
        const nm = m && typeof m.name === "string" ? cleanPartyName(m.name) : "";
        preview.textContent = nm ? "Buli: " + nm : "Ezzel a kóddal még nincs elnevezett buli. Ha a barátod most indította, így is beléphetsz.";
      }).catch(() => { preview.textContent = ""; });
    };
    code.addEventListener("input", () => { clearTimeout(pt); pt = setTimeout(look, 350); });
    const goCode = async () => {
      const c = cleanParty(code.value);
      if (!c) { say("A buli kódja legalább 3 betű vagy szám legyen.", true); code.focus(); return; }
      if (c === cur) { done(c); return; }
      busy(allBtns, true);
      say("Csatlakozás…");
      const ok = await assignDay(key, c);
      busy(allBtns, false);
      if (ok) done(c); else say("");
    };
    codeBtn.addEventListener("click", goCode);
    code.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); goCode(); } });
    const codeSec = el("div", { class: "stack" },
      el("h3", { class: "settings-sub cond", text: s.invite ? "Meghívtak egy buliba" : "Belépés kóddal" }),
      el("label", { class: "lbl", for: "joinCode", text: "A buli kódja" }), code, preview, codeBtn);

    // Új buli
    const pname = el("input", { id: "joinName", class: "field", type: "text", maxlength: PARTY_NAME_MAX, autocomplete: "off",
      enterkeyhint: "go", placeholder: "pl. Szilveszter 2026" });
    const newBtn = el("button", { type: "button", class: "btn wide" }, "Új buli indítása");
    const goNew = async () => {
      busy(allBtns, true);
      say("Indítás…");
      const ok = await createParty(key, pname.value);
      busy(allBtns, false);
      const now = getDay(key) ? getDay(key).party : null;
      if (ok && now) done(now); else say("");
    };
    newBtn.addEventListener("click", goNew);
    pname.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); goNew(); } });
    const newSec = el("div", { class: "stack" },
      el("h3", { class: "settings-sub cond", text: "Új buli" }),
      el("label", { class: "lbl", for: "joinName", text: "A buli neve" }), pname,
      el("p", { class: "hint", text: "Ha üresen hagyod: „" + defaultPartyName(key) + "”. Később át is nevezheted. Indítás után a Meghívás gombbal küldheted el a barátaidnak." }),
      newBtn);

    // Meglévő bulijaim
    const mine = loadParties().filter(p => p.code !== cur).slice(0, 30);
    const listSec = el("div", { class: "stack" }, el("h3", { class: "settings-sub cond", text: "Meglévő bulijaim" }));
    const listBtns = [];
    if (!mine.length) listSec.append(el("p", { class: "muted", text: "Még nincs korábbi bulid." }));
    else {
      const ul = el("ul", { class: "party-list" });
      for (const p of mine) {
        const days = myPartyDays(p.code);
        const b = el("button", { type: "button", class: "party-open",
          onclick: async () => {
            busy(allBtns, true);
            say("Csatlakozás…");
            const ok = await assignDay(key, p.code);
            busy(allBtns, false);
            if (ok) done(p.code); else say("");
          } },
          el("span", { class: "pi-name", text: partyName(p.code) }),
          el("span", { class: "pi-sub", text: days.length ? daysText(days) : (p.created ? "Indult: " + fmtDate(p.created) : "") }));
        listBtns.push(b);
        ul.append(el("li", { class: "party-item" }, b));
      }
      listSec.append(ul);
    }
    const allBtns = [codeBtn, newBtn, ...listBtns];
    const order = s.mode === "new" ? [newSec, codeSec, listSec] : s.mode === "code" ? [codeSec, newSec, listSec] : [listSec, codeSec, newSec];
    wrap.append(msg, ...order);
    if (s.code) look();
    return wrap;
  }
  function partyNameBody() {
    const wrap = el("div", { class: "stack" });
    const input = el("input", { id: "partyNameInput", class: "field", type: "text", maxlength: PARTY_NAME_MAX, autocomplete: "off",
      enterkeyhint: "done", placeholder: "pl. Szilveszter 2026" });
    input.value = S.partyMeta && S.partyMeta.name ? S.partyMeta.name : "";
    const btn = el("button", { type: "button", class: "btn wide" }, "Mentés");
    const go = () => {
      if (!savePartyName(input.value)) { input.focus(); return; }
      closeSheet();
      toast("A buli neve elmentve.");
    };
    btn.addEventListener("click", go);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    wrap.append(el("label", { class: "lbl", for: "partyNameInput", text: "A buli neve" }), input,
      el("p", { class: "hint", text: "Mindenki ezt a nevet látja. A buli kódja ettől nem változik: " + (S.party || "") }), btn);
    return wrap;
  }
  function otherDayBody() {
    const wrap = el("div", { class: "stack" });
    const t = todayKey();
    const input = el("input", { id: "otherDay", class: "field", type: "date", max: t, min: "2000-01-01" });
    input.value = shiftDay(t, -1);
    const msg = el("p", { class: "msg", role: "status" });
    const btn = el("button", { type: "button", class: "btn wide" }, "Megnyitás");
    btn.addEventListener("click", () => {
      const k = String(input.value || "");
      if (!DAY_RE.test(k) || k > t || k < "2000-01-01") { msg.textContent = "Válassz egy napot, legkésőbb a mait."; msg.classList.add("err"); return; }
      openSheet({ type: "day", day: k });
    });
    wrap.append(el("p", { class: "muted", text: "Melyik napot szeretnéd felírni vagy javítani? Egy nap hajnali 6-tól másnap hajnali 6-ig tart." }),
      el("label", { class: "lbl", for: "otherDay", text: "Nap" }), input, btn, msg);
    return wrap;
  }
  function gameBody(s) {
    const g = s.id ? S.games.get(s.id) : null;
    const wrap = el("div", { class: "stack" });
    const field = (id, lbl, attrs, value, area) => {
      const input = area ? el("textarea", Object.assign({ id, class: "field area" }, attrs)) : el("input", Object.assign({ id, class: "field", type: "text" }, attrs));
      input.value = value || "";
      wrap.append(el("label", { class: "lbl", for: id, text: lbl }), input);
      return input;
    };
    const name = field("gName", "Játék neve (nem kötelező)", { maxlength: GAME_MAX.name, autocomplete: "off", placeholder: "pl. Királyos" }, g && g.name);
    const players = field("gPlayers", "Személyek száma", { maxlength: GAME_MAX.players, autocomplete: "off", placeholder: "pl. 3–8" }, g && g.players);
    const tools = field("gTools", "Szükséges eszközök", { maxlength: GAME_MAX.tools, autocomplete: "off", placeholder: "pl. kártyapakli, poharak" }, g && g.tools);
    const desc = field("gDesc", "Rövid leírás", { maxlength: GAME_MAX.desc, rows: 5, placeholder: "Röviden a szabályok…" }, g && g.desc, true);
    const msg = el("p", { class: "msg", role: "status" });
    const btn = el("button", { type: "button", class: "btn wide" }, g ? "Mentés" : "Hozzáadás");
    btn.addEventListener("click", () => {
      const data = {
        name: cleanLine(name.value, GAME_MAX.name), players: cleanLine(players.value, GAME_MAX.players),
        tools: cleanLine(tools.value, GAME_MAX.tools), desc: cleanText(desc.value, GAME_MAX.desc),
      };
      if (!data.name && !data.desc) { msg.textContent = "Adj meg legalább egy nevet vagy egy rövid leírást."; msg.classList.add("err"); return; }
      if (!canEdit() || typeof S.backend.saveGame !== "function") { msg.textContent = "Most nem lehet menteni."; msg.classList.add("err"); return; }
      const now = Date.now();
      data.createdAt = g && g.createdAt ? g.createdAt : now;
      data.updatedAt = now;
      let r;
      try { r = S.backend.saveGame(s.id || null, data); } catch (e) { onGameError(e); return; }
      Promise.resolve(r && r.done).catch(onGameError);
      closeSheet();
      toast(g ? "Elmentve." : "Hozzáadva: " + (data.name || "Névtelen játék"));
    });
    wrap.append(btn, msg);
    if (g) {
      wrap.append(el("button", { type: "button", class: "btn danger wide",
        onclick: () => confirmSheet("Törlöd ezt a játékot: „" + (g.name || "Névtelen játék") + "”?", "Törlöm", () => {
          Promise.resolve().then(() => S.backend.deleteGame(s.id)).catch(onGameError);
          toast("A játék törölve.");
        }) }, "Törlés"));
    }
    wrap.append(el("p", { class: "muted small", text: "A saját játékaidat csak te látod." }));
    return wrap;
  }
  function onGameError(e) {
    if (errCode(e) === "permission-denied") { S.gamesError = true; renderAll(); toast(RULES_MSG); }
    else toast("A játékot nem sikerült menteni. Nézd meg a netet.");
  }
  function accountBody() {
    const wrap = el("div", { class: "settings" });
    const uinput = el("input", { id: "setUser", class: "field", type: "text", maxlength: 20, autocomplete: "username",
      autocapitalize: "none", spellcheck: "false", enterkeyhint: "done" });
    uinput.value = S.username;
    const usave = el("button", { type: "button", class: "btn" }, "Mentés");
    usave.addEventListener("click", () => saveUsername(uinput.value, uinput));
    uinput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveUsername(uinput.value, uinput); } });
    wrap.append(el("div", {},
      el("label", { class: "lbl", for: "setUser", text: "Felhasználónév" }),
      el("div", { class: "add-inline" }, uinput, usave),
      el("p", { class: "hint spaced", text: USERNAME_HINT })));
    wrap.append(emailSettings());
    const uidCopy = el("button", { type: "button", class: "btn secondary" }, "Másolás");
    uidCopy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(S.myId); toast("Fiókazonosító kimásolva."); } catch (e) { toast(S.myId); } });
    wrap.append(el("div", {}, el("p", { class: "muted small" }, "Fiókazonosító (UID): ", el("span", { class: "code", text: S.myId })), uidCopy));
    return wrap;
  }

  /* ---------- belépés, regisztráció ---------- */
  function consentBoxes() {
    const adult = el("input", { type: "checkbox", id: "cAdult" });
    const terms = el("input", { type: "checkbox", id: "cTerms" });
    const agree = el("input", { type: "checkbox", id: "cAgree" });
    const box = el("div", { class: "consents" },
      el("button", { type: "button", class: "link-btn inline", onclick: () => openSheet({ type: "terms" }) }, "A Felhasználási feltételek elolvasása"),
      el("button", { type: "button", class: "link-btn inline", onclick: () => openSheet({ type: "privacy" }) }, "Az adatkezelési tájékoztató elolvasása"),
      el("label", { class: "check block", for: "cAdult" }, adult, el("span", { text: "Elmúltam 18 éves." })),
      el("label", { class: "check block", for: "cTerms" }, terms,
        el("span", { text: "Elolvastam és elfogadom a Felhasználási feltételeket, és tudomásul veszem, hogy az appot a saját felelősségemre használom." })),
      el("label", { class: "check block", for: "cAgree" }, agree,
        el("span", { text: "Elolvastam az adatkezelési tájékoztatót, és kifejezetten hozzájárulok, hogy az app tárolja a napi naplómat (az általam felírt italokat), és a többi felhasználónak megmutassa a statisztikámat, a bulikon felírt italaimat, a pontjaimat és a rólam szóló szavazatokat, a kocsmáim tagjainak pedig a havi pontjaimat és a chat-üzeneteimet." })));
    return { box, adult, terms, agree };
  }
  function authView() {
    const mode = S.authMode === "login" || S.authMode === "reset" ? S.authMode : "signup";
    const signup = mode === "signup";
    const sec = el("section", { class: "onboard auth" });
    sec.append(heroMark());
    const heads = {
      signup: ["Szia!", "Hozz létre egy fiókot. Egy egyedi felhasználónév és egy jelszó kell hozzá, az e-mail-cím nem kötelező."],
      login: ["Üdv újra!", "Lépj be a felhasználóneveddel vagy, ha megadtál, az e-mail-címeddel."],
      reset: ["Új jelszó", "Add meg a fiókodhoz tartozó e-mail-címet, és küldünk egy levelet, amellyel új jelszót állíthatsz be."],
    };
    sec.append(el("h2", { class: "hero cond", text: heads[mode][0] }));
    sec.append(el("p", { class: "lead", text: heads[mode][1] }));
    const go = (m) => { S.authMode = m; $("#main").dataset.screen = ""; renderMain(); window.scrollTo(0, 0); };
    const msg = el("p", { id: "authMsg", class: "msg", role: "status" });

    if (mode === "reset") {
      const em = el("input", { id: "resetEmail", class: "field big", type: "email", maxlength: 120, autocomplete: "email",
        autocapitalize: "none", spellcheck: "false", enterkeyhint: "send", placeholder: "pl. nev@gmail.com" });
      const btn = el("button", { type: "button", class: "btn big wide" }, "Levél küldése");
      btn.addEventListener("click", () => doReset(em.value, msg, btn));
      em.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doReset(em.value, msg, btn); } });
      sec.append(el("div", { class: "stack" }, el("label", { class: "lbl", for: "resetEmail", text: "E-mail-cím" }), em, btn), msg,
        el("p", { class: "hint", text: "Ha a fiókodhoz nem adtál meg e-mail-címet, a jelszót sajnos nem lehet visszaállítani. Ilyenkor hozz létre új fiókot." }),
        el("button", { type: "button", class: "link-btn", onclick: () => go("login") }, "Vissza a belépéshez"));
      return sec;
    }

    const tabBtn = (m, text) => el("button", { type: "button", class: "seg-btn", role: "tab", "aria-selected": mode === m ? "true" : "false",
      onclick: () => { if (mode !== m) go(m); } }, text);
    sec.append(el("div", { class: "seg", role: "tablist", "aria-label": "Fiók" }, tabBtn("signup", "Fiók létrehozása"), tabBtn("login", "Belépés")));
    if (S.legacy) {
      sec.append(el("p", { class: "note", text: signup
        ? "Ezen a telefonon már vannak adataid. Ha itt hozod létre a fiókodat, minden megmarad."
        : "Figyelem: ezen a telefonon már vannak adataid. Ha egy meglévő fiókba lépsz be, azok nem kerülnek át. Ha még nincs fiókod, inkább hozz létre egyet." }));
    }
    const user = el("input", { id: "authUser", class: "field big", type: "text", maxlength: signup ? 20 : 120, autocomplete: "username",
      autocapitalize: "none", spellcheck: "false", enterkeyhint: "next", placeholder: signup ? "pl. zsombi" : "felhasználónév vagy e-mail" });
    const email = signup ? el("input", { id: "authEmail", class: "field", type: "email", maxlength: 120, autocomplete: "email",
      autocapitalize: "none", spellcheck: "false", enterkeyhint: "next", placeholder: "nem kötelező" }) : null;
    const pw = el("input", { id: "authPw", class: "field", type: "password", maxlength: 128,
      autocomplete: signup ? "new-password" : "current-password", enterkeyhint: signup ? "next" : "go" });
    const pw2 = signup ? el("input", { id: "authPw2", class: "field", type: "password", maxlength: 128, autocomplete: "new-password", enterkeyhint: "done" }) : null;
    const showCb = el("input", { type: "checkbox", id: "authShow" });
    showCb.addEventListener("change", () => { const t = showCb.checked ? "text" : "password"; pw.type = t; if (pw2) pw2.type = t; });
    const cons = signup ? consentBoxes() : null;
    const btn = el("button", { type: "button", class: "btn big wide" }, signup ? "Fiók létrehozása" : "Belépés");
    const submit = () => signup
      ? doSignup(user.value, email.value, pw.value, pw2.value, cons.adult.checked, cons.terms.checked, cons.agree.checked, msg, btn)
      : doLogin(user.value, pw.value, msg, btn);
    btn.addEventListener("click", submit);
    user.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); (email || pw).focus(); } });
    if (email) email.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); pw.focus(); } });
    pw.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (pw2) pw2.focus(); else submit(); } });
    if (pw2) pw2.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); pw2.blur(); } });

    const fields = [el("label", { class: "lbl", for: "authUser", text: signup ? "Felhasználónév" : "Felhasználónév vagy e-mail-cím" }), user];
    if (signup) {
      fields.push(el("p", { class: "hint", text: USERNAME_HINT }),
        el("label", { class: "lbl", for: "authEmail", text: "E-mail-cím (nem kötelező)" }), email,
        el("p", { class: "hint", text: "Csak az elfelejtett jelszó visszaállításához kell, senki más nem látja. Ha megadod, a belépésnél is ezt használd." }));
    }
    fields.push(el("label", { class: "lbl", for: "authPw", text: "Jelszó" }), pw);
    if (signup) {
      const items = [["len", "Legalább 8 karakter"], ["lower", "Kisbetű"], ["upper", "Nagybetű"], ["digit", "Szám"]];
      const list = el("ul", { class: "pw-checks" }, ...items.map(([k, t]) =>
        el("li", { "data-k": k, "data-t": t }, el("span", { class: "ck", "aria-hidden": "true", text: "•" }), el("span", { text: t }))));
      const upd = () => {
        const c = passwordChecks(pw.value);
        for (const li of list.children) {
          const ok = !!c[li.dataset.k];
          li.classList.toggle("ok", ok);
          li.querySelector(".ck").textContent = ok ? "✓" : "•";
          li.setAttribute("aria-label", li.dataset.t + (ok ? ": rendben" : ": még hiányzik"));
        }
      };
      pw.addEventListener("input", upd);
      upd();
      fields.push(list, el("label", { class: "lbl", for: "authPw2", text: "Jelszó még egyszer" }), pw2);
    }
    fields.push(el("label", { class: "check", for: "authShow" }, showCb, "Jelszó mutatása"));
    if (cons) fields.push(cons.box);
    fields.push(btn);
    sec.append(el("div", { class: "stack" }, ...fields), msg);
    if (signup) sec.append(el("p", { class: "hint", text: "Ha nem adsz meg e-mail-címet, jegyezd meg jól a jelszavad: e-mail nélkül elfelejtett jelszót nem lehet visszaállítani." }));
    else sec.append(el("button", { type: "button", class: "link-btn", onclick: () => go("reset") }, "Elfelejtettem a jelszavam"));
    return sec;
  }
  function consentView() {
    const sec = el("section", { class: "onboard" });
    sec.append(el("h2", { class: "hero cond", text: "Feltételek" }));
    sec.append(el("p", { class: "lead", text: "Frissült az app: megjöttek a barátok és a kocsmák (közös chattel, havi ranglistával és kocsmás bulival). Mielőtt folytatod, kérjük, olvasd el a frissített adatkezelési tájékoztatót és a Felhasználási feltételeket, fogadd el a feltételeket, és járulj hozzá az adataid kezeléséhez." }));
    sec.append(el("p", { class: "note", text: "Röviden: az app a felhasználónevedet és a napi naplódat (a felírt italaidat) tárolja. A napi naplód részleteit és a barátlistádat csak te látod; a statisztikádat, a bulikon felírt italaidat, a pontjaidat és a rólad szóló szavazatokat a többi felhasználó is látja, a kocsmád chatjét és tagjait pedig a kocsma tagjai. Nem adjuk el és nem adjuk át senkinek. A fiókodat bármikor törölheted a Profil fülön." }));
    const cons = consentBoxes();
    const msg = el("p", { class: "msg", role: "status" });
    const btn = el("button", { type: "button", class: "btn big wide" }, "Elfogadom és folytatom");
    btn.addEventListener("click", () => doConsent(cons.adult.checked, cons.terms.checked, cons.agree.checked, msg));
    sec.append(el("div", { class: "stack" }, cons.box, btn), msg,
      el("button", { type: "button", class: "link-btn", onclick: () => openSheet({ type: "delete" }) }, "Inkább törlöm a fiókomat"),
      el("button", { type: "button", class: "link-btn", onclick: logout }, "Kijelentkezés"));
    return sec;
  }
  function privacyContent() {
    const p = privacyInfo();
    const h = (t) => el("h3", { class: "cond", text: t });
    const para = (t) => el("p", { text: t });
    const list = (...items) => el("ul", {}, ...items.map(t => el("li", { text: t })));
    return el("div", { class: "privacy" },
      el("p", { class: "muted small", text: "Utolsó módosítás: " + PRIVACY_DATE }),
      h("Ki kezeli az adataidat?"),
      para("A Másnapló egy baráti társaság saját, nem kereskedelmi alkalmazása. Adatkezelő: " + p.controller + ". Elérhetőség: " + p.contact + "."),
      h("Milyen adatokat tárolunk?"),
      list(
        "A felhasználónevedet és a jelszavadat. A jelszót a Google Firebase olvashatatlan formában (lenyomatként) tárolja, az adatkezelő sem látja.",
        "Az e-mail-címedet, ha megadod.",
        "A napi naplódat: amit felírsz, napokra bontva (az ital fajtáját és darabszámát, a napközben felírt italoknál az időpontot is), és azt, hogy melyik napod melyik bulihoz tartozik.",
        "A bulikat, amelyekben részt veszel: a buli nevét és kódját, a buliba rendelt napjaid összesítését és a hányás-szavazatokat.",
        "Az ezekből számolt statisztikát (éves, összesített és napi) és a pontjaidat.",
        "A saját ivós játékaidat (név, létszám, eszközök, leírás), ha felveszel ilyet.",
        "A barátaidat és a barátkéréseket (ki kit jelölt barátnak, és mikor), valamint a barátaidtól kapott kocsma-meghívókat.",
        "A kocsmáidat: a kocsma nevét, profilképét, meghívókódját és alapítóját, a tagokat és a belépésük idejét, a kocsmás buli kódját és napját, valamint a kocsma chatjébe írt üzeneteidet (a szöveget és az időpontot).",
        "A saját italneveidet, és hogy kategóriánként melyik fajtát választottad utoljára (ezt írja fel a +1 gomb).",
        "Azoknak a buliknak a kódját, amelyekben részt vettél. Ezt csak te látod, és azért tároljuk, hogy a fiókod törlésekor minden buliból törölhessük az adataidat.",
        "Azoknak a kocsmáknak az azonosítóját, amelyeknek tagja vagy vagy voltál. Ezt csak te látod, és azért tároljuk, hogy a fiókod törlésekor minden kocsmából törölhessük az üzeneteidet és a tagságodat.",
        "A hozzájárulásod és a Felhasználási feltételek elfogadásának időpontját.",
        "A telefonodon, a böngésző tárhelyén a mértékegység beállítását, a korábbi bulijaid listáját, a legutóbb választott kocsmát, és hogy a chatben meddig olvastál."),
      h("Mire használjuk?"),
      para("Kizárólag az app működéséhez: hogy a napi napló, a számlálók, a statisztika, a grafikon, a verseny, a barátok, a kocsmák, a chat és a havi ranglista működjön, és a buli résztvevői lássák egymás italait. Az e-mail-címet csak a jelszó visszaállításához és a cím megerősítéséhez használjuk. Nincs reklám, az adataidat nem adjuk el és nem adjuk át senkinek, és más célra nem használjuk."),
      h("Mi a jogalap?"),
      para("A hozzájárulásod (GDPR 6. cikk (1) bekezdés a) pont). Mivel az italfogyasztásra vonatkozó adatok egészségügyi jellegűnek is tekinthetők, ezekhez kifejezett hozzájárulást kérünk (GDPR 9. cikk (2) bekezdés a) pont). A hozzájárulásodat bármikor visszavonhatod a fiókod törlésével; ez nem érinti a korábbi adatkezelés jogszerűségét."),
      h("Ki látja az adataidat?"),
      para("A napi naplód részleteit (hogy melyik napon pontosan mit ittál, és melyik napod melyik bulihoz tartozik), a saját italneveidet, az ivós játékaidat és a barátlistádat csak te látod. Egy barátkérést a küldője és a címzettje lát; ha egy barátodat meghívod egy kocsmába, ő látja a meghívót (a kocsma nevét, képét és meghívókódját)."),
      para("A többi bejelentkezett felhasználó látja a felhasználónevedet, a statisztikádat (kategóriánként: éves, összesített és napi bontásban) és a grafikonodat. Egy bulin a résztvevők látják a buliba rendelt napjaid összesítését fajtánként, a legutóbbi italaidat az időpontjukkal, a pontjaidat és a rólad szóló szavazatokat. Egy buli adatait az láthatja, akinek van fiókja és ismeri a buli kódját. Az e-mail-címedet és a jelszavadat senki más nem látja."),
      para("Egy kocsma nevét, profilképét és tagjainak listáját az láthatja, akinek van fiókja és megvan a kocsma meghívókódja vagy meghívó linkje. A kocsma chatjét, a tagok belépési idejét, az alapítót, a meghívókódot és a kocsmás bulit csak a kocsma tagjai látják. A havi ranglistán a kocsma tagjai a havi pontjaidat és italaid számát is látják; ezek a statisztikádból számolódnak, amelyet a többi felhasználó egyébként is lát."),
      para("Adatfeldolgozó a Google (Firebase szolgáltatás). Az adatbázis európai szervereken van; a bejelentkezési adatokat a Google az EU–USA adatvédelmi keretrendszer és szerződéses garanciák alapján az Egyesült Államokban is kezelheti. Az oldal betöltésekor a GitHub (a tárhely) és a Google (betűtípusok, Firebase) a működéshez szükséges technikai adatokat, például az IP-címedet is megkapja."),
      h("A tulajdonos jogosultságai"),
      para("Az app tulajdonosa (az adatkezelő) a visszaélések kezelése és a hibák javítása érdekében átnevezhet felhasználókat, javíthatja vagy nullázhatja a buli-számlálókat (ilyenkor a buliba rendelt napjaidat is), törölhet szavazatokat, bulikat és felhasználói adatokat, és letilthat fiókokat. Ehhez a saját fiókjával, a jelszava újbóli megadása után fér hozzá, és minden ilyen műveletet naplózunk. Ugyanígy kocsmákat törölhet, tagot távolíthat el egy kocsmából, és chat-üzeneteket törölhet. Ehhez a tulajdonos a bulik és a kocsmáid listáját, a barátlistádat, a hozzájárulásod időpontját, a napi naplódat, valamint a kocsmák adatait és üzeneteit is láthatja. A tulajdonos a Firebase kezelőfelületén keresztül is hozzáfér az adatokhoz."),
      h("Meddig tároljuk?"),
      para("Amíg a fiókod létezik. A chat-üzeneteket addig tároljuk, amíg a szerzőjük, a kocsma alapítója vagy a tulajdonos nem törli őket, vagy amíg a kocsma meg nem szűnik; ha kilépsz egy kocsmából, az üzeneteid ott maradnak. Ha törlöd a fiókodat, a profilod, a felhasználóneved, a statisztikád, a napi naplód, az ivós játékaid, a barátságaid és a barátkéréseid, minden chat-üzeneted, valamint a buli-összesítéseid és a szavazataid minden olyan buliból azonnal törlődnek, amelyről az app tud (amelyet bármelyik eszközödön megnyitottál ezzel a fiókkal, vagy amelyhez napot rendeltél). A kocsmáidból kilépsz: ahol alapító vagy, a kocsmát a legrégebbi tag kapja meg; ahol te vagy az utolsó tag, a kocsma minden adatával törlődik. Ha egy régebbi buliban mégis maradna adatod, például egy azóta nem használt telefonról, az adatkezelő kérésre törli. A mások által rólad leadott szavazatokban csak egy azonosító marad, ami már senkihez sem köthető. A bulik neve a bulihoz tartozik, ezért az megmarad."),
      h("Milyen jogaid vannak?"),
      para("Jogod van hozzáférni az adataidhoz (ezek nagy részét az appban látod), helyesbíteni őket (a napi naplód bármelyik napja és a felhasználóneved az appban módosítható), törölni őket (Profil, Fiókom törlése), kérni az adataid másolatát, és visszavonni a hozzájárulásodat. Kérésekkel az adatkezelőhöz fordulhatsz a fenti elérhetőségen. Panaszt a Nemzeti Adatvédelmi és Információszabadság Hatóságnál tehetsz (NAIH, 1055 Budapest, Falk Miksa utca 9–11., www.naih.hu)."),
      h("Új funkciók"),
      para("Az appba később új funkciók kerülhetnek (például naptár, térkép). Ha egy új funkció új adatot kezelne, előbb frissítjük ezt a tájékoztatót, és újra kérjük a hozzájárulásodat."),
      h("Korhatár"),
      para("Az appot csak 18. életévüket betöltött személyek használhatják."),
      h("Felhasználási feltételek"),
      el("p", {}, "Az app használatának szabályairól és a felelősség kizárásáról a ",
        el("button", { type: "button", class: "link-in", onclick: () => openSheet({ type: "terms", back: { type: "privacy" } }) }, "Felhasználási feltételek"),
        " szólnak."));
  }
  // A Felhasználási feltételek lap szövege (a FEJLESZTES.md-ben rögzített szöveg; a nevet és az elérhetőséget a config.js adja).
  function termsContent() {
    const p = privacyInfo();
    const h = (t) => el("h3", { class: "cond", text: t });
    const para = (t) => el("p", { text: t });
    return el("div", { class: "privacy terms" },
      el("p", { class: "muted small", text: "Utolsó módosítás: " + TERMS_DATE }),
      h("1. Az app és az üzemeltető"),
      para("A Másnapló egy baráti társaság saját, ingyenes, nem kereskedelmi alkalmazása, amely a felhasználók által beírt adatok alapján nyilvántartja és megjeleníti az italfogyasztást. Az app fejlesztője, tulajdonosa és üzemeltetője: " + p.controller + " (a továbbiakban: üzemeltető). Elérhetőség: " + p.contact + ". Az app használatáért az üzemeltető semmilyen díjat vagy más ellenszolgáltatást nem kér és nem kap."),
      h("2. Ki használhatja?"),
      para("Az appot csak 18. életévét betöltött személy használhatja. A regisztrációval, illetve a feltételek elfogadásával kijelented, hogy elmúltál 18 éves, és ezeket a feltételeket elfogadod. Ha nem fogadod el őket, ne használd az appot; a fiókodat bármikor törölheted."),
      h("3. Felelős alkoholfogyasztás"),
      para("Az app nem ösztönöz alkoholfogyasztásra. A pontok, a verseny, a rangsorok és az ivós játékok kizárólag szórakoztató jellegűek, nem célok és nem elvárások. Mindenki maga dönt arról, iszik-e és mennyit, és maga felel a saját egészségéért, biztonságáért és magatartásáért. Ittasan ne vezess, és ne végezz olyan tevékenységet, amelyhez józanság kell. Senkit ne biztass és ne kényszeríts ivásra. Ha úgy érzed, hogy az alkoholfogyasztásod gondot okoz, fordulj orvoshoz vagy más szakemberhez."),
      h("4. Az app nem orvosi és nem mérőeszköz"),
      para("Az appban megjelenő mennyiségek (például egy rövid 4 cl, egy sör 5 dl) becslések, a felhasználók által beírt adatokon alapulnak, és eltérhetnek a valóságtól. Az app nem méri és nem becsüli a véralkoholszintet, nem nyújt orvosi tanácsot, és nem alkalmas annak megítélésére, hogy valaki vezethet-e, dolgozhat-e, vagy hogy egészségügyi szempontból mennyi alkohol biztonságos számára."),
      h("5. Ivós játékok és a felhasználók által beírt tartalom"),
      para("Az ivós játékokat a felhasználók maguk írják; az üzemeltető ezeket nem ellenőrzi, nem ajánlja és nem vállal értük felelősséget. Minden játékot mindenki a saját felelősségére játszik; tartsátok be a jogszabályokat és a helyszín szabályait, és vegyétek figyelembe egymás egészségét és határait. Mindenki maga felel azért, amit az appba beír (italok, nevek, szavazatok, játékok, kocsmák és chat-üzenetek). Tilos jogsértő, mások jogait vagy jó hírnevét sértő, illetve bántó tartalmat beírni. Az üzemeltető az ilyen tartalmat eltávolíthatja, a fiókot letilthatja."),
      h("6. Az app „ahogy van” működik"),
      para("Az app egy baráti társaság szabadidős, ingyenes fejlesztése. Az üzemeltető nem vállal kötelezettséget és nem ad garanciát arra, hogy az app hibátlanul vagy megszakítás nélkül működik, hogy az adatok pontosak, teljesek vagy mindig elérhetők, illetve hogy nem vesznek el. Az üzemeltető az appot bármikor módosíthatja, szüneteltetheti vagy megszüntetheti. Az app külső szolgáltatásokat használ (Google Firebase, GitHub); ezek működéséért az üzemeltető nem felel."),
      h("7. A felelősség kizárása"),
      para("Az appot mindenki a saját felelősségére használja. Az üzemeltető a jogszabályok által megengedett legteljesebb mértékben kizárja a felelősségét minden olyan kárért, ideértve különösen a vagyoni kárt, az elmaradt hasznot, az adatvesztést, a nem vagyoni sérelmet és a személyi sérülést is, amely"),
      el("ul", { class: "dash" },
        el("li", { text: "az app használatából vagy a használat lehetetlenségéből," }),
        el("li", { text: "az appban megjelenő adatokra, számokra vagy tartalmakra való hagyatkozásból," }),
        el("li", { text: "az alkoholfogyasztásból, az ivós játékokból, illetve a felhasználók egymás közötti vagy az appon kívüli magatartásából, vagy" }),
        el("li", { text: "a külső szolgáltatások hibájából vagy kieséséből" })),
      para("ered."),
      para("Ez a kizárás nem vonatkozik azokra az esetekre, amelyekben a felelősség kizárását vagy korlátozását jogszabály tiltja, így különösen a szándékosan okozott kárra, valamint az emberi életet, testi épséget vagy egészséget megkárosító kárra; ezekben az esetekben az üzemeltető a jogszabályok szerint felel."),
      h("8. A felhasználó felelőssége"),
      para("A felhasználó felel azért a kárért, amelyet e feltételek megszegésével, illetve jogsértő tartalom beírásával vagy jogsértő magatartással másoknak vagy az üzemeltetőnek okoz."),
      h("9. Módosítás"),
      para("Az üzemeltető ezeket a feltételeket módosíthatja. Lényeges módosítás esetén az app a következő megnyitáskor megmutatja az új feltételeket, és a további használathoz újra el kell fogadni őket."),
      h("10. Egyéb rendelkezések"),
      el("p", {}, "Ezekre a feltételekre a magyar jog az irányadó. Ha valamelyik rendelkezésük érvénytelen vagy végrehajthatatlan, az a többi rendelkezés érvényességét nem érinti; az érvénytelen rendelkezés helyett a jogszabályok által megengedett, ahhoz legközelebb álló szabályt kell alkalmazni. Az adataid kezeléséről az ",
        el("button", { type: "button", class: "link-in", onclick: () => openSheet({ type: "privacy", back: { type: "terms" } }) }, "Adatkezelési tájékoztató"),
        " szól."));
  }
  function pickView() {
    const sec = el("section", { class: "onboard" });
    sec.append(el("h2", { class: "hero cond", text: "Még egy lépés" }));
    sec.append(el("p", { class: "lead", text: "A fiókod megvan, már csak egy egyedi felhasználónév hiányzik." }));
    if (S.pickMsg) sec.append(el("p", { class: "note", text: S.pickMsg }));
    const msg = el("p", { class: "msg", role: "status" });
    const user = el("input", { id: "pickUser", class: "field big", type: "text", maxlength: 20, autocomplete: "username",
      autocapitalize: "none", spellcheck: "false", enterkeyhint: "go", placeholder: "pl. zsombi" });
    const btn = el("button", { type: "button", class: "btn big wide" }, "Mentés");
    btn.addEventListener("click", () => doPickname(user.value, msg, btn));
    user.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doPickname(user.value, msg, btn); } });
    sec.append(el("div", { class: "stack" },
      el("label", { class: "lbl", for: "pickUser", text: "Felhasználónév" }), user,
      el("p", { class: "hint", text: USERNAME_HINT }), btn), msg,
      el("button", { type: "button", class: "link-btn", onclick: logout }, "Kijelentkezés"));
    return sec;
  }

  /* ---------- tulajdonosi menü ---------- */
  function ownerUnlocked() { return S.isOwner && S.ownerUntil > Date.now(); }
  function ownerStatsDay() {
    const t = (S.partyMeta && S.partyMeta.createdAt) || guessStart();
    return dayKey(t);
  }
  function ownerErrorText(e) {
    const c = errCode(e);
    if (c === "permission-denied") return "A szerver nem engedte. Lehet, hogy lejárt a feloldás, vagy a tulajdonosi azonosító nincs beírva a Firestore szabályokba.";
    if (c === "app/taken") return "Ez a felhasználónév már foglalt.";
    if (c === "app/no-player") return "Ez a résztvevő már nincs a buliban.";
    if (c === "aborted" || c === "failed-precondition") return "Közben változtak az adatok. Próbáld újra.";
    return authErrorText(e);
  }
  async function ownerAction(fn, okText, after) {
    if (!ownerUnlocked()) { S.ownerUntil = 0; toast("Lejárt a feloldás. Add meg újra a jelszavadat."); openSheet({ type: "owner" }); return false; }
    if (navigator.onLine === false) { toast("Ehhez internet kell."); return false; }
    try {
      await fn();
      if (okText) toast(okText);
      if (after) after();
      return true;
    } catch (e) {
      console.error(e);
      if (errCode(e) === "permission-denied") S.ownerUntil = 0;
      toast(ownerErrorText(e));
      return false;
    }
  }
  async function doOwnerUnlock(pw, msg, btn) {
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    if (!pw) { say("Add meg a jelszavadat.", true); return; }
    btn.disabled = true;
    say("Ellenőrzés…");
    try {
      await S.backend.ownerUnlock(pw);
      S.ownerUntil = Date.now() + OWNER_WINDOW_MS;
      openSheet({ type: "owner" });
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      const c = errCode(e);
      say(["auth/invalid-credential", "auth/wrong-password", "auth/invalid-login-credentials"].includes(c) ? "Hibás jelszó." : authErrorText(e), true);
    }
  }
  function ownerBump(uid, cid, name, delta) {
    if (!S.party) return;
    const party = S.party;
    ownerAction(() => S.backend.adminEditPlayer(party, uid, [{ type: "bump", cid, name, delta }], ownerStatsDay(),
      displayName(uid, S.docs.get(uid)) + ": " + name + " " + (delta > 0 ? "+1" : "−1")));
  }
  function ownerLogText(e) {
    const who = e.target ? displayName(e.target, S.docs.get(e.target)) : "";
    const names = { rename: "Átnevezés", ban: "Letiltás", unban: "Letiltás feloldása", wipe: "Adatok törlése", edit: "Számláló javítása",
      reset: "Számlálók nullázása", clearvotes: "Szavazatok törlése", deleteparty: "Buli törlése",
      kdelete: "Kocsma törlése", kmsg: "Üzenet törlése", kkick: "Kocsmatag eltávolítása" };
    const parts = [names[e.action] || e.action];
    if (e.detail) parts.push(e.detail); else if (who) parts.push(who);
    if (e.party) parts.push("(" + e.party + ")");
    return parts.join(": ").replace(": (", " (");
  }
  function ownerBody() {
    const wrap = el("div", { class: "settings" });
    const missing = privacyMissingText();
    if (missing) wrap.append(el("p", { class: "note warn", text: missing }));
    if (!ownerUnlocked()) {
      const pw = el("input", { id: "ownerPw", class: "field", type: "password", maxlength: 128, autocomplete: "current-password", enterkeyhint: "done" });
      const msg = el("p", { class: "msg", role: "status" });
      const btn = el("button", { type: "button", class: "btn wide" }, "Feloldás");
      btn.addEventListener("click", () => doOwnerUnlock(pw.value, msg, btn));
      pw.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doOwnerUnlock(pw.value, msg, btn); } });
      wrap.append(
        el("p", { text: "A tulajdonosi műveletekhez add meg újra a jelszavadat. A feloldás kb. 15 percig érvényes, utána a szerver újra kéri." }),
        el("label", { class: "lbl", for: "ownerPw", text: "Jelszó" }), pw, btn, msg);
      return wrap;
    }
    const mins = Math.max(1, Math.round((S.ownerUntil - Date.now()) / 60000));
    wrap.append(el("p", { class: "note", text: "Feloldva még kb. " + mins + " percig. Minden tulajdonosi művelet bekerül a naplóba." }));

    wrap.append(el("h3", { class: "settings-sub cond first", text: "Felhasználók" }));
    const users = [...S.stats.entries()].filter(([, st]) => st.username)
      .sort((a, b) => a[1].username.localeCompare(b[1].username, "hu", { sensitivity: "base" }));
    if (!users.length) wrap.append(el("p", { class: "muted", text: "Még nincs felhasználó." }));
    const ul = el("ul", { class: "owner-users" });
    for (const [uid, st] of users) {
      const flags = [];
      if (uid === S.myId) flags.push("te");
      if (S.bans.has(uid)) flags.push("letiltva");
      if (S.docs.has(uid)) flags.push("ezen a bulin");
      ul.append(el("li", {}, el("button", { type: "button", class: "owner-user", onclick: () => openSheet({ type: "ownerUser", uid }) },
        el("span", { class: "dot", style: "background:" + colorFor(uid), "aria-hidden": "true" }),
        el("span", { class: "ou-name", text: st.username }),
        flags.length ? el("span", { class: "ou-flags" + (S.bans.has(uid) ? " bad" : ""), text: flags.join(", ") }) : null)));
    }
    wrap.append(ul);

    if (S.party && S.phase === "ready") {
      const party = S.party;
      const title = partyName(party);
      wrap.append(el("h3", { class: "settings-sub cond", text: "Ez a buli" }),
        el("p", { class: "muted", text: "Egy ember számlálóját a buliban a nevére, majd a kategóriájára koppintva javíthatod, amíg a tulajdonosi mód fel van oldva." }),
        el("button", { type: "button", class: "btn danger wide",
          onclick: () => confirmSheet("A(z) „" + title + "” buli minden adata (minden résztvevő buli-összesítése, a szavazatok és a buli neve) véglegesen törlődik. A résztvevők napi naplója és statisztikája megmarad, a napjaik csak már nem tartoznak ehhez a bulihoz.", "Törlöm a bulit",
            () => ownerAction(() => S.backend.adminDeleteParty(party, title), "A buli törölve.", () => { forgetParty(party); closeSheet(); backToToday(); })) },
          "A buli törlése"));
    }

    wrap.append(el("h3", { class: "settings-sub cond", text: "Kocsmák" }),
      el("button", { type: "button", class: "btn secondary wide", onclick: () => openSheet({ type: "ownerKocsmak", back: { type: "owner" } }) }, "Kocsmák kezelése"));

    wrap.append(el("h3", { class: "settings-sub cond", text: "Napló" }));
    const logBox = el("div", { class: "owner-log" }, el("p", { class: "muted", text: "Betöltés…" }));
    wrap.append(logBox);
    if (typeof S.backend.adminLog === "function") {
      S.backend.adminLog(20).then((rows) => {
        logBox.replaceChildren();
        if (!rows.length) { logBox.append(el("p", { class: "muted", text: "Még nincs bejegyzés." })); return; }
        const list = el("ol", { class: "feed" });
        for (const r of rows) {
          let when = "";
          try { when = new Date(r.at).toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) {}
          list.append(el("li", {}, el("span", { text: ownerLogText(r) }), el("span", { class: "f-when", text: when })));
        }
        logBox.append(list);
      }).catch(() => { logBox.replaceChildren(el("p", { class: "muted", text: "A napló nem tölthető be." })); });
    }
    return wrap;
  }
  function ownerUserBody(uid) {
    const wrap = el("div", { class: "settings" });
    const st = S.stats.get(uid) || {};
    const name = st.username || displayName(uid, S.docs.get(uid));
    const self = uid === S.myId;
    const banned = S.bans.has(uid);
    if (!ownerUnlocked()) {
      wrap.append(el("p", { text: "Lejárt a feloldás." }),
        el("button", { type: "button", class: "btn wide", onclick: () => openSheet({ type: "owner" }) }, "Feloldás"));
      return wrap;
    }
    const copyBtn = el("button", { type: "button", class: "btn secondary" }, "Másolás");
    copyBtn.addEventListener("click", async () => { try { await navigator.clipboard.writeText(uid); toast("Fiókazonosító kimásolva."); } catch (e) { toast(uid); } });
    wrap.append(el("p", { class: "muted" }, "Fiókazonosító: ", el("span", { class: "code", text: uid })), copyBtn,
      el("p", { class: banned ? "vote-result bad" : "muted", text: banned ? "Ez a fiók le van tiltva." : "A fiók aktív." }));

    const input = el("input", { id: "ownerRename", class: "field", type: "text", maxlength: 20, autocomplete: "off",
      autocapitalize: "none", spellcheck: "false", enterkeyhint: "done" });
    input.value = name;
    const rbtn = el("button", { type: "button", class: "btn" }, "Mentés");
    const doRename = () => {
      const username = input.value.trim();
      if (!USERNAME_RE.test(username)) { toast("A felhasználónév: " + USERNAME_HINT); return; }
      if (username === name) return;
      const oldKey = st.username ? st.username.toLowerCase() : null;
      ownerAction(() => S.backend.adminRename(uid, username, username.toLowerCase(), oldKey), "Átnevezve: " + username, () => {
        if (self) { S.username = username; S.usernameKey = username.toLowerCase(); checkMyParty(); }
        openSheet({ type: "ownerUser", uid });
      });
    };
    rbtn.addEventListener("click", doRename);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doRename(); } });
    wrap.append(el("div", {}, el("label", { class: "lbl", for: "ownerRename", text: "Felhasználónév átírása" }), el("div", { class: "add-inline" }, input, rbtn)));

    if (S.party && S.phase === "ready" && S.docs.has(uid)) {
      const party = S.party;
      wrap.append(el("h3", { class: "settings-sub cond", text: "Ezen a bulin" }),
        el("button", { type: "button", class: "btn secondary wide",
          onclick: () => confirmSheet(name + " összes számlálója nullára áll ezen a bulin (a buliba tartozó napjain is), és a statisztikájából is levonódik.", "Nullázom",
            () => ownerAction(() => S.backend.adminEditPlayer(party, uid, [{ type: "reset" }], ownerStatsDay(), name), "Nullázva.", () => openSheet({ type: "ownerUser", uid }))) },
          "Számlálóinak nullázása"),
        el("button", { type: "button", class: "btn secondary wide",
          onclick: () => confirmSheet("Minden róla szóló hányás-szavazat törlődik ezen a bulin.", "Törlöm",
            () => ownerAction(() => S.backend.adminClearVotesAbout(party, uid, name), "A szavazatok törölve.", () => openSheet({ type: "ownerUser", uid }))) },
          "A róla szóló hányás-szavazatok törlése"));
    }

    if (!self) {
      wrap.append(el("h3", { class: "settings-sub cond", text: "Fiók" }),
        el("button", { type: "button", class: "btn secondary wide",
          onclick: () => confirmSheet(banned ? name + " újra használhatja az appot." : name + " ezután semmit nem lát és nem írhat az appban, de a saját fiókját törölheti.",
            banned ? "Feloldom" : "Letiltom",
            () => ownerAction(() => S.backend.adminBan(uid, !banned, name), banned ? "A letiltás feloldva." : "Letiltva.", () => {
              if (banned) S.bans.delete(uid); else S.bans.add(uid);
              openSheet({ type: "ownerUser", uid });
            })) },
          banned ? "Letiltás feloldása" : "Letiltás"),
        el("button", { type: "button", class: "btn danger wide",
          onclick: () => confirmSheet(name + " profilja, felhasználóneve, statisztikája, napi naplója, ivós játékai, számlálói és szavazatai minden ismert buliból, chat-üzenetei, barátságai és barátkérései véglegesen törlődnek, és kikerül a kocsmáiból (ahol alapító, ott a legrégebbi tag kapja meg a kocsmát). Ha nem szeretnéd, hogy újra regisztráljon ezzel a fiókkal, előbb tiltsd le.", "Törlöm",
            () => ownerAction(() => S.backend.adminWipe(uid, [...new Set([...loadParties().map(p => p.code), ...(S.party ? [S.party] : [])])], name), "Az adatai törölve.", () => openSheet({ type: "owner" }))) },
          "Összes adatának törlése"),
        el("p", { class: "muted small", text: "A belépési rekordot (a Firebase-fiókot) csak a Firebase konzolban lehet törölni: Authentication, Users, majd keresd meg a fenti fiókazonosítót." }));
    }
    return wrap;
  }
  function bannedView() {
    return el("section", { class: "onboard" },
      el("h2", { class: "hero cond", text: "Letiltva" }),
      el("p", { class: "lead", text: "Az app tulajdonosa letiltotta a fiókodat, ezért most nem használhatod az appot. Ha szerinted ez tévedés, keresd az adatkezelőt." }),
      el("p", { class: "muted", text: "Adatkezelő: " + privacyInfo().controller + ". Elérhetőség: " + privacyInfo().contact + "." }),
      el("button", { type: "button", class: "link-btn", onclick: () => openSheet({ type: "terms" }) }, "Felhasználási feltételek"),
      el("button", { type: "button", class: "link-btn", onclick: () => openSheet({ type: "privacy" }) }, "Adatkezelési tájékoztató"),
      el("button", { type: "button", class: "link-btn", onclick: () => openSheet({ type: "delete" }) }, "Fiókom törlése"),
      el("button", { type: "button", class: "link-btn", onclick: logout }, "Kijelentkezés"));
  }

  function emailSettings() {
    const box = el("div", { class: "stack" });
    if (S.emailReal) {
      box.append(el("p", {}, "E-mail-cím: ", el("strong", { class: "code", text: S.email })),
        el("p", { class: "muted small", text: (S.emailVerified ? "Megerősítve. " : "Még nincs megerősítve. ") + "Ezzel lépsz be, és erre kérhetsz új jelszót. Senki más nem látja." }));
      if (!S.emailVerified) {
        const rb = el("button", { type: "button", class: "btn secondary wide" }, "Megerősítő levél újraküldése");
        rb.addEventListener("click", () => doResend(rb));
        box.append(rb);
      }
      return box;
    }
    const pending = lsGet("strigula-pending-email");
    const em = el("input", { id: "setEmail", class: "field", type: "email", maxlength: 120, autocomplete: "email",
      autocapitalize: "none", spellcheck: "false", placeholder: "pl. nev@gmail.com" });
    const pw = el("input", { id: "setEmailPw", class: "field", type: "password", maxlength: 128, autocomplete: "current-password" });
    const msg = el("p", { class: "msg", role: "status" });
    const btn = el("button", { type: "button", class: "btn wide" }, "E-mail-cím hozzáadása");
    btn.addEventListener("click", () => doAddEmail(em.value, pw.value, msg, btn));
    if (pending) box.append(el("p", { class: "note", text: "Megerősítésre vár: " + pending + ". Kattints a levélben lévő linkre, utána ezzel az e-mail-címmel lépj be." }));
    box.append(
      el("label", { class: "lbl", for: "setEmail", text: "E-mail-cím hozzáadása (nem kötelező)" }), em,
      el("p", { class: "hint", text: "Csak az elfelejtett jelszó visszaállításához kell, senki más nem látja. Ha megadod, utána a belépésnél ezt használd." }),
      el("label", { class: "lbl", for: "setEmailPw", text: "A jelszavad a megerősítéshez" }), pw, btn, msg);
    return box;
  }

  /* ---------- értesítés ---------- */
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

  /* ---------- telepítés, offline héj ---------- */
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    S.installPrompt = e;
    if (S.phase === "ready") renderAll();
  });
  window.addEventListener("appinstalled", () => { S.installPrompt = null; if (S.phase === "ready") renderAll(); });
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }

  /* ---------- indulás ---------- */
  const bootTimer = setTimeout(() => { if (!S.started) { S.phase = "bootfail"; renderAll(); } }, 20000);
  window.strigulaStart = async function (backend, problem) {
    if (S.started) return;
    S.started = true;
    clearTimeout(bootTimer);
    if (!backend) { S.phase = problem || "error"; renderAll(); return; }
    S.backend = backend;
    S.myId = backend.uid;
    S.email = backend.email || "";
    S.emailReal = !!backend.emailIsReal;
    S.emailVerified = !!backend.emailVerified;
    if (S.emailReal) lsSet("strigula-pending-email", null);
    S.isOwner = !backend.isAnonymous && !!OWNER_UID && backend.uid === OWNER_UID;
    if (!backend.isAnonymous && typeof backend.isBanned === "function") {
      try { if (await backend.isBanned()) { S.phase = "banned"; renderAll(); return; } } catch (e) {}
    }
    if (backend.isAnonymous) {
      S.phase = "auth";
      renderAll();
      let legacy = false;
      try { legacy = typeof backend.hasLegacyData === "function" ? !!(await backend.hasLegacyData()) : false; } catch (e) {}
      if (!legacy) legacy = loadParties().length > 0;
      if (legacy && S.phase === "auth") {
        S.legacy = true;
        $("#main").dataset.screen = "";
        renderAll();
      }
      return;
    }
    let prof = null;
    try { prof = await backend.getMyProfile(); }
    catch (e) {
      console.error(e);
      S.phase = errCode(e) === "permission-denied" ? "rulesold" : "offline";
      renderAll();
      return;
    }
    const u = prof && typeof prof.username === "string" ? prof.username : "";
    if (!USERNAME_RE.test(u)) { S.phase = "pickname"; renderAll(); return; }
    S.username = u;
    S.usernameKey = typeof prof.usernameKey === "string" && prof.usernameKey ? prof.usernameKey : u.toLowerCase();
    let consentOk = false;
    if (typeof backend.getPrivate === "function") {
      try {
        const priv = await backend.getPrivate();
        consentOk = consentValid(priv && priv.consent);
        S.privParties = priv && priv.parties && typeof priv.parties === "object" ? priv.parties : null;
        S.migrated = priv && Number(priv.migrated) > 0 ? Number(priv.migrated) : 0;
        if (priv && priv.kocsmak && typeof priv.kocsmak === "object") {
          S.privK = {};
          for (const [kid, at] of Object.entries(priv.kocsmak)) if (KID_RE.test(kid)) S.privK[kid] = num(at) || 1;
        }
        S.prefs = sanitizePrefs(priv && priv.drinks);
      } catch (e) {
        console.error(e);
        if (errCode(e) === "permission-denied") { S.phase = "rulesold"; renderAll(); return; }
      }
    } else consentOk = true;
    if (!consentOk) { S.phase = "consent"; renderAll(); return; }
    startData();
  };
  // Félpercenként: frissülnek az „x perce” feliratok, és reggel 6-kor átvált a „Ma”.
  setInterval(() => {
    if (S.phase !== "ready" || document.hidden) return;
    if (!S.migrationDone && !S.migrating) runMigration();
    renderAll();
  }, 30000);
  renderAll();
  if (window.strigulaPending) window.strigulaStart(window.strigulaPending[0], window.strigulaPending[1]);
})();
