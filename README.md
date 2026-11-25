# MÁSNAPLÓ – „Ami tegnap még jó ötletnek tűnt”

Telefonra telepíthető buli számláló és verseny barátoknak. Mindenki a saját fiókjával lép be,
a saját fülén vezeti, mit ivott, és a többiek élőben látják.

## Mi van a mappában

- `index.html`, `app.js`: maga az app
- `backend.js`: a Firebase kapcsolat (fiókok és adatbázis)
- `config.js`: a Firebase projekted adatai (már ki van töltve az ivas-tracker projekttel)
- `firestore.rules`: az adatbázis szabályai, ezt a Firebase konzolba kell bemásolni
- `manifest.webmanifest`, `sw.js`, `icons/`: ettől települ appként a telefonra

## Frissítés a korábbi változatról (tulajdonosi menü)

1. **GitHub:** **Add file → Upload files**, húzd be a mappa teljes tartalmát, és **Commit changes**.
2. **Firebase → Firestore → Rules:** másold be az új `firestore.rules` teljes tartalmát, és **Publish**.
   Amíg a fájl elején a minta szöveg (`IDE_JON_A_SAJAT_UID`) áll, senkinek nincs tulajdonosi joga, így ez biztonságos.
3. Nyisd meg az appot. Mivel a tájékoztató bővült, mindenki egyszer újra látja a hozzájárulási képernyőt.
4. Utána állítsd be magad tulajdonosnak (lásd lent).

Ha még az adatvédelmi frissítés előtti változatról jössz, a `config.js` `MASNAPLO_PRIVACY` részébe írd be a nevedet
és egy elérhetőséget, és ellenőrizd, hogy a Firebase-ben az **Authentication → Settings → User actions** alatt az
**Enable deletion** be van-e kapcsolva.

## Tulajdonosi menü beállítása (egyszer kell)

1. Az appban: **☰ → Beállítások → Fiók → Fiókazonosító (UID) → Másolás.**
   (Ugyanezt a Firebase konzolban is megtalálod: Authentication → Users → User UID oszlop.)
2. **`firestore.rules`:** a fájl elején az `ownerUid()` részben cseréld le az `IDE_JON_A_SAJAT_UID` szöveget a
   kimásolt UID-ra (az aposztrófok maradjanak), másold be a Firebase konzolba, és **Publish**.
3. **`config.js`:** a `MASNAPLO_OWNER_UID` értékét is cseréld le ugyanerre a UID-ra, és töltsd fel GitHubra.
4. Nyisd meg újra az appot: a menüben megjelenik a **Tulajdonos** pont. Másoknál nem jelenik meg, és ha valaki
   a kódot átírva megjelenítené, a szerver akkor is elutasítja.

**Hogyan véd:**
- A jogot a szerver adja a szabályokban lévő UID alapján, nem az app.
- Tulajdonosi műveletet a szerver csak akkor enged, ha az elmúlt 15 percben újra beírtad a jelszavadat.
  Ha valaki a feloldott telefonodhoz hozzáfér, jelszó nélkül akkor sem tud semmit csinálni.
- Minden tulajdonosi művelet bekerül egy naplóba, amit az appból sem módosítani, sem törölni nem lehet.
- A tulajdonost nem lehet letiltani, és a saját fiókodat a menüből nem lehet kiüríteni.

**Mit tud a Tulajdonos menü:** felhasználók átnevezése, letiltása és feloldása, egy felhasználó összes adatának
törlése, egy ember számlálóinak nullázása és a róla szóló hányás-szavazatok törlése az aktuális bulin, egy egész buli
törlése, és a napló megtekintése. Egy ember számlálóját darabonként is javíthatod: nyisd meg a fülét, és koppints a
kategóriájára, amíg a tulajdonosi mód fel van oldva.

**Amit nem tud:** a belépési rekordot (a Firebase-fiókot) az app nem tudja törölni. Ha teljesen el akarsz tüntetni
egy fiókot: Firebase konzol → Authentication → Users → keresd meg a fiókazonosítót → ⋮ → Delete account.
A letiltás és az adatok törlése után ez a rekord már semmire nem használható.

**Biztonsági javaslatok:**
- A tulajdonosi fiókodhoz használj erős, máshol nem használt jelszót, és adj meg hozzá e-mail-címet.
- A Firebase konzolhoz használt Google-fiókodon kapcsold be a kétlépcsős azonosítást. A konzol mindenhez hozzáfér,
  ez a legerősebb kulcs az egész rendszerhez.

## Fiókok

- Felhasználónév: 3–20 karakter, angol betűk, számok, pont, kötőjel vagy aláhúzás, ékezet nélkül.
  Minden név csak egyszer létezhet (a kis- és nagybetű nem számít különbözőnek). A Beállításokban módosítható.
- Jelszó: legalább 8 karakter, legyen benne kisbetű, nagybetű és szám.
- **E-mail-cím (nem kötelező):** regisztrációkor vagy később a Beállításokban adható meg. Csak az elfelejtett
  jelszó visszaállításához kell, és senki más nem látja.
  - Akinek van e-mail-címe, az **az e-mail-címével lép be** (a felhasználóneve marad a neve az appban).
    Erre azért van szükség, mert különben a valódi e-mail-címet a nyilvánosan lekérdezhető név-rekordban
    kellene tárolni, és bárki kiolvashatná.
  - Később hozzáadott címnél a Firebase megerősítő levelet küld; a cím a levélben lévő linkre kattintás után
    lesz a fiók címe, onnantól azzal kell belépni.
  - A levelek a `noreply@ivas-tracker.firebaseapp.com` címről jönnek, és a levélszemét mappába is kerülhetnek.
- **Elfelejtett jelszó:** a belépő képernyőn „Elfelejtettem a jelszavam”. Csak e-mail-címmel rendelkező fióknál
  működik; e-mail nélkül a jelszót nem lehet visszaállítani, ilyenkor új fiók kell.
- Ugyanazzal a fiókkal több telefonról is be lehet lépni.

## Adatvédelem

- Regisztrációkor kötelező bejelölni, hogy az illető elmúlt 18 éves, és hozzájárul az adatkezeléshez.
  A hozzájárulás időpontja a szerveren, csak a tulajdonos számára olvashatóan tárolódik.
- Az adatkezelési tájékoztató a regisztrációnál és a Beállításokban is elérhető.
- **Fiókom törlése** (Beállítások): a jelszó megadása után törli a fiókot, a felhasználónevet, a statisztikát,
  valamint a számlálókat és a szavazatokat minden olyan buliból, amelyet a felhasználó ezzel a fiókkal bármelyik
  eszközén megnyitott a frissítés után. Ha valakinek egy régebbi buliban mégis maradna adata (például egy azóta
  nem használt telefonról), azt a Firebase konzolban kézzel lehet törölni: Firestore → `parties` → a buli kódja →
  `players`, illetve `votes` → az illető azonosítója.

## Használat

- **Menü (☰):** fogaskerék és „Beállítások”, alatta vékony csík után a korábbi bulijaid (görgethető lista).
  Egy bulira koppintva megnyílik, és látod, ki mennyit ivott ott. Itt indíthatsz új bulit is.
- **Beállítások:** mértékegység (metrikus vagy imperial), felhasználónév, kijelentkezés,
  és az aktuális buli dolgai (név, meghívás, nullázás, kilépés).
- **Mennyiségek:** rövid 4 cl, bor 1 dl, sör 5 dl, víz vagy üdítő 3 dl darabonként.
  Imperialban brit fl oz és pint.
- **Grafikon:** a saját füleden alul, naponta, színekre bontva. Egy színre koppintva kiírja, mi az és hány darab.
  Egy buli-nap hajnali 6-tól másnap hajnali 6-ig tart, így az éjfél utáni italok is ugyanahhoz a bulihoz kerülnek.
  A grafikon ettől a frissítéstől kezdve gyűjti az adatokat.
- **Verseny:** a Mindenki fülön. Pontok: rövid +5, bor +3, sör +2, víz vagy üdítő +0,25.
- **Hányás-szavazás:** egy ember fülén a többiek szavazhatnak (az illető saját magára nem).
  Ha a többiek több mint fele igennel szavaz, hányásonként −20 pont. Ilyenkor megjelenik a „Szerinted hányszor?” kérdés:
  ha a beküldött számok egyeznek, annyiszor −20 pont; ha eltérnek, vagy senki nem adott meg számot, 1 hányás számít.

## Teljesen új telepítés (ha egyszer újra kellene kezdeni)

1. console.firebase.google.com: új projekt, Firestore adatbázis (Standard, `(default)`, európai hely, production mode).
2. Authentication: az **Anonymous** és az **Email/Password** bejelentkezés bekapcsolása.
3. Firestore Rules: a `firestore.rules` tartalma, Publish.
4. Project settings → Your apps → Web app: a kapott adatokat írd be a `config.js` fájlba
   (a `MASNAPLO_PRIVACY` részt és a tulajdonos UID-ját is).
5. Feltöltés GitHub Pagesre, majd Authentication → Settings → Authorized domains: `FELHASZNALONEV.github.io`.

## Költség

A Firebase ingyenes (Spark) csomagja napi 50 000 olvasást és 20 000 írást ad, ez egy baráti társaságnak bőven elég.
