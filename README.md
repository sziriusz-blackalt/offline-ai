# Nexa AI – Offline Stúdió

Egyetlen statikus webalkalmazás, ami **telefonon (Android/iOS) és számítógépen (Windows/macOS/Linux) is fut**, és a modellek letöltése után **internetkapcsolat nélkül** használható. Nincs szerver, nincs API-kulcs, nincs adatgyűjtés: minden számítás a készüléken történik.

## Élő cím

**https://sziriusz-blackalt.github.io/offline-ai/**

A repó **nyilvános**, a GitHub Pages tartósan kiszolgálja – a laptopnak nem kell bekapcsolva lennie. Androidra van egy aláírt APK is: `offline-ai.apk` (a projekt gyökerében, illetve az `offline-ai-apk-github/` mappában). Ugyanazzal a kulccsal van aláírva, mint a korábbi verzió, így simán frissíti azt.

A teljes változattörténet: [CHANGELOG.md](CHANGELOG.md). Ugyanez az appban is olvasható: **Beállítások → Release napló**.

## Mit tartalmaz

| Funkció | Modell | Megjegyzés |
|---|---|---|
| 💬 Csevegés (magyar is) | SmolLM2 135M / **SmolLM2 360M** / Qwen3 0.6B / **Nexa HU** | Streamelt válasz, több stílus; telefonon a 360M az alap, a Nexa HU saját finomhangolt modell |
| ⌘ Kód asszisztens | Qwen2.5-Coder 0.5B | Írás, magyarázat, hibakeresés |
| 🎙️ Beszéd → szöveg | Whisper Tiny | Magyar, angol, német stb. |
| 🔊 Szöveg → beszéd | Supertonic TTS | Angol hangok, WAV letöltés |
| 🖼️ Kép leírása / OCR | ViT-GPT2 | Helyben futó képfelismerés |
| ✂️ Háttér eltávolítása | MODNet | Átlátszó PNG export |
| ❓ Kérdés a képről | LFM2.5-VL 450M | Haladó, angol kérdésekkel |

A technológia a [Transformers.js](https://huggingface.co/docs/transformers.js) v4 és az ONNX Runtime Web. A teljes futtatókörnyezet a `vendor/` mappában van, ezért a böngészőnek nem kell semmit letöltenie a CDN-ről.

## Indítás

> ⚠️ A `file://` közvetlen megnyitás **nem működik** (ES modulok + Service Worker miatt). Egy egyszerű statikus szerver kell hozzá.

### Windows
Kattints duplán a **`START.bat`** fájlra, majd nyisd meg a böngészőben:
<http://localhost:8080/>

### macOS / Linux
A mappa belsejében:

```bash
python3 -m http.server 8080
```

vagy bármely más statikus szerver. Utána: <http://localhost:8080/>

## Telepítés telefonra / gépre

1. Töltsd fel a **teljes `offline-ai` mappát** egy HTTPS statikus tárhelyre (pl. GitHub Pages, Netlify, Cloudflare Pages, saját szerver).
2. Nyisd meg az URL-t a telefonon/gépen.
3. A böngésző menüjében válaszd a **Telepítés** / **Hozzáadás a kezdőképernyőhöz** lehetőséget (vagy az alkalmazás tetején lévő *Telepítés* gombot).
4. A **Modellek** fülön töltsd le a használni kívánt modelleket – ezt még **online** kell megtenni.
5. Kapcsold ki az internetet, és használd tovább. A modellfájlok a böngésző Cache Storagejában maradnak.

A *Szigorú offline mód* kapcsolóval kikapcsolható minden hálózati modellkérés: ilyenkor a betöltés kizárólag a gyorsítótárból történik.

## Saját modell (Nexa HU)

A v1.4.9-tól az app képes egy **saját, magyar adatokkal betanított modellt** is használni. A csevegőmező melletti gomb a jelenlegi modell nevét mutatja, és rákattintva közvetlenül választható a Szikra, Nova Lite, Nova, Nexa HU, Magyarusz és Forge. A teljes, Colabban futtatható tanítórendszer a [`nexa-model/`](https://github.com/sziriusz-blackalt/offline-ai/tree/main/nexa-model) mappában van.

A választott út a **nulláról tanított modell**: `nexa_scratch.ipynb`. Saját BPE tokenizáló, véletlen súlyokból indított transzformer, két szakaszú magyar tanítás (Wikipédia + saját minták + Aya + OPUS), majd ONNX/q4 export. Egy kb. 34M-paraméteres modell **nem éri el** a Qwen3-0.6B finomhangolásának minőségét, de a súlyok és a tokenizáló teljesen sajátok. Ha a lehető legjobb magyar tudás a cél, a `nexa_train.ipynb` erősebb alternatíva — mindkettő ugyanabba a Hugging Face repóba tud feltölteni.

Használat: a csevegő **Modell** gombjából válaszd a **🧠 Nexa HU**-t. A repo mező üresen is jó: az app az alapértelmezett `sziriusz-blackalt/nexa-hu` repót használja. A **Beállítások → Modellek → Nexa HU** kártyán nyomj a *Letöltés* gombra; a mezőt csak akkor kell kitölteni, ha saját repo-d van. Az „Összes letöltése” nem próbálja automatikusan letölteni a még nem létező saját modellt.

## Magyarusz — külön tanuló magyar AI

A v1.5.3 óta a mellékelt önálló `magyarusz.html` is teljes értékű, külön letölthető modell. A csevegő **Modell** menüjéből a **🇭🇺 Magyarusz** kiválasztható, a **Beállítások → Modellek → Magyarusz → Letöltés** gombbal pedig le kell tölteni a csomagot — pont úgy, mint a Nova vagy a Forge esetében. Letöltés után hálózat nélkül is dolgozik: beszélget, kódot generál, számol, fordít, és tanítható a „Tanulj: kérdés => válasz” paranccsal. A tanult tudás a böngésző helyi tárolójában marad.

A **🔨 Forge** szintén kiválasztható a Modell menüben; nem kell hozzá kódmódot kapcsolni. Telefonon, hálózat nélkül ha a kiválasztott Nova/Forge túl lassú, az app automatikusan egy már letöltött gyors modellre (Magyarusz / Szikra / Nova Lite) vált, és ezt értesítéssel jelzi.

## Tárhelyigény

Az alkalmazás maga ~83 MB (főleg az ONNX Runtime WASM fájljai). A modellek külön letölthetők:

- SmolLM2 135M Instruct (Szikra): ~117 MB
- **SmolLM2 360M Instruct (Nova Lite): ~272 MB (q4f16) — telefonra ajánlott**
- Qwen3 0.6B (Nova): ~570 MB (q4f16; ez a legjobb magyar, de nagyobb)
- **Nexa HU: ~20–50 MB** (opcionális, nulláról magyar adatokkal betanított modell; a Qwen3-alapú erősebb változat ~420 MB)
- Qwen2.5-Coder 0.5B (Forge): ~555 MB (q4f16)
- **Magyarusz: ~160 KB** (külön letölthető tanuló magyar AI-csomag)
- Whisper Tiny: ~45 MB
- Supertonic TTS: ~260 MB
- Képleíró: ~190 MB
- MODNet: ~25 MB
- LFM2.5-VL 450M: ~350 MB

Telefonon érdemes először csak a **Nova Lite**, **Whisper Tiny** és **MODNet** modelleket letölteni (~340 MB összesen). A Nova és a Forge nagy modellek egyenként is letölthetők, de az „Összes letöltése” telefonon átugorja őket.

A v1.5.0 óta **ha van internet, bármelyik modell azonnal használható**: nem kell előre letölteni, az első üzenetnél az app igény szerint betölti a súlyokat, és a haladást a válaszbuborékban mutatja. **Szigorú offline módban vagy hálózat nélkül** nem indul letöltés: az app egy már gyorsítótárazott modellre esik vissza, vagy egyértelmű hibát ad. A letöltések ezután a böngésző gyorsítótárában maradnak, így később offline is működnek. A v1.5.4 óta a letöltés **csak a fájlokat** teszi a gyorsítótárba, nem tölti be a modellt a memóriába — ezért az 555 MB-os Forge és az 570 MB-os Nova telefonon sem zárja be a lapot.

A v1.5.5 óta a generált kód egyetlen dobozban jelenik meg: a **Másolás** a teljes kódot teszi a vágólapra (tartalék megoldással is), a **Mentés** fájlba írja, a JavaScript/HTML kódnál pedig a **▶ Futtatás** a kód alatt, helyben, sandboxolt iframe-ben mutatja az eredményt — a kód közben látható marad. Ugyanígy jelenik meg a Magyarusz és a Forge kódja is.

A v1.4.9-ban **nincs időzítő**: a modell addig ír, amíg a beállított hosszúságú válasz el nem készül (alapértelmezés: 128 token). A gyorsaságot a kisebb q4f16 modell, a rövid rendszerüzenet és az újrahasznált, betöltve tartott modell adja — **nem a válasz lecsonkítása**. Ha mégis gyorsabb eredményt szeretnél, a csevegőmező modellgombjából válassz **⚡ Szikrát**.

## Korlátok

- A kis modellek néha hibáznak; a magyar beszédfelismerés és szöveggenerálás pontossága változó.
- A TTS jelenleg csak **angol** nyelvű hangokat tartalmaz (magyar TTS ONNX modell nem érhető el nyilvánosan).
- A valódi **szöveg → kép generálás** nem része a csomagnak: a jelenlegi kis ONNX modellekhez több GB modell kellene, ami nem telefonbarát. Helyette képleírás, OCR, háttér eltávolítás és képi kérdés-válasz érhető el.
- WebGPU gyorsítás csak támogatott böngészőkben érhető el; egyébként az alkalmazás automatikusan CPU/WASM módra vált.
- Az iOS Safari PWA-korlátozásai miatt a WebGPU részleges lehet; a WASM útvonal mindenhol működik.

## Hibaelhárítás

- **„Letöltés szükséges”** a Modellek fülön → kapcsold ki a szigorú offline módot, és töltsd le újra a modellt online állapotban.
- **A modell nem töltődik be offline** → ellenőrizd, hogy a böngésző nem törölte-e a gyorsítótárat (privát módban az offline tárolás nem megbízható).
- **WebGPU hiba** → Beállítások → Eszköz: `CPU / WASM`.
- **Frissítés után régi verzió látszik** → a service worker verziószáma a `sw.js`-ben és `app.js`-ben (`SHELL_CACHE`) van; mindkettőt egyszerre kell emelni.

## Források és licenc

- Transformers.js — Apache-2.0
- ONNX Runtime — MIT
- A modellek a Hugging Face Hubról származnak; licencüket az egyes modelllapokon találod.

---

Készült azzal a céllal, hogy a AI ne legyen felhőfüggő, és a telefonod is tudjon saját magától gondolkodni. 🌱
