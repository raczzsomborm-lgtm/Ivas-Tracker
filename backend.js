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
    async deleteAccount(password, extraParties) {
      const u = await reauth(password);
      const codes = new Set();
      for (const c of extraParties || []) codes.add(c);
      try {
        const p = await fs.getDoc(privRef(u.uid));
        if (p.exists() && p.data().parties && typeof p.data().parties === "object") Object.keys(p.data().parties).forEach((c) => codes.add(c));
      } catch (e) { console.error(e); }
      let key = null;
      try { const prof = await fs.getDoc(userRef(u.uid)); if (prof.exists()) key = prof.data().usernameKey || null; } catch (e) {}
      const refs = [];
      for (const c of [...codes]) {
        if (typeof c === "string" && /^[a-z0-9-]{3,40}$/.test(c)) refs.push(playerRef(c, u.uid), voteRef(c, u.uid));
      }
      if (key) {
        try { const m = await fs.getDoc(nameRef(key)); if (m.exists() && m.data().uid === u.uid) refs.push(nameRef(key)); } catch (e) {}
      }
      refs.push(userRef(u.uid), privRef(u.uid));
      for (let i = 0; i < refs.length; i += 400) {
        const b = fs.writeBatch(db);
        refs.slice(i, i + 400).forEach((r) => b.delete(r));
        await b.commit();
      }
      await authMod.deleteUser(u);
      try { await fs.terminate(db); await fs.clearIndexedDbPersistence(db); } catch (e) {}
    },
    async signOut() {
      try { await Promise.race([fs.waitForPendingWrites(db), new Promise((r) => setTimeout(r, 3000))]); } catch (e) {}
      await authMod.signOut(auth);
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
