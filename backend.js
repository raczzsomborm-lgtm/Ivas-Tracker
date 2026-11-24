/* Strigula – Firebase kapcsolat. Anonim belépés + Firestore, offline gyorsítótárral. */
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

  let app, db, auth;
  try {
    app = appMod.initializeApp(cfg);
    try {
      db = fs.initializeFirestore(app, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      });
    } catch (e) {
      db = fs.getFirestore(app);
    }
    auth = authMod.getAuth(app);
  } catch (e) {
    console.error(e);
    hand(null, "noconfig");
    return;
  }

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
    if (!user) user = (await authMod.signInAnonymously(auth)).user;
  } catch (e) {
    console.error(e);
    const c = (e && e.code) || "";
    if (c === "auth/operation-not-allowed" || c === "auth/admin-restricted-operation") hand(null, "authoff");
    else if (c === "auth/network-request-failed") hand(null, "offline");
    else hand(null, "error");
    return;
  }

  const playerRef = (party, uid) => fs.doc(db, "parties", party, "players", uid);

  hand({
    uid: user.uid,
    watchPlayers(party, next, onError) {
      const q = fs.query(fs.collection(db, "parties", party, "players"), fs.limit(300));
      return fs.onSnapshot(q, { includeMetadataChanges: true },
        (snap) => next({
          fromCache: snap.metadata.fromCache,
          docs: snap.docs.map((d) => ({ id: d.id, data: d.data() })),
        }),
        (err) => onError(err));
    },
    async getPlayer(party, uid) {
      const s = await fs.getDoc(playerRef(party, uid));
      return s.exists() ? s.data() : null;
    },
    setPlayer(party, uid, data) {
      return fs.setDoc(playerRef(party, uid), data);
    },
    deletePlayer(party, uid) {
      return fs.deleteDoc(playerRef(party, uid));
    },
    // A buli neve és kezdete: parties/{party}
    watchParty(party, next, onError) {
      return fs.onSnapshot(fs.doc(db, "parties", party),
        (snap) => next(snap.exists() ? snap.data() : null),
        (err) => onError(err));
    },
    async getPartyMeta(party) {
      const s = await fs.getDoc(fs.doc(db, "parties", party));
      return s.exists() ? s.data() : null;
    },
    setPartyMeta(party, data) {
      return fs.setDoc(fs.doc(db, "parties", party), data);
    },
    // Éves és összesített statisztika: users/{uid}, atomikus növeléssel,
    // így több eszközről vagy gyenge netről is pontos marad.
    watchStats(next, onError) {
      const q = fs.query(fs.collection(db, "users"), fs.limit(500));
      return fs.onSnapshot(q, { includeMetadataChanges: true },
        (snap) => next({
          fromCache: snap.metadata.fromCache,
          docs: snap.docs.map((d) => ({ id: d.id, data: d.data() })),
        }),
        (err) => onError(err));
    },
    addStats(uid, byYear) {
      const total = {};
      const years = {};
      for (const [y, counts] of Object.entries(byYear)) {
        const yc = {};
        for (const [k, v] of Object.entries(counts)) {
          if (!v) continue;
          yc[k] = fs.increment(v);
          total[k] = (total[k] || 0) + v;
        }
        if (Object.keys(yc).length) years[y] = yc;
      }
      const totalInc = {};
      for (const [k, v] of Object.entries(total)) if (v) totalInc[k] = fs.increment(v);
      const data = { v: 1, updatedAt: Date.now() };
      if (Object.keys(totalInc).length) data.total = totalInc;
      if (Object.keys(years).length) data.years = years;
      return fs.setDoc(fs.doc(db, "users", uid), data, { merge: true });
    },
  });
})();
