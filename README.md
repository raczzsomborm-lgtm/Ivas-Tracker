# Strigula – buli számláló (önálló verzió)

Telefonra telepíthető webes alkalmazás (PWA). Mindenki a saját fülén vezeti, mit ivott, és a többiek élőben látják.
Nem kell hozzá Claude-fiók: az adatokat a saját, ingyenes Firebase projekted tárolja.

## Mi van a mappában

- `index.html`, `app.js`: maga az app
- `backend.js`: a Firebase kapcsolat
- `config.js`: **ide kell beírnod a saját Firebase adataidat**
- `firestore.rules`: az adatbázis szabályai, ezt a Firebase konzolba kell bemásolni
- `manifest.webmanifest`, `sw.js`, `icons/`: ettől települ appként a telefonra, és indul el gyenge neten is

## 1. Firebase projekt (kb. 10 perc, ingyenes)

1. Nyisd meg a https://console.firebase.google.com oldalt, és hozz létre egy új projektet (például `strigula` néven). A Google Analytics kikapcsolható.
2. Bal oldalt: **Build → Authentication → Get started**, majd a **Sign-in method** fülön kapcsold be az **Anonymous** módot, és mentsd.
3. **Build → Firestore Database → Create database.** Ha kérdezi, válaszd a Standard változatot, helynek egy európait (például `eur3` vagy `europe-west3`), és a **Production mode**-ot.
4. A Firestore **Rules** fülén töröld ki, ami ott van, másold be a `firestore.rules` teljes tartalmát, és nyomj **Publish**-t.
5. Fogaskerék → **Project settings → General → Your apps** → Web ikon (`</>`). Adj nevet, a Firebase Hosting jelölőnégyzet nem kell. Megjelenik egy `const firebaseConfig = { ... }` blokk.
6. A `config.js` fájlban cseréld le az `IDE_JON…` értékeket a kapott értékekre (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).

Ezek az adatok nem titkosak, nyugodtan lehetnek nyilvános helyen: a védelmet a szabályok adják
(mindenki csak a saját számlálóját írhatja, és csak az láthatja a bulit, aki ismeri a kódját).

## 2. Feltöltés GitHub Pagesre (ingyenes)

1. A github.com-on hozz létre új, **Public** repository-t (például `strigula`).
2. Kattints az „uploading an existing file” linkre, húzd be a mappa **tartalmát** (az `icons` mappát is), és **Commit changes**.
   Ha az `icons` mappa nem jönne át, töltsd fel külön: **Add file → Upload files**, és húzd be a mappát.
3. **Settings → Pages**: Source legyen **Deploy from a branch**, Branch **main** és **/ (root)**, majd **Save**.
   Egy-két perc múlva itt fut: `https://FELHASZNALONEV.github.io/strigula/`
4. Firebase konzol: **Authentication → Settings → Authorized domains → Add domain**, és add hozzá: `FELHASZNALONEV.github.io`

## 3. Telefonra telepítés

- **iPhone:** nyisd meg a linket Safariban → Megosztás ikon → **Főképernyőhöz adás**. Ezután **az ikonról indítva** lépj be
  (iPhone-on a kitett app külön tárolót kap, ezért ha előbb Safariban lépnél be, kétszer szerepelnél).
- **Android:** nyisd meg a linket Chrome-ban → ⋮ menü → **Alkalmazás telepítése** vagy **Hozzáadás a kezdőképernyőhöz**.
  Az appban is megjelenhet egy Telepítés gomb.

## Használat

- Első indításkor megadod a neved és a buli kódját. Ha te indítod a bulit, koppints az „Új bulit indítok” linkre, az ad egy kódot.
- A **Mindenki** fülön a **Barátok meghívása** gombbal elküldheted a linket; aki megnyitja, annak a kód már ki van töltve.
- A **+1** gomb az adott kategóriában az utoljára választott italt írja fel. Egy sorra koppintva fajtánként vezetheted, javíthatsz (−), és saját italt is felvehetsz.
- Elkoppintás után 5 másodpercig ott a **Visszavonás**.
- Új buli: **Beállítások → Másik buli vagy új kód**. A régi buli megmarad, a kódjával vissza lehet menni.
- Gyenge térerőnél is felírhatsz: az app elmenti, és amint visszajön a net, elküldi.
- **Statisztika:** a saját füleden alul látod, mennyit ittál idén és összesen, az összes bulidból összeadva.
  A Mindenki fülön ugyanez van mindenkire együtt. A nullázás, a buliváltás és a kilépés ezt nem törli.
  A saját statisztika ahhoz a telefonhoz (böngészőhöz) tartozik, amelyikről beírtad.

## Ha már feltöltötted egy korábbi változatot

1. Töltsd fel újra az `index.html`, `app.js` és `backend.js` fájlt (GitHubon: a fájlra kattintva ceruza, vagy Add file → Upload files, ugyanazzal a névvel felülírja).
2. A Firebase konzolban a Firestore **Rules** fülén cseréld le a szabályokat az új `firestore.rules` tartalmára, és **Publish**.
   Ha ezt kihagyod, a számlálók működnek, de a statisztika helyén az app szól, hogy frissíteni kell a szabályokat.

## Költség

A Firebase ingyenes (Spark) csomagja napi 50 000 olvasást és 20 000 írást ad, ez egy baráti társaságnak bőven elég, és nem kell hozzá bankkártya.
