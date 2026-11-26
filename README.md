# MÁSNAPLÓ – „Ami tegnap még jó ötletnek tűnt”

Telefonra telepíthető napi ivásnapló, buli számláló és verseny barátoknak. Mindenki a saját fiókjával lép be,
naponta felírja, mit ivott (buli nélkül is), és ha egy napját buliba rendeli, a buli többi résztvevője élőben látja.

## Mi van a mappában

- `index.html`, `app.js`: maga az app (felület és logika)
- `backend.js`: a Firebase kapcsolat (fiókok és adatbázis)
- `config.js`: a Firebase projekted adatai (már ki van töltve az ivas-tracker projekttel)
- `firestore.rules`: az adatbázis szabályai, ezt a Firebase konzolba kell bemásolni
- `manifest.webmanifest`, `sw.js`, `icons/`: ettől települ appként a telefonra

## Frissítés a Felhasználási feltételekkel (v8)

Ebben a kiadásban csak a felület változott: a Firestore szabályai és az adatmodell ugyanazok, mint a v7-ben.
Ha a v7-et (napi napló) még nem töltötted fel, előbb annak a lépéseit csináld meg (lent), utána ezt.

1. **Nézd meg a saját `config.js`-edet:** a `MASNAPLO_PRIVACY` részben a `controller` (a neved) és a `contact`
   (egy elérhetőség, például e-mail-cím) legyen kitöltve, mert ez kerül a Felhasználási feltételekbe üzemeltetőként.
   Ha nincs kitöltve, töltsd ki, és ezt az egy esetben a `config.js`-t is töltsd fel. (Ha hiányzik, a Profil fülön
   a Tulajdonos sor és a Tulajdonos menü pirossal figyelmeztet.)
2. **GitHub:** **Add file → Upload files**, és húzd be ezeket: `index.html`, `app.js`, `sw.js`, `README.md`,
   `FEJLESZTES.md`, majd **Commit changes**. A `backend.js`, a `firestore.rules`, a `manifest.webmanifest` és az
   `icons` mappa nem változott; a Firebase konzolban sem kell semmit csinálni.
3. Nyisd meg az appot. Mindenki egyszer újra látja a hozzájárulási képernyőt: itt el kell fogadni a Felhasználási
   feltételeket (új, külön jelölőnégyzet), és újra megerősíteni a 18 évet és az adatkezelési hozzájárulást.

## Frissítés a napi naplós változatra (v7)

Ezt a sorrendet tartsd be, mert az új app az új szabályok nélkül nem tud menteni.

1. **Firebase → Firestore → Rules:** másold be az új `firestore.rules` teljes tartalmát, majd **a fájl elején az
   `ownerUid()` részbe írd vissza a saját UID-odat** (a mintában `IDE_JON_A_SAJAT_UID` áll), és **Publish**.
   Az új szabályok a régi appot is kiszolgálják, így ez a lépés semmit nem ront el.
2. **GitHub:** **Add file → Upload files**, és húzd be ezeket a fájlokat a mappából: `index.html`, `app.js`, `backend.js`,
   `sw.js`, `README.md`, `FEJLESZTES.md`, majd **Commit changes**. **A `config.js`-t ne töltsd fel**, a tiéd marad
   (abban vannak a saját adataid). Az `icons` mappa és a `manifest.webmanifest` nem változott. A `firestore.rules`
   feltöltése nem kötelező (a szerver a konzolba bemásolt példányt használja); ha feltöltöd, előtte ebbe is írd bele a UID-odat.
3. Nyisd meg az appot. Mivel bővült az adatkezelési tájékoztató, mindenki egyszer újra látja a hozzájárulási képernyőt.
4. Az első indításkor az app magától átírja a korábbi bulijaidat a napi naplóba (ez pár másodperc). A statisztikád
   nem változik, a bulik ugyanúgy megvannak. Mindenkinél a saját első indításakor történik meg.

**Mi történik az átíráskor:** minden buliban a saját számlálóid a buli napjára kerülnek (a buli indulásának napjára,
vagy ha az nem ismert, a legkorábbi ismert ital napjára), és az a nap ahhoz a bulihoz tartozik. Ha két régi buli
ugyanarra a napra esik, a nagyobbik kapja a napot; a kisebbik „régi buliként” érintetlen marad (a buliban látszik,
de napot nem lehet hozzá rendelni). Az átírás ismételhető: ha közben megszakad, a következő indításkor vagy amikor
visszajön a net, ott folytatja, ahol abbahagyta, és semmit nem számol kétszer.

## Tulajdonosi menü beállítása (egyszer kell)

1. Az appban: **Profil → Fiók és e-mail → Fiókazonosító (UID) → Másolás.**
   (Ugyanezt a Firebase konzolban is megtalálod: Authentication → Users → User UID oszlop.)
2. **`firestore.rules`:** a fájl elején az `ownerUid()` részben cseréld le az `IDE_JON_A_SAJAT_UID` szöveget a
   kimásolt UID-ra (az aposztrófok maradjanak), másold be a Firebase konzolba, és **Publish**.
3. **`config.js`:** a `MASNAPLO_OWNER_UID` értékét is cseréld le ugyanerre a UID-ra, és töltsd fel GitHubra.
4. Nyisd meg újra az appot: a Profil fül Beállítások részében megjelenik a **Tulajdonos** pont. Másoknál nem jelenik meg,
   és ha valaki a kódot átírva megjelenítené, a szerver akkor is elutasítja.

**Hogyan véd:**
- A jogot a szerver adja a szabályokban lévő UID alapján, nem az app.
- Tulajdonosi műveletet a szerver csak akkor enged, ha az elmúlt 15 percben újra beírtad a jelszavadat.
  Ha valaki a feloldott telefonodhoz hozzáfér, jelszó nélkül akkor sem tud semmit csinálni.
- Minden tulajdonosi művelet bekerül egy naplóba, amit az appból sem módosítani, sem törölni nem lehet.
- A tulajdonost nem lehet letiltani, és a saját fiókodat a menüből nem lehet kiüríteni.

**Ha a `config.js`-ben nincs kitöltve a neved vagy az elérhetőséged** (`MASNAPLO_PRIVACY`), a Tulajdonos sor és a
Tulajdonos menü pirossal jelzi, mert enélkül a Felhasználási feltételek és az Adatkezelési tájékoztató nem nevezi meg
az üzemeltetőt.

**Mit tud a Tulajdonos menü:** felhasználók átnevezése, letiltása és feloldása, egy felhasználó összes adatának
törlése, egy ember számlálóinak nullázása és a róla szóló hányás-szavazatok törlése a megnyitott bulin, egy egész buli
törlése, és a napló megtekintése. Egy ember számlálóját darabonként is javíthatod: a buliban koppints a nevére, majd a
kategóriájára, amíg a tulajdonosi mód fel van oldva. A javítás az illető napi naplójában (a buliba rendelt napján) és a
statisztikájában is átvezetődik. Buli törlésekor a résztvevők napi naplója megmarad, a napjaik csak már nem tartoznak
ahhoz a bulihoz.

**Amit nem tud:** a belépési rekordot (a Firebase-fiókot) az app nem tudja törölni. Ha teljesen el akarsz tüntetni
egy fiókot: Firebase konzol → Authentication → Users → keresd meg a fiókazonosítót → ⋮ → Delete account.
A letiltás és az adatok törlése után ez a rekord már semmire nem használható.

**Biztonsági javaslatok:**
- A tulajdonosi fiókodhoz használj erős, máshol nem használt jelszót, és adj meg hozzá e-mail-címet.
- A Firebase konzolhoz használt Google-fiókodon kapcsold be a kétlépcsős azonosítást. A konzol mindenhez hozzáfér,
  ez a legerősebb kulcs az egész rendszerhez.

## Fiókok

- Felhasználónév: 3–20 karakter, angol betűk, számok, pont, kötőjel vagy aláhúzás, ékezet nélkül.
  Minden név csak egyszer létezhet (a kis- és nagybetű nem számít különbözőnek). A Profil fülön módosítható.
- Jelszó: legalább 8 karakter, legyen benne kisbetű, nagybetű és szám.
- **E-mail-cím (nem kötelező):** regisztrációkor vagy később a Profil fülön (Fiók és e-mail) adható meg. Csak az elfelejtett
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

## Felhasználási feltételek

- Az app „Felhasználási feltételek” lapja elmondja, hogy az appot mindenki a saját felelősségére használja, és hogy
  az üzemeltető (a fejlesztő és tulajdonos) a jogszabályok által megengedett legteljesebb mértékben kizárja a
  felelősségét az app használatából eredő károkért. A magyar jog szerint a szándékosan okozott, illetve az emberi
  életet, testi épséget vagy egészséget megkárosító kárért a felelősség nem zárható ki: a szöveg ezt kifejezetten kiveszi.
- A lap elérhető: Profil → Beállítások (az Adatkezelési tájékoztató fölött), a regisztrációs képernyőről, a hozzájárulási
  képernyőről és a Letiltva képernyőről. A két lap hivatkozik egymásra.
- Az üzemeltető neve és elérhetősége a `config.js` `MASNAPLO_PRIVACY` részéből jön.
- Elfogadásuk kötelező: regisztrációkor és a hozzájárulási képernyőn külön jelölőnégyzet („Elolvastam és elfogadom a
  Felhasználási feltételeket, és tudomásul veszem, hogy az appot a saját felelősségemre használom.”), enélkül nem lehet
  továbblépni. Az elfogadás a hozzájárulási rekordba kerül (`terms: true`).
- Rövid emlékeztetők: az Ivós játékok fülön („Minden játékot a saját felelősségedre játszol. Senkit ne kényszeríts ivásra.”)
  és a Profil grafikonja alatt („A számok becslések: nem mérik a véralkoholszintet, és nem alkalmasak annak eldöntésére,
  hogy vezethetsz-e.”).
- **Ha módosítod a feltételeket:** a szöveg az `app.js` `termsContent()` függvényében van; a dátumot az `app.js` elején a
  `TERMS_DATE` adja. Lényeges módosításnál a `CONSENT_V` értékét is emeld (például új dátumra), így mindenki a következő
  megnyitáskor újra látja és elfogadja őket.

## Adatvédelem

- Regisztrációkor kötelező bejelölni, hogy az illető elmúlt 18 éves, elfogadja a Felhasználási feltételeket, és
  hozzájárul az adatkezeléshez. A hozzájárulás (és a feltételek elfogadásának) időpontja a szerveren, csak a felhasználó
  és a tulajdonos számára olvashatóan tárolódik.
- Az adatkezelési tájékoztató a regisztrációnál, a hozzájárulási képernyőn és a Profil fülön is elérhető.
- A napi napló részleteit (melyik nap pontosan mit ivott, melyik napja melyik bulihoz tartozik) és a saját ivós
  játékokat csak a felhasználó látja (és a tulajdonos, friss jelszóval). A statisztikát (kategóriánként, napi
  bontásban is) és a bulikon felírt italokat a többiek is látják.
- **Fiókom törlése** (Profil): a jelszó megadása után törli a fiókot, a felhasználónevet, a statisztikát, a napi naplót,
  a saját ivós játékokat, valamint a buli-összesítéseket és a szavazatokat minden olyan buliból, amelyet a felhasználó
  ezzel a fiókkal bármelyik eszközén megnyitott, vagy amelyhez napot rendelt. Ha valakinek egy régebbi buliban mégis
  maradna adata (például egy azóta nem használt telefonról), azt a Firebase konzolban kézzel lehet törölni:
  Firestore → `parties` → a buli kódja → `players`, illetve `votes` → az illető azonosítója.

## Használat

- **Alsó sáv:** Ivós játékok · Naptár · **Kocsma** (középen) · Térkép · Profil (a saját monogramod).
- **Kocsma fül, „Ma” sáv:** a négy kategória (rövid, bor, sör, víz) mai darabszáma. A **+1** gomb az alatta kiírt,
  utoljára választott fajtát írja fel (pl. Unicum). A kategóriára koppintva fajtánként is felírhatsz vagy levonhatsz.
  Egy nap hajnali 6-tól másnap hajnali 6-ig tart, így az éjfél utáni italok is ugyanahhoz a naphoz kerülnek.
- **Lebegő + gomb (jobb alul, minden fülön):** egy lap az összes fajtával; egy koppintás egy ital a mai napra.
  A „Más…” gombbal saját italnevet is felvehetsz. Minden felírás után 5 másodpercig visszavonható.
- **Buli nélkül is működik:** amit felírsz, a napi naplódba kerül. Ha bulizol, a Kocsma fülön **Új buli** vagy
  **Belépés kóddal**: a mai napod ahhoz a bulihoz kerül, és a résztvevők látják egymást (verseny, szavazás).
  Egy naphoz egy buli tartozik. A **Meghívás** gomb linket küld; aki azt megnyitja, egy koppintással belép.
  Ha előző nap buliban voltál, a Kocsma fül felajánlja a folytatását (többnapos bulihoz).
- **Buli nézet:** verseny (a résztvevők egymás alatt, monogrammal), egy emberre koppintva a részletei és a
  hányás-szavazás, a buli közös összege és a legutóbbi italok. A buli bármikor átnevezhető.
- **Korábbi bulijaim:** a Kocsma fül alján; egy bulira koppintva megnyílik. Az × csak erről a telefonról veszi le.
- **Profil fül:** saját statisztika (idén és összesen), napi grafikon, **Napjaim** és a beállítások.
  A Napjaim listában bármelyik nap megnyitható: utólag javíthatod (+/−, ez a statisztikát és a buli összesítését is
  frissíti), és buliba rendelheted (meglévő bulidhoz, új bulihoz névvel, vagy kóddal), illetve kiveheted belőle.
  A „Másik nap” gombbal egy korábbi, még üres napot is felírhatsz.
- **Ivós játékok fül:** saját játékok (név, létszám, eszközök, rövid leírás), keresés név alapján. Csak te látod őket.
- **Naptár és Térkép:** hamarosan.
- **Mennyiségek:** rövid 4 cl, bor 1 dl, sör 5 dl, víz vagy üdítő 3 dl darabonként. Imperialban brit fl oz és pint.
- **Verseny:** pontok: rövid +5, bor +3, sör +2, víz vagy üdítő +0,25.
- **Hányás-szavazás:** egy emberre koppintva a buli többi résztvevője szavazhat (az illető saját magára nem).
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
