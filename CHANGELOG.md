# Release napló — Nexa AI

Minden kiadás rövid összefoglalója. Ugyanez a napló az alkalmazáson belül is elérhető: **Beállítások → Release napló**.

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
