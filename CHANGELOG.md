# Release napló — Nexa AI

Minden kiadás rövid összefoglalója. Ugyanez a napló az alkalmazáson belül is elérhető: **Beállítások → Release napló**.

## v1.5.7 — 2026-11-27

- A kódblokkok gombjai most **Futtatás – Mentés – Másolás** sorrendben vannak (a Magyarusz saját oldalán is).
- A futtatott program nem a kód alján, hanem **a képernyő közepén, egy külön alkalmazásablakban** jelenik meg (átlátszó háttér, bezárás / újraindítás / Esc). A kód a beszélgetésben marad.
- A Magyarusz beépített tudása magyar Wikipédia-cikkekből (Magyarország, Budapest, magyar nyelv, mesterséges intelligencia, számítógép) származó, párbeszédre használható tényekkel bővült.
- Új kódgenerálási sablon: „számológép szivárványos háttérrel” és hasonló, teljes, futtatható HTML alkalmazások.

## v1.5.6 — 2026-11-27

- **Képi modellek javítása:** a kiválasztott `File`/`Blob` közvetlenül kerül a `RawImage.read()`-be (a könyvtár támogatja), így nem kell `blob:` URL-t `fetch`-elni — ez volt a „Failed to fetch” egyik oka.
- **Szigorú offline mód:** a `env.allowRemoteModels` többé nem kapcsol ki. A súlyokat a Hugging Face URL-jére cache-eljük, és a könyvtár előbb a Cache API-ból olvas; a `/models/` helyi út váltása korábban üres keresést és hálózati hibát eredményezett.
- A képi modelleknél (👁️ Látó, ✂️ Olló, 🔮 Látnok) indulás előtt ellenőrizzük a gyorsítótárat: ha nincs letöltve és offline van, magyar útmutatás jelenik meg a Beállítások → Modellek felé. Nagy modell letöltésekor haladás látszik az eredménymezőben.
- A nyers „Failed to fetch” / hálózati hibák helyett érthető magyar hibaüzenet jelenik meg minden modellnél.
- A **Release napló** saját fülre került a bal oldalsávban (Settings mellett); a Beállításokból is át lehet rajta ugrani.

## v1.5.5 — 2026-11-27

- A kódgenerálás megjelenítése egységesült: minden modell (beleértve a **Magyarusz** és a **Forge**) kódja egyetlen, fejlécelt dobozban jelenik meg, még nem-kódmódban is — a ``` kereteket a megjelenítő automatikusan felismeri.
- A doboz **Másolás** gombja a teljes kódot másolja, vágólap-hiba esetén `execCommand` tartalékkal, „Másolva ✓” visszajelzéssel. **Mentés** gomb letölti a kódot a megfelelő kiterjesztéssel.
- A JavaScript és HTML kód **helyben futtatható** a kód alatt: az eredmény egy sandboxolt iframe-ben jelenik meg, miközben a kód maga látható marad a képernyőn. A futás újraindítható („↻ Újra”) és bezárható („✕”).
- Az önálló `ai/magyarusz.html` futatása is a kód alatti, beágyazott eredményre váltott — nem takarja el a kódot modal ablakkal.
- A futtató környezet saját (opaque) originnal és `localStorage` shimmel dolgozik, így a generált kód nem fér hozzá az alkalmazás adataihoz.

## v1.5.4 — 2026-11-27

- A **Forge** (555 MB) és a **Nova** (570 MB) letöltése nem hoz létre modellpéldányt a memóriában: a `downloadModel` mostantól közvetlenül a szükséges fájlokat teszi a `transformers-cache` gyorsítótárba, streaming haladással. Ez megszünteti a telefonos memóriahiányt, amely korábban bezárta a lapot / kilépett az oldalról.
- A letöltő gombok explicit `type="button"`-t kaptak, így semmilyen körülmények között nem indítanak űrlapbeküldést vagy navigációt.
- Hálózat hiányában a modellletöltés azonnal egyértelmű magyar hibát ad, nem próbálkozik csendben.
- A képi modell (Látnok) továbbra is a régi, processorral közös úton tölt, mert ott a fájlok külön csomagok.

## v1.5.3 — 2026-11-26

- **Új külön modell: 🇭🇺 Magyarusz.** A mellékelt, önálló tanuló magyar AI beépült az alkalmazásba: a chat **Modell** menüjéből választható, és a **Beállítások → Modellek → Magyarusz → Letöltés** gombbal kell letölteni — ugyanúgy, mint a többi modellt. Utána offline is működik, tanítható („Tanulj: kérdés => válasz”), kódot ír, számol, fordít.
- A **🔨 Forge** mostantól a csevegő Modell menüjében is kiválasztható, nem csak automatikus kódmódban.
- A csevegés felső és alsó sávja a képernyőhöz ragasztva marad; csak az üzenetlista görget.
- A beépített hátterek valódi képek: a **Forest** most tényleg egy három rétegű, ködös fenyőerdő, a Aurora/Dusk/Graphite is egyedi rajzolt kép.
- Telefonon, hálózat nélkül a lassú Nova/Forge helyett automatikusan egy már letöltött gyors modell (Magyarusz/Szikra/Nova Lite) válaszol, látható értesítéssel.
- A gyorsítótár verziója `v1.5.3` lett.

## v1.5.2 — 2026-11-26

- A Beállításokból mostantól **„← Csevegés”** gombbal rögtön visszatérhetsz a megnyitott beszélgetéshez, nem kell újat létrehozni.
- Az oldalsávban egy meglévő csevegésre kattintva az app **ténylegesen a chat nézetbe vált**, még ha Settings/Images/Voice oldalon voltál is.
- A gyorsítótár verziója `v1.5.2` lett.

## v1.5.1 — 2026-11-26

- A Hugging Face **401 / unauthorized** hibája helyett érthető magyar üzenet jelenik meg: a Nexa HU repo még nem érhető el, előbb Hugging Face fiók + `HF_TOKEN` + a Colab notebook kell.
- A Beállításokban közvetlen Colab-link és magyarázat olvasható az előfeltételről.
- Megjegyzés: a `sziriusz-blackalt` Hugging Face fiók jelenleg **nem létezik** (404), ezért a repo sem tud létrejönni. Ezért jött a 401 — nem alkalmazáshiba.

## v1.5.0 — 2026-11-26

- **Ha van internet, bármelyik modell használható**: nem kell előre a Modellek kártyán letölteni — a kiválasztott modell az első üzenetnél igény szerint betölti a súlyokat.
- A letöltés haladása a válaszbuborékban látszik (`⏬ Modell letöltése… X%`).
- **Szigorú offline mód** és hálózat hiányában változatlan a viselkedés: nem indul letöltés, az app egy már gyorsítótárazott modellre esik vissza, vagy egyértelmű hibát ad.
- A saját Nexa HU és a képi/hangmodellek is igény szerint töltenek, amikor elérhető a hálózat.

## v1.4.9 — 2026-11-26

- A saját **🧠 Nexa HU** modell repo beállítása **nélkül** is választható a csevegő Modell menüjéből; alapértelmezett repo: `sziriusz-blackalt/nexa-hu`.
- A repo mező mostantól csak opcionális felülírás.
- Látható verziójelvény a profilmenüben és a **Settings** oldal tetején.
- Teljes release napló az appban és ez a `CHANGELOG.md` fájl.
- Az „Összes letöltése” nem próbálja automatikusan letölteni a még nem létező saját modellt.

## v1.4.8 — 2026-11-26

- A saját Nexa HU mindig megjelenik a csevegő **Modell** gomb menüjében.
- Ha még nincs letöltve, egyértelmű útmutató: **Beállítások → Modellek → Letöltés**.
- A gyorsítótár verziója `v1.4.8` lett.

## v1.4.7 — 2026-11-26

- Eltűnt a Szikra modell maradék 64 tokenes korlátja és az újrapróbálások 160/256 tokenes korlátja.
- A modell csak a felhasználó által beállított hosszúságig ír (alap 128, maximum 512 token).
- Csiszolt két szakaszú tanító notebook és az „teljes válasz” minták.

## v1.4.6 — 2026-11-26

- **Nincs válaszidőzítő**: eltávolítottuk a 30 másodperces telefonos határidőt és a hozzá tartozó megszakítást.
- A válaszok nem csonkulnak: a modell addig ír, amíg a beállított hosszúság el nem készül.
- Megjelent a két szakaszú magyar tanítási terv: folyamatos magyar előképzés, majd utasítás-követő tanítás.
- Frissült a `nexa-model/` dokumentáció.

## v1.4.5 — 2026-11-25

- 30 másodperces telefonos válaszkeret, q4f16 Nova Lite, rövid rendszerüzenet és kevesebb token a gyorsaságért.
- Ezt a korlátot a v1.4.6 **eltávolította**, mert üres/csonkolt válaszokat okozott.

## v1.4.4 — 2026-11-25

- A csevegő modellgombjának menüje modellneveket mutat, nem gyorsválasz-módokat.
- Új „Speciális beállítások” menü a `+` gomb alatt.

## v1.4.3 — 2026-11-25

- A betöltött modell a használat után 60 másodpercig a memóriában marad, majd felszabadul.
- A következő üzenet nem tölti be újra a modellt.

## v1.4.2 — 2026-11-25

- A tartalékmodellre váltás előtt a tényleges súlyfájl jelenlétét ellenőrzi.
- Küldéskor nem indul automatikusan hatalmas modellletöltés.

## v1.4.1 — 2026-11-25

- Gyorsabb telefonos út: q4f16 letöltések, **Nova Lite alapértelmezett** telefonra.
- Tárhely-ellenőrzés letöltés előtt, egyértelmű hiba, ha nincs elég hely.

## v1.4.0 — 2026-11-25

- Saját Nexa HU finomhangolási folyamat (`nexa-model/nexa_train.ipynb`).
- Konfigurálható egyedi Hugging Face repo a Beállításokban.
- Dokumentáció- és notebook-javítások (`f8edd126`, `c56b533e`).

## v1.3.3 — 2026-11-24

- A Qwen3 néha üres válaszainak javítása `enable_thinking: false` beállítással és automatikus újrapróbálással.

## v1.3.2 — 2026-11-24

- Egyértelműbb modell-útmutatás és további válaszminőségi javítások.

## v1.3.1 — 2026-11-24

- Jobb modellalapértelmezések, egyszerűbb rendszerüzenetek, újratervezett adatvédelmi oldal.

## v1.3.0 — 2026-11-24

- Skinnek, beépített és saját háttérképek, gyorsabb mobil csevegés, összeomlásjavítások.

## v1.2.2 — 2026-11-24

- Reszponzív elrendezés verziózott CSS/JS fájlokkal, hogy a gyorsítótár mindig frissüljön.

## v1.2.1 — 2026-11-24

- ChatGPT-szerű reszponzív elrendezés.

## v1.2.0 — 2026-11-24

- Csevegési munkamenetek, biztonságosabb generálás és valódi APK telepítés.

## v1.1.2 — 2026-11-24

- Barátságos modellnevek: Szikra, Nova, Forge, Suttogó, Szirén, Látó, Olló, Látnok.

## v1.1.1 — 2026-11-24

- A **Telepítés** gomb valódi, aláírt APK-t tölt le.

## v1.1.0 — 2026-11-24

- Az alkalmazás neve **Nexa AI** lett.

## v1.0.8 — 2026-11-24

- Letölthető APK-link hozzáadása.

## v1.0.7 — 2026-11-24

- Mobil CSS frissítése új shell-cache verzióval.

## v1.0.6 — 2026-11-24

- Nagyobb érintőfelületek, `safe-area` támogatás, nincs vízszintes túlcsordulás mobilon.

## v1.0.5 — 2026-11-24

- Az első teljes offline PWA: SEO meta, `robots.txt`, `sitemap.xml`, `.nojekyll` és állandó GitHub Pages URL.

---

A modelltanításról és a két notebookról lásd a [`nexa-model/README.md`](nexa-model/README.md) fájlt.
