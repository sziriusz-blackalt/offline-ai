# Nexa HU — saját adatokkal tanított modell

Ez a könyvtár a **saját Nexa modell** elkészítéséhez tartozik. A nyílt
`Qwen/Qwen3-0.6B` bázist **két szakaszban** tanítjuk magyar adatokon, majd
telefonra alkalmas ONNX fájlt készítünk belőle. A kész modell a saját Hugging
Face repónkra kerül, és a Nexa AI appban internet nélkül fut.

## Mit jelent pontosan a „saját modell”?

| Állítás | Igaz? |
| --- | --- |
| A súlyokat magyar korpuszon és saját utasításokon mi tanítjuk be | ✅ igen |
| A modell `Nexa AI`-ként azonosítja magát | ✅ igen |
| A modell a saját Hugging Face repónkon van | ✅ igen |
| Telefonon, offline fut, nem küld adatot | ✅ igen |
| Nulláról, saját architektúrával betanított LLM | ❌ nem — ehhez több ezer GPU-óra kellene |
| Egyetlen modell végzi a képet, hangot és szöveget is | ❌ nem — ezt az app irányítja külön modellekhez |

A bázismodell licence **Apache 2.0**, így a finomhangolt változat szabadon
terjeszthető. A cél a **lehető legtöbbet tudó, telefonbarát magyar modell**;
egy nulláról indított, nagyon kis modell ezen az eszközön jóval gyengébb
válaszokat adna.

## A tanítás két szakasza

1. **Folyamatos magyar előképzés** — a `wikimedia/wikipedia` `20231101.hu`
   részhalmazából vett szövegblokkok (alapértelmezés: 4000 blokk × 768 token,
   kb. 3 millió token). Ez adja a magyar nyelvtant, szókincset és tényanyagot.
2. **Utasítás-követő finomhangolás** — a notebook saját mintái, a
   `CohereLabs/aya_dataset` magyar (`hun`) párjai és a `Helsinki-NLP/opus-100`
   angol–magyar fordítási párok. Ez tanítja meg a rövid, de **teljes** magyar
   válaszra; a rendszerüzenet megegyezik az appban használt utasítással.

A LoRA-rétegeket ezután összeolvasztjuk a bázissal, ONNX-be exportáljuk,
`MatMulNBits` 4 bites kvantálással tömörítjük, és ellenőrizzük, hogy a kimenet
nem üres és nem NaN. A notebook minden nyilvános forrást `try/except` blokkban
kezel: ha egy korpusz épp nem érhető el, a tanítás a többivel folytatódik.

## Fájlok

- `nexa_train.ipynb` — teljes Colab notebook: adatok → magyar előképzés →
  utasítás-finomhangolás → összeolvasztás → ONNX → q4 → ellenőrzés → feltöltés.
- `README.md` — ez az útmutató.

## 1. Hugging Face token

1. Készíts Hugging Face fiókot, majd egy **write** jogosultságú tokent:
   <https://huggingface.co/settings/tokens>
2. Colabban a bal oldali **Secrets** panelen vegyél fel egy titkot `HF_TOKEN`
   néven, ennek értéke a token. Ha ezt nem teszed meg, a notebook kérni fogja.

A cél repo alapértelmezés szerint: `sziriusz-blackalt/nexa-hu`.
Ha más repót szeretnél, az **1. Beállítások** cellában módosítsd az
`OUTPUT_REPO` változót. A repót a notebook létrehozza, nem kell előre felvenni.

## 2. Futtatás Colabban

1. Nyisd meg a <https://colab.research.google.com> oldalt.
2. `Fájl → Notebook feltöltése` → válaszd ki a `nexa_train.ipynb` fájlt.
3. `Futtatás → Futtatókörnyezet módosítása → T4 GPU → Csatlakozás`.
4. Futtasd a cellákat sorrendben. A bővített tanítás kb. **60–90 perc**.

A notebook a végén ellenőrzi, hogy a modell ad-e nem üres, véges kimenetet,
és hogy van-e KV-cache (ez kell a gyors folyamatos generáláshoz).

Az eredmény egy kb. **350–450 MB**-s `onnx/model_q4.onnx` fájl, a tokenizer és
konfigurációs fájlokkal a repo gyökerében.

## 3. Használata a Nexa AI appban

1. Győződj meg róla, hogy a Hugging Face repo **nyilvános**.
2. Nexa AI → **Beállítások → Modellek → Saját Nexa modell** → írd be:
   `sziriusz-blackalt/nexa-hu` (vagy a saját repod).
3. Megjelenik a **🧠 Nexa HU** kártya → nyomj a **Letöltés** gombra.
4. A csevegőmező **Modell** gombjából válaszd a **🧠 Nexa HU**-t.

A mező üresen hagyása esetén az app pontosan úgy működik, mint korábban —
a beépített Nova/Szikra modellek elérhetők maradnak, és az „Összes letöltése”
sem próbálja letölteni a saját modellt. A v1.4.6-ban **nincs válaszidőzítő**:
a modell addig ír, amíg a beállított hosszúságú válasz el nem készül.

## Hibaelhárítás

- **`AssertError: nincs GPU`** — a Colab nem T4 GPU módban fut. Válts GPU-re,
  majd futtasd újra a cellát.
- **A `pip` ütközést jelez** — indítsd újra a futtatókörnyezetet, és az 0. cellát
  futtasd újra.
- **A feltöltés 401-et ad** — a `HF_TOKEN` hiányzik vagy csak `read` jogosultsága
  van. Készíts új tokent write joggal.
- **Az app nem találja a modellt** — ellenőrizd a repo pontos nevét, és hogy
  az `onnx/model_q4.onnx` fent van-e a `main` ágon.
- **Lassú első válasz** — az első letöltés után a modell a böngésző
  gyorsítótárába kerül; a következő indítások offline gyorsak.
- **A Wikipédia letöltése nem sikerül** — a notebook kiírja, hogy kihagyta,
  és a meglévő utasítási adatokkal folytatja. Ilyenkor a magyar tudás kisebb
  lesz, de a modell használható marad.

## Adatvédelem

A tanítás a Colabon történik, a kész modell a nyilvános Hugging Face repón.
A modell maga nem gyűjt adatot: az appban fut, és egyetlen csevegést sem küld
szerverre.
