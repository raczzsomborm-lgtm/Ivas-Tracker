# MÁSNAPLÓ – „Ami tegnap még jó ötletnek tűnt”

Telefonra telepíthető napi ivásnapló, buli számláló és verseny barátoknak. Mindenki a saját fiókjával lép be,
naponta felírja, mit ivott (buli nélkül is), és ha egy napját buliba rendeli, a buli többi résztvevője élőben látja.
A barátok kocsmákba (állandó baráti társaságokba) gyűlnek: közös chat, havi ranglista és egy gombbal indítható kocsmás buli.

## Mi van a mappában

- `index.html`, `app.js`: maga az app (felület és logika)
- `backend.js`: a Firebase kapcsolat (fiókok és adatbázis)
- `config.js`: a Firebase projekted adatai (ivas-tracker), az üzemeltető neve és elérhetősége (Rácz Zsombor Marcell,
  racz.zsomborm@gmail.com) és a tulajdonos UID-ja (`3hTaBCw1TYdBJt4mfVm3w0mEm7y1`) – minden ki van töltve, feltölthető
- `firestore.rules`: az adatbázis szabályai, ezt a Firebase konzolba kell bemásolni (a tulajdonos UID-ja már benne van)
- `manifest.webmanifest`, `sw.js`, `icons/`: ettől települ appként a telefonra

## A saját adataid már benne vannak

A csomagban a `firestore.rules` (`ownerUid()`) és a `config.js` (`MASNAPLO_OWNER_UID`, `MASNAPLO_PRIVACY`) már a te
adataidat tartalmazza: UID `3hTaBCw1TYdBJt4mfVm3w0mEm7y1`, név Rácz Zsombor Marcell, elérhetőség racz.zsomborm@gmail.com.
Így a szabályokat szerkesztés nélkül, egészben bemásolhatod és Publish-olhatod, a `config.js`-t pedig nyugodtan feltöltheted.
(A lenti, régebbi frissítési lépésekben szereplő „írd vissza a UID-odat” és „a `config.js`-t ne töltsd fel” már nem kell.)

## Frissítés: megosztott ivós játékok, világos/sötét mód, Páros-páratlan (v13)

- **Ivós játékok fül, két fül:** **Az app játékai** (14 beépített játék, köztük újra a Páros-páratlan, orgia nélkül) és
  **Felhasználók játékai**: a saját játékaid („Megosztva” vagy „Csak te látod” jelöléssel), alattuk **Mások játékai**
  (amit mások megosztottak, a készítő nevével). Játék felvételekor vagy szerkesztésekor bejelölheted: **Megosztom a többi
  felhasználóval**. A megosztottat mindenki látja, a többit csak te. Tulajdonosként (feloldott módban) egy megosztott
  játék lapján **Törlés (tulajdonos)**, naplózva.
- A korábbi saját játékok az első indításkor maguktól átköltöznek az új helyre (nem megosztva).
- **Profil → Beállítások → Megjelenés:** Világos · Sötét · Automatikus (a telefon beállítását követi). A választás az
  adott telefonon marad meg.
- **Felhasználási feltételek, 5. pont:** a felhasználók játékait az üzemeltető nem ellenőrzi; egyik játékért, és az
  ezekből eredő károkért vagy személyi sérülésekért sem vállal felelősséget (a 7. pontban leírt, jogszabályi keretek
  között). A tájékoztató is bővült (megosztott játékok), ezért mindenki egyszer újra elfogadja a feltételeket.

1. **Firebase → Firestore → Rules:** másold be az új `firestore.rules` teljes tartalmát (a UID-od már benne van), és
   **Publish**. Új benne a közös `games` gyűjtemény szabálya. Ez kell előbb, különben a játékok nem költöznek át, és újat
   sem lehet felvenni.
2. **GitHub → Add file → Upload files:** `index.html`, `app.js`, `backend.js`, `config.js`, `sw.js`, `README.md`,
   `FEJLESZTES.md`, majd **Commit changes**.

## Frissítés: ivós játékok, ital-ikonok, Jelvényeim (v12)

- **Ivós játékok fül:** a saját játékaid alatt megjelent **Az app játékai** rész 13 beépített játékkal (magyarul, létszámmal,
  eszközökkel és leírással; egy játékra koppintva a teljes leírás). Ezeket mindenki látja, és nem szerkeszthetők; a kereső
  a magyar és az eredeti (angol) névre is keres. A saját játékok ugyanúgy működnek, mint eddig.
- **Ital-ikonok:** a rövid, bor, sör és víz/üdítő emoji helyett saját vektoros rajzok (a kategória színével) mindenhol, ahol
  fogyasztás látszik: a Ma sávban, a buli versenyében, a havi ranglistán, a „Legutóbb” listában, a statisztikában, a
  Napjaim listában és az ital-lapokon.
- **Profil → Jelvényeim:** koppintásra elhomályosodik a háttér, és megjelennek a jelvények helyei („Fejlesztés alatt”,
  egyelőre „Hamarosan” helyőrzőkkel). A jelvényeket és a leírásukat később adjuk hozzá (`app.js`, `BADGES` lista).

Feltöltés: **GitHub → Add file → Upload files**: `index.html`, `app.js`, `backend.js`, `sw.js`, `README.md`,
`FEJLESZTES.md`, majd **Commit changes**. A szabályok (`firestore.rules`) a v11 óta nem változtak, a `config.js`-t ne töltsd
fel. (Ha a v11-et még nem töltötted fel, a szabályokat a v11-es lépések szerint közzé kell tenni.)

## Frissítés: kocsma-javítás és „Minden fogyasztás nullázása” (v11)

**A hiba:** alapítás vagy belépés után a kocsma eltűnt, és nem lehetett megnyitni. Az app a kocsmát már akkor elkezdte
figyelni, amikor az alapítás (vagy a belépés) még úton volt a szerver felé; a szerver ezt az első figyelést elutasította,
az app pedig ezt úgy értette, hogy kikerültél a kocsmából, és törölte a saját tagságodat. Most az app előbb megvárja,
hogy a saját írásai a szerverre érjenek, és a szerveren ellenőrzi, valóban kikerültél-e; ha tag vagy, egyszerűen újra
figyel. **A hiba miatt már elveszett kocsmák:** ha te alapítottad, az app indításkor magától visszalép bele (a neve, a
kódja és a chatje megvan). Ha valaki más kocsmájába léptél be, és onnan esett ki, lépj be újra a kóddal vagy a linkkel.

1. **Firebase → Firestore → Rules:** másold be az új `firestore.rules`-t, **az `ownerUid()` részbe írd vissza a saját
   UID-odat** (a mintában `IDE_JON_A_SAJAT_UID` áll), és **Publish**. Új benne: az alapító akkor is olvashatja a kocsmáját,
   ha kiesett belőle (ehhez kell a visszalépés), a nullázáshoz a `meta` gyűjtemény, a bulik résztvevőinek és
   szavazatainak csoportos lekérdezése (csak a tulajdonosnak), és hogy a tulajdonos törölhesse a havi hányásszámot.
2. **GitHub:** **Add file → Upload files**: `index.html`, `app.js`, `backend.js`, `sw.js`, `README.md`, `FEJLESZTES.md`
   (és a `firestore.rules`, ha beleírtad a UID-odat), majd **Commit changes**. A `config.js`-t ne töltsd fel.
3. Nyisd meg az appot (ha kell, zárd be teljesen és nyisd meg újra, hogy az új változat töltődjön be).

**Minden fogyasztás nullázása:** Profil → Beállítások → **Tulajdonos** → jelszó → **Feloldás** → lent, az
**Újrakezdés** résznél **Minden fogyasztás nullázása** → írd be: `NULLÁZÁS` → **Nullázom**. Mindenkinél törlődik minden
felírt ital (a napi naplóból, a statisztikából, a bulik összesítéséből), minden hányás-szavazat és a kocsmákban a havi
hányásszám, így minden ranglista nulláról indul. Megmarad: a fiókok, a barátok, a kocsmák és a chat, a bulik (a nevük, és
hogy kinek melyik napja tartozik hozzájuk), a saját italnevek és az ivós játékok. A művelet bekerül a naplóba, és ha
félbeszakad (pl. elment a net), nyugodtan újra lehet indítani. A többi telefon a következő megnyitáskor (vagy ha éppen
nyitva van, azonnal) a nullázott adatokat mutatja. Ha valakinek a telefonja a nullázás előtt netkapcsolat nélkül
írt fel italt, az a net visszatérésekor még felkerülhet; ilyenkor elég a nullázást újra lefuttatni.

## Frissítés: hányás a havi ranglistában (v10)

A kocsma havi ranglistájába most a buliban megszavazott hányás is beleszámít (−20 pont hányásonként).
Ha a v9-et (barátok és kocsmák) még nem töltötted fel, az alatta lévő v9-es lépéssort kövesd: a v10 azt is tartalmazza.

1. **Firebase → Firestore → Rules:** másold be az új `firestore.rules` teljes tartalmát, **az `ownerUid()` részbe írd
   vissza a saját UID-odat** (a mintában `IDE_JON_A_SAJAT_UID` áll), és **Publish**. Új: a kocsmatag a saját tagsági
   dokumentumába beírhatja a havi hányásszámát. (Ha ez kimarad, az app nem hibázik, csak a hányás nem jut el a többiekhez.)
2. **GitHub:** **Add file → Upload files**: `index.html`, `app.js`, `backend.js`, `sw.js`, `README.md`, `FEJLESZTES.md`
   (és a `firestore.rules`, ha beleírtad a UID-odat), majd **Commit changes**. A `config.js`-t ne töltsd fel.
3. Mivel bővült az adatkezelési tájékoztató (a kocsma tagjai látják a havi megszavazott hányásszámodat), mindenki egyszer
   újra látja a hozzájárulási képernyőt.

## Frissítés a barátokra és kocsmákra (v9)

Ezt a sorrendet tartsd be, mert az új app az új szabályok nélkül nem tud kocsmát alapítani és barátot jelölni.
Ha a v7-et vagy a v8-at még nem töltötted fel, nem baj: ez a lépéssor azokat is tartalmazza (a v7 átállása magától lefut).

1. **Firebase → Firestore → Rules:** másold be az új `firestore.rules` teljes tartalmát, majd **a fájl elején az
   `ownerUid()` részbe írd vissza a saját UID-odat** (a mintában `IDE_JON_A_SAJAT_UID` áll), és **Publish**.
   Az új szabályok a régebbi appot is kiszolgálják, így ez a lépés semmit nem ront el. Új index nem kell.
2. **Nézd meg a saját `config.js`-edet:** a `MASNAPLO_PRIVACY` részben a `controller` (a neved) és a `contact`
   legyen kitöltve (ez kerül a Felhasználási feltételekbe és a tájékoztatóba). Ha nincs, töltsd ki, és csak ebben az
   esetben töltsd fel a `config.js`-t is.
3. **GitHub:** **Add file → Upload files**, és húzd be ezeket: `index.html`, `app.js`, `backend.js`, `sw.js`,
   `firestore.rules` (a UID-oddal, vagy hagyd ki), `README.md`, `FEJLESZTES.md`, valamint az **`icons/kocsma`** mappát
   (a 10 kocsma-profilkép; ha már fent van, nem kell újra). Majd **Commit changes**.
4. Nyisd meg az appot. Mivel bővült az adatkezelési tájékoztató (barátok, kocsmák, chat), mindenki egyszer újra látja a
   hozzájárulási képernyőt, és újra elfogadja a feltételeket.

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

A te UID-od (`3hTaBCw1TYdBJt4mfVm3w0mEm7y1`) már benne van a `firestore.rules` `ownerUid()` részében és a `config.js`
`MASNAPLO_OWNER_UID` sorában. Ha egyszer más lenne a tulajdonos:
1. Az appban: **Profil → Fiók és e-mail → Fiókazonosító (UID) → Másolás.**
   (Ugyanezt a Firebase konzolban is megtalálod: Authentication → Users → User UID oszlop.)
2. **`firestore.rules`:** a fájl elején az `ownerUid()` részben írd át a UID-ot (az aposztrófok maradjanak), másold be a
   Firebase konzolba, és **Publish**.
3. **`config.js`:** a `MASNAPLO_OWNER_UID` értékét is írd át ugyanerre, és töltsd fel GitHubra.
4. Nyisd meg újra az appot: a Profil fül Beállítások részében megjelenik a **Tulajdonos** pont. Másoknál nem jelenik meg,
   és ha valaki a kódot átírva megjelenítené, a szerver akkor is elutasítja.

**Hogyan véd:**
- A jogot a szerver adja a szabályokban lévő UID alapján, nem az app.
- Tulajdonosi műveletet a szerver csak akkor enged, ha az elmúlt 15 percben újra beírtad a jelszavadat.
  Ha valaki a feloldott telefonodhoz hozzáfér, jelszó nélkül akkor sem tud semmit csinálni.
- Minden tulajdonosi művelet bekerül egy naplóba, amit az appból sem módosítani, sem törölni nem lehet.
- A tulajdonost nem lehet letiltani, és a saját fiókodat a menüből nem lehet kiüríteni.

**Kocsmák kezelése (Tulajdonos menü → Kocsmák kezelése):** az összes kocsma listája; egy kocsmára koppintva látod a
tagjait és az utolsó 100 üzenetét, és törölhetsz üzenetet, eltávolíthatsz tagot (ilyenkor új meghívókód készül, és ha
az alapítót veszed ki, a legrégebbi tag kapja meg a kocsmát), vagy törölheted az egész kocsmát. Ha egy olyan kocsma
chatjében vagy, amelynek nem te vagy az alapítója, feloldott tulajdonosi módban ott is törölhetsz bármelyik üzenetet.
Minden ilyen művelet bekerül a naplóba. Egy felhasználó „összes adatának törlése” a barátságait, barátkéréseit és
chat-üzeneteit is törli, és kiveszi a kocsmáiból.

**Ha a `config.js`-ben nincs kitöltve a neved vagy az elérhetőséged** (`MASNAPLO_PRIVACY`), a Tulajdonos sor és a
Tulajdonos menü pirossal jelzi, mert enélkül a Felhasználási feltételek és az Adatkezelési tájékoztató nem nevezi meg
az üzemeltetőt.

**Mit tud a Tulajdonos menü:** felhasználók átnevezése, letiltása és feloldása, egy felhasználó összes adatának
törlése, egy ember számlálóinak nullázása és a róla szóló hányás-szavazatok törlése a megnyitott bulin, egy egész buli
törlése, **minden fogyasztás nullázása mindenkinél** (lásd a v11-es frissítésnél), megosztott ivós játék törlése (a
játék lapján), és a napló megtekintése. Egy ember számlálóját darabonként is javíthatod: a buliban koppints a nevére, majd a
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
- A napi napló részleteit (melyik nap pontosan mit ivott, melyik napja melyik bulihoz tartozik), a saját ivós
  játékokat és a barátlistát csak a felhasználó látja (és a tulajdonos, friss jelszóval). A statisztikát (kategóriánként,
  napi bontásban is) és a bulikon felírt italokat a többiek is látják.
- A saját ivós játékokat csak a készítőjük látja, kivéve a megosztottakat: azokat minden felhasználó látja a készítő
  felhasználónevével.
- Egy barátkérést a küldője és a címzettje lát. Egy kocsma nevét, profilképét és tagjait az látja, akinek megvan a
  meghívókódja; a chatet, a kocsmás bulit és a meghívókódot csak a kocsma tagjai. A havi ranglista a tagok nyilvános
  statisztikájából számol; a megszavazott hányások havi számát mindenki telefonja a saját bulijai szavazataiból számolja ki,
  és beírja a kocsmái tagsági adatába (ezt csak a kocsma tagjai látják).
- **Fiókom törlése** (Profil): a jelszó megadása után törli a fiókot, a felhasználónevet, a statisztikát, a napi naplót,
  a saját ivós játékokat, a barátságokat és barátkéréseket, minden chat-üzenetet (azokban a kocsmákban is, amelyekből
  korábban kilépett), valamint a buli-összesítéseket és a szavazatokat minden olyan buliból, amelyet a felhasználó
  ezzel a fiókkal bármelyik eszközén megnyitott, vagy amelyhez napot rendelt. A kocsmáiból kilép: ahol alapító, ott a
  legrégebbi tag kapja meg a kocsmát; ahol ő az utolsó tag, a kocsma minden adatával törlődik. Ha valakinek egy régebbi buliban mégis
  maradna adata (például egy azóta nem használt telefonról), azt a Firebase konzolban kézzel lehet törölni:
  Firestore → `parties` → a buli kódja → `players`, illetve `votes` → az illető azonosítója.

## Használat

- **Alsó sáv:** Ivós játékok · Naptár · **Kocsma** (középen) · Térkép · Profil (a saját monogramod). Egy kis narancs
  pötty jelzi az új barátkérést (Profil), illetve a kocsma-meghívót vagy az olvasatlan chat-üzenetet (Kocsma).
- **Kocsma:** állandó baráti társaság. A Kocsma fülön **Kocsma alapítása** (név és a 10 profilkép egyike) vagy
  **Belépés kocsmába** (meghívókóddal vagy a meghívó linkkel; belépés előtt látod a nevét, a képét és a tagjait).
  Egyszerre több kocsmának is tagja lehetsz: a fejlécre koppintva válthatsz közöttük, vagy alapíthatsz újat.
  - **Chat:** szöveges, csak a tagok látják (legfeljebb 500 karakter). A saját üzenetedet rákoppintva törölheted, az alapító
    bármelyiket. Az olvasatlan üzenetek száma a Chat gombon látszik.
  - **Buli:** kocsmás bulit indít a kocsma nevével; a mai napod ebbe kerül, a tagok pedig a Kocsma fülön egy
    „Csatlakozom” gombbal léphetnek be (senki napja nem kerül be magától).
  - **Meghívás:** a meghívó link vagy a kód küldése, vagy egy barátod meghívása egy koppintással (ő a Kocsma fülön
    látja a meghívót, és előnézet után dönt).
  - **Kezelés:** a meghívókód és a tagok listája, kilépés. Az alapító átnevezheti a kocsmát, profilképet cserélhet,
    tagot távolíthat el (ilyenkor új meghívókód készül, hogy a régivel ne lehessen visszalépni), új meghívókódot kérhet,
    és törölheti a kocsmát. Ha az alapító kilép, a legrégebbi tag kapja meg; ha az utolsó tag lép ki, a kocsma törlődik.
  - **Havi ranglista:** a tagok pontjai a hónap minden napjából (bulival vagy anélkül), ugyanazzal a pontozással, mint a
    buliban, a hányással együtt: minden hányás, amit egy buliban a többiek megszavaztak, −20 pont abban a hónapban,
    amelyikben a buli első napja volt (a sorban 🤮 jelzi). Korábbi hónapok is visszanézhetők. Egy tagra koppintva a
    profilja látszik.
- **Barátok (Profil fül):** **Barát hozzáadása** felhasználónév alapján; a kérést a másik elfogadhatja vagy elutasíthatja,
  te visszavonhatod. Egy barátra koppintva a statisztikája látszik, és meghívhatod a kocsmádba.
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
- **Profil fül:** saját statisztika (idén és összesen), napi grafikon, **Napjaim**, **Barátaim** és a beállítások.
  A Napjaim listában bármelyik nap megnyitható: utólag javíthatod (+/−, ez a statisztikát és a buli összesítését is
  frissíti), és buliba rendelheted (meglévő bulidhoz, új bulihoz névvel, vagy kóddal), illetve kiveheted belőle.
  A „Másik nap” gombbal egy korábbi, még üres napot is felírhatsz.
- **Ivós játékok fül:** két fül. **Az app játékai:** 14 beépített játék (mindenki látja; koppintásra a teljes leírás).
  **Felhasználók játékai:** a saját játékaid (név, létszám, eszközök, rövid leírás; megosztva mindenki látja, különben csak
  te), és mások megosztott játékai a készítő nevével. Keresés név alapján a megnyitott fülön (az app játékainál az
  eredeti névre is).
- **Profil → Jelvényeim:** a jelvények helye (fejlesztés alatt); megnyitáskor a háttér elhomályosodik.
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
