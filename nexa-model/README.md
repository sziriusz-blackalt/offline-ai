# Nexa HU — saját modell, most nulláról

Ez a könyvtár két Colab notebookot tartalmaz. A különbség fontos:

| Notebook | Mit csinál | Mikor jó |
| --- | --- | --- |
| [`nexa_scratch.ipynb`](https://github.com/sziriusz-blackalt/offline-ai/blob/main/nexa-model/nexa_scratch.ipynb) | **Saját BPE tokenizáló + véletlen súlyokból indított transzformer**, két szakaszú magyar tanítás | Ha a modell **teljesen saját** legyen |
| [`nexa_train.ipynb`](https://github.com/sziriusz-blackalt/offline-ai/blob/main/nexa-model/nexa_train.ipynb) | A nyílt `Qwen3-0.6B` (Apache 2.0) finomhangolása magyar adatokon | Ha a **lehető legjobb magyar tudás** a cél telefoton |

A választásod alapján az elsődleges út most a **`nexa_scratch.ipynb`**.

## Mit jelent a „nulláról”?

- A modell súlyai **véletlen értékekkel indulnak** — nincs `from_pretrained`.
- A tokenizálót is mi tanítjuk be magyar Wikipédia szövegekre (16000 tokenes BPE).
- Minden tanítási lépés a saját adatainkból történik: magyar Wikipédia, saját magyar minták, Aya magyar párjai és OPUS-100 fordítások.
- A kész modellt **saját Hugging Face repóra** töltjük, és a Nexa AI app offline használja.

Az architektúra GPT-2-szerű, mert ezt a formátumot a Transformers.js telefoton megbízhatóan be tudja olvasni. A *súlyok* és a *tokenizáló* így is teljesen sajátok; a „teljesen saját architektúra” önmagában nem javítaná a minőséget, csak a kompatibilitást rontaná.

## Őszinte korlátok

Egy kb. **34 millió paraméteres**, nulláról tanított modell:

- **nem ér fel** a Qwen3-0.6B finomhangolásával;
- nem lesz ChatGPT-szintű, és hosszú cikkeket sem fog jól megérteni;
- rövid, befejezett magyar mondatokat, egyszerű kérdéseket és alapvető fordításokat fog tudni;
- néha hibás magyar nyelvtant vagy tényt mondhat.

Ez a teljesen saját súlyok ára. Ha később mégis a jobb minőséget választod, a `nexa_train.ipynb` ugyanebbe a `sziriusz-blackalt/nexa-hu` repóba tud erősebb modellt feltölteni.

## A tanítás két szakasza

1. **Magyar szöveges előképzés** — 30000 Wikipédia-cikk, 8000 blokk × 512 token (kb. 4 millió token). Ez tanítja meg a magyar szókincset és nyelvtant.
2. **Utasítás-követő tanítás** — saját minták + Aya hu + OPUS-100. A rendszerüzenet megegyezik az appban használttal: „rövid, de teljes, fejezd be a gondolatot”.

A modellt ezután összeolvasztjuk a konfigurációval, ONNX-be exportáljuk, `MatMulNBits` 4 bitesre kvantáljuk, ellenőrizzük, hogy nem üres és nem NaN, majd feltöltjük. A várható modellméret **kb. 20–50 MB**, tehát telefonra könnyebb, mint a beépített Nova.

## 1. Hugging Face token

1. Készíts Hugging Face fiókot, majd **write** jogosultságú tokent: <https://huggingface.co/settings/tokens>
2. Colabban a bal oldali **Secrets** panelen vegyél fel egy titkot `HF_TOKEN` néven. Ha ezt kihagyod, a notebook kérni fogja.

A cél repo alapértelmezés szerint `sziriusz-blackalt/nexa-hu`. A notebook `private=False`-szel hozza létre, tehát nyilvános lesz. Ha más repót szeretnél, az **1. Beállítások** cellában módosítsd az `OUTPUT_REPO` értékét.

A token csak a tanítás végén, a feltöltéshez kell. **Az appba nem kerül, és a modell nem küld adatot szerverre.**

## 2. Futtatás Colabban

Nyisd meg közvetlenül:

<https://colab.research.google.com/github/sziriusz-blackalt/offline-ai/blob/main/nexa-model/nexa_scratch.ipynb>

Vagy: Colab → `Fájl → Notebook feltöltése` → `nexa_scratch.ipynb`.

1. `Futtatás → Futtatókörnyezet módosítása → T4 GPU → Csatlakozás`.
2. Futtasd a cellákat sorrendben. A teljes folyamat **60–90 perc**.
3. A 8. cella kiír egy mintaválaszt — ez még gyenge lesz, ez rendben van.
4. A 12. cella feltölti a modellt a Hugging Face-re.

Ha a Wikipédia letöltése nem sikerül, a notebook kiírja, hogy kihagyta, és a rövid magyar mintákkal folytatja. Ilyenkor a modell gyengébb, de a folyamat végigfut.

## 3. Használata a Nexa AI appban

1. Győződj meg róla, hogy a repo **nyilvános**.
2. A csevegő **Modell** gombjából válaszd a **🧠 Nexa HU**-t — repo mező kitöltése nem kötelező, az app az alapértelmezett `sziriusz-blackalt/nexa-hu` repót használja.
3. A **Beállítások → Modellek → Nexa HU** kártyán kattints a **Letöltés** gombra.
4. Csak akkor írd be a repo nevét a **Saját Nexa modell** mezőbe, ha saját repo-d van.

Az „Összes letöltése” nem próbálja automatikusan letölteni a még nem létező saját modellt. A v1.4.9 óta **nincs válaszidőzítő és nincs rejtett tokenkorlát** sem.

## Hibaelhárítás

- **`AssertError: nincs GPU`** — válts T4 GPU-re a futtatókörnyezetben.
- **`pip` ütközés** — indítsd újra a futtatókörnyezetet, és a 2. cellát futtasd újra.
- **401 a feltöltésnél** — a `HF_TOKEN` hiányzik vagy csak `read` jogú. Készíts új write tokent.
- **Az app nem találja a modellt** — ellenőrizd a repo pontos nevét és az `onnx/model_q4.onnx` fájl jelenlétét a `main` ágon.
- **Gyenge válaszok** — várható a kis, nulláról tanított modellnél. A jobb minőséghez használd a `nexa_train.ipynb`-t vagy a beépített Novát.

## Adatvédelem

A tanítás Colabban történik, a kész modell a nyilvános Hugging Face repón van. A modell maga nem gyűjt adatot: az appban fut, és egyetlen csevegést sem küld szerverre.
