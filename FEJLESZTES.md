# Másnapló – fejlesztési leírás (átadás új beszélgetéshez)

Ez a fájl minden eddigi döntést és a következő fejlesztési ütemek tervét tartalmazza.
Új beszélgetésben ezt, a teljes projektmappát és a tesztcsomagot (`masnaplo-tesztek.zip`) kell átadni, és innen lehet folytatni.

## 1. A jelenlegi állapot (v13: az 1a., az 1b. ütem és a Felhasználási feltételek kész; v10: hányás a havi ranglistában; v11: kocsma-javítás, minden fogyasztás nullázása; v12: beépített ivós játékok, ital-ikonok, Jelvényeim; v13: megosztott játékok, világos/sötét mód)

**Hosting:** GitHub Pages (repó: „Ivas Tracker”), Firebase projekt: `ivas-tracker` (Spark, ingyenes).
**Firebase:** Authentication (Anonymous + Email/Password), Firestore (`(default)`, európai hely).

### Fájlok
- `index.html` – teljes CSS, fejléc (MÁSNAPLÓ logó + dőlt mottó), alsó sáv (`#nav`), lebegő gombok (`#fab`, `#gameFab`),
  `app.js?v=13`, `backend.js?v=13`.
- `app.js` – egy IIFE, állapot az `S` objektumban. Fázisok: `boot | auth | pickname | consent | banned | loading | ready | …`.
  Statikus nézetek (nem rajzolódnak újra adatfrissítéskor): auth, pickname, consent, banned.
  `ready` fázisban fülek: `S.tab` = `games | calendar | kocsma | map | profile`. Az Ivós játékok fül kulcsolt nézet
  (a keresőmező megmarad, csak a lista frissül). Lapok (`openSheet`): dinamikusak (`add`, `day`, `daycat`, `pcat`) és
  statikusak (űrlapok: `join`, `partyName`, `otherDay`, `game`, `account`, `owner`, `ownerUser`, `privacy`, `terms`, `delete`, `confirm`, `daysPick`,
  és az 1b-ben: `kList`, `kNew`, `kJoin`, `kSet`, `kInvite`, `kPick`, `fAdd`, `ownerKocsmak`, `ownerKocsma`).
  Egy lap `back` mezővel vissza gombot kap (pl. a `terms` és a `privacy` egymásra hivatkozik, és vissza lehet lépni).
  A `confirm` lap `title` és `safe` (nem piros gomb) mezőt is kaphat.
  A Kocsma fülön a chat kulcsolt nézet (`S.kScreen = "chat"`; a beviteli mező megmarad, csak az üzenetek frissülnek: `updateChat`).
  Gépelés közben (`body.chat-typing`) az alsó sáv eltűnik, és a beviteli sáv a billentyűzet fölé kerül: Androidon a
  `interactive-widget=resizes-content` (viewport meta), iOS-en a `visualViewport` alapján számolt `--kb` CSS-változó.
  Egy felhasználó profilja (`userView`): a Kocsma fülön `S.kUser`, a Profil fülön `S.profUser`.
- `backend.js` – Firebase modular SDK 10.12.2 dinamikus importtal (gstatic), `hand(backendObj)` adja át az appnak.
  Offline gyorsítótár (persistentLocalCache). Minden adatművelet itt van függvényként.
- `config.js` – `STRIGULA_FIREBASE`, `MASNAPLO_PRIVACY` (`controller: "Rácz Zsombor Marcell"`, `contact: "racz.zsomborm@gmail.com"`),
  `MASNAPLO_OWNER_UID = "3hTaBCw1TYdBJt4mfVm3w0mEm7y1"`. A felhasználó kérésére mindig az ő adatai állnak benne.
- `firestore.rules` – a szerveroldali védelem. Az `ownerUid()` függvényben a tulajdonos UID-ja áll (a repóban minta szöveg).
- `sw.js` – service worker; saját fájlok: előbb hálózat; Firebase/betűk: előbb gyorsítótár. Cache: `masnaplo-v13`
  (a 10 kocsma-profilképet is előre menti).
- `manifest.webmanifest`, `icons/masnaplo-*.png`, `icons/kocsma/*.svg` (a 10 kocsma-profilkép; azonosítójuk `01`…`10`, `KICONS`).

### Adatmodell (Firestore)
- `usernames/{kisbetus_nev}` – `{uid, email?, hasEmail?, emailPending?, username, createdAt}` (változatlan).
- `users/{uid}` – `{v, username, usernameKey, total{kat:db}, years{ÉÉÉÉ:{kat:db}}, days{ÉÉÉÉ-HH-NN:{kat:db}}, updatedAt}`.
  Mindenki olvashatja (statisztika, grafikon). Növelés atomikusan (`increment`), a felírás napjára.
- **`users/{uid}/days/{ÉÉÉÉ-HH-NN}` – napi napló** (csak a felhasználó és friss jelszóval a tulajdonos látja):
  `{v: 2, cats: {shot: {"Unicum": 2}, wine: {}, beer: {}, water: {}}, recent: [{c, d, t}] (≤10), party: kód|null, mig?: [kódok], updatedAt}`.
  **Eltérés a tervtől:** a `cats` nem a player-féle `items` lista, hanem név → darab térkép, mert így minden felírás
  atomikus `increment` (két telefon vagy offline sorban álló írás sem írja felül egymást). A `mig` lista az átállás
  ismételhetőségét jelzi. Az italnevek mezőnevek: `__x__` alakú név nem lehet (a `cleanName` átalakítja),
  és a kódban prototípus nélküli objektumokat használunk (`Object.create(null)`), hogy pl. „constructor” is működjön.
- **Beépített ivós játékok (v12):** nem az adatbázisban vannak, hanem az `app.js`-ben (`BUILTIN_GAMES`: `{id, name, aka,
  players, tools, desc}`; `aka` = eredeti név, a kereső erre is keres; `gameKey`: ékezet, kisbetű, aposztróf nélkül).
  Az Ivós játékok fülön a „Saját játékaim” alatt „Az app játékai” rész; a kártya (`.game-card.builtin`) a `gameInfo`
  lapot nyitja (csak olvasható). A forrás a felhasználó által adott angol lista fordítása (14 játék). Kimaradt: „Cold
  winter” (a játék célja az önkontroll elvesztéséig inni). A „Páros-páratlan” (Evens and Odds) v13-ban a felhasználó kérésére
  visszakerült, az orgia-javaslat nélkül (a tóba ugrás és a „részegen már senkit nem érdekel a meztelenség” mondat sem
  maradt benne), az önkéntességről szóló mondattal. A „Drunk Driving Disclaimer” neve „Boxkiállás”, és kiírja: csak
  videójátékban, ittasan ne vezess; a Tuskónál és a Torpedónál biztonsági megjegyzés van.
- **`games/{id}` (v13)** – a felhasználók ivós játékai: `{uid, name ≤60, players ≤30, tools ≤300, desc ≤2000, shared: bool,
  createdAt, updatedAt}`. Olvasás: a készítő, a megosztottat (`shared == true`) minden tag, a tulajdonos friss jelszóval;
  lekérdezés `where(uid == én)` vagy `where(shared == true)`. Írás: csak a készítő (az `uid` és a `createdAt` nem
  változhat); törlés: a készítő vagy a tulajdonos (`adminDeleteGame`, napló: `gdelete`). Fióktörléskor és a tulajdonosi
  „összes adat törlése”-kor `where(uid == …)` alapján törlődnek. **Átköltöztetés:** `migrateGames` (indításkor, egyszer
  munkamenetenként) a régi `users/{uid}/games` dokumentumokat `games/{uid}_{régi id}` alá teszi (`shared: false`), és a régit
  törli, egy kötegben; a determinisztikus azonosító miatt két telefon sem duplikálja.
- **`users/{uid}/games/{id}`** – régi hely (v12-ig) – saját ivós játék: `{name ≤60, players ≤30, tools ≤300, desc ≤2000, createdAt, updatedAt}` (csak a felhasználó látja).
- `private/{uid}` – csak a tulajdonos olvassa: `{consent{v,at,adult,health,terms}, parties{kód:időbélyeg}, drinks{kat:{custom[], quick}}, migrated: 1, updatedAt}`.
  `consent.terms: true`: a Felhasználási feltételek elfogadása (v8 óta; a szabály a `consent`-et csak map-ként ellenőrzi).
  `drinks`: a saját italnevek és kategóriánként az utoljára választott fajta (ezt írja fel a +1). `migrated`: az átállás kész.
- `parties/{kód}` – `{name, createdAt, updatedAt}`.
- `parties/{kód}/players/{uid}` – `{v:1, name, cats{kat:{items[{name,n}], custom[], quick}}, recent[≤8], updatedAt}`.
  **Ez most származtatott:** a felhasználó azon napjainak összege, amelyek ehhez a bulihoz tartoznak
  (`deriveParty` az app.js-ben, `deriveFromDays` a backend.js-ben – a kettőnek egyeznie kell).
  Írás csak akkor, ha a napok a szerverről is megjöttek (`daysSynced`) és az átállás kész (`migrationDone`).
  Önjavítás: a megnyitott buliban, ha a saját összesítés eltér a napoktól, újraírja (`checkMyParty`).
  Ha egy bulihoz nincs napom („régi buli”), a dokumentumhoz nem nyúl. Ha az utolsó napomat kiveszem egy buliból, törli.
- `parties/{kód}/votes/{uid}` – hányás-szavazás (változatlan).
- `meta/app` – `{resetAt}` (v11): a tulajdonos legutóbbi „minden fogyasztás nullázása” ideje. Mindenki olvassa, csak a
  tulajdonos írja. A telefonok ebből tudják, hogy a helyben tárolt hányás-számításukat el kell dobniuk (`subscribeMeta`).
- `banned/{uid}` (változatlan), `adminlog/{id}` – `{at, action, target?, party?, kocsma?, detail?}` (v9: `kocsma` mező;
  új műveletek: `kdelete` kocsma törlése, `kmsg` üzenet törlése, `kkick` tag eltávolítása; v11: `resetall` minden fogyasztás nullázása).
- **Barátok (v9):**
  - `friendReqs/{küldő}_{címzett}` – `{from, to, at}`. Csak a két érintett látja (lekérdezés `where(from|to == én)`).
    Létrehozás: csak a saját nevében, létező felhasználónak, aki még nem barátja; módosítani nem lehet; a két érintett törölheti.
  - `users/{uid}/friends/{fid}` – `{at, invite?}`. Csak a felhasználó látja. Létrejön, ha a címzett elfogadja a kérést:
    egy kötegben írja mindkét oldalt és törli a kérést (a szabály a kérés meglétét nézi). Barát törlése: mindkét oldal.
  - **Kocsma-meghívó:** a barát dokumentumában (`users/{címzett}/friends/{küldő}.invite = {kid, code, name, icon, at}`),
    a küldő írja (csak ha tagja a kocsmának, és az érvényes kódot küldi), a címzett törli. Így barát törlésekor vagy
    fióktörléskor a meghívók is eltűnnek.
- **Kocsmák (v9):**
  - `kocsmak/{kid}` – `{name ≤40, icon "01"…"10", code, owner, party?: {code, day, by} | null, createdAt, updatedAt}`.
    Csak a tagok olvassák (v11: és az alapítója, ha kiesett belőle). Az alapító (`owner`) módosíthat mindent (más tagnak adhatja, kódot cserélhet a kód dokumentumával
    együtt); bármelyik tag csak a `party` mezőt (kocsmás buli). Ha az alapító már nem tag, bármelyik tag átveheti
    (`claimKocsma`; az app a legrégebbi tag telefonján, 3 mp várakozás után teszi meg).
  - `kocsmak/{kid}/members/{uid}` – `{at, code, v?}`. Csak a tagok látják. Belépni csak az érvényes kóddal lehet, és ugyanabban a
    kötegben a kód dokumentumába is be kell írni magát. Kilépni bárki tud; az alapító bárkit eltávolíthat.
    **v10:** `v: {"ÉÉÉÉ-HH": db}` – a tag megszavazott hányásai hónaponként (a havi ranglistához). Csak ő maga írhatja
    (`updateDoc`, a szabály szerint csak a `v` változhat, térkép, legfeljebb 120 kulcs); 0-s hónap nincs benne.
    A tulajdonos (v11, nullázáskor) a `v` mezőt törölheti.
  - `kocsmak/{kid}/messages/{id}` – `{uid, text 1–500, at}`. Csak a tagok olvassák és írják; a saját üzenetét bárki törölheti
    (kilépés után is, ezért a saját üzeneteit `where(uid == én)` lekérdezheti), az alapító bármelyiket.
  - `kocsmaCodes/{kód}` – `{kid, name, icon, m: {uid: belépés ideje}}` (≤100 tag). Bárki olvashatja, akinek fiókja van és
    ismeri a kódot (belépés előtti előnézet); listázni nem lehet. A kód 8 kisbetű/szám. Kódcserekor (új kód vagy tag
    eltávolítása) a régi dokumentum törlődik, az új a mostani tagokkal készül. Az alapító munkamenetenként egyszer
    rendbe teszi az `m`-et (`repairKCode`), ha olyan tag maradt benne, aki már nem tag.
  - `private/{uid}` bővül: `kocsmak{kid: belépés}` (a kocsmáim; élőben figyeljük, több telefon között is), és
    `kmsg{kid: idő}` (minden kocsma, aminek valaha tagja volt; fióktörléskor ebből tudjuk, hol vannak üzenetei).
- localStorage: `strigula-parties`, `strigula-hidden-parties`, `strigula-units`, `strigula-install-hidden`,
  `strigula-pending-email` (a `strigula-party` az átállás után törlődik), `masnaplo-kocsma` (az aktív kocsma),
  `masnaplo-chat-read` (kocsmánként meddig olvasott a chatben), `masnaplo-vomits` (`{uid, p: {buliKód: hányások}}`, a saját,
  bulinként kiszámolt hányásszám), `masnaplo-vsent` (`{uid, s: {kid: érték}}`, melyik kocsmába mit írt már be),
  `masnaplo-reset` (a legutóbb feldolgozott `meta/app.resetAt`), `masnaplo-kchecked` (`{uid, ids}`: a már megnézett,
  vissza nem állítható korábbi kocsmák).

### Szabályok és logika röviden
- Buli-nap: hajnali 6-tól másnap hajnali 6-ig (`DAY_START_HOUR = 6`). A „Ma” félpercenként újraszámolódik.
- Egy naphoz egy buli. Egy buli több napból is állhat (többnapos buli: „Folytatom a tegnapi bulit”).
- Adagok, pontok, hányás-szavazás, fiókszabályok: változatlanok (rövid 4 cl/+5, bor 1 dl/+3, sör 5 dl/+2, víz 3 dl/+0,25; hányás −20).
- Hozzájárulás: `CONSENT_V = "2026-11-27c"` (v7: `"2026-11-26"`, v8: `"2026-11-26b"`, v9: `"2026-11-27"`, v10: `"2026-11-27b"`
  – hányás a havi ranglistában; v13: a feltételek 5. pontja az ivós játékokról, és a tájékoztató a megosztott játékokról). Érvényes, ha `consent.v === CONSENT_V` és
  `consent.terms === true` (`consentValid`); különben a hozzájárulási képernyő jön. A tájékoztató 1b-re frissítve (barátok,
  kocsmák, chat, havi ranglista, tulajdonosi jogok, törlés); a feltételek 5. pontja a kocsmákkal és a chat-üzenetekkel bővült.
  A későbbi funkciókhoz (naptár, térkép) a tájékoztatót bővíteni és `CONSENT_V`-t emelni kell.
- **Felhasználási feltételek (v8):** a lap szövege az `app.js` `termsContent()` függvényében (a 3/b. pontban rögzített szöveg),
  a dátumok az `app.js` elején: `TERMS_DATE`, `PRIVACY_DATE`. A [Név] és az [Elérhetőség] a `privacyInfo()`-ból jön
  (`config.js` → `MASNAPLO_PRIVACY`); a `privacyInfo().missing` mondja meg, mi nincs kitöltve, ilyenkor a Tulajdonos sor és
  a Tulajdonos menü figyelmeztet (`privacyMissingText`). Elfogadás: `consentBoxes()` három jelölőnégyzete (`cAdult`,
  `cTerms`, `cAgree`) a regisztrációnál (`doSignup`) és a hozzájárulási képernyőn (`doConsent`); a `consentRecord()` a
  `terms: true`-t is menti. A lap a Profil → Beállításokból, a regisztrációs, a hozzájárulási és a Letiltva képernyőről nyílik.
- **Átállás (`runMigration`, `MIGRATION_V = 1`):** kódok forrása: `private.parties` + helyi lista + `strigula-party`.
  Minden buliból a saját player-dokumentum (`getDocFromServer`) → a buli napjára (`createdAt`, különben a legkorábbi `recent`,
  különben `updatedAt`), tranzakcióban (`migrateParty`): ha a napon már ott a kód a `mig`-ben → kész; ha a nap másik bulié
  → ütközés, a régi buli érintetlen marad; ha a napon volt bulihoz nem rendelt ital → összefésül, és a buli-összesítést
  újraszámolja. A nagyobb buli kapja a napot. A statisztikához nem nyúl. Hibánál (offline) a felület elindul,
  figyelmeztet, és `online` eseményre / félpercenként újrapróbálja. Az átállás előtt a buli-összesítés nem íródik.
- Régi buliba (ahol régi, napokhoz nem rendelt számláló van) nem rendelhető új nap (különben felülírnánk).
- Tulajdonosi javítás (`adminEditPlayer`): ha a résztvevőnek vannak napjai az adott bulihoz, a napjait javítja
  (+1 az utolsó napra, −1 a legutolsó olyan napról, ahol van ilyen ital), a statisztikát a napra vezeti, és tranzakcióban
  újraszámolja a buli-összesítést; ha nincsenek (még át nem állt felhasználó), a régi módon a player-dokumentumot.
  Buli törlése (`adminDeleteParty`): a résztvevők napjaiban `party: null`, a napló megmarad.
- Fióktörlés és tulajdonosi „összes adat törlése”: a napokat és a játékokat is törli, a napokból kiolvasott bulikkal együtt.
  v9: a kocsmákból kilép (`removeFromKocsma`: alapítóként a legrégebbi tag kapja meg, utolsó tagként a kocsma minden adatával
  törlődik), törli az üzeneteit minden kocsmában a `kocsmak` és a `kmsg` alapján, a barátságait mindkét oldalon és a
  barátkéréseit. Letiltott felhasználó a kocsmát nem olvashatja: ilyenkor csak a saját tagságát és üzeneteit törli, a kocsmát
  a legrégebbi tag veszi át.
- **A szabályok get/exists korlátja:** egy írásban legfeljebb 10, egy kötegben legfeljebb 20 hívás. Ezért ahol a szabály
  dokumentumot olvas (pl. az alapító jogát nézi), kis kötegekkel törlünk (`deleteRefs(…, 8)`), a tulajdonosi ágak
  (`ownerFresh()`) pedig elöl állnak, hogy ne hívjanak semmit. A tesztszerver ezt a korlátot szigorúbban is ellenőrzi.
- **Kocsmák a felületen:** fejléc (profilkép, név, taglétszám; koppintásra váltás / új kocsma / belépés), Chat · Buli ·
  Meghívás · Kezelés gomb, „Ma” sáv, kocsmás buli kártya, mai buli, havi ranglista (hónap váltható), Korábbi bulijaim,
  Mindenki együtt. Kocsma nélkül egy bemutató kártya („Kocsma alapítása”, „Belépés kocsmába”). Meghívó link: `?kocsma=kód`.
  Jelzőpötty az alsó sávon: új barátkérés (Profil), meghívó vagy olvasatlan üzenet (Kocsma).
- **Kocsmás buli:** a Buli gomb a kocsma nevével és a dátummal indít egy közönséges bulit (a mai nap oda kerül), és a kocsmába
  beírja (`party: {code, day, by}`). A többi tag a Kocsma fülön egy „Csatlakozom” gombbal lép be (ha máshol volt, rákérdez).
  Senki napja nem kerül be magától.
- Meghívó link (`?buli=kód`): ismeretlen kódnál meghívó lap (előnézettel), ismert kódnál csak megnyitja a bulit.
- **Ivós játékok fül (v13):** `S.gameTab` = `app | users` (fül-sáv: `.game-tabs`, `role=tab`). Az `app` fülön a
  `BUILTIN_GAMES`, a `users` fülön a figyelmeztetés („nem ellenőrizzük”), a „Saját játékaim” (`S.games`, jelölés:
  Megosztva / Csak te látod) és a „Mások játékai” (`S.sharedGames` a sajátjaim nélkül, `.game-card.shared`, a `sharedGame`
  lapot nyitja; feloldott tulajdonosnak Törlés gomb). Új játék mentése után a `users` fül nyílik meg. A kereső a megnyitott
  fülön keres.
- **Megjelenés (v13):** `masnaplo-theme` (localStorage, `light | dark`, hiányzik = automatikus). Az `index.html` fejében
  egy kis szkript már az első rajzolás előtt beállítja a `data-theme`-et és a `theme-color` metákat; a CSS-ben
  `:root[data-theme="dark"]` és `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`. A Profil
  Beállítások részében „Megjelenés”: Világos · Sötét · Automatikus (`setTheme`, `applyTheme`). Fióktörléskor törlődik.
- **Ital-ikonok (v12):** a `CATS` elemeiben már nincs `emoji`; a rajzok a `CAT_SVG`-ben (24×24, vonalas, a folyadék 30%-os
  kitöltéssel, `currentColor`). `catIcon(cid, cls)` a kategória színével (`var(--shot)` stb.) adja; `countsLine(get, vomits,
  cls, cats)` a darabszám-sorokat (ranglisták, Napjaim; tördelhető `.cnts`). A 🤮 a hányásnál megmaradt.
- **Jelvényeim (v12, fejlesztés alatt):** a saját profilon `badgeEntry()` gomb → `openSheet({type: "badges"})`: a lap
  középre kerül (`.sheet-badges`), a háttér elhomályosodik (`.backdrop.blur`, `backdrop-filter: blur`). A jelvények a
  `BADGES` listában lesznek (`{id, name, desc, icon?, earned: (ctx) => bool}`, a `ctx`-ben a statisztika és a napok);
  amíg üres, `BADGE_SLOTS` (9) „Hamarosan” helyőrző látszik. Más profilján nincs. Adatbázis nem kell hozzá (még).
- **A kocsma figyelése és a függő írások (v11, hibajavítás):** a valódi Firestore-ban egy figyelés (onSnapshot) a saját,
  még úton lévő írásunk előtt is a szerverre érhet (a figyelés és az írás külön csatornán megy), és a szerver ilyenkor
  elutasítja (a kocsma olvasásához tagság kell, ami még nincs a szerveren). A v9–v10 ezt kikerülésnek vette (`lostKocsma`
  → `cleanupKocsma` törölte a saját tagságot és a listáról is levette): alapítás/belépés után a kocsma eltűnt. Javítás:
  (1) a `watchPrivate` `includeMetadataChanges`-szel figyel, és egy még függő (helyi) pillanatképből új kocsmát nem kezd
  figyelni (az alapítás/belépés a sikeres mentés után maga veszi fel); (2) minden kocsma-, tag- és chatfigyelés hibája,
  a szervertől jövő „nincs ilyen” és a tagok közül hiányzó saját sor után `verifyKocsma` jön: a `kocsmaStatus` megvárja a
  függő írásokat (`waitForPendingWrites`), majd a szerverről olvas: `ok` → a figyelés újraindul (`restartK`, legfeljebb 5×),
  `gone` → `lostKocsma` (takarítás, értesítés), `orphan` (alapító, de nincs tagsága) → `reclaimKocsma` (újra belép a kóddal),
  `banned` → csak helyben engedi el, hiba/offline → 30 mp múlva újra. A gyorsítótárból jövő „nincs ilyen” nem számít.
  (3) `maybeScanOrphans`: indításkor egyszer, a `private.kmsg`-ben szereplő, de a listán nem lévő kocsmák közül ahol én
  vagyok az alapító (vagy megvan a tagságom), visszaveszi; a többit megjegyzi (`masnaplo-kchecked`). Ehhez a szabály: a
  kocsma dokumentumát az alapítója tagság nélkül is olvashatja.
- **Minden fogyasztás nullázása (v11, tulajdonos, `adminResetConsumption`):** a felhasználó döntése: csak a fogyasztás
  (a bulik megmaradnak). Sorrend: (1) minden felhasználó napjai: buliba rendelt nap → üres `cats`, üres `recent` (a `party`
  és a `mig` marad), buli nélküli nap → törlés; statisztika (`total`, `years`, `days`) → üres (5-ös kötegek, mert a szabály
  a felhasználónevet is olvassa); (2) minden buli-összesítés nullára (név, saját italnevek, „quick” marad) és minden
  szavazat törlése — gyűjteménycsoport-lekérdezéssel (`collectionGroup("players"|"votes")`, szabály:
  `match /{path=**}/players|votes/{uid} { allow list: if ownerFresh(); }`), így a név-dokumentum nélküli régi bulik is
  benne vannak; ha ez nem megy, tartalék: a `parties` lista + a napokból és a `private.parties`-ből ismert kódok;
  (3) a kocsmatagok `v` mezőjének törlése (a szabály a tulajdonosnak csak ezt engedi); (4) `meta/app.resetAt` és napló.
  A napok előbb nullázódnak, mint a buli-összesítések, hogy a nyitott telefonok önjavítása (`checkMyParty`) a nullázott
  napokból számoljon. Az elutasított köteget egyenként újrapróbálja, a hibás régi dokumentumokat megszámolja.
  Ismételhető. A telefonok a `meta/app` jelzésére eldobják a `masnaplo-vomits`/`masnaplo-vsent` tárolót, és mindent
  újraszámolnak (`S.vGen`: a közben futó régi számítás eredménye elvész).
- **Hányás a havi ranglistában (v10):** havi pont = a hónap napjainak italpontja − 20 × a hónapban megszavazott hányások.
  Egy buli hányásai annak a hónapnak számítanak, amelyikben a tag **első, ehhez a bulihoz rendelt napja** van (egyszer, nem
  naponként). A számolás ugyanaz, mint a buli versenyében (`vomitCalc`: szavaz mindenki a buli résztvevői közül az érintetten
  kívül, kell a többség, egyező számoknál annyi, különben 1). Mivel a kocsma tagjai nem feltétlenül tagjai a bulinak, és a
  szavazatokat egyenként nem kell letölteniük, **az érintett telefonja számol**: `refreshMyVomits` a saját napjaiból
  (`myPartyFirstDays`) veszi a bulikat, a megnyitott buliban az élő adatokból (`liveVomits`, ha a szerverről jöttek), máshol a
  szerverről (`getPartyRoster`, `getDocsFromServer` – hiányos gyorsítótárból nem számol) számol, az eredményt bulinként tárolja
  (`masnaplo-vomits`), és hónaponként beírja minden kocsmája tagsági dokumentumába (`syncKVomits` → `setKVomits`; csak ha
  eltér, munkamenetenként kocsmánként egy értéket legfeljebb egyszer, hogy két telefon ne írja felül egymást oda-vissza).
  Újraszámolás: induláskor az aktuális és az előző havi bulik a szerverről (`scheduleVomits("all")`), a megnyitott buliban
  szavazat- vagy résztvevő-változáskor (`partyVomitsChanged`), ha a napjaim bulijai változnak, az átállás végén és `online`
  eseményre; a régebbi bulik a tárolt eredményből. A saját sort a saját számolásból, a többiekét a tagsági dokumentumukból
  (`monthVomits`) mutatja. Ugyanúgy önbevalláson alapul, mint az italok (azokat is mindenki maga írja fel).

### Tesztelés (így készült a v7–v13)
- `masnaplo-tesztek.zip`: hamis Firebase SDK modulok (`fakefb/`: app, auth, firestore – a gstatic címeket Playwright
  útvonallal ezekre cseréljük), egy Node-oldali hamis szerver (`store.js`) a `firestore.rules` kézzel írt tükrével
  (minden írást és olvasást ellenőriz, az elutasítottakat gyűjti), és Playwright Chromium tesztek 390×844-es telefonméretben:
  - `t1_migration.js` – v6-os adatokból átállás, ütközés, üres buli, ismételhetőség, összefésülés, régi `?buli=` cím.
  - `t2_flows.js` – Ma sáv, + gomb, visszavonás, saját ital, új buli, meghívó, élő frissítés, szavazás, Napjaim,
    múltbeli nap javítása, kivétel és visszarendelés, régi buli védelme, kilépés, névváltozás.
  - `t3_owner_games.js` – tulajdonosi javítás (napi naplós és régi felhasználónál), nullázás, buli törlése, ivós játékok,
    naptár/térkép, fióktörlés, regisztráció, letiltás.
  - `t4_edges.js` – megszakadt átállás és folytatás, elavult szabályok, hajnali 6-os napváltás, többnapos buli,
    két telefon egyszerre, különleges italnevek, régebbi nap felírása.
  - `t5_oldclient.js` – egy még régi (v6) appot használó barát és az új app ugyanabban a buliban.
  - `t6_terms.js` – Felhasználási feltételek: a lap tartalma (név, elérhetőség, dátum, 10 pont), kereszthivatkozások,
    elfogadás nélkül nem lehet továbblépni (hozzájárulási képernyő és regisztráció), `consent.terms` mentése, régi és
    hiányos hozzájárulás, elérhetőség a Profilból / regisztrációból / Letiltva képernyőről, emlékeztetők, tulajdonosi
    figyelmeztetés hiányzó `MASNAPLO_PRIVACY` adatnál.
  - `t7_friends.js` – barátkérés (hibás, saját, ismeretlen, dupla), elfogadás, kölcsönös jelölés, elutasítás, visszavonás,
    barát törlése és újra jelölés, egy barát profilja, és 14 nyers (az appot megkerülő) írás, amit a szabály nem enged.
  - `t8_kocsma.js` – alapítás, belépés kóddal/linkkel/baráti meghívóval előnézettel, chat (élő, olvasatlan, törlés, 500
    karakter, korábbi üzenetek), kocsmás buli, havi ranglista, hányás a havi ranglistában (szavazás → az érintett telefonja
    beírja; megadott szám; átszavazás; előző havi buli a buli első napjának hónapjában; újratöltés után nincs fölösleges írás;
    új kocsmába is beírja), kezelés (átnevezés, kép, új kód, tag eltávolítása), több kocsma és váltás, kilépés (alapítói
    szerep átadása, utolsó tag), a kocsma törlése sok üzenettel, és 26 nyers művelet.
  - `t10_kocsma_race.js` – a v11-es hiba: alapítás és belépés, miközben a szerver a korai figyelést elutasítja
    (`server.listenRace`); a tagság megmarad, a kocsma látszik, a chat él; a hiba miatt kiesett alapító visszakerül, a nem
    visszaállítható kocsmát megjegyzi; a valódi kikerülés továbbra is működik. (A v10-es appon ez a teszt elbukik.)
  - `t11_reset.js` – a tulajdonosi nullázás: rossz megerősítő szó, utána minden statisztika, nap, buli-összesítés,
    szavazat és havi hányásszám nulla, a bulik, kocsmák, chat, barátok, játékok megmaradnak; a telefonok nem írják vissza a
    régi hányásokat (előző havi buli a gyorsítótárban), újratöltés után is nulla, utána újra lehet inni.
    `NO_GROUP=1`-gyel a tartalék út (csoportos lekérdezés nélkül).
  - `t12_games_icons_badges.js` – az app 13 játéka (magyar nevek, ábécérend, létszám, eszközök, leírás, keresés a magyar
    és az eredeti névre, teljes leírás lap, nem szerkeszthető, a saját játékok mellett), az ital-ikonok (sehol nincs
    ital-emoji a Kocsma és a Profil fülön, a lapokon; a kategória színe), és a Jelvényeim (elhomályosított háttér,
    9 helyőrző, bezárás ×-szel és a háttérre koppintva, más profilján nincs).
  - `t13_shared_theme.js` – a régi játék átköltöztetése (egyszer, adatai megmaradnak), megosztás (alapból nincs bejelölve,
    a másik látja a készítő nevével, a nem megosztottat nem), keresés, 8 nyers művelet, amit a szabály nem enged, a
    megosztás visszavonása élőben, tulajdonosi törlés naplózva; Világos/Sötét/Automatikus (háttér, böngészősáv, újratöltés
    előtti beállítás, telefononként); a Felhasználási feltételek új mondatai.
  - `t9_kocsma_admin.js` – a tulajdonos a kocsmákban (üzenet, tag, kocsma törlése, naplózva), fióktörlés kocsmákkal,
    üzenetekkel és barátokkal (semmi nem marad, ami a felhasználóhoz kötődne), letiltott alapító fióktörlése és a kocsma
    átvétele, tulajdonosi „összes adat törlése”.
  - `social.js` – segédek: kész fiók (`addAccount`), nyers Firestore-műveletek a lapon belül (`raw`), kocsma-lépések.
  - `shots.js` – képernyőképek világos és sötét módban (benne a hozzájárulási képernyő, a regisztráció, a Felhasználási
    feltételek lap, a tulajdonosi figyelmeztetés, a kocsma, a chat, a meghívók, a ranglista és a barátok is).
  A hamis SDK v11 óta: `collectionGroup`, valódi `waitForPendingWrites` (az úton lévő írások végét várja), a
  `getDocFromServer` elutasítását a szerver `probe: true`-val jelöli (a kikerülés ellenőrzése; a tesztek ezeket külön
  kezelik), `server.listenRace(path, auth)` a korai figyelés utánzására, `server.noGroup` a tartalék út próbájára.
  A `harness.js` `appConst("CONSENT_V")` az app.js-ből olvassa ki az állandót, így a tesztet nem kell minden emeléskor átírni.
  Futtatás: Node 18+ és Playwright (Chromium) kell, más nem. A tesztcsomagot a projektmappa mellé kell kibontani, majd
  pl. `cd masnaplo-tesztek && TZ=Europe/Budapest node t1_migration.js`. Az `APP_DIR` mondja meg, melyik mappát szolgálja ki
  (alapból `../masnaplo`), az `OLD_DIR` a régi (v6) változatot (alapból a csomagban lévő `regi-v6`).
- **Korlát:** a valódi Firestore-emulátor ebben a környezetben nem volt elérhető, ezért a szabályokat a tükör teszteli.
  A `firestore.rules` szintaxisát a Firebase hivatalos szabály-nyelvtanával (`@firebase/eslint-plugin-security-rules`
  értelmezője) ellenőriztük; a Firebase konzol a Publish-kor is ellenőrzi. Új szabálynál a tükröt (`store.js` `rule()`)
  is frissíteni kell. A tükör a lekérdezéseknél a `where` feltételből dönt (mint a valódi szabálymotor), és számolja a
  get/exists hívásokat.

## 2. A felhasználó döntései (érvényesek)

- **Kocsma-profilképek:** a 10 kiválasztott ikon (`icons/kocsma/01…10`).
- **Chat:** egyelőre **csak szöveges** (képek/videók később; videóhoz Firebase Blaze kellene).
- **Naptár-import:** **Google Naptár** (Google-belépés, `calendar.readonly`; egyszeri Google Cloud OAuth-beállítás kell).
- **A hónap ivója: KIMARAD** (a felhasználó döntése az 1b-nél). Helyette **pontos havi ranglista** a kocsmában
  (rövid 5, bor 3, sör 2, víz 0,25, helyezéssel). **A hányás is beleszámít (v10, a felhasználó kérése):** −20 minden
  megszavazott hányásért, ugyanazzal a szabállyal, mint a buli versenyében, a buli első napjának hónapjában.
  Megjegyzés: a Google Play szabályzata tiltja a versenyszerű ivás kedvező bemutatását; nyilvános Play-kiadásnál ezt újra kell gondolni.
- **Kocsmás buli (Buli gomb):** egy koppintással csatlakozás, senki napja nem kerül be magától.
- **Kocsma kezelése:** az alapító kezeli (átnevezés, kép, tag eltávolítása új kóddal, új kód, törlés); kilépéskor a legrégebbi
  tag örökli; bárki kiléphet és a saját üzenetét törölheti; a Tulajdonos friss jelszóval bármit törölhet, naplózva.
- **Barátok:** lista + kérések + barát profilja + egy koppintásos kocsma-meghívó (a meghívott előnézet után dönt).
- **Térkép helyadatai:** **csak a felhasználó látja** a sajátjait. Hely csak engedéllyel.
- **Kocsmák:** egy felhasználó **több kocsmának is tagja lehet, és válthat közöttük**.
- **Ital felírása:** a Kocsma fül tetején „Ma” sáv (4 kategória, +1), és lebegő + gomb minden fülön (kész).
  Az Ivós játékok fülön a „+ játék” buborék az ital-gomb fölött (kész).
- **Kocsma fül:** a tagok **egymás alatt**, a név előtt a **profilképükkel** (most színes monogram; felhasználói profilképek később).
- **Alsó sáv (balról jobbra):** Ivós játékok · Naptár · **Kocsma (középen, kiemelve)** · Térkép · Saját profilkép (→ Profil) (kész).

## 3. A fejlesztés terve

### 1a. ütem – új alap: KÉSZ (v7)
(A v8 ezen felül a Felhasználási feltételeket hozta, lásd 3/b.)
Napi napló, bulik napokhoz rendelése, átállás, alsó sáv és + gomb, Profil fül (statisztika, napi grafikon a napokból,
Napjaim, beállítások), Ivós játékok fül, Naptár/Térkép „hamarosan”, új tájékoztató és `CONSENT_V`. Részletek fent.
A Kocsma fül most: „Ma” sáv → mai buli (verseny, tagok monogrammal; egy emberre koppintva részletek és szavazás) vagy
„Új buli / Belépés kóddal” → Korábbi bulijaim → Mindenki együtt → „Hamarosan: kocsmák”.

### 1b. ütem – barátok és kocsmák: KÉSZ (v9)
A megvalósítás az 1. részben (adatmodell, szabályok, felület), a döntések a 2. részben. Eltérések a lenti eredeti tervtől:
a hónap ivója kimaradt; a havi ranglistába v10 óta a hányás is beleszámít; a barátkérések gyűjteménye `friendReqs`; a meghívókód előnézete a `kocsmaCodes`-ban van, a
tagok listája csak a tagoknak látszik (a kód előnézetében az `m` mezőből); a kocsma-meghívó a barátság dokumentumában van.
Az eredeti terv:
1. **Barátok:** jelölés felhasználónév alapján, elfogadás/elutasítás; `friendRequests`, `users/{uid}/friends/{uid}`.
2. **Kocsma:** alapítás (név, 10 ikonból profilkép), meghívókód; belépés kóddal **előnézettel** (név, profilkép, tagok listája egymás alatt);
   több kocsma, váltás közöttük. Javasolt: `kocsmak/{id}` (név, ikon, kód, tulajdonos), `kocsmak/{id}/members/{uid}`,
   `kocsmaCodes/{kód}` → előnézeti adat, amit belépés előtt is lehet olvasni.
3. **Kocsma fül:** fejléc (profilkép, név, taglétszám), Chat és Buli gomb, „Ma” sáv (megvan), a hónap ivója (előző hónap), havi ranglista
   (tagok egymás alatt, profilkép + név + pont), tagra koppintva a profilja (közérdekű adatok: fogyasztás, statisztika).
   A mai buli és a Korábbi bulijaim a kocsma alá kerülhet.
4. **Chat:** szöveges, `kocsmak/{id}/messages/{id}`, csak tagok olvashatják/írhatják.
5. **A hónap ivója:** KIMARADT (a felhasználó döntése). Eredetileg: havi pontok a `users/{uid}.days` alapján; kihirdetés a hónap után (`kocsmak/{id}/awards/{ÉÉÉÉ-HH}`).
6. Tájékoztató bővítése (barátok, kocsmatagság, chat, a hónap ivója), `CONSENT_V` emelése; fióktörléskor ezek törlése is.

### 2. ütem – naptár
- Havi/heti naptár saját eseményekkel (`users/{uid}/events`).
- Google Naptár import engedéllyel (Google Identity Services, `calendar.readonly`). Ehhez a felhasználónak a Google Cloud Console-ban
  OAuth-hozzájárulási képernyőt és webes klienst kell beállítania (tesztfelhasználókkal, ellenőrzés nélkül max. 100 fő).
- **Buli előre bejelentése:** dátum vagy időszak; a kezdőnap reggel 6-kor „automatikusan indul”: amikor a meghívottak megnyitják az appot,
  az aznapi napjuk már ehhez a bulihoz tartozik (a napi napló `party` mezője ezt már tudja). Push értesítés szerver nélkül nem lehetséges.
- **Kocsmás buli:** a „Buli” gomb az 1b-ben elkészült (egy koppintásos csatlakozással). A naptárral jöhet az előre bejelentett
  kocsmás buli.

### 3. ütem – térkép
- MapLibre GL JS 5 földgömb-vetülettel + OpenFreeMap vektorcsempék (ingyenes, kulcs nélkül).
- Felíráskor (engedéllyel) a hely mentése a napi dokumentum italához (pl. a `recent` mellé egy `locs` lista; a szabályban
  a `validDay` kulcslistáját bővíteni kell); 40 m-en belüli ivások egy jelölőbe csoportosítva. A helyadatot csak a felhasználó láthatja.

## 3/b. Felhasználási feltételek felelősségkizárással – KÉSZ (v8)
A megvalósítás az 1. részben (Hozzájárulás, Felhasználási feltételek) és a README-ben. Az alábbi szöveg az appban lévő
szöveg forrása; ha az egyiket módosítod, a másikat is (és lényeges módosításnál a `TERMS_DATE`-et és a `CONSENT_V`-t).

A felhasználó kérése: az app mondja el egyértelműen, hogy a fejlesztő és tulajdonos (üzemeltető) a jogszabályok által
megengedett legteljesebb mértékben nem vállal felelősséget az app használatából eredő károkért. A magyar jog szerint
a szándékosan okozott, illetve az életet, testi épséget vagy egészséget megkárosító kárért a felelősség nem zárható ki,
ezért a szöveg ezt kifejezetten kiveszi (különben a kikötés ebben a részében semmis lenne). A beépítendő szöveg:

**Felhasználási feltételek** (az app „Felhasználási feltételek” lapjának szövege; a [Név] és az [Elérhetőség] helyére a `config.js` `MASNAPLO_PRIVACY` adatai kerülnek, a dátum a kiadás napja)

> Utolsó módosítás: [a kiadás dátuma]
>
> **1. Az app és az üzemeltető**
> A Másnapló egy baráti társaság saját, ingyenes, nem kereskedelmi alkalmazása, amely a felhasználók által beírt adatok alapján nyilvántartja és megjeleníti az italfogyasztást. Az app fejlesztője, tulajdonosa és üzemeltetője: [Név] (a továbbiakban: üzemeltető). Elérhetőség: [Elérhetőség]. Az app használatáért az üzemeltető semmilyen díjat vagy más ellenszolgáltatást nem kér és nem kap.
>
> **2. Ki használhatja?**
> Az appot csak 18. életévét betöltött személy használhatja. A regisztrációval, illetve a feltételek elfogadásával kijelented, hogy elmúltál 18 éves, és ezeket a feltételeket elfogadod. Ha nem fogadod el őket, ne használd az appot; a fiókodat bármikor törölheted.
>
> **3. Felelős alkoholfogyasztás**
> Az app nem ösztönöz alkoholfogyasztásra. A pontok, a verseny, a rangsorok és az ivós játékok kizárólag szórakoztató jellegűek, nem célok és nem elvárások. Mindenki maga dönt arról, iszik-e és mennyit, és maga felel a saját egészségéért, biztonságáért és magatartásáért. Ittasan ne vezess, és ne végezz olyan tevékenységet, amelyhez józanság kell. Senkit ne biztass és ne kényszeríts ivásra. Ha úgy érzed, hogy az alkoholfogyasztásod gondot okoz, fordulj orvoshoz vagy más szakemberhez.
>
> **4. Az app nem orvosi és nem mérőeszköz**
> Az appban megjelenő mennyiségek (például egy rövid 4 cl, egy sör 5 dl) becslések, a felhasználók által beírt adatokon alapulnak, és eltérhetnek a valóságtól. Az app nem méri és nem becsüli a véralkoholszintet, nem nyújt orvosi tanácsot, és nem alkalmas annak megítélésére, hogy valaki vezethet-e, dolgozhat-e, vagy hogy egészségügyi szempontból mennyi alkohol biztonságos számára.
>
> **5. Ivós játékok és a felhasználók által beírt tartalom**
> (v13-tól, a felhasználó kérésére módosítva:) Az appban kétféle ivós játék van: az app saját játékai, és azok, amelyeket a felhasználók készítenek (és megoszthatnak egymással). A felhasználók által készített ivós játékokat az üzemeltető nem ellenőrzi és nem ajánlja. Az üzemeltető egyik ivós játékért sem vállal felelősséget, sem az app saját játékaiért, sem a felhasználók által készítettekért, és az ezekből eredő károkért vagy személyi sérülésekért sem, a 7. pontban leírt keretek között. Minden játékot mindenki a saját felelősségére játszik; tartsátok be a jogszabályokat és a helyszín szabályait, és vegyétek figyelembe egymás egészségét és határait. Mindenki maga felel azért, amit az appba beír (italok, nevek, szavazatok, játékok, kocsmák és chat-üzenetek). Tilos jogsértő, mások jogait vagy jó hírnevét sértő, illetve bántó tartalmat beírni. Az üzemeltető az ilyen tartalmat eltávolíthatja, a fiókot letilthatja.
>
> **6. Az app „ahogy van” működik**
> Az app egy baráti társaság szabadidős, ingyenes fejlesztése. Az üzemeltető nem vállal kötelezettséget és nem ad garanciát arra, hogy az app hibátlanul vagy megszakítás nélkül működik, hogy az adatok pontosak, teljesek vagy mindig elérhetők, illetve hogy nem vesznek el. Az üzemeltető az appot bármikor módosíthatja, szüneteltetheti vagy megszüntetheti. Az app külső szolgáltatásokat használ (Google Firebase, GitHub); ezek működéséért az üzemeltető nem felel.
>
> **7. A felelősség kizárása**
> Az appot mindenki a saját felelősségére használja. Az üzemeltető a jogszabályok által megengedett legteljesebb mértékben kizárja a felelősségét minden olyan kárért, ideértve különösen a vagyoni kárt, az elmaradt hasznot, az adatvesztést, a nem vagyoni sérelmet és a személyi sérülést is, amely
> – az app használatából vagy a használat lehetetlenségéből,
> – az appban megjelenő adatokra, számokra vagy tartalmakra való hagyatkozásból,
> – az alkoholfogyasztásból, az ivós játékokból, illetve a felhasználók egymás közötti vagy az appon kívüli magatartásából, vagy
> – a külső szolgáltatások hibájából vagy kieséséből
> ered.
> Ez a kizárás nem vonatkozik azokra az esetekre, amelyekben a felelősség kizárását vagy korlátozását jogszabály tiltja, így különösen a szándékosan okozott kárra, valamint az emberi életet, testi épséget vagy egészséget megkárosító kárra; ezekben az esetekben az üzemeltető a jogszabályok szerint felel.
>
> **8. A felhasználó felelőssége**
> A felhasználó felel azért a kárért, amelyet e feltételek megszegésével, illetve jogsértő tartalom beírásával vagy jogsértő magatartással másoknak vagy az üzemeltetőnek okoz.
>
> **9. Módosítás**
> Az üzemeltető ezeket a feltételeket módosíthatja. Lényeges módosítás esetén az app a következő megnyitáskor megmutatja az új feltételeket, és a további használathoz újra el kell fogadni őket.
>
> **10. Egyéb rendelkezések**
> Ezekre a feltételekre a magyar jog az irányadó. Ha valamelyik rendelkezésük érvénytelen vagy végrehajthatatlan, az a többi rendelkezés érvényességét nem érinti; az érvénytelen rendelkezés helyett a jogszabályok által megengedett, ahhoz legközelebb álló szabályt kell alkalmazni. Az adataid kezeléséről az Adatkezelési tájékoztató szól.

**Hova és hogyan került az appba (a feladat leírása, mind kész):**
1. **Új lap: „Felhasználási feltételek”** (a fenti szöveg, ugyanolyan stílusban, mint az Adatkezelési tájékoztató).
   A [Név] és az [Elérhetőség] a `privacyInfo()`-ból jöjjön (`config.js` → `MASNAPLO_PRIVACY`), a dátum a kiadás napja legyen.
   Elérhető legyen: a Profil fül Beállítások részéből (az Adatkezelési tájékoztató fölött), a regisztrációs képernyőről,
   a hozzájárulási képernyőről és a Letiltva képernyőről. Ha a `config.js`-ben a név vagy az elérhetőség nincs kitöltve,
   a Tulajdonos menü jelezze ezt, mert enélkül a feltételek nem nevezik meg az üzemeltetőt.
2. **Kötelező elfogadás:** a regisztrációnál és a hozzájárulási képernyőn egy új, külön jelölőnégyzet:
   „Elolvastam és elfogadom a Felhasználási feltételeket, és tudomásul veszem, hogy az appot a saját felelősségemre használom.”
   Elfogadás nélkül ne lehessen továbblépni. A hozzájárulási rekordba kerüljön bele (`consent.terms: true`; a `private.consent`
   már most is map, a szabályt nem kell módosítani). A `CONSENT_V` emelése, hogy mindenki egyszer elfogadja.
3. **Rövid emlékeztetők** (egy-egy mondat, nem tolakodóan):
   - Ivós játékok fül, a „fejlesztés alatt” felirat alatt: „Minden játékot a saját felelősségedre játszol. Senkit ne kényszeríts ivásra.”
   - A Profil grafikonja vagy statisztikája alatt: „A számok becslések: nem mérik a véralkoholszintet, és nem alkalmasak annak eldöntésére, hogy vezethetsz-e.”
4. Az Adatkezelési tájékoztató végére egy mondat utaljon a Felhasználási feltételekre (és fordítva, ahogy a 10. pont már teszi).
5. **Tesztek:** a `masnaplo-tesztek.zip`-ben a hozzájárulást és a regisztrációt kezelő segédeket (`ui.js` `acceptConsent`,
   `t3_owner_games.js` regisztráció) frissíteni kell az új jelölőnégyzettel, és új ellenőrzés kell arra, hogy elfogadás nélkül
   nem lehet továbblépni, hogy a `consent.terms` elmentődik, és hogy a lap a Profilból megnyílik. Minden teszt fusson le hibátlanul,
   és készüljenek képernyőképek (világos és sötét mód) az új lapról és a hozzájárulási képernyőről.
6. Frissítsd a README.md-t és a FEJLESZTES.md-t, emeld a `?v=` számot és a service worker cache nevét, és a végén írd le,
   mit és hol cseréljek le.

## 4. Adatkezelési tájékoztató és Felhasználási feltételek – még hátralévő változások
- Kész (v9): barátok, kocsmatagság, chat-üzenetek (ki látja, meddig tároljuk), havi ranglista, a tulajdonos moderálási joga a
  kocsmákra (naplózva), fióktörléskor ezek törlése; a feltételek 5. pontja a kocsmákkal és a chat-üzenetekkel bővült.
- Kész (v10): a havi ranglistába számító hányás (a kocsma tagjai látják a havi megszavazott hányásszámot; a telefon számolja a
  bulik szavazataiból és beírja a kocsmákba; a telefonon tárolt adatok listája is bővült).
- Hátra van: naptári események, Google Naptár-hozzáférés (csak olvasás, csak a felhasználó kérésére, visszavonható),
  helyadatok (csak engedéllyel, csak a felhasználó látja), később a felhasználói profilképek.
- Ha a chat nyilvánosabb lesz, vagy az app a Google Playre kerül: a Play felhasználói tartalomra vonatkozó szabálya az appon
  belüli jelentést (és 1:1 kapcsolatnál tiltást) is kéri.

## 5. Fontos figyelmeztetések a folytatáshoz
- **A felhasználó kérése (v13 óta): mindig az ő adatai kerüljenek a fájlokba**, helyőrző soha: a `firestore.rules`
  `ownerUid()`-ba és a `config.js` `MASNAPLO_OWNER_UID`-ba a UID-ja: `3hTaBCw1TYdBJt4mfVm3w0mEm7y1`; a `config.js`
  `MASNAPLO_PRIVACY`-be a neve: `Rácz Zsombor Marcell`, az elérhetősége: `racz.zsomborm@gmail.com`. Így a szabályokat
  szerkesztés nélkül Publish-olhatja, és a `config.js` is feltölthető. A tesztek ettől függetlenek: a `harness.js`
  `testConfig({owner, controller, contact})` a config.js-ből mindig minta-példányt készít (alapból helyőrzőkkel), így a
  tesztek a valódi adatoktól függetlenül ugyanúgy futnak.
- Fájlverziók: a `?v=` számot és a service worker cache nevét minden kiadásnál emelni kell (most: 13).
- A meglévő felhasználók adatai (statisztika, napok, bulik, fiókok) nem veszhetnek el; minden átállást kliensoldali,
  ismételhető (idempotens) migrációval. Új migrációnál `MIGRATION_V` emelése és a `private.migrated` jelző használata.
- Ha a régi kliens (v6) egy ideig még fut valakinél, ugyanabban a buliban az új apppal együtt is működik (tesztelve).
