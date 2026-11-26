# Másnapló – fejlesztési leírás (átadás új beszélgetéshez)

Ez a fájl minden eddigi döntést és a következő fejlesztési ütemek tervét tartalmazza.
Új beszélgetésben ezt, a teljes projektmappát és a tesztcsomagot (`masnaplo-tesztek.zip`) kell átadni, és innen lehet folytatni.

## 1. A jelenlegi állapot (v8: az 1a. ütem és a Felhasználási feltételek kész)

**Hosting:** GitHub Pages (repó: „Ivas Tracker”), Firebase projekt: `ivas-tracker` (Spark, ingyenes).
**Firebase:** Authentication (Anonymous + Email/Password), Firestore (`(default)`, európai hely).

### Fájlok
- `index.html` – teljes CSS, fejléc (MÁSNAPLÓ logó + dőlt mottó), alsó sáv (`#nav`), lebegő gombok (`#fab`, `#gameFab`),
  `app.js?v=8`, `backend.js?v=8`.
- `app.js` – egy IIFE, állapot az `S` objektumban. Fázisok: `boot | auth | pickname | consent | banned | loading | ready | …`.
  Statikus nézetek (nem rajzolódnak újra adatfrissítéskor): auth, pickname, consent, banned.
  `ready` fázisban fülek: `S.tab` = `games | calendar | kocsma | map | profile`. Az Ivós játékok fül kulcsolt nézet
  (a keresőmező megmarad, csak a lista frissül). Lapok (`openSheet`): dinamikusak (`add`, `day`, `daycat`, `pcat`) és
  statikusak (űrlapok: `join`, `partyName`, `otherDay`, `game`, `account`, `owner`, `ownerUser`, `privacy`, `terms`, `delete`, `confirm`, `daysPick`).
  Egy lap `back` mezővel vissza gombot kap (pl. a `terms` és a `privacy` egymásra hivatkozik, és vissza lehet lépni).
- `backend.js` – Firebase modular SDK 10.12.2 dinamikus importtal (gstatic), `hand(backendObj)` adja át az appnak.
  Offline gyorsítótár (persistentLocalCache). Minden adatművelet itt van függvényként.
- `config.js` – `STRIGULA_FIREBASE`, `MASNAPLO_PRIVACY`, `MASNAPLO_OWNER_UID`. **A felhasználó saját példányát nem szabad felülírni.**
- `firestore.rules` – a szerveroldali védelem. Az `ownerUid()` függvényben a tulajdonos UID-ja áll (a repóban minta szöveg).
- `sw.js` – service worker; saját fájlok: előbb hálózat; Firebase/betűk: előbb gyorsítótár. Cache: `masnaplo-v8`.
- `manifest.webmanifest`, `icons/masnaplo-*.png`, `icons/kocsma/*.svg` (a 10 kocsma-profilkép, az 1b-ben kell).

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
- **`users/{uid}/games/{id}`** – saját ivós játék: `{name ≤60, players ≤30, tools ≤300, desc ≤2000, createdAt, updatedAt}` (csak a felhasználó látja).
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
- `banned/{uid}`, `adminlog/{id}` (változatlan).
- localStorage: `strigula-parties`, `strigula-hidden-parties`, `strigula-units`, `strigula-install-hidden`,
  `strigula-pending-email` (a `strigula-party` az átállás után törlődik).

### Szabályok és logika röviden
- Buli-nap: hajnali 6-tól másnap hajnali 6-ig (`DAY_START_HOUR = 6`). A „Ma” félpercenként újraszámolódik.
- Egy naphoz egy buli. Egy buli több napból is állhat (többnapos buli: „Folytatom a tegnapi bulit”).
- Adagok, pontok, hányás-szavazás, fiókszabályok: változatlanok (rövid 4 cl/+5, bor 1 dl/+3, sör 5 dl/+2, víz 3 dl/+0,25; hányás −20).
- Hozzájárulás: `CONSENT_V = "2026-11-26b"` (a v7-ben `"2026-11-26"` volt). Érvényes, ha `consent.v === CONSENT_V` és
  `consent.terms === true` (`consentValid`); különben a hozzájárulási képernyő jön. A tájékoztató 1a-ra frissítve; a későbbi
  funkciókhoz (barátok, kocsma, chat, naptár, térkép) a tájékoztatót (és ha kell, a feltételeket) bővíteni és `CONSENT_V`-t
  emelni kell (a szöveg ezt előre jelzi).
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
- Meghívó link (`?buli=kód`): ismeretlen kódnál meghívó lap (előnézettel), ismert kódnál csak megnyitja a bulit.

### Tesztelés (így készült a v7 és a v8)
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
  - `shots.js` – képernyőképek világos és sötét módban (benne a hozzájárulási képernyő, a regisztráció, a Felhasználási
    feltételek lap és a tulajdonosi figyelmeztetés is).
  A `harness.js` `appConst("CONSENT_V")` az app.js-ből olvassa ki az állandót, így a tesztet nem kell minden emeléskor átírni.
  Futtatás: Node 18+ és Playwright (Chromium) kell, más nem. A tesztcsomagot a projektmappa mellé kell kibontani, majd
  pl. `cd masnaplo-tesztek && TZ=Europe/Budapest node t1_migration.js`. Az `APP_DIR` mondja meg, melyik mappát szolgálja ki
  (alapból `../masnaplo`), az `OLD_DIR` a régi (v6) változatot (alapból a csomagban lévő `regi-v6`).
- **Korlát:** a valódi Firestore-emulátor ebben a környezetben nem volt elérhető, ezért a szabályokat a tükör teszteli.
  A `firestore.rules` szintaxisát a Firebase konzol a Publish-kor ellenőrzi. Új szabálynál a tükröt (`store.js` `rule()`)
  is frissíteni kell.

## 2. A felhasználó döntései (érvényesek)

- **Kocsma-profilképek:** a 10 kiválasztott ikon (`icons/kocsma/01…10`).
- **Chat:** egyelőre **csak szöveges** (képek/videók később; videóhoz Firebase Blaze kellene).
- **Naptár-import:** **Google Naptár** (Google-belépés, `calendar.readonly`; egyszeri Google Cloud OAuth-beállítás kell).
- **A hónap ivója:** **pontok** alapján (rövid 5, bor 3, sör 2, víz 0,25), csak italok; a hányás-büntetés a bulik versenyében marad.
  Kihirdetés: a hónap utáni első megnyitáskor a kocsmában (egy tag kliense írja be, idempotensen, hónap szerinti azonosítóval).
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

### 1b. ütem – barátok és kocsmák
1. **Barátok:** jelölés felhasználónév alapján, elfogadás/elutasítás; `friendRequests`, `users/{uid}/friends/{uid}`.
2. **Kocsma:** alapítás (név, 10 ikonból profilkép), meghívókód; belépés kóddal **előnézettel** (név, profilkép, tagok listája egymás alatt);
   több kocsma, váltás közöttük. Javasolt: `kocsmak/{id}` (név, ikon, kód, tulajdonos), `kocsmak/{id}/members/{uid}`,
   `kocsmaCodes/{kód}` → előnézeti adat, amit belépés előtt is lehet olvasni.
3. **Kocsma fül:** fejléc (profilkép, név, taglétszám), Chat és Buli gomb, „Ma” sáv (megvan), a hónap ivója (előző hónap), havi ranglista
   (tagok egymás alatt, profilkép + név + pont), tagra koppintva a profilja (közérdekű adatok: fogyasztás, statisztika).
   A mai buli és a Korábbi bulijaim a kocsma alá kerülhet.
4. **Chat:** szöveges, `kocsmak/{id}/messages/{id}`, csak tagok olvashatják/írhatják.
5. **A hónap ivója:** havi pontok a `users/{uid}.days` alapján; kihirdetés a hónap után (`kocsmak/{id}/awards/{ÉÉÉÉ-HH}`).
6. Tájékoztató bővítése (barátok, kocsmatagság, chat, a hónap ivója), `CONSENT_V` emelése; fióktörléskor ezek törlése is.

### 2. ütem – naptár
- Havi/heti naptár saját eseményekkel (`users/{uid}/events`).
- Google Naptár import engedéllyel (Google Identity Services, `calendar.readonly`). Ehhez a felhasználónak a Google Cloud Console-ban
  OAuth-hozzájárulási képernyőt és webes klienst kell beállítania (tesztfelhasználókkal, ellenőrzés nélkül max. 100 fő).
- **Buli előre bejelentése:** dátum vagy időszak; a kezdőnap reggel 6-kor „automatikusan indul”: amikor a meghívottak megnyitják az appot,
  az aznapi napjuk már ehhez a bulihoz tartozik (a napi napló `party` mezője ezt már tudja). Push értesítés szerver nélkül nem lehetséges.
- **Kocsmás buli:** a kocsma „Buli” gombjával; a kocsma minden tagja automatikusan bekerül.

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
> Az ivós játékokat a felhasználók maguk írják; az üzemeltető ezeket nem ellenőrzi, nem ajánlja és nem vállal értük felelősséget. Minden játékot mindenki a saját felelősségére játszik; tartsátok be a jogszabályokat és a helyszín szabályait, és vegyétek figyelembe egymás egészségét és határait. Mindenki maga felel azért, amit az appba beír (italok, nevek, szavazatok, játékok). Tilos jogsértő, mások jogait vagy jó hírnevét sértő, illetve bántó tartalmat beírni. Az üzemeltető az ilyen tartalmat eltávolíthatja, a fiókot letilthatja.
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
- Felhasználási feltételek 5. pont: a felhasználók által beírt tartalom felsorolását a chat-üzenetekkel, a kocsmák nevével
  és később a profilképekkel bővíteni; a tulajdonos moderálási joga a kocsmákra is. Ilyenkor `TERMS_DATE` és `CONSENT_V` emelése.
- Barátkapcsolatok, kocsmatagság, chat-üzenetek (tárolás ideje, ki látja: a kocsma tagjai), naptári események,
  Google Naptár-hozzáférés (csak olvasás, csak a felhasználó kérésére, visszavonható), helyadatok (csak engedéllyel,
  csak a felhasználó látja), a hónap ivója kihirdetése a kocsmában.
- Fióktörléskor ezek törlése is (üzenetek: javaslat: törlés).
- A tulajdonosi jogosultságok kiterjesztése a kocsmákra (moderálás) – a naplózással együtt.

## 5. Fontos figyelmeztetések a folytatáshoz
- A felhasználó **ne töltse fel a csomagban lévő `config.js`-t és ne másolja be a minta `firestore.rules`-t UID nélkül**, mert azokban
  az ő saját adatai (név, UID) helyett minta szöveg áll. Új szabályoknál mindig emlékeztetni: az `ownerUid()`-ba írja vissza a UID-ját.
- Fájlverziók: a `?v=` számot és a service worker cache nevét minden kiadásnál emelni kell (most: 8).
- A meglévő felhasználók adatai (statisztika, napok, bulik, fiókok) nem veszhetnek el; minden átállást kliensoldali,
  ismételhető (idempotens) migrációval. Új migrációnál `MIGRATION_V` emelése és a `private.migrated` jelző használata.
- Ha a régi kliens (v6) egy ideig még fut valakinél, ugyanabban a buliban az új apppal együtt is működik (tesztelve).
