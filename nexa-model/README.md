# Nexa HU — saját modell készítése

Ez a könyvtár a **saját Nexa modell** elkészítéséhez tartozik. Nem egy előre gyártott
modellt töltünk le, hanem a nyílt `Qwen/Qwen3-0.6B` bázist **saját magyar
utasításokkal finomhangoljuk**, majd telefonra alkalmas ONNX fájlt készítünk belőle.

## Mit jelent pontosan a „saját modell”?

| Állítás | Igaz? |
| --- | --- |
| A súlyokat magyar adatokkal mi tanítjuk | ✅ igen |
| A modell `Nexa AI`-ként azonosítja magát | ✅ igen |
| A modell a saját Hugging Face repónkon van | ✅ igen |
| Telefonon, offline fut, nem küld adatot | ✅ igen |
| Nulláról, saját architektúrával betanított LLM | ❌ nem — ehhez több ezer GPU-óra kellene |
| Egyetlen modell végzi a képet, hangot és szöveget is | ❌ nem — ezt az app *irányítja* külön modellekhez |

A bázismodell licence **Apache 2.0**, így a finomhangolt változat szabadon
terjeszthető. A „mindent egyszerre” élményt az app adja: a chatben ez a modell
a „nyelvi agy”, a hang- és képfeladatokat pedig az app automatikusan a megfelelő
külön modellre irányítja.

## Fájlok

- `nexa_train.ipynb` — teljes Colab notebook: adatok → LoRA → összeolvasztás →
  ONNX → 4 bites kvantálás → ellenőrzés → feltöltés.
- `README.md` — ez az útmutató.

A notebook **68 beágyazott magyar mintát** tartalmaz (ezeket erre a projektre
írtuk: üdvözlés, kilét, offline működés, fordítás, összefoglalás, kód, matek,
app-használat). Ezen felül, ha elérhető, hozzáad:
- `CohereLabs/aya_dataset` magyar (`hun`) részhalmazát (~98 emberi pár),
- `Helsinki-NLP/opus-100` angol–magyar mondatpárjaiból készített fordítási utasításokat.

## 1. Hugging Face token

1. Készíts egy Hugging Face fiókot, majd egy **write** jogosultságú tokennt:
   <https://huggingface.co/settings/tokens>
2. Colabban a bal oldali **Secrets** (kulcs ikon) panelen vegyél fel egy
   titkot `HF_TOKEN` néven, ennek értéke a token.
   (Ha ezt nem teszed meg, a notebook kérni fogja a tokennt.)

A cél repo alapértelmezés szerint: `sziriusz-blackalt/nexa-hu`.
Ha más repót akarsz, a notebook **1. Beállítások** cellájában módosítsd az
`OUTPUT_REPO` változót. A repo nem kell előre létrehozni, a notebook létrehozza.

## 2. Futtatás Colabban

1. Nyisd meg a <https://colab.research.google.com> oldalt.
2. `Fájl → Notebook feltöltése` → válaszd ki a `nexa_train.ipynb` fájlt.
3. `Futtatás → Futtatókörnyezet módosítása → T4 GPU → Csatlakozás`.
4. Futtasd a cellákat sorrendben (kb. 20–40 perc).

A notebook a végén ellenőrzi, hogy a modell ad-e nem üres, véges kimenetet,
és hogy van-e KV-cache (ez kell a gyors, folyamatos generáláshoz).

Az eredmény egy kb. **350–450 MB**-s `onnx/model_q4.onnx` fájl, a repo
gyökerében a tokenizer és config fájlokkal.

## 3. Használata a Nexa AI appban

1. Győződj meg róla, hogy a Hugging Face repo **nyilvános**.
2. Nexa AI → **Beállítások → Modellek → Saját Nexa modell** → írd be:
   `sziriusz-blackalt/nexa-hu` (vagy a saját repod).
3. Megjelenik a **🧠 Nexa HU** kártya → nyomj a **Letöltés** gombra.
4. A csevegés **Modell** legördülőjében válaszd a **🧠 Nexa HU**-t.

A mező üresen hagyása esetén az app pontosan úgy működik, mint korábban —
a beépített Nova/Szikra modellek elérhetők maradnak.

## Hibaelhárítás

- **`AssertError: nincs GPU`** — a Colab nem T4 GPU módban fut. Váltás GPU-re,
  majd újra a cellát.
- **A `pip` ütközést jelez** — futtasd újra az 0. cellát egy friss
  futtatókörnyezetben (`Futtatás → Futtatókörnyezet újraindítása`).
- **A feltöltés 401-et ad** — a `HF_TOKEN` hiányzik vagy csak `read` jogosultsága
  van. Új token, write joggal.
- **Az app nem találja a modellt** — ellenőrizd a repo pontos nevét, és hogy
  a `onnx/model_q4.onnx` fent van-e a `main` ágon.
- **Lassú első válasz** — az első letöltés után a modell a böngésző gyorsítótárába
  kerül; a következő indítások már offline gyorsak.

## Adatvédelem

A tanítás a Colabon történik, a kész modell pedig a nyilvános Hugging Face
repón. A modell maga nem gyűjt adatot: az appban fut, és egyetlen csevegést
sem küld szerverre.
