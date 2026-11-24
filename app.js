/* Másnapló – „Ami tegnap még jó ötletnek tűnt”.
   A felület és a logika. Az adatbázist és a fiókokat a backend.js adja. */
(() => {
  "use strict";

  /* ---------- alapbeállítások ---------- */
  const CATS = [
    { id: "shot", name: "Rövid", emoji: "🥃", ml: 40, pts: 5, quick: "Egyéb", placeholder: "pl. Becherovka",
      defaults: ["Jägermeister", "Unicum", "Pálinka", "Tequila", "Vodka", "Rum", "Whisky", "Gin", "Egyéb"] },
    { id: "wine", name: "Bor", emoji: "🍷", ml: 100, pts: 3, quick: "Egyéb", placeholder: "pl. Tokaji",
      defaults: ["Fehér", "Vörös", "Rozé", "Fröccs", "Pezsgő", "Egyéb"] },
    { id: "beer", name: "Sör", emoji: "🍺", ml: 500, pts: 2, quick: "Egyéb", placeholder: "pl. Cider",
      defaults: ["Világos", "Barna", "Búza", "IPA", "Egyéb"] },
    { id: "water", name: "Víz, üdítő", emoji: "💧", ml: 300, pts: 0.25, quick: "Víz", placeholder: "pl. Kóla", quiet: true,
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
  const CONSENT_V = "2026-11-24";
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
  // Egy „buli-nap” hajnali 6-tól másnap hajnali 6-ig tart.
  function dayKey(ts) {
    const d = new Date(ts - DAY_START_HOUR * 3600 * 1000);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function thisYear() { return dayKey(Date.now()).slice(0, 4); }
  function dayLabel(key) {
    const p = key.split("-").map(Number);
    try { return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }); }
    catch (e) { return key.slice(5); }
  }
  function passwordChecks(p) {
    const s = String(p || "");
    return { len: s.length >= 8, lower: /\p{Ll}/u.test(s), upper: /\p{Lu}/u.test(s), digit: /\p{Nd}/u.test(s) };
  }
  function passwordOk(p) { const c = passwordChecks(p); return c.len && c.lower && c.upper && c.digit; }

  /* ---------- állapot ---------- */
  const S = {
    phase: "boot", // boot | auth | pickname | consent | loading | join | ready | error | noconfig | authoff | offline | bootfail | rulesold
    started: false, backend: null, myId: null,
    username: "", usernameKey: "", legacy: false, authMode: "signup", pickMsg: "",
    email: "", emailReal: false, emailVerified: false,
    party: null, unsub: null, metaUnsub: null, votesUnsub: null,
    docs: new Map(), votes: new Map(), myDoc: null, partyMeta: null,
    stale: false, errorCode: "", readOnly: false, votesError: false,
    view: "me", sheet: null, drawerOpen: false, fresh: null,
    writeTimer: null, pending: 0,
    stats: new Map(), statsDelta: { years: {}, days: {} }, statsTimer: null, statsError: false,
    onboardNew: false, installPrompt: null,
    units: lsGet("strigula-units") === "imperial" ? "imperial" : "metric",
    chartTip: null, chartScroll: {},
  };

  /* ---------- buli kódok és a Bulijaim lista (ezen a telefonon) ---------- */
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
  function cleanPartyName(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, PARTY_NAME_MAX); }
  function defaultPartyName() { return "Buli, " + fmtDate(Date.now()); }
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
    Object.assign(p, patch || {});
    list.sort((a, b) => b.at - a.at);
    saveParties(list);
  }
  function forgetParty(code) { saveParties(loadParties().filter(p => p.code !== code)); }
  function partyTitle() {
    if (S.partyMeta && S.partyMeta.name) return S.partyMeta.name;
    const saved = loadParties().find(p => p.code === S.party);
    return (saved && saved.name) || S.party || "";
  }
  function partyHintText() { return S.partyMeta && S.partyMeta.name ? "Buli: " + S.partyMeta.name : ""; }
  function inviteUrl() {
    const u = new URL(location.href);
    u.search = "";
    u.hash = "";
    u.searchParams.set("buli", S.party);
    return u.toString();
  }

  /* ---------- adatmodell: egy ember egy bulin ---------- */
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
  function catMl(doc, cat) { return catTotal(doc, cat) * cat.ml; }
  function alcoholTotal(doc) { return CATS.filter(c => !c.quiet).reduce((s, c) => s + catTotal(doc, c), 0); }
  function alcoholMl(doc) { return CATS.filter(c => !c.quiet).reduce((s, c) => s + catMl(doc, c), 0); }
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
  function displayName(id, doc) {
    if (id === S.myId && S.username) return S.username;
    const st = S.stats.get(id);
    return (st && st.username) || (doc && doc.name) || "Névtelen";
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
      for (const [k, v] of Object.entries(d.days)) if (/^\d{4}-\d{2}-\d{2}$/.test(k)) days[k] = cleanCounts(v);
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
  function statsAdd(cid, delta) {
    const dk = dayKey(Date.now());
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
  function castVote(subject, value) {
    if (!S.party || !S.backend || subject === S.myId || typeof S.backend.setVote !== "function") return;
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
    if (!S.party || !S.backend || subject === S.myId || typeof S.backend.setVoteCount !== "function") return;
    n = Math.max(1, Math.min(50, Math.floor(n) || 1));
    const on = Object.assign({}, S.votes.get(S.myId) || {});
    on[subject] = Object.assign({}, on[subject] || {}, { n });
    S.votes.set(S.myId, on);
    renderAll();
    Promise.resolve().then(() => S.backend.setVoteCount(S.party, subject, n)).catch(onVoteError);
  }

  /* ---------- mentés (mindig csak a saját dokumentum) ---------- */
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

  /* ---------- italok ---------- */
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
    toast("Nulláztad a saját számlálóidat ezen a bulin.");
  }
  async function invite() {
    if (!S.party) return;
    const url = inviteUrl();
    if (navigator.share) {
      try { await navigator.share({ title: "Másnapló", text: "Gyere a buliba! A kód: " + S.party, url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); toast("Link kimásolva, küldd el a barátaidnak."); }
    catch (e) { toast("A meghívó link: " + url); }
  }

  /* ---------- bulik ---------- */
  function goJoin() {
    S.phase = "join";
    $("#main").dataset.screen = "";
  }
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
    S.chartTip = null;
    lsSet("strigula-party", party);
    try {
      const u = new URL(location.href);
      if (party) u.searchParams.set("buli", party); else u.searchParams.delete("buli");
      history.replaceState(null, "", u.toString());
    } catch (e) {}
    if (party) {
      rememberParty(party, { at: Date.now() });
      subscribe();
      watchMeta();
      watchVotes();
    }
  }
  function watchMeta() {
    const party = S.party;
    if (!party || typeof S.backend.watchParty !== "function") return;
    try {
      S.metaUnsub = S.backend.watchParty(party, (data) => {
        if (S.party !== party) return;
        const name = data ? cleanPartyName(data.name) : "";
        S.partyMeta = name ? { name, createdAt: num(data.createdAt) } : null;
        if (S.partyMeta) rememberParty(party, { name, created: S.partyMeta.createdAt });
        const hint = document.getElementById("partyHint");
        if (hint) hint.textContent = partyHintText();
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
    return Number.isFinite(t) ? t : Date.now();
  }
  function savePartyName(raw) {
    const name = cleanPartyName(raw);
    if (!name || !S.party) return false;
    const party = S.party;
    const now = Date.now();
    const createdAt = (S.partyMeta && S.partyMeta.createdAt) || guessStart();
    S.partyMeta = { name, createdAt };
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
    closeDrawer();
    if (!code || code === S.party) return;
    flushAll();
    S.myDoc = null;
    S.readOnly = false;
    S.view = "me";
    S.phase = "loading";
    setParty(code);
    renderAll();
    window.scrollTo(0, 0);
  }
  function switchParty(fresh) {
    closeSheet();
    closeDrawer();
    flushAll();
    S.myDoc = null;
    S.readOnly = false;
    setParty(null);
    S.onboardNew = !!fresh;
    goJoin();
    renderAll();
    window.scrollTo(0, 0);
  }
  function leaveParty() {
    if (!S.myDoc || !S.party) return;
    const party = S.party;
    clearTimeout(S.writeTimer);
    S.writeTimer = null;
    S.myDoc = null;
    S.backend.deletePlayer(party, S.myId).catch(() => toast("Nem sikerült törölni. Nézd meg a netet, és próbáld újra."));
    forgetParty(party);
    goJoin();
    renderAll();
    toast("Kiléptél ebből a buliból.");
  }
  function syncMyName() {
    if (!S.myDoc || !S.username || S.readOnly || S.myDoc.name === S.username) return;
    S.myDoc.name = S.username;
    S.myDoc.updatedAt = Date.now();
    scheduleWrite();
  }
  async function join(rawCode, rawPartyName, msg, btn) {
    const party = cleanParty(rawCode);
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    if (!party) { say("A buli kódja legalább 3 betű vagy szám legyen.", true); return; }
    btn.disabled = true;
    say("Csatlakozás…");
    if (party !== S.party) setParty(party);
    let existing = null;
    try { existing = await S.backend.getPlayer(party, S.myId); }
    catch (e) {
      btn.disabled = false;
      say(errCode(e) === "permission-denied" ? RULES_MSG : "Nem érem el a szervert. Nézd meg a netet, és próbáld újra.", true);
      return;
    }
    if (S.party !== party) return;
    if (rawPartyName != null) {
      const pn = cleanPartyName(rawPartyName) || defaultPartyName();
      let meta;
      try { meta = typeof S.backend.getPartyMeta === "function" ? await S.backend.getPartyMeta(party) : undefined; }
      catch (e) { meta = undefined; }
      if (S.party !== party) return;
      if (meta === null) {
        const now = Date.now();
        S.partyMeta = { name: pn, createdAt: now };
        rememberParty(party, { name: pn, created: now });
        S.backend.setPartyMeta(party, { name: pn, createdAt: now, updatedAt: now }).catch(() => {});
      } else if (meta === undefined) {
        rememberParty(party, { name: pn });
      }
    }
    S.onboardNew = false;
    rememberParty(party, { at: Date.now() });
    recordParties([party]);
    const doc = sanitize(existing || {});
    doc.name = S.username;
    doc.updatedAt = Date.now();
    S.myDoc = doc;
    S.readOnly = false;
    flush();
    S.phase = "ready";
    S.view = "me";
    renderAll();
    window.scrollTo(0, 0);
  }

  /* ---------- fiók ---------- */
  function restart(ms) { setTimeout(() => { try { location.reload(); } catch (e) {} }, ms || 60); }
  function consentRecord() { return { v: CONSENT_V, at: Date.now(), adult: true, health: true }; }
  function privacyInfo() {
    const p = window.MASNAPLO_PRIVACY || {};
    const ok = (v) => typeof v === "string" && v.trim() && !/IDE_/.test(v);
    return { controller: ok(p.controller) ? p.controller.trim() : "nincs megadva", contact: ok(p.contact) ? p.contact.trim() : "nincs megadva" };
  }
  function recordParties(codes) {
    if (!S.backend || typeof S.backend.recordParties !== "function") return;
    Promise.resolve().then(() => S.backend.recordParties(codes)).catch(() => {});
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
  async function doSignup(rawUser, rawEmail, p1, p2, adult, agree, msg, btn) {
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    const username = String(rawUser || "").trim();
    const email = String(rawEmail || "").trim();
    if (!USERNAME_RE.test(username)) { say("A felhasználónév: " + USERNAME_HINT, true); return; }
    if (email && !EMAIL_RE.test(email)) { say("Az e-mail-cím nem tűnik érvényesnek. Ha nem szeretnél megadni, hagyd üresen.", true); return; }
    if (!passwordOk(p1)) { say("A jelszó nem felel meg a feltételeknek.", true); return; }
    if (p1 !== p2) { say("A két jelszó nem egyezik.", true); return; }
    if (!adult) { say("Az appot csak 18 éven felüliek használhatják.", true); return; }
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
  function doConsent(adult, agree, msg) {
    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };
    if (!adult) { say("Az appot csak 18 éven felüliek használhatják.", true); return; }
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
    clearTimeout(S.writeTimer);
    S.writeTimer = null;
    clearTimeout(S.statsTimer);
    S.statsTimer = null;
    S.statsDelta = { years: {}, days: {} };
    const codes = new Set(loadParties().map(p => p.code));
    if (S.party) codes.add(S.party);
    try {
      await S.backend.deleteAccount(pw, [...codes]);
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      const c = errCode(e);
      if (["auth/invalid-credential", "auth/wrong-password", "auth/invalid-login-credentials"].includes(c)) say("Hibás jelszó.", true);
      else if (c === "auth/admin-restricted-operation" || c === "auth/operation-not-allowed") say("A Firebase-ben ki van kapcsolva a fióktörlés (Authentication, Settings, User actions).", true);
      else say(authErrorText(e), true);
      return;
    }
    for (const k of ["strigula-party", "strigula-parties", "strigula-units", "strigula-install-hidden", "strigula-pending-email", "strigula-id", "strigula-name"]) lsSet(k, null);
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
      syncMyName();
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
    try { await S.backend.signOut(); } catch (e) {}
    restart();
  }

  /* ---------- élő adatok ---------- */
  function subscribe() {
    const party = S.party;
    let fresh = false, gotAny = false;
    const timer = setTimeout(() => {
      if (S.party !== party) return;
      S.stale = true;
      if (S.phase === "loading" && gotAny) { if (S.myDoc) S.phase = "ready"; else goJoin(); }
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
        else if (fresh || S.stale) goJoin();
      } else if (S.phase === "join" && S.myDoc) {
        S.phase = "ready"; S.view = "me";
      }
      if (S.phase === "ready") syncMyName();
      renderAll();
    }, (e) => {
      if (S.party !== party) return;
      clearTimeout(timer);
      S.errorCode = errCode(e);
      if (S.phase === "ready") { S.stale = true; renderAll(); }
      else { S.phase = "error"; renderAll(); }
    });
  }
  function subscribeStats() {
    if (typeof S.backend.watchStats !== "function") return;
    try {
      S.backend.watchStats((snap) => {
        const m = new Map();
        for (const d of snap.docs) m.set(d.id, sanitizeStats(d.data));
        S.stats = m;
        S.statsError = false;
        if (S.phase === "ready" || S.phase === "join") renderAll();
      }, (e) => {
        if (errCode(e) === "permission-denied") { S.statsError = true; if (S.phase === "ready") renderAll(); }
      });
    } catch (e) {}
  }
  function startData() {
    S.phase = "loading";
    subscribeStats();
    const known = new Set(loadParties().map(p => p.code));
    let urlParty = null;
    try { urlParty = cleanParty(new URLSearchParams(location.search).get("buli")); } catch (e) {}
    const party = urlParty || cleanParty(lsGet("strigula-party"));
    if (party) known.add(party);
    recordParties([...known]);
    if (party) { S.phase = "loading"; setParty(party); }
    else goJoin();
    renderAll();
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
  function heroTally() {
    const svg = svgEl("svg", { viewBox: "0 0 72 56", width: 92, height: 72, class: "hero-tally", "aria-hidden": "true" });
    [["12", "6", "12", "50", "var(--shot)"], ["27", "6", "27", "50", "var(--wine)"],
     ["42", "6", "42", "50", "var(--beer)"], ["57", "6", "57", "50", "var(--water)"],
     ["3", "42", "69", "14", "currentColor"]].forEach((s, i) => {
      svg.append(svgEl("line", { x1: s[0], y1: s[1], x2: s[2], y2: s[3], class: "draw",
        style: "stroke:" + s[4] + ";animation-delay:" + (i * 0.12) + "s" }));
    });
    return svg;
  }

  /* ---------- fejléc ---------- */
  const ICON_MENU = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';
  const ICON_GEAR = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  const ICON_CLOSE = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
  const ICON_CHEV = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  function iconSpan(html, cls) { const s = el("span", { class: cls || "ico", "aria-hidden": "true" }); s.innerHTML = html; return s; }
  function ensureHeader() {
    const old = $("#settingsBtn");
    if (old) old.remove();
    let menu = $("#menuBtn");
    if (!menu) {
      menu = el("button", { id: "menuBtn", type: "button", class: "icon-btn menu-btn", "aria-label": "Menü", hidden: true });
      const row = document.querySelector(".brand-row");
      if (row) row.prepend(menu);
    }
    if (!menu.dataset.ready) {
      menu.dataset.ready = "1";
      if (!menu.firstElementChild) menu.innerHTML = ICON_MENU;
      menu.addEventListener("click", openDrawer);
    }
    let bar = $("#partyBar");
    if (!bar) {
      bar = el("button", { id: "partyBar", type: "button", class: "party-bar", hidden: true });
      const inner = document.querySelector(".top-inner");
      if (inner) inner.append(bar);
    }
    if (!bar.dataset.ready) {
      bar.dataset.ready = "1";
      bar.addEventListener("click", openDrawer);
    }
    return { menu, bar };
  }
  function renderHeader() {
    const { menu, bar } = ensureHeader();
    menu.hidden = !(S.phase === "ready" || S.phase === "join");
    menu.setAttribute("aria-expanded", S.drawerOpen ? "true" : "false");
    const showBar = S.phase === "ready" && !!S.party;
    bar.hidden = !showBar;
    if (showBar) {
      bar.replaceChildren(el("span", { class: "pb-label", text: "Buli:" }), el("span", { class: "pb-name", text: partyTitle() }), iconSpan(ICON_CHEV, "pb-chev"));
      bar.setAttribute("aria-label", "Buli: " + partyTitle() + ". Menü és korábbi bulik");
    }
  }

  /* ---------- megjelenítés ---------- */
  function renderAll() {
    renderHeader();
    renderTabs();
    renderMain();
    renderSheet();
  }
  function renderTabs() {
    const nav = $("#tabs");
    if (!nav) return;
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
    const others = [...S.docs.entries()].filter(([id]) => id !== S.myId)
      .sort((a, b) => displayName(a[0], a[1]).localeCompare(displayName(b[0], b[1]), "hu", { sensitivity: "base" }));
    for (const [id, d] of others) tab(id, displayName(id, d), colorFor(id));
    nav.scrollLeft = keep;
  }
  function messageView(title, text) {
    return el("section", {}, el("h2", { class: "view-title cond", text: title }), el("p", { text }));
  }
  const STATIC_VIEWS = { auth: () => authView(), pickname: () => pickView(), consent: () => consentView(), join: () => joinView() };
  function renderMain() {
    const main = $("#main");
    if (STATIC_VIEWS[S.phase]) {
      if (main.dataset.screen !== S.phase) { main.dataset.screen = S.phase; main.replaceChildren(STATIC_VIEWS[S.phase]()); }
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
      case "error":
        main.replaceChildren(S.errorCode === "permission-denied"
          ? messageView("Nincs hozzáférés", RULES_MSG)
          : messageView("Nem sikerült betölteni", "Frissítsd az oldalt. Ha így sem megy, nézd meg a netkapcsolatot."));
        break;
      case "ready": {
        const y = window.scrollY;
        main.replaceChildren(readyView());
        afterRender(main);
        window.scrollTo(0, y);
        break;
      }
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
    const rows = ranking();
    const me = rows.find(r => r.id === id);
    sec.append(el("div", { class: "p-head" },
      el("h2", { class: "cond", text: displayName(id, doc) }),
      el("p", { text: "Ezen a bulin: " + alc + " alkoholos ital (" + fmtVol(alcoholMl(doc)) + "), " + wat + " víz vagy üdítő ("
        + fmtVol(catMl(doc, CAT_BY_ID.water)) + ")." + (doc.recent[0] ? " Utoljára " + ago(doc.recent[0].t) + "." : "") }),
      me ? el("p", { class: "p-score" },
        el("span", { class: "score-num cond", text: fmtPts(me.pts) }),
        " pont, " + me.rank + ". hely " + rows.length + " főből") : null));
    if (mine && S.readOnly) {
      sec.append(el("p", { class: "banner", text: "A szerver most nem engedi a mentést. Ellenőrizd a Firestore szabályokat." }));
    }
    for (const cat of CATS) sec.append(catRow(id, doc, cat, editable));
    if (editable) {
      sec.append(el("p", { class: "help", text: "A + gomb az utoljára választott italt írja fel. Koppints egy sorra, és ott fajtánként is felírhatod, például Jägermeister vagy Unicum." }));
    }
    sec.append(vomitCard(id, doc, mine));
    const st = statsOf(id);
    sec.append(statsSection(mine ? "Az én statisztikám" : "Statisztikája", st.years[thisYear()] || emptyCounts(), st.total,
      mine ? "Minden bulidból összeadva. A nullázás és a buliváltás nem törli." : "Minden bulijából összeadva."));
    sec.append(el("section", { class: "stats" },
      el("h3", { class: "feed-title cond", text: "Fogyasztás naponta" }),
      S.statsError ? el("p", { class: "banner", text: RULES_MSG }) : chartView(id, st),
      el("p", { class: "stat-note", text: "Egy oszlop egy buli-nap: hajnali 6-tól másnap hajnali 6-ig. Koppints egy színre a részletekért." })));
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
    row.append(el("button", { type: "button", class: "cat-open", "aria-label": cat.name + ": " + total + " darab, " + fmtVol(total * cat.ml) + ". Részletek",
      onclick: () => openSheet({ type: "detail", pid, cid: cat.id }) },
      el("span", { class: "cat-title" }, el("span", { class: "emoji", "aria-hidden": "true", text: cat.emoji }), el("span", { text: cat.name })),
      el("span", { class: "cat-num cond", text: String(total) }),
      tally(total, editable && S.fresh === cat.id),
      hint ? el("span", { class: "cat-hint", text: hint }) : null,
      el("span", { class: "cat-vol", text: fmtVol(total * cat.ml) })));
    if (editable) {
      row.append(el("button", { type: "button", class: "plus cond", "aria-label": "Még egy: " + label(cat.id, quick),
        onclick: () => addDrink(cat.id, quickOf(S.myDoc, cat)) }, "+1"));
    }
    return row;
  }
  function vomitCard(id, doc, mine) {
    const v = vomitInfo(id);
    const sec = el("section", { class: "vomit" });
    sec.append(el("h3", { class: "feed-title cond", text: mine ? "Hányás-szavazás rólad" : "Hányt " + displayName(id, doc) + "?" }));
    if (S.votesError) { sec.append(el("p", { class: "banner", text: RULES_MSG })); return sec; }
    if (!v.eligible) {
      sec.append(el("p", { class: "vote-tally", text: "Amint mások is belépnek a buliba, ők szavazhatnak." }));
      return sec;
    }
    if (!mine) {
      const my = myVote(id);
      sec.append(el("div", { class: "vote-row", role: "group", "aria-label": "A szavazatod" },
        el("button", { type: "button", class: "vote-btn yes", "aria-pressed": my && my.v === true ? "true" : "false", onclick: () => castVote(id, true) }, "Igen, hányt"),
        el("button", { type: "button", class: "vote-btn no", "aria-pressed": my && my.v === false ? "true" : "false", onclick: () => castVote(id, false) }, "Nem")));
    }
    sec.append(el("p", { class: "vote-tally", text: v.yes + " igen, " + v.no + " nem. Szavazók: " + v.eligible + ", a büntetéshez legalább " + v.need + " igen kell." }));
    if (v.confirmed) {
      sec.append(el("p", { class: "vote-result bad", text: (mine ? "A többiek szerint hánytál: " : "Megszavazva, hányt: ")
        + v.count + " hányás, " + fmtPts(-VOMIT_PTS * v.count) + " pont." }));
      if (!mine) {
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
    if (S.statsError) { sec.append(el("p", { class: "banner", text: RULES_MSG })); return sec; }
    sec.append(el("div", { class: "stat-grid" }, statCard("Idén (" + thisYear() + ")", yearCounts), statCard("Összesen", totalCounts)));
    if (note) sec.append(el("p", { class: "stat-note", text: note }));
    return sec;
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

  /* ---------- Mindenki: verseny, közös összeg, statisztika ---------- */
  function allView() {
    const sec = el("section");
    const rows = ranking();
    sec.append(el("h2", { class: "view-title cond", text: rows.length ? rows.length + " fő a buliban" : "Még senki sincs itt" }));
    sec.append(el("p", { class: "muted" }, "A buli kódja: ", el("span", { class: "code", text: S.party || "" }),
      S.partyMeta && S.partyMeta.createdAt ? ". Indult: " + fmtDate(S.partyMeta.createdAt) : null));
    sec.append(el("div", { class: "top-actions" },
      el("button", { type: "button", class: "btn secondary", onclick: invite }, "Barátok meghívása")));

    sec.append(el("h3", { class: "feed-title cond", text: "Verseny" }));
    const ol = el("ol", { class: "rank-list" });
    for (const r of rows) {
      const me = r.id === S.myId;
      const nm = displayName(r.id, r.doc);
      const counts = CATS.map(c => c.emoji + " " + catTotal(r.doc, c)).join("   ") + (r.vomits ? "   🤮 " + r.vomits : "");
      ol.append(el("li", {}, el("button", { type: "button", class: "rank-row" + (r.rank === 1 ? " first-place" : ""),
        "aria-label": r.rank + ". hely: " + nm + (me ? " (te)" : "") + ", " + fmtPts(r.pts) + " pont",
        onclick: () => { S.view = me ? "me" : r.id; renderAll(); window.scrollTo(0, 0); } },
        el("span", { class: "rank-no cond", "aria-hidden": "true", text: r.rank + "." }),
        el("span", { class: "dot big", style: "background:" + colorFor(r.id), "aria-hidden": "true" }),
        el("span", { class: "p-main", "aria-hidden": "true" },
          el("span", { class: "p-name", text: nm + (me ? " (te)" : "") }),
          el("span", { class: "p-sub", text: counts })),
        el("span", { class: "rank-pts", "aria-hidden": "true" },
          el("span", { class: "cond", text: fmtPts(r.pts) }),
          el("span", { class: "rank-unit", text: "pont" })))));
    }
    sec.append(ol);
    sec.append(el("p", { class: "rules-note", text: "Pontozás: rövid +5, bor +3, sör +2, víz vagy üdítő +0,25. Hányás −20, ha a többiek több mint fele megszavazza. Szavazni egy ember fülén lehet." }));

    const pc = emptyCounts();
    for (const r of rows) for (const c of CATS) pc[c.id] += catTotal(r.doc, c);
    sec.append(el("section", { class: "stats first" },
      el("h3", { class: "feed-title cond", text: "Ezen a bulin együtt" }),
      el("div", { class: "stat-grid one" }, statCard(partyTitle(), pc))));

    const g = groupStats();
    sec.append(statsSection("Mindenki együtt", g.year, g.total, "Az összes buliból, mindenkit beleszámolva, aki valaha használta az appot."));

    const feed = [];
    for (const r of rows) for (const x of r.doc.recent) feed.push({ who: displayName(r.id, r.doc), me: r.id === S.myId, ...x });
    feed.sort((a, b) => b.t - a.t);
    if (feed.length) {
      sec.append(el("h3", { class: "feed-title cond", text: "Legutóbb" }));
      const list = el("ol", { class: "feed" });
      for (const f of feed.slice(0, 15)) {
        list.append(el("li", {},
          el("span", { class: "f-who", text: f.me ? "Te" : f.who }),
          el("span", { text: CAT_BY_ID[f.c].emoji + " " + label(f.c, f.d) }),
          el("span", { class: "f-when", text: ago(f.t) })));
      }
      sec.append(list);
    }
    return sec;
  }

  /* ---------- belépés, regisztráció ---------- */
  function consentBoxes() {
    const adult = el("input", { type: "checkbox", id: "cAdult" });
    const agree = el("input", { type: "checkbox", id: "cAgree" });
    const box = el("div", { class: "consents" },
      el("button", { type: "button", class: "link-btn inline", onclick: () => openSheet({ type: "privacy" }) }, "Az adatkezelési tájékoztató elolvasása"),
      el("label", { class: "check block", for: "cAdult" }, adult, el("span", { text: "Elmúltam 18 éves." })),
      el("label", { class: "check block", for: "cAgree" }, agree,
        el("span", { text: "Elolvastam az adatkezelési tájékoztatót, és kifejezetten hozzájárulok, hogy az app tárolja és a többi felhasználónak megmutassa az általam felírt italokat, a pontjaimat és a rólam szóló szavazatokat." })));
    return { box, adult, agree };
  }
  function authView() {
    const mode = S.authMode === "login" || S.authMode === "reset" ? S.authMode : "signup";
    const signup = mode === "signup";
    const sec = el("section", { class: "onboard auth" });
    sec.append(heroTally());
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
      ? doSignup(user.value, email.value, pw.value, pw2.value, cons.adult.checked, cons.agree.checked, msg, btn)
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
    sec.append(el("h2", { class: "hero cond", text: "Adatkezelés" }));
    sec.append(el("p", { class: "lead", text: "Frissült az app. Mielőtt folytatod, kérjük, olvasd el az adatkezelési tájékoztatót, és járulj hozzá az adataid kezeléséhez." }));
    sec.append(el("p", { class: "note", text: "Röviden: az app a felhasználónevedet, a felírt italaidat, a pontjaidat és a rólad szóló szavazatokat tárolja, és megmutatja a többi felhasználónak. Nem adjuk el és nem adjuk át senkinek. A fiókodat bármikor törölheted a Beállításokban." }));
    const cons = consentBoxes();
    const msg = el("p", { class: "msg", role: "status" });
    const btn = el("button", { type: "button", class: "btn big wide" }, "Elfogadom és folytatom");
    btn.addEventListener("click", () => doConsent(cons.adult.checked, cons.agree.checked, msg));
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
      el("p", { class: "muted small", text: "Utolsó módosítás: 2026. november 24." }),
      h("Ki kezeli az adataidat?"),
      para("A Másnapló egy baráti társaság saját, nem kereskedelmi alkalmazása. Adatkezelő: " + p.controller + ". Elérhetőség: " + p.contact + "."),
      h("Milyen adatokat tárolunk?"),
      list(
        "A felhasználónevedet és a jelszavadat. A jelszót a Google Firebase olvashatatlan formában (lenyomatként) tárolja, az adatkezelő sem látja.",
        "Az e-mail-címedet, ha megadod.",
        "Amit az appba beírsz: az italaidat fajtánként, darabszámmal és időponttal, a bulikat, amelyekben részt veszel, a bulik nevét és a hányás-szavazatokat.",
        "Az ezekből számolt statisztikát (éves, összesített és napi) és a pontjaidat.",
        "Azoknak a buliknak a kódját, amelyekben részt vettél. Ezt csak te látod, és azért tároljuk, hogy a fiókod törlésekor minden buliból törölhessük az adataidat.",
        "A hozzájárulásod időpontját.",
        "A telefonodon, a böngésző tárhelyén a mértékegység beállítását és a korábbi bulijaid listáját."),
      h("Mire használjuk?"),
      para("Kizárólag az app működéséhez: hogy a számlálók, a statisztika, a grafikon és a verseny működjön, és a buli résztvevői lássák egymás italait. Az e-mail-címet csak a jelszó visszaállításához és a cím megerősítéséhez használjuk. Nincs reklám, az adataidat nem adjuk el és nem adjuk át senkinek, és más célra nem használjuk."),
      h("Mi a jogalap?"),
      para("A hozzájárulásod (GDPR 6. cikk (1) bekezdés a) pont). Mivel az italfogyasztásra vonatkozó adatok egészségügyi jellegűnek is tekinthetők, ezekhez kifejezett hozzájárulást kérünk (GDPR 9. cikk (2) bekezdés a) pont). A hozzájárulásodat bármikor visszavonhatod a fiókod törlésével; ez nem érinti a korábbi adatkezelés jogszerűségét."),
      h("Ki látja az adataidat?"),
      para("A többi bejelentkezett felhasználó látja a felhasználónevedet, a bulikon felírt italaidat, a pontjaidat, a statisztikádat és a grafikonodat. Egy buli adatait az láthatja, akinek van fiókja és ismeri a buli kódját. Az e-mail-címedet és a jelszavadat senki más nem látja."),
      para("Adatfeldolgozó a Google (Firebase szolgáltatás). Az adatbázis európai szervereken van; a bejelentkezési adatokat a Google az EU–USA adatvédelmi keretrendszer és szerződéses garanciák alapján az Egyesült Államokban is kezelheti. Az oldal betöltésekor a GitHub (a tárhely) és a Google (betűtípusok, Firebase) a működéshez szükséges technikai adatokat, például az IP-címedet is megkapja."),
      h("Meddig tároljuk?"),
      para("Amíg a fiókod létezik. Ha törlöd a fiókodat, a profilod, a felhasználóneved, a statisztikád, valamint a buli-számlálóid és a szavazataid minden olyan buliból azonnal törlődnek, amelyről az app tud (amelyet bármelyik eszközödön megnyitottál ezzel a fiókkal). Ha egy régebbi buliban mégis maradna adatod, például egy azóta nem használt telefonról, az adatkezelő kérésre törli. A mások által rólad leadott szavazatokban csak egy azonosító marad, ami már senkihez sem köthető. A bulik neve a bulihoz tartozik, ezért az megmarad."),
      h("Milyen jogaid vannak?"),
      para("Jogod van hozzáférni az adataidhoz (ezek nagy részét az appban látod), helyesbíteni őket (a számlálók és a felhasználónév az appban módosítható), törölni őket (Beállítások, Fiókom törlése), kérni az adataid másolatát, és visszavonni a hozzájárulásodat. Kérésekkel az adatkezelőhöz fordulhatsz a fenti elérhetőségen. Panaszt a Nemzeti Adatvédelmi és Információszabadság Hatóságnál tehetsz (NAIH, 1055 Budapest, Falk Miksa utca 9–11., www.naih.hu)."),
      h("Korhatár"),
      para("Az appot csak 18. életévüket betöltött személyek használhatják."));
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
  function joinView() {
    const sec = el("section", { class: "onboard" });
    sec.append(heroTally());
    sec.append(el("h2", { class: "hero cond", text: "Ki iszik ma?" }));
    sec.append(el("p", { class: "lead", text: "Szia, " + S.username + "! Lépj be egy buliba a kódjával, vagy indíts újat." }));
    const code = el("input", { id: "codeInput", class: "field big", type: "text", maxlength: 40, autocomplete: "off",
      autocapitalize: "none", spellcheck: "false", enterkeyhint: "go", placeholder: "pl. buli-k7m2p9qa" });
    code.value = S.party || "";
    const pname = el("input", { id: "partyNameInput", class: "field", type: "text", maxlength: PARTY_NAME_MAX, autocomplete: "off",
      enterkeyhint: "go", placeholder: "pl. Szilveszter 2026" });
    const pnameWrap = el("div", { class: "stack", hidden: !S.onboardNew },
      el("label", { class: "lbl", for: "partyNameInput", text: "A buli neve" }), pname,
      el("p", { class: "hint", text: "Később a Beállításokban át is nevezheted." }));
    if (S.onboardNew && !code.value) code.value = newPartyCode();
    const btn = el("button", { type: "button", class: "btn big wide" }, "Belépek a buliba");
    const msg = el("p", { id: "joinMsg", class: "msg", role: "status" });
    const go = () => join(code.value, pnameWrap.hidden ? null : pname.value, msg, btn);
    btn.addEventListener("click", go);
    code.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    pname.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    const fresh = el("button", { type: "button", class: "link-btn",
      onclick: () => {
        code.value = newPartyCode();
        pnameWrap.hidden = false;
        const hint = document.getElementById("partyHint");
        if (hint) hint.textContent = "";
        msg.textContent = "Új buli kód kész. Adj nevet a bulinak, és lépj be. Utána a Mindenki fülön tudod elküldeni a barátaidnak.";
        msg.classList.remove("err");
        try { pname.focus(); } catch (e) {}
      } }, "Új bulit indítok, kérek egy kódot");
    sec.append(el("div", { class: "stack" },
      el("label", { class: "lbl", for: "codeInput", text: "A buli kódja" }), code,
      el("p", { class: "hint", text: "Ha linkkel kaptad, már ki van töltve." }),
      el("p", { id: "partyHint", class: "party-hint", text: S.onboardNew ? "" : partyHintText() }),
      pnameWrap, btn), msg, fresh);
    if (loadParties().some(p => p.code !== S.party)) {
      sec.append(el("button", { type: "button", class: "link-btn", onclick: openDrawer }, "Korábbi bulijaim"));
    }
    return sec;
  }

  /* ---------- szendvicsmenü ---------- */
  function updateLock() { document.body.classList.toggle("locked", !!S.sheet || S.drawerOpen); }
  function drawerRoot() {
    let r = $("#drawerRoot");
    if (!r) { r = el("div", { id: "drawerRoot" }); document.body.append(r); }
    return r;
  }
  function openDrawer() {
    if (!(S.phase === "ready" || S.phase === "join")) return;
    closeSheet();
    S.drawerOpen = true;
    const close = el("button", { type: "button", class: "icon-btn", "aria-label": "Menü bezárása", onclick: closeDrawer });
    close.innerHTML = ICON_CLOSE;
    const list = el("ul", { class: "drawer-parties" });
    const parties = loadParties();
    if (!parties.length) list.append(el("li", { class: "muted drawer-empty", text: "Még nincs elmentett bulid ezen a telefonon." }));
    for (const p of parties) {
      const cur = p.code === S.party && S.phase === "ready";
      const title = (p.code === S.party && S.partyMeta && S.partyMeta.name) || p.name || p.code;
      const when = p.created ? "Indult: " + fmtDate(p.created) : (p.at ? "Utoljára megnyitva: " + fmtDate(p.at) : "");
      const li = el("li", { class: "party-item" + (cur ? " on" : "") });
      li.append(el("button", { type: "button", class: "party-open", "aria-current": cur ? "true" : null, onclick: () => openParty(p.code) },
        el("span", { class: "pi-name", text: title }),
        el("span", { class: "pi-sub", text: (cur ? "Most itt vagy. " : "") + when })));
      if (!cur) {
        li.append(el("button", { type: "button", class: "del", "aria-label": title + " levétele a listáról",
          onclick: () => { forgetParty(p.code); li.remove(); } }, "×"));
      }
      list.append(li);
    }
    const panel = el("aside", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-label": "Menü" },
      el("div", { class: "drawer-head" },
        el("div", { class: "drawer-user" }, el("span", { class: "muted small", text: "Bejelentkezve" }), el("strong", { text: S.username })),
        close),
      el("button", { type: "button", class: "drawer-item", onclick: () => { closeDrawer(); openSheet({ type: "settings" }); } },
        iconSpan(ICON_GEAR), el("span", { text: "Beállítások" })),
      el("hr", { class: "drawer-sep" }),
      el("div", { class: "drawer-sub" },
        el("span", { class: "drawer-title cond", text: "Bulijaim" }),
        el("button", { type: "button", class: "drawer-new", onclick: () => switchParty(true) }, "+ Új buli")),
      list,
      el("div", { class: "drawer-foot" },
        el("button", { type: "button", class: "link-btn", onclick: () => switchParty(false) }, "Belépés kóddal")));
    drawerRoot().replaceChildren(el("div", { class: "drawer-backdrop", onclick: closeDrawer }), panel);
    updateLock();
    renderHeader();
    try { close.focus({ preventScroll: true }); } catch (e) {}
  }
  function closeDrawer() {
    if (!S.drawerOpen) return;
    S.drawerOpen = false;
    drawerRoot().replaceChildren();
    updateLock();
    renderHeader();
  }

  /* ---------- alsó lapok ---------- */
  function openSheet(sheet) {
    closeDrawer();
    S.sheet = sheet;
    const root = $("#sheetRoot");
    root.replaceChildren();
    const close = el("button", { type: "button", class: "icon-btn", "aria-label": "Bezárás", onclick: closeSheet });
    close.innerHTML = ICON_CLOSE;
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
    } else if (sheet.type === "privacy") {
      title.textContent = "Adatkezelési tájékoztató";
      body.append(privacyContent());
    } else if (sheet.type === "delete") {
      title.textContent = "Fiók törlése";
      const pw = el("input", { id: "delPw", class: "field", type: "password", maxlength: 128, autocomplete: "current-password", enterkeyhint: "done" });
      const msg = el("p", { class: "msg", role: "status" });
      const btn = el("button", { type: "button", class: "btn danger wide" }, "Fiókom végleges törlése");
      btn.addEventListener("click", () => doDelete(pw.value, msg, btn));
      pw.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doDelete(pw.value, msg, btn); } });
      body.append(el("div", { class: "stack" },
        el("p", { class: "confirm-text", text: "Ezzel végleg törlöd a fiókodat, a felhasználónevedet, a statisztikádat, valamint a számlálóidat és a szavazataidat minden buliból. Ezt nem lehet visszavonni." }),
        el("label", { class: "lbl", for: "delPw", text: "A jelszavad a megerősítéshez" }), pw, btn, msg,
        el("button", { type: "button", class: "btn secondary wide", onclick: closeSheet }, "Mégse")));
    } else if (sheet.type === "confirm") {
      title.textContent = "Biztos?";
      body.append(
        el("p", { class: "confirm-text", text: sheet.text }),
        el("div", { class: "btn-row" },
          el("button", { type: "button", class: "btn secondary", onclick: closeSheet }, "Mégse"),
          el("button", { type: "button", class: "btn danger", onclick: () => { const a = sheet.action; closeSheet(); a(); } }, sheet.label)));
    }
    root.append(el("div", { class: "backdrop", onclick: closeSheet }), panel);
    updateLock();
    renderSheet();
    try { close.focus({ preventScroll: true }); } catch (e) {}
  }
  function closeSheet() {
    if (!S.sheet) return;
    S.sheet = null;
    $("#sheetRoot").replaceChildren();
    updateLock();
  }
  function confirmSheet(text, lbl, action) { openSheet({ type: "confirm", text, label: lbl, action }); }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (S.sheet) closeSheet();
    else if (S.drawerOpen) closeDrawer();
  });

  function renderSheet() {
    const s = S.sheet;
    if (!s || s.type !== "detail") return;
    const cat = CAT_BY_ID[s.cid];
    const mine = s.pid === S.myId && !!S.myDoc;
    const doc = mine ? S.myDoc : S.docs.get(s.pid);
    if (!doc || S.phase !== "ready") { closeSheet(); return; }
    const editable = mine && !S.readOnly;
    const body = $("#sheetBody");
    const total = catTotal(doc, cat);
    $("#sheetTitle").replaceChildren(
      document.createTextNode(cat.emoji + " " + cat.name + " "),
      el("span", { class: "sheet-total", text: String(total) }),
      el("span", { class: "sheet-vol", text: " " + fmtVol(total * cat.ml) }));
    let list = drinkList(doc, cat);
    if (!editable) list = list.filter(d => d.n > 0).sort((a, b) => b.n - a.n);
    const keep = body.scrollTop;
    const who = mine ? null : el("p", { class: "muted", text: displayName(s.pid, doc) + " számlálója, csak nézheted." });
    if (!list.length) {
      body.replaceChildren(...(who ? [who] : []), el("p", { class: "empty", text: "Ebből még nincs semmi felírva." }));
      return;
    }
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
  function settingsBody() {
    const wrap = el("div", { class: "settings" });

    wrap.append(el("h3", { class: "settings-sub cond first", text: "Mértékegység" }));
    const seg = el("div", { class: "seg", role: "radiogroup", "aria-label": "Mértékegység" });
    const opt = (val, text) => el("button", { type: "button", class: "seg-btn", role: "radio", "data-val": val,
      "aria-checked": S.units === val ? "true" : "false",
      onclick: () => {
        S.units = val;
        lsSet("strigula-units", val);
        for (const b of seg.children) b.setAttribute("aria-checked", b.dataset.val === val ? "true" : "false");
        renderAll();
      } }, text);
    seg.append(opt("metric", "Metrikus"), opt("imperial", "Imperial"));
    wrap.append(seg, el("p", { class: "muted small", text: "Metrikus: cl, dl, l. Imperial: brit fl oz és pint. Egy adag: rövid 4 cl, bor 1 dl, sör 5 dl, víz vagy üdítő 3 dl." }));

    wrap.append(el("h3", { class: "settings-sub cond", text: "Fiók" }));
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
    wrap.append(el("button", { type: "button", class: "btn secondary wide",
      onclick: () => confirmSheet("Kijelentkezel ebből a fiókból ezen a telefonon.", "Kijelentkezem", logout) }, "Kijelentkezés"));

    if (S.party && S.phase === "ready") {
      wrap.append(el("h3", { class: "settings-sub cond", text: "Ez a buli" }));
      const pinput = el("input", { id: "setParty", class: "field", type: "text", maxlength: PARTY_NAME_MAX, autocomplete: "off",
        enterkeyhint: "done", placeholder: "pl. Szilveszter 2026" });
      pinput.value = S.partyMeta && S.partyMeta.name ? S.partyMeta.name : "";
      const psave = el("button", { type: "button", class: "btn" }, "Mentés");
      const doPSave = () => {
        if (!savePartyName(pinput.value)) { pinput.focus(); return; }
        pinput.blur();
        toast("A buli neve elmentve.");
      };
      psave.addEventListener("click", doPSave);
      pinput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doPSave(); } });
      wrap.append(
        el("div", {}, el("label", { class: "lbl", for: "setParty", text: "A buli neve" }), el("div", { class: "add-inline" }, pinput, psave)),
        el("p", { class: "muted" }, "A buli kódja: ", el("span", { class: "code", text: S.party })),
        el("button", { type: "button", class: "btn wide", onclick: invite }, "Barátok meghívása"));
      if (S.myDoc && !S.readOnly) {
        wrap.append(
          el("button", { type: "button", class: "btn secondary wide",
            onclick: () => confirmSheet("Nullázod a saját számlálóidat ezen a bulin. A statisztikád megmarad, a többiekét ez nem érinti.", "Nullázom", resetMine) }, "Saját számlálóim nullázása"),
          el("button", { type: "button", class: "btn danger wide",
            onclick: () => confirmSheet("Kilépsz ebből a buliból, és a számlálóid törlődnek belőle. A statisztikád megmarad.", "Kilépek", leaveParty) }, "Kilépek ebből a buliból"));
      }
    }

    wrap.append(el("h3", { class: "settings-sub cond", text: "Adatvédelem" }),
      el("button", { type: "button", class: "btn secondary wide", onclick: () => openSheet({ type: "privacy" }) }, "Adatkezelési tájékoztató"),
      el("button", { type: "button", class: "btn danger wide", onclick: () => openSheet({ type: "delete" }) }, "Fiókom törlése"),
      el("p", { class: "muted small", text: "A fiókod törlésével minden adatod törlődik, és ezzel a hozzájárulásodat is visszavonod." }));

    if (!isStandalone()) {
      wrap.append(el("h3", { class: "settings-sub cond", text: "Telepítés" }));
      if (S.installPrompt) wrap.append(el("button", { type: "button", class: "btn wide", onclick: () => { closeSheet(); promptInstall(); } }, "Telepítés a telefonra"));
      else if (isIOS()) wrap.append(el("p", { class: "muted", text: "Safariban koppints a Megosztás ikonra, majd a Főképernyőhöz adás pontra." }));
      else wrap.append(el("p", { class: "muted", text: "Chrome-ban nyisd meg a ⋮ menüt, és válaszd az Alkalmazás telepítése vagy a Hozzáadás a kezdőképernyőhöz pontot." }));
    }
    return wrap;
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
        consentOk = !!(priv && priv.consent && priv.consent.v === CONSENT_V);
      } catch (e) {
        console.error(e);
        if (errCode(e) === "permission-denied") { S.phase = "rulesold"; renderAll(); return; }
      }
    } else consentOk = true;
    if (!consentOk) { S.phase = "consent"; renderAll(); return; }
    startData();
  };
  setInterval(() => { if (S.phase === "ready" && !document.hidden) renderMain(); }, 30000);
  renderAll();
  if (window.strigulaPending) window.strigulaStart(window.strigulaPending[0], window.strigulaPending[1]);
})();
