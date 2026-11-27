/* Másnapló – Firebase kapcsolat: fiókok és adatbázis.
   E-mail nélküli fióknál a felhasználónévhez egy véletlen, belső e-mail-cím tartozik (ide soha nem megy levél).
   Ha valaki megadja a saját e-mail-címét, az lesz a fiók címe; ezt a cím senki más nem láthatja. */
const FIREBASE_VERSION = "10.12.2";
const BASE = "https://www.gstatic.com/firebasejs/" + FIREBASE_VERSION + "/";

function hand(backend, problem) {
  if (typeof window.strigulaStart === "function") window.strigulaStart(backend, problem);
  else window.strigulaPending = [backend, problem];
}

(async () => {
  const cfg = window.STRIGULA_FIREBASE;
  if (!cfg || typeof cfg.apiKey !== "string" || !cfg.projectId || /IDE_/.test(cfg.apiKey + cfg.projectId)) {
    hand(null, "noconfig");
    return;
  }

  let appMod, authMod, fs;
  try {
    [appMod, authMod, fs] = await Promise.all([
      import(BASE + "firebase-app.js"),
      import(BASE + "firebase-auth.js"),
      import(BASE + "firebase-firestore.js"),
    ]);
  } catch (e) {
    console.error(e);
    hand(null, "offline");
    return;
  }

  let db, auth;
  try {
    const app = appMod.initializeApp(cfg);
    try {
      db = fs.initializeFirestore(app, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      });
    } catch (e) {
      db = fs.getFirestore(app);
    }
    auth = authMod.getAuth(app);
    try { auth.languageCode = "hu"; } catch (e) {}
  } catch (e) {
    console.error(e);
    hand(null, "noconfig");
    return;
  }

  const emailDomain = String(cfg.authDomain || (cfg.projectId + ".firebaseapp.com")).toLowerCase();
  const isSynthetic = (email) => {
    const e = String(email || "").toLowerCase();
    return e.endsWith("@" + emailDomain) && /^u[a-z0-9]{20}@/.test(e);
  };
  const randomLocal = () => {
    const a = "abcdefghijklmnopqrstuvwxyz0123456789";
    const b = new Uint8Array(20);
    crypto.getRandomValues(b);
    return "u" + Array.from(b, (x) => a[x % a.length]).join("");
  };
  const appUrl = () => location.origin + location.pathname;
  // A levelekben lévő gomb visszavisz az appba; ha a cím nincs engedélyezve, enélkül küldjük.
  async function withContinue(fn) {
    try { return await fn({ url: appUrl() }); }
    catch (e) {
      const c = e && e.code;
      if (c === "auth/unauthorized-continue-uri" || c === "auth/invalid-continue-uri" || c === "auth/missing-continue-uri") return await fn(undefined);
      throw e;
    }
  }

  // Megvárjuk az elmentett bejelentkezést, és frissítjük (pl. ha közben megerősítette az új e-mail-címét).
  let user = null;
  try {
    user = await new Promise((resolve) => {
      let done = false;
      const stop = authMod.onAuthStateChanged(auth, (u) => {
        if (done) return;
        done = true;
        resolve(u);
        setTimeout(() => stop && stop(), 0);
      });
    });
    if (user && !user.isAnonymous) {
      try { await user.reload(); user = auth.currentUser || user; }
      catch (e) {
        const c = (e && e.code) || "";
        if (["auth/user-token-expired", "auth/user-not-found", "auth/user-disabled", "auth/invalid-user-token"].includes(c)) {
          try { await authMod.signOut(auth); } catch (e2) {}
          user = null;
        }
      }
    }
    // Vendég munkamenet: ezzel tud a belépő képernyő felhasználónevet keresni, és ebből lesz a fiók.
    if (!user) user = (await authMod.signInAnonymously(auth)).user;
  } catch (e) {
    console.error(e);
    const c = (e && e.code) || "";
    if (c === "auth/operation-not-allowed" || c === "auth/admin-restricted-operation") hand(null, "authoff");
    else if (c === "auth/network-request-failed") hand(null, "offline");
    else hand(null, "error");
    return;
  }

  const userRef = (uid) => fs.doc(db, "users", uid);
  const privRef = (uid) => fs.doc(db, "private", uid);
  const nameRef = (key) => fs.doc(db, "usernames", key);
  const playerRef = (party, uid) => fs.doc(db, "parties", party, "players", uid);
  const voteRef = (party, uid) => fs.doc(db, "parties", party, "votes", uid || user.uid);
  const err = (code, msg) => { const e = new Error(msg || code); e.code = code; return e; };
  const bannedRef = (uid) => fs.doc(db, "banned", uid);
  const logRef = () => fs.doc(fs.collection(db, "adminlog"));
  const logEntry = (action, target, party, detail) => {
    const e = { at: Date.now(), action };
    if (target) e.target = target;
    if (party) e.party = party;
    if (detail) e.detail = String(detail).slice(0, 300);
    return e;
  };
  const CAT_IDS = ["shot", "wine", "beer", "water"];
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const PARTY_RE = /^[a-z0-9-]{3,40}$/;
  const dayRef = (uid, day) => fs.doc(db, "users", uid, "days", day);
  const daysColl = (uid) => fs.collection(db, "users", uid, "days");
  const gameRef = (uid, id) => fs.doc(db, "users", uid, "games", id);
  const gamesColl = (uid) => fs.collection(db, "users", uid, "games");
  // Barátok és kocsmák
  const kocsmaRef = (kid) => fs.doc(db, "kocsmak", kid);
  const kMemberRef = (kid, uid) => fs.doc(db, "kocsmak", kid, "members", uid);
  const kMembersColl = (kid) => fs.collection(db, "kocsmak", kid, "members");
  const kMsgColl = (kid) => fs.collection(db, "kocsmak", kid, "messages");
  const kCodeRef = (code) => fs.doc(db, "kocsmaCodes", code);
  const friendRef = (uid, fid) => fs.doc(db, "users", uid, "friends", fid);
  const friendsColl = (uid) => fs.collection(db, "users", uid, "friends");
  const reqRef = (from, to) => fs.doc(db, "friendReqs", from + "_" + to);
  const reqColl = () => fs.collection(db, "friendReqs");
  const KCODE_RE = /^[a-z0-9]{8}$/;
  const objOf = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  function newKCode() {
    const a = "abcdefghjkmnpqrstuvwxyz23456789";
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => a[x % a.length]).join("");
  }
  const kLog = (action, target, kid, detail) => { const e = logEntry(action, target, null, detail); if (kid) e.kocsma = kid; return e; };
  // Sok dokumentum törlése kötegekben. A szabályok kötegenként legfeljebb 20 get/exists hívást engednek, ezért ahol
  // a szabály dokumentumot olvas (pl. az alapító jogát ellenőrzi), kis kötegekkel dolgozunk.
  async function deleteRefs(refs, size) {
    for (let i = 0; i < refs.length; i += size) {
      const b = fs.writeBatch(db);
      refs.slice(i, i + size).forEach((r) => b.delete(r));
      await b.commit();
    }
  }
  // Új meghívókóddal ír egy köteget; ha a véletlen kód már foglalt (ritka), újat próbál.
  async function withNewCode(build) {
    let last = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = newKCode();
      try {
        await build(code).commit();
        return code;
      } catch (e) {
        last = e;
        let taken = false;
        if (e && e.code === "permission-denied") { try { taken = (await fs.getDoc(kCodeRef(code))).exists(); } catch (e2) {} }
        if (!taken) throw e;
      }
    }
    throw last;
  }
  // Egy kocsma teljes törlése: tagok, üzenetek, meghívókód, maga a kocsma. admin: a tulajdonos végzi (naplózva).
  async function wipeKocsma(kid, k, admin, label) {
    const ms = await fs.getDocs(kMembersColl(kid));
    const others = ms.docs.filter((d) => admin || d.id !== user.uid).map((d) => d.ref);
    await deleteRefs(others, admin ? 400 : 8);
    const msgs = await fs.getDocs(kMsgColl(kid));
    await deleteRefs(msgs.docs.map((d) => d.ref), admin ? 400 : 8);
    let codeExists = false;
    if (k && KCODE_RE.test(k.code)) { try { codeExists = (await fs.getDoc(kCodeRef(k.code))).exists(); } catch (e) {} }
    const b = fs.writeBatch(db);
    if (!admin) b.delete(kMemberRef(kid, user.uid));
    if (codeExists) b.delete(kCodeRef(k.code));
    b.delete(kocsmaRef(kid));
    if (admin) b.set(logRef(), kLog("kdelete", null, kid, label));
    await b.commit();
    if (!admin) await unlistKocsma(user.uid, kid);
  }
  // Egy ember eltávolítása egy kocsmából (kilépés, a tulajdonos törlése, fióktörlés). Ha ő az alapító, a legrégebbi
  // tag kapja meg a kocsmát; ha ő az utolsó tag, a kocsma minden adatával törlődik.
  async function removeFromKocsma(kid, uid, opts) {
    const o = opts || {};
    const ks = await fs.getDoc(kocsmaRef(kid));
    if (!ks.exists()) return "gone";
    const k = ks.data();
    const ms = await fs.getDocs(kMembersColl(kid));
    const others = ms.docs.filter((d) => d.id !== uid)
      .map((d) => ({ uid: d.id, at: Number(d.data().at) || 0 }))
      .sort((a, b) => a.at - b.at || (a.uid < b.uid ? -1 : 1));
    if (k.owner === uid && !others.length) {
      if (o.admin) await wipeKocsma(kid, k, true, o.label);
      else await wipeKocsma(kid, k, false);
      return "deleted";
    }
    let codeExists = false;
    if (KCODE_RE.test(k.code)) { try { codeExists = (await fs.getDoc(kCodeRef(k.code))).exists(); } catch (e) {} }
    const b = fs.writeBatch(db);
    if (k.owner === uid) b.set(kocsmaRef(kid), { owner: others[0].uid, updatedAt: Date.now() }, { merge: true });
    b.delete(kMemberRef(kid, uid));
    if (codeExists) b.set(kCodeRef(k.code), { m: { [uid]: fs.deleteField() } }, { merge: true });
    if (o.admin && o.log) b.set(logRef(), kLog("kkick", uid, kid, o.label));
    await b.commit();
    if (o.privat) await unlistKocsma(uid, kid);
    return k.owner === uid ? "transferred" : "left";
  }
  // A saját listából (private.kocsmak) egy kocsma kivétele. updateDoc: ha a dokumentum már nincs meg
  // (pl. a fiókot közben törölték), nem hozza létre újra.
  async function unlistKocsma(uid, kid) {
    try { await fs.updateDoc(privRef(uid), { ["kocsmak." + kid]: fs.deleteField(), updatedAt: Date.now() }); } catch (e) {}
  }
  const uniqRefs = (refs) => { const seen = new Set(); return refs.filter((r) => (seen.has(r.path) ? false : (seen.add(r.path), true))); };
  // Egy felhasználó üzenetei, barátságai és barátkérései (fióktörléshez).
  async function socialRefs(uid, kids) {
    const refs = [];
    for (const kid of kids) {
      try {
        const s = await fs.getDocs(fs.query(kMsgColl(kid), fs.where("uid", "==", uid)));
        s.docs.forEach((d) => refs.push(d.ref));
      } catch (e) { console.error(e); }
    }
    try {
      const fr = await fs.getDocs(friendsColl(uid));
      for (const d of fr.docs) refs.push(friendRef(d.id, uid), d.ref);
    } catch (e) { console.error(e); }
    for (const dir of ["from", "to"]) {
      try {
        const s = await fs.getDocs(fs.query(reqColl(), fs.where(dir, "==", uid)));
        s.docs.forEach((d) => refs.push(d.ref));
      } catch (e) { console.error(e); }
    }
    return refs;
  }

  /* ----- napi napló: egy nap dokumentuma -----
     { v: 2, cats: { shot: { "Unicum": 2 }, wine: {}, beer: {}, water: {} }, recent: [{c, d, t}],
       party: kód | null, mig: [régi buli kódok, amelyeket már átírtunk ide], updatedAt } */
  function dayCats(data) {
    const out = {};
    for (const cid of CAT_IDS) {
      out[cid] = Object.create(null); // az italnevek mezőnevek: így egy „constructor” nevű ital sem gond
      const src = data && data.cats && data.cats[cid] && typeof data.cats[cid] === "object" ? data.cats[cid] : {};
      for (const [name, v] of Object.entries(src)) {
        const n = Math.floor(Number(v));
        if (name && n > 0) out[cid][name] = Math.min(9999, n);
      }
    }
    return out;
  }
  function cleanRecent(list, max) {
    const out = [];
    for (const r of Array.isArray(list) ? list : []) {
      if (!r || !CAT_IDS.includes(r.c) || typeof r.d !== "string" || !r.d) continue;
      out.push({ c: r.c, d: r.d, t: Number(r.t) > 0 ? Number(r.t) : 0 });
    }
    out.sort((a, b) => b.t - a.t);
    return out.slice(0, max);
  }
  // Egy buli résztvevői dokumentuma a felhasználó azon napjainak összege, amelyek ehhez a bulihoz tartoznak.
  // Ugyanez a számolás van az app.js-ben (deriveParty) is; a kettőnek egyeznie kell.
  function deriveFromDays(days, name) {
    const sums = {};
    for (const cid of CAT_IDS) sums[cid] = new Map();
    let recent = [];
    for (const d of days) {
      const cats = dayCats(d);
      for (const cid of CAT_IDS) {
        for (const [nm, n] of Object.entries(cats[cid])) sums[cid].set(nm, Math.min(9999, (sums[cid].get(nm) || 0) + n));
      }
      recent = recent.concat(cleanRecent(d.recent, 20));
    }
    const out = { v: 1, name, cats: {}, recent: cleanRecent(recent, 8), updatedAt: Date.now() };
    for (const cid of CAT_IDS) {
      out.cats[cid] = { items: [...sums[cid]].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([nm, n]) => ({ name: nm, n })), custom: [], quick: null };
    }
    return out;
  }
  function dayDocOut(data, cats, recent, party) {
    const o = { v: 2, cats, recent, party: party || null, updatedAt: Date.now() };
    if (data && Array.isArray(data.mig)) o.mig = data.mig.filter((c) => typeof c === "string").slice(-100);
    return o;
  }
  // Tulajdonosi számláló-javítás egy résztvevő dokumentumán. Visszaadja a darabszám-változásokat kategóriánként.
  function applyOwnerOps(data, ops) {
    const out = { v: 1, name: data.name, cats: {}, recent: Array.isArray(data.recent) ? data.recent.slice(0, 8) : [], updatedAt: Date.now() };
    const changes = {};
    for (const cid of CAT_IDS) {
      const c = data.cats && data.cats[cid] && typeof data.cats[cid] === "object" ? data.cats[cid] : {};
      out.cats[cid] = {
        items: (Array.isArray(c.items) ? c.items : []).filter((i) => i && typeof i.name === "string" && Number(i.n) > 0).map((i) => ({ name: i.name, n: Math.floor(Number(i.n)) })),
        custom: Array.isArray(c.custom) ? c.custom.filter((x) => typeof x === "string").slice(0, 30) : [],
        quick: typeof c.quick === "string" ? c.quick : null,
      };
    }
    for (const op of ops) {
      if (op.type === "reset") {
        for (const cid of CAT_IDS) {
          const sum = out.cats[cid].items.reduce((a, i) => a + i.n, 0);
          if (sum) changes[cid] = (changes[cid] || 0) - sum;
          out.cats[cid].items = [];
        }
        out.recent = [];
      } else if (op.type === "bump" && CAT_IDS.includes(op.cid) && typeof op.name === "string" && op.name) {
        const c = out.cats[op.cid];
        let it = c.items.find((i) => i.name === op.name);
        const cur = it ? it.n : 0;
        const next = Math.max(0, Math.min(9999, cur + (op.delta > 0 ? 1 : -1)));
        if (next === cur) continue;
        if (!it) { it = { name: op.name, n: 0 }; c.items.push(it); }
        it.n = next;
        if (next === 0) c.items = c.items.filter((i) => i !== it);
        changes[op.cid] = (changes[op.cid] || 0) + (next - cur);
      }
    }
    return { out, changes };
  }

  // Felhasználónév-rekord: e-mail nélküli fióknál a belső cím, e-mailes fióknál csak egy jelzés.
  function mappingFor(u, username, extra) {
    const m = { uid: u.uid, username, createdAt: Date.now() };
    if (isSynthetic(u.email)) m.email = u.email; else m.hasEmail = true;
    return Object.assign(m, extra || {});
  }
  async function claim(u, username, key, consent) {
    const batch = fs.writeBatch(db);
    batch.set(nameRef(key), mappingFor(u, username));
    batch.set(userRef(u.uid), { v: 1, username, usernameKey: key, updatedAt: Date.now() }, { merge: true });
    if (consent) batch.set(privRef(u.uid), { consent, updatedAt: Date.now() }, { merge: true });
    await batch.commit();
  }
  async function reauth(password) {
    const u = auth.currentUser;
    await authMod.reauthenticateWithCredential(u, authMod.EmailAuthProvider.credential(u.email, password));
    return u;
  }
  const watchColl = (ref, next, onError) => fs.onSnapshot(ref, { includeMetadataChanges: true },
    (snap) => next({ fromCache: snap.metadata.fromCache, docs: snap.docs.map((d) => ({ id: d.id, data: d.data() })) }),
    (e) => onError(e));

  // Ha a fiók már valódi e-mail-címmel működik, a nyilvános név-rekordban ne maradjon belső cím.
  if (!user.isAnonymous && user.email && !isSynthetic(user.email)) {
    (async () => {
      try {
        const prof = await fs.getDoc(userRef(user.uid));
        const key = prof.exists() ? prof.data().usernameKey : null;
        if (!key) return;
        const m = await fs.getDoc(nameRef(key));
        if (!m.exists() || m.data().uid !== user.uid) return;
        const d = m.data();
        if ("email" in d || d.emailPending || !d.hasEmail) {
          await fs.setDoc(nameRef(key), { uid: user.uid, username: d.username, createdAt: d.createdAt || Date.now(), hasEmail: true });
        }
      } catch (e) { console.error(e); }
    })();
  }

  hand({
    uid: user.uid,
    isAnonymous: user.isAnonymous,
    email: user.isAnonymous ? "" : (user.email || ""),
    emailIsReal: !user.isAnonymous && !!user.email && !isSynthetic(user.email),
    emailVerified: !!user.emailVerified,

    /* ----- fiók ----- */
    async hasLegacyData() {
      const s = await fs.getDoc(userRef(user.uid));
      if (!s.exists()) return false;
      const t = s.data().total || {};
      return Object.values(t).some((v) => Number(v) > 0);
    },
    async getMyProfile() {
      const s = await fs.getDoc(userRef(user.uid));
      return s.exists() ? s.data() : null;
    },
    async getPrivate() {
      const s = await fs.getDoc(privRef(user.uid));
      return s.exists() ? s.data() : null;
    },
    saveConsent(consent) {
      return fs.setDoc(privRef(user.uid), { consent, updatedAt: Date.now() }, { merge: true });
    },
    recordParties(codes) {
      const parties = {};
      for (const c of codes || []) if (typeof c === "string" && /^[a-z0-9-]{3,40}$/.test(c)) parties[c] = Date.now();
      if (!Object.keys(parties).length) return Promise.resolve();
      return fs.setDoc(privRef(user.uid), { parties, updatedAt: Date.now() }, { merge: true });
    },
    async lookupUsername(key) {
      const s = await fs.getDoc(nameRef(key));
      return s.exists() ? s.data() : null;
    },
    async signUp(username, key, password, email, consent) {
      let u = auth.currentUser;
      const real = !!email;
      for (let attempt = 0; ; attempt++) {
        const address = real ? email : randomLocal() + "@" + emailDomain;
        try {
          if (u && u.isAnonymous) {
            u = (await authMod.linkWithCredential(u, authMod.EmailAuthProvider.credential(address, password))).user;
          } else {
            u = (await authMod.createUserWithEmailAndPassword(auth, address, password)).user;
          }
          break;
        } catch (e) {
          const retry = !real && e && (e.code === "auth/email-already-in-use" || e.code === "auth/credential-already-in-use");
          if (!retry || attempt >= 2) throw e;
        }
      }
      await u.getIdToken(true);
      try {
        await claim(u, username, key, consent);
      } catch (e) {
        console.error(e);
        throw err("app/claim-failed");
      }
      if (real) {
        try { await withContinue((s) => authMod.sendEmailVerification(u, s)); } catch (e) { console.error(e); }
      }
    },
    async claimUsername(username, key) {
      const u = auth.currentUser;
      await u.getIdToken(true);
      await claim(u, username, key, null);
    },
    // Belépés felhasználónévvel (e-mail nélküli fiók) vagy e-mail-címmel.
    async signIn(identifier, password) {
      if (identifier.includes("@")) {
        await authMod.signInWithEmailAndPassword(auth, identifier.trim(), password);
        return;
      }
      const m = await fs.getDoc(nameRef(identifier));
      if (!m.exists()) throw err("app/no-user");
      const d = m.data();
      if (typeof d.email !== "string") throw err("app/use-email");
      try {
        await authMod.signInWithEmailAndPassword(auth, d.email, password);
      } catch (e) {
        const c = e && e.code;
        if (d.emailPending && ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"].includes(c)) {
          throw err("app/maybe-email");
        }
        throw e;
      }
    },
    async changeUsername(username, key, oldKey) {
      const u = auth.currentUser;
      let old = null;
      if (oldKey) { try { const s = await fs.getDoc(nameRef(oldKey)); if (s.exists() && s.data().uid === u.uid) old = s.data(); } catch (e) {} }
      const extra = old && old.emailPending && isSynthetic(u.email) ? { emailPending: true } : null;
      const batch = fs.writeBatch(db);
      batch.set(nameRef(key), mappingFor(u, username, extra));
      if (old && oldKey !== key) batch.delete(nameRef(oldKey));
      batch.set(userRef(u.uid), { username, usernameKey: key, updatedAt: Date.now() }, { merge: true });
      await batch.commit();
    },
    // Saját e-mail-cím hozzáadása: megerősítő levelet küld; a cím csak a linkre kattintás után lesz a fiók címe.
    async addEmail(email, password) {
      const u = await reauth(password);
      await withContinue((s) => authMod.verifyBeforeUpdateEmail(u, email, s));
      try {
        const prof = await fs.getDoc(userRef(u.uid));
        const key = prof.exists() ? prof.data().usernameKey : null;
        if (key) await fs.setDoc(nameRef(key), { emailPending: true }, { merge: true });
      } catch (e) { console.error(e); }
    },
    async resendVerification() {
      const u = auth.currentUser;
      await withContinue((s) => authMod.sendEmailVerification(u, s));
    },
    async sendReset(email) {
      await withContinue((s) => authMod.sendPasswordResetEmail(auth, email.trim(), s));
    },
    // Fiók törlése: minden adat, amiről tudunk, aztán maga a fiók.
    async deleteAccount(password, extraParties, extraKocsmak) {
      const u = await reauth(password);
      const codes = new Set();
      for (const c of extraParties || []) codes.add(c);
      let priv = {};
      try {
        const p = await fs.getDoc(privRef(u.uid));
        if (p.exists()) priv = p.data();
        if (priv.parties && typeof priv.parties === "object") Object.keys(priv.parties).forEach((c) => codes.add(c));
      } catch (e) { console.error(e); }
      // Kocsmák: kilépés mindegyikből (alapítóként a legrégebbi tag kapja meg, utolsó tagként a kocsma törlődik).
      const kids = new Set([...Object.keys(objOf(priv.kocsmak)), ...(extraKocsmak || [])]);
      for (const kid of kids) {
        try { await removeFromKocsma(kid, u.uid, {}); }
        catch (e) {
          console.error(e);
          try { await fs.deleteDoc(kMemberRef(kid, u.uid)); } catch (e2) {}
        }
      }
      // Üzenetek minden kocsmában, ahová írt; barátságok mindkét oldalon; barátkérések.
      const social = await socialRefs(u.uid, new Set([...kids, ...Object.keys(objOf(priv.kmsg))]));
      let key = null;
      try { const prof = await fs.getDoc(userRef(u.uid)); if (prof.exists()) key = prof.data().usernameKey || null; } catch (e) {}
      const refs = [...social];
      // Napi napló és saját ivós játékok (a napokból azt is megtudjuk, melyik bulikban volt).
      const days = await fs.getDocs(daysColl(u.uid));
      for (const d of days.docs) {
        const p = d.data().party;
        if (typeof p === "string") codes.add(p);
        refs.push(d.ref);
      }
      const games = await fs.getDocs(gamesColl(u.uid));
      for (const g of games.docs) refs.push(g.ref);
      for (const c of [...codes]) {
        if (typeof c === "string" && /^[a-z0-9-]{3,40}$/.test(c)) refs.push(playerRef(c, u.uid), voteRef(c, u.uid));
      }
      if (key) {
        try { const m = await fs.getDoc(nameRef(key)); if (m.exists() && m.data().uid === u.uid) refs.push(nameRef(key)); } catch (e) {}
      }
      refs.push(userRef(u.uid), privRef(u.uid));
      await deleteRefs(uniqRefs(refs), 400);
      await authMod.deleteUser(u);
      try { await fs.terminate(db); await fs.clearIndexedDbPersistence(db); } catch (e) {}
    },
    async signOut() {
      try { await Promise.race([fs.waitForPendingWrites(db), new Promise((r) => setTimeout(r, 3000))]); } catch (e) {}
      await authMod.signOut(auth);
    },

    async isBanned() {
      const s = await fs.getDoc(bannedRef(user.uid));
      return s.exists();
    },

    /* ----- tulajdonosi műveletek: a szerver csak a tulajdonos fiókjának, friss jelszó után engedi ----- */
    async ownerUnlock(password) {
      const u = await reauth(password);
      await u.getIdToken(true);
    },
    watchBans(next, onError) {
      return fs.onSnapshot(fs.collection(db, "banned"),
        (snap) => next(snap.docs.map((d) => d.id)),
        (e) => onError(e));
    },
    async adminLog(limit) {
      const q = fs.query(fs.collection(db, "adminlog"), fs.orderBy("at", "desc"), fs.limit(limit || 20));
      const snap = await fs.getDocs(q);
      return snap.docs.map((d) => d.data());
    },
    async adminRename(uid, username, key, oldKey) {
      const target = await fs.getDoc(nameRef(key));
      if (target.exists() && target.data().uid !== uid) throw err("app/taken");
      let old = null;
      if (oldKey) { const s = await fs.getDoc(nameRef(oldKey)); if (s.exists() && s.data().uid === uid) old = s.data(); }
      const m = { uid, username, createdAt: Date.now() };
      if (old && typeof old.email === "string") m.email = old.email;
      else if (old && old.hasEmail) m.hasEmail = true;
      if (old && old.emailPending) m.emailPending = true;
      if (!old && target.exists()) {
        const t = target.data();
        if (typeof t.email === "string") m.email = t.email; else if (t.hasEmail) m.hasEmail = true;
      }
      const batch = fs.writeBatch(db);
      batch.set(nameRef(key), m);
      if (old && oldKey !== key) batch.delete(nameRef(oldKey));
      batch.set(userRef(uid), { username, usernameKey: key, updatedAt: Date.now() }, { merge: true });
      batch.set(logRef(), logEntry("rename", uid, null, (old ? old.username : "?") + " → " + username));
      await batch.commit();
    },
    async adminBan(uid, on, label) {
      const batch = fs.writeBatch(db);
      if (on) batch.set(bannedRef(uid), { at: Date.now() });
      else batch.delete(bannedRef(uid));
      batch.set(logRef(), logEntry(on ? "ban" : "unban", uid, null, label));
      await batch.commit();
    },
    async adminWipe(uid, extraParties, label) {
      const codes = new Set(extraParties || []);
      const p = await fs.getDoc(privRef(uid));
      const priv = p.exists() ? p.data() : {};
      if (priv.parties && typeof priv.parties === "object") Object.keys(priv.parties).forEach((c) => codes.add(c));
      // Kocsmák: eltávolítás (alapítóként a legrégebbi tag kapja meg, utolsó tagként a kocsma törlődik).
      const kids = new Set(Object.keys(objOf(priv.kocsmak)));
      for (const kid of kids) {
        try { await removeFromKocsma(kid, uid, { admin: true, label }); } catch (e) { console.error(e); }
      }
      const social = await socialRefs(uid, new Set([...kids, ...Object.keys(objOf(priv.kmsg))]));
      let key = null;
      const prof = await fs.getDoc(userRef(uid));
      if (prof.exists()) key = prof.data().usernameKey || null;
      const refs = [...social];
      const days = await fs.getDocs(daysColl(uid));
      for (const d of days.docs) {
        const pc = d.data().party;
        if (typeof pc === "string") codes.add(pc);
        refs.push(d.ref);
      }
      const games = await fs.getDocs(gamesColl(uid));
      for (const g of games.docs) refs.push(g.ref);
      for (const c of codes) if (typeof c === "string" && /^[a-z0-9-]{3,40}$/.test(c)) refs.push(playerRef(c, uid), voteRef(c, uid));
      if (key) { const m = await fs.getDoc(nameRef(key)); if (m.exists() && m.data().uid === uid) refs.push(nameRef(key)); }
      refs.push(userRef(uid), privRef(uid));
      const all = uniqRefs(refs);
      let first = true;
      for (let i = 0; i < all.length; i += 400) {
        const b = fs.writeBatch(db);
        all.slice(i, i + 400).forEach((r) => b.delete(r));
        if (first) { b.set(logRef(), logEntry("wipe", uid, null, label)); first = false; }
        await b.commit();
      }
    },
    async adminEditPlayer(party, uid, ops, statsDay, label) {
      // Ha a résztvevő már a napi naplót használja: a napjait javítjuk, és abból számoljuk újra a buli-összegét.
      const found = await fs.getDocs(fs.query(daysColl(uid), fs.where("party", "==", party)));
      const keys = found.docs.map((d) => d.id).filter((k) => DAY_RE.test(k)).sort();
      if (keys.length) {
        await fs.runTransaction(db, async (tx) => {
          const pref = playerRef(party, uid);
          const psnap = await tx.get(pref);
          const usnap = await tx.get(userRef(uid));
          const days = [];
          for (const k of keys) {
            const s = await tx.get(dayRef(uid, k));
            if (s.exists() && s.data().party === party) {
              days.push({ key: k, data: s.data(), cats: dayCats(s.data()), recent: cleanRecent(s.data().recent, 10), touched: false });
            }
          }
          if (!days.length) throw err("app/no-player");
          const changes = {};
          const note = (day, cid, d) => { const m = changes[day] || (changes[day] = {}); m[cid] = (m[cid] || 0) + d; };
          for (const op of ops) {
            if (op.type === "reset") {
              for (const d of days) {
                for (const cid of CAT_IDS) {
                  for (const n of Object.values(d.cats[cid])) note(d.key, cid, -n);
                  d.cats[cid] = Object.create(null);
                }
                d.recent = [];
                d.touched = true;
              }
            } else if (op.type === "bump" && CAT_IDS.includes(op.cid) && typeof op.name === "string" && op.name) {
              const up = op.delta > 0;
              // +1 a buli utolsó napjára, −1 a legutolsó olyan napról, amelyen van ilyen ital.
              const have = (d) => (typeof d.cats[op.cid][op.name] === "number" ? d.cats[op.cid][op.name] : 0);
              const target = up ? days[days.length - 1] : [...days].reverse().find((d) => have(d) > 0);
              if (!target) continue;
              const cur = have(target);
              const next = Math.max(0, Math.min(9999, cur + (up ? 1 : -1)));
              if (next === cur) continue;
              if (next) target.cats[op.cid][op.name] = next; else delete target.cats[op.cid][op.name];
              if (!up) {
                const i = target.recent.findIndex((r) => r.c === op.cid && r.d === op.name);
                if (i >= 0) target.recent.splice(i, 1);
              }
              target.touched = true;
              note(target.key, op.cid, next - cur);
            }
          }
          let name = psnap.exists() && typeof psnap.data().name === "string" ? psnap.data().name : "";
          if (!name && usnap.exists() && typeof usnap.data().username === "string") name = usnap.data().username;
          name = String(name || "Névtelen").slice(0, 24);
          for (const d of days) if (d.touched) tx.set(dayRef(uid, d.key), dayDocOut(d.data, d.cats, d.recent, party));
          tx.set(pref, deriveFromDays(days.map((d) => ({ cats: d.cats, recent: d.recent })), name));
          const inc = (o) => {
            const r = {};
            for (const [c, v] of Object.entries(o)) if (v) r[c] = fs.increment(v);
            return r;
          };
          const total = {}, years = {}, perDay = {};
          for (const [day, m] of Object.entries(changes)) {
            const y = day.slice(0, 4);
            for (const [cid, v] of Object.entries(m)) {
              if (!v) continue;
              total[cid] = (total[cid] || 0) + v;
              const yy = years[y] || (years[y] = {});
              yy[cid] = (yy[cid] || 0) + v;
              const dd = perDay[day] || (perDay[day] = {});
              dd[cid] = (dd[cid] || 0) + v;
            }
          }
          if (Object.keys(inc(total)).length) {
            const data = { total: inc(total), years: {}, days: {}, updatedAt: Date.now() };
            for (const [y, o] of Object.entries(years)) if (Object.keys(inc(o)).length) data.years[y] = inc(o);
            for (const [d, o] of Object.entries(perDay)) if (Object.keys(inc(o)).length) data.days[d] = inc(o);
            tx.set(userRef(uid), data, { merge: true });
          }
          tx.set(logRef(), logEntry(ops.some((o) => o.type === "reset") ? "reset" : "edit", uid, party, label));
        });
        return;
      }
      // Régi adat (a résztvevő még nem lépett át a napi naplóra): közvetlenül a buli-dokumentumot javítjuk.
      await fs.runTransaction(db, async (tx) => {
        const ref = playerRef(party, uid);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw err("app/no-player");
        const { out, changes } = applyOwnerOps(snap.data(), ops);
        tx.set(ref, out);
        const cats = Object.keys(changes).filter((c) => changes[c]);
        if (cats.length && /^\d{4}-\d{2}-\d{2}$/.test(statsDay)) {
          const y = statsDay.slice(0, 4);
          const inc = {};
          for (const c of cats) inc[c] = fs.increment(changes[c]);
          tx.set(userRef(uid), { total: inc, years: { [y]: inc }, days: { [statsDay]: inc }, updatedAt: Date.now() }, { merge: true });
        }
        tx.set(logRef(), logEntry(ops.some((o) => o.type === "reset") ? "reset" : "edit", uid, party, label));
      });
    },
    async adminClearVotesAbout(party, subject, label) {
      const snap = await fs.getDocs(fs.collection(db, "parties", party, "votes"));
      const batch = fs.writeBatch(db);
      for (const d of snap.docs) {
        const on = d.data().on;
        if (on && typeof on === "object" && subject in on) batch.set(d.ref, { on: { [subject]: fs.deleteField() }, updatedAt: Date.now() }, { merge: true });
      }
      batch.set(logRef(), logEntry("clearvotes", subject, party, label));
      await batch.commit();
    },
    async adminDeleteParty(party, label) {
      const [players, votes] = await Promise.all([
        fs.getDocs(fs.collection(db, "parties", party, "players")),
        fs.getDocs(fs.collection(db, "parties", party, "votes")),
      ]);
      // A résztvevők napjai megmaradnak (a napi naplójuk része), csak már nem tartoznak ehhez a bulihoz.
      const dayRefs = [];
      for (const p of players.docs) {
        const s = await fs.getDocs(fs.query(daysColl(p.id), fs.where("party", "==", party)));
        s.docs.forEach((d) => dayRefs.push(d.ref));
      }
      const ops = [
        ...dayRefs.map((r) => (b) => b.set(r, { party: null, updatedAt: Date.now() }, { merge: true })),
        ...[...players.docs.map((d) => d.ref), ...votes.docs.map((d) => d.ref), fs.doc(db, "parties", party)].map((r) => (b) => b.delete(r)),
      ];
      let first = true;
      for (let i = 0; i < ops.length; i += 400) {
        const b = fs.writeBatch(db);
        ops.slice(i, i + 400).forEach((f) => f(b));
        if (first) { b.set(logRef(), logEntry("deleteparty", null, party, label)); first = false; }
        await b.commit();
      }
    },

    /* ----- tulajdonosi műveletek a kocsmákon ----- */
    async adminListKocsmak() {
      const s = await fs.getDocs(fs.query(fs.collection(db, "kocsmak"), fs.limit(300)));
      return s.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
    async adminKocsmaDetail(kid) {
      const [k, ms, msgs] = await Promise.all([
        fs.getDoc(kocsmaRef(kid)),
        fs.getDocs(kMembersColl(kid)),
        fs.getDocs(fs.query(kMsgColl(kid), fs.orderBy("at", "desc"), fs.limit(100))),
      ]);
      return {
        kocsma: k.exists() ? k.data() : null,
        members: ms.docs.map((d) => ({ id: d.id, data: d.data() })),
        messages: msgs.docs.map((d) => ({ id: d.id, data: d.data() })),
      };
    },
    async adminDeleteKMessage(kid, mid, label) {
      const b = fs.writeBatch(db);
      b.delete(fs.doc(kMsgColl(kid), mid));
      b.set(logRef(), kLog("kmsg", null, kid, label));
      await b.commit();
    },
    // Tag eltávolítása: új meghívókóddal, hogy a régivel ne tudjon visszalépni. Az alapítót a legrégebbi tag váltja.
    async adminRemoveKMember(kid, uid, label) {
      const ks = await fs.getDoc(kocsmaRef(kid));
      if (!ks.exists()) throw err("app/no-kocsma");
      const k = ks.data();
      const ms = await fs.getDocs(kMembersColl(kid));
      const others = ms.docs.filter((d) => d.id !== uid).map((d) => ({ uid: d.id, at: Number(d.data().at) || 0 }))
        .sort((a, b) => a.at - b.at || (a.uid < b.uid ? -1 : 1));
      if (!others.length) { await wipeKocsma(kid, k, true, label); return "deleted"; }
      let oldExists = false;
      try { oldExists = (await fs.getDoc(kCodeRef(k.code))).exists(); } catch (e) {}
      const m = {};
      for (const o of others) m[o.uid] = o.at || Date.now();
      await withNewCode((code) => {
        const b = fs.writeBatch(db);
        b.delete(kMemberRef(kid, uid));
        if (oldExists) b.delete(kCodeRef(k.code));
        b.set(kCodeRef(code), { kid, name: k.name, icon: k.icon, m });
        const patch = { code, updatedAt: Date.now() };
        if (k.owner === uid) patch.owner = others[0].uid;
        b.set(kocsmaRef(kid), patch, { merge: true });
        b.set(logRef(), kLog("kkick", uid, kid, label));
        return b;
      });
      return "removed";
    },
    async adminDeleteKocsma(kid, label) {
      const ks = await fs.getDoc(kocsmaRef(kid));
      await wipeKocsma(kid, ks.exists() ? ks.data() : null, true, label);
    },

    /* ----- saját adatok élőben (a kocsmáim listája több telefon között is) ----- */
    watchPrivate(next, onError) {
      return fs.onSnapshot(privRef(user.uid), (snap) => next(snap.exists() ? snap.data() : null), (e) => onError(e));
    },

    /* ----- kocsmák ----- */
    watchKocsma(kid, next, onError) {
      return fs.onSnapshot(kocsmaRef(kid), (snap) => next(snap.exists() ? snap.data() : null), (e) => onError(e));
    },
    watchKMembers(kid, next, onError) {
      return watchColl(fs.query(kMembersColl(kid), fs.limit(200)), next, onError);
    },
    watchKMessages(kid, n, next, onError) {
      return watchColl(fs.query(kMsgColl(kid), fs.orderBy("at", "desc"), fs.limit(n)), next, onError);
    },
    async getKCode(code) {
      if (!KCODE_RE.test(code)) return null;
      const s = await fs.getDoc(kCodeRef(code));
      return s.exists() ? s.data() : null;
    },
    // Alapítás: a kocsma, az alapító tagsága és a meghívókód egyszerre jön létre.
    async createKocsma(name, icon) {
      const kid = fs.doc(fs.collection(db, "kocsmak")).id;
      const now = Date.now();
      const code = await withNewCode((c) => {
        const b = fs.writeBatch(db);
        b.set(kocsmaRef(kid), { name, icon, code: c, owner: user.uid, createdAt: now, updatedAt: now });
        b.set(kMemberRef(kid, user.uid), { at: now, code: c });
        b.set(kCodeRef(c), { kid, name, icon, m: { [user.uid]: now } });
        b.set(privRef(user.uid), { kocsmak: { [kid]: now }, kmsg: { [kid]: now }, updatedAt: now }, { merge: true });
        return b;
      });
      return { kid, code };
    },
    async joinKocsma(kid, code) {
      const now = Date.now();
      const b = fs.writeBatch(db);
      b.set(kMemberRef(kid, user.uid), { at: now, code });
      b.set(kCodeRef(code), { m: { [user.uid]: now } }, { merge: true });
      b.set(privRef(user.uid), { kocsmak: { [kid]: now }, kmsg: { [kid]: now }, updatedAt: now }, { merge: true });
      await b.commit();
    },
    leaveKocsma(kid) { return removeFromKocsma(kid, user.uid, { privat: true }); },
    // Átnevezés vagy új profilkép (csak az alapító): a meghívókód előnézete is frissül.
    async updateKocsma(kid, patch) {
      const ks = await fs.getDoc(kocsmaRef(kid));
      if (!ks.exists()) throw err("app/no-kocsma");
      const k = ks.data();
      const p = {};
      if (typeof patch.name === "string") p.name = patch.name;
      if (typeof patch.icon === "string") p.icon = patch.icon;
      let codeExists = false;
      try { codeExists = (await fs.getDoc(kCodeRef(k.code))).exists(); } catch (e) {}
      const b = fs.writeBatch(db);
      b.set(kocsmaRef(kid), Object.assign({ updatedAt: Date.now() }, p), { merge: true });
      if (codeExists) b.set(kCodeRef(k.code), p, { merge: true });
      await b.commit();
    },
    // Új meghívókód (csak az alapító); removeUid: egy tag eltávolítása ugyanebben a lépésben.
    async rotateKCode(kid, removeUid) {
      const ks = await fs.getDoc(kocsmaRef(kid));
      if (!ks.exists()) throw err("app/no-kocsma");
      const k = ks.data();
      const ms = await fs.getDocs(kMembersColl(kid));
      const m = {};
      for (const d of ms.docs) if (d.id !== removeUid) m[d.id] = Number(d.data().at) || Date.now();
      let oldExists = false;
      try { oldExists = (await fs.getDoc(kCodeRef(k.code))).exists(); } catch (e) {}
      return withNewCode((code) => {
        const b = fs.writeBatch(db);
        if (removeUid) b.delete(kMemberRef(kid, removeUid));
        if (oldExists) b.delete(kCodeRef(k.code));
        b.set(kCodeRef(code), { kid, name: k.name, icon: k.icon, m });
        b.set(kocsmaRef(kid), { code, updatedAt: Date.now() }, { merge: true });
        return b;
      });
    },
    async deleteKocsma(kid) {
      const ks = await fs.getDoc(kocsmaRef(kid));
      if (!ks.exists()) return;
      await wipeKocsma(kid, ks.data(), false);
    },
    // Ha a kocsma megszűnt, vagy kikerültem belőle: a saját nyomaim eltakarítása (ha maradt).
    async cleanupKocsma(kid) {
      try { await fs.deleteDoc(kMemberRef(kid, user.uid)); } catch (e) {}
      await unlistKocsma(user.uid, kid);
    },
    // Ha az alapító már nem tag, a legrégebbi tag átveszi a kocsmát (a szabály csak ekkor engedi).
    claimKocsma(kid) {
      return fs.setDoc(kocsmaRef(kid), { owner: user.uid, updatedAt: Date.now() }, { merge: true });
    },
    // Az alapító rendbe teszi a meghívókód előnézetét: benne csak a mostani tagok legyenek (pl. ha egy letiltott
    // tag törölte a fiókját, és ezért nem tudta magát kivenni belőle).
    async repairKCode(kid) {
      const ks = await fs.getDoc(kocsmaRef(kid));
      if (!ks.exists() || ks.data().owner !== user.uid || !KCODE_RE.test(ks.data().code)) return false;
      const k = ks.data();
      const [ms, cs] = await Promise.all([fs.getDocs(kMembersColl(kid)), fs.getDoc(kCodeRef(k.code))]);
      const m = {};
      for (const d of ms.docs) m[d.id] = Number(d.data().at) || Date.now();
      const cur = cs.exists() ? objOf(cs.data().m) : null;
      const same = cur && Object.keys(cur).length === Object.keys(m).length && Object.keys(m).every((u) => u in cur)
        && cs.data().name === k.name && cs.data().icon === k.icon && cs.data().kid === kid;
      if (same) return false;
      await fs.setDoc(kCodeRef(k.code), { kid, name: k.name, icon: k.icon, m });
      return true;
    },
    setKocsmaParty(kid, party) {
      return fs.setDoc(kocsmaRef(kid), { party, updatedAt: Date.now() }, { merge: true });
    },
    sendKMessage(kid, text) {
      const ref = fs.doc(kMsgColl(kid));
      return { id: ref.id, done: fs.setDoc(ref, { uid: user.uid, text, at: Date.now() }) };
    },
    deleteKMessage(kid, mid) { return fs.deleteDoc(fs.doc(kMsgColl(kid), mid)); },

    /* ----- barátok ----- */
    watchFriends(next, onError) {
      return watchColl(fs.query(friendsColl(user.uid), fs.limit(500)), next, onError);
    },
    // dir: "from" (az általam küldött kérések) vagy "to" (nekem küldött kérések)
    watchFriendReqs(dir, next, onError) {
      return watchColl(fs.query(reqColl(), fs.where(dir, "==", user.uid), fs.limit(200)), next, onError);
    },
    sendFriendRequest(to) {
      return fs.setDoc(reqRef(user.uid, to), { from: user.uid, to, at: Date.now() });
    },
    // Elfogadás: mindkét barátság-dokumentum és a kérés törlése egy lépésben (ha én is jelöltem, az is törlődik).
    async acceptFriend(from, alsoMine) {
      const now = Date.now();
      const b = fs.writeBatch(db);
      b.set(friendRef(user.uid, from), { at: now });
      b.set(friendRef(from, user.uid), { at: now });
      b.delete(reqRef(from, user.uid));
      if (alsoMine) b.delete(reqRef(user.uid, from));
      await b.commit();
    },
    declineFriend(from) { return fs.deleteDoc(reqRef(from, user.uid)); },
    cancelFriendRequest(to) { return fs.deleteDoc(reqRef(user.uid, to)); },
    async removeFriend(fid) {
      const b = fs.writeBatch(db);
      b.delete(friendRef(user.uid, fid));
      b.delete(friendRef(fid, user.uid));
      await b.commit();
    },
    // Kocsma-meghívó egy barátnak: a barát saját barátlistájában, az én dokumentumomba kerül.
    sendKInvite(fid, invite) {
      return fs.setDoc(friendRef(fid, user.uid), { invite }, { merge: true });
    },
    dismissKInvite(fid) {
      return fs.setDoc(friendRef(user.uid, fid), { invite: fs.deleteField() }, { merge: true });
    },

    /* ----- egy buli résztvevői ----- */
    watchPlayers(party, next, onError) {
      return watchColl(fs.query(fs.collection(db, "parties", party, "players"), fs.limit(300)), next, onError);
    },
    async getPlayer(party, uid) {
      const s = await fs.getDoc(playerRef(party, uid));
      return s.exists() ? s.data() : null;
    },
    setPlayer(party, uid, data) { return fs.setDoc(playerRef(party, uid), data); },
    deletePlayer(party, uid) { return fs.deleteDoc(playerRef(party, uid)); },
    // Az átálláshoz mindig a szerver friss adata kell (nem a telefonon tárolt másolat).
    async getPlayerFresh(party, uid) {
      const s = await fs.getDocFromServer(playerRef(party, uid));
      return s.exists() ? s.data() : null;
    },
    async getPartyMetaFresh(party) {
      const s = await fs.getDocFromServer(fs.doc(db, "parties", party));
      return s.exists() ? s.data() : null;
    },

    /* ----- napi napló (csak a felhasználó látja) ----- */
    watchDays(next, onError) {
      return watchColl(fs.query(daysColl(user.uid), fs.limit(3000)), next, onError);
    },
    // Ital hozzáadása vagy levonása egy napon. Atomikus növelés, így két telefon sem írja felül egymást.
    addToDay(day, changes, recent) {
      if (!DAY_RE.test(day)) return Promise.reject(err("app/bad-day"));
      const cats = {};
      for (const ch of changes || []) {
        const delta = Math.trunc(Number(ch && ch.delta));
        if (!ch || !CAT_IDS.includes(ch.cid) || typeof ch.name !== "string" || !ch.name || !delta) continue;
        const m = cats[ch.cid] || (cats[ch.cid] = {});
        m[ch.name] = fs.increment(delta);
      }
      const data = { v: 2, updatedAt: Date.now() };
      if (Object.keys(cats).length) data.cats = cats;
      if (Array.isArray(recent)) data.recent = cleanRecent(recent, 10);
      return fs.setDoc(dayRef(user.uid, day), data, { merge: true });
    },
    setDayParty(day, party) {
      if (!DAY_RE.test(day)) return Promise.reject(err("app/bad-day"));
      if (party != null && !PARTY_RE.test(party)) return Promise.reject(err("app/bad-party"));
      return fs.setDoc(dayRef(user.uid, day), { v: 2, party: party || null, updatedAt: Date.now() }, { merge: true });
    },
    // Átállás: egy régi buli-számláló áthelyezése a buli napjára. Ismételhető: a mig lista jelzi, ha már megtörtént.
    // Eredmény: "created" | "merged" (a napon már volt bulihoz nem rendelt ital) | "done" (már megvolt) | "collision" (a nap másik bulié).
    async migrateParty(party, day, cats, recent) {
      if (!DAY_RE.test(day) || !PARTY_RE.test(party)) throw err("app/bad-day");
      return fs.runTransaction(db, async (tx) => {
        const ref = dayRef(user.uid, day);
        const s = await tx.get(ref);
        const cur = s.exists() ? s.data() : null;
        const mig = cur && Array.isArray(cur.mig) ? cur.mig.filter((c) => typeof c === "string") : [];
        if (mig.includes(party)) return "done";
        if (cur && typeof cur.party === "string" && cur.party && cur.party !== party) return "collision";
        const merged = dayCats(cur);
        const had = CAT_IDS.some((cid) => Object.keys(merged[cid]).length > 0);
        const add = dayCats({ cats });
        for (const cid of CAT_IDS) {
          for (const [nm, n] of Object.entries(add[cid])) merged[cid][nm] = Math.min(9999, (typeof merged[cid][nm] === "number" ? merged[cid][nm] : 0) + n);
        }
        tx.set(ref, {
          v: 2, cats: merged,
          recent: cleanRecent([...((cur && Array.isArray(cur.recent)) ? cur.recent : []), ...(recent || [])], 10),
          party, mig: [...mig, party].slice(-100), updatedAt: Date.now(),
        });
        return had ? "merged" : "created";
      });
    },
    finishMigration(v, drinks) {
      const data = { migrated: v, updatedAt: Date.now() };
      if (drinks) data.drinks = drinks;
      return fs.setDoc(privRef(user.uid), data, { merge: true });
    },
    // Saját italnevek és az utoljára választott fajta kategóriánként.
    savePrefs(drinks) {
      return fs.setDoc(privRef(user.uid), { drinks, updatedAt: Date.now() }, { merge: true });
    },

    /* ----- saját ivós játékok (csak a felhasználó látja) ----- */
    watchGames(next, onError) {
      return watchColl(fs.query(gamesColl(user.uid), fs.limit(500)), next, onError);
    },
    saveGame(id, data) {
      const ref = id ? gameRef(user.uid, id) : fs.doc(gamesColl(user.uid));
      return { id: ref.id, done: fs.setDoc(ref, data) };
    },
    deleteGame(id) { return fs.deleteDoc(gameRef(user.uid, id)); },

    /* ----- a buli neve és kezdete ----- */
    watchParty(party, next, onError) {
      return fs.onSnapshot(fs.doc(db, "parties", party),
        (snap) => next(snap.exists() ? snap.data() : null),
        (e) => onError(e));
    },
    async getPartyMeta(party) {
      const s = await fs.getDoc(fs.doc(db, "parties", party));
      return s.exists() ? s.data() : null;
    },
    setPartyMeta(party, data) { return fs.setDoc(fs.doc(db, "parties", party), data); },

    /* ----- hányás-szavazás: mindenki a saját szavazatait írja ----- */
    watchVotes(party, next, onError) {
      return watchColl(fs.collection(db, "parties", party, "votes"), next, onError);
    },
    setVote(party, subject, value) {
      let entry;
      if (value === null) entry = fs.deleteField();
      else if (value === true) entry = { v: true };
      else entry = { v: false, n: fs.deleteField() };
      return fs.setDoc(voteRef(party), { on: { [subject]: entry }, updatedAt: Date.now() }, { merge: true });
    },
    setVoteCount(party, subject, n) {
      return fs.setDoc(voteRef(party), { on: { [subject]: { n } }, updatedAt: Date.now() }, { merge: true });
    },

    /* ----- éves, összesített és napi statisztika (atomikus növelés) ----- */
    watchStats(next, onError) {
      return watchColl(fs.query(fs.collection(db, "users"), fs.limit(500)), next, onError);
    },
    addStats(uid, delta) {
      const data = { v: 1, updatedAt: Date.now() };
      const total = {};
      for (const part of ["years", "days"]) {
        const out = {};
        for (const [k, counts] of Object.entries((delta && delta[part]) || {})) {
          const o = {};
          for (const [c, v] of Object.entries(counts)) {
            if (!v) continue;
            o[c] = fs.increment(v);
            if (part === "years") total[c] = (total[c] || 0) + v;
          }
          if (Object.keys(o).length) out[k] = o;
        }
        if (Object.keys(out).length) data[part] = out;
      }
      const totalInc = {};
      for (const [c, v] of Object.entries(total)) if (v) totalInc[c] = fs.increment(v);
      if (Object.keys(totalInc).length) data.total = totalInc;
      if (!data.years && !data.days) return Promise.resolve();
      return fs.setDoc(userRef(uid), data, { merge: true });
    },
  });
})();
