# Offline AI Stúdió

Egyetlen statikus webalkalmazás, ami **telefonon (Android/iOS) és számítógépen (Windows/macOS/Linux) is fut**, és a modellek letöltése után **internetkapcsolat nélkül** használható. Nincs szerver, nincs API-kulcs, nincs adatgyűjtés: minden számítás a készüléken történik.

## Élő cím

**https://sziriusz-blackalt.github.io/offline-ai/**

A repó **nyilvános**, a GitHub Pages tartósan kiszolgálja – a laptopnak nem kell bekapcsolva lennie. Androidra van egy aláírt APK is: `offline-ai.apk` (a projekt gyökerében, illetve az `offline-ai-apk-github/` mappában). Ugyanazzal a kulccsal van aláírva, mint a korábbi verzió, így simán frissíti azt.

## Mit tartalmaz

| Funkció | Modell | Megjegyzés |
|---|---|---|
| 💬 Csevegés (magyar is) | SmolLM2 135M / Qwen3 0.6B | Streamelt válasz, több stílus |
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

## Tárhelyigény

Az alkalmazás maga ~83 MB (főleg az ONNX Runtime WASM fájljai). A modellek külön letölthetők:

- SmolLM2 135M Instruct: ~170 MB
- Qwen3 0.6B: ~880 MB (q4; a kisebb q4f16 változat gazdagabb eszközökön választható a Beállításokban)
- Qwen2.5-Coder 0.5B: ~820 MB (q4)
- Whisper Tiny: ~45 MB
- Supertonic TTS: ~260 MB
- Képleíró: ~190 MB
- MODNet: ~25 MB
- LFM2.5-VL 450M: ~350 MB

Telefonon érdemes először csak a **SmolLM2**, **Whisper Tiny** és **MODNet** modelleket letölteni (~250 MB összesen).

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
