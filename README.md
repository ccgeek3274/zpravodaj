# Zpravodaj kola — generátor DOCX (ŠSČR)

Generátor zpravodaje z kola soutěže družstev Šachového svazu ČR. Jednosouborová
webová aplikace, která načte data z API chess.cz a vygeneruje formátovaný
dokument `.docx`.

## Použití

Otevři https://zpravodaj.sachytynec.cz (nebo lokálně `public/index.html`).
Práce má tři kroky:

1. **Zadání** — po otevření není nic předvybrané, jen aktuální ročník
   (od září nový). Soutěž vyber přes menu *Sezóna → Kraj → Soutěž*
   (s našeptáváním, bez diakritiky), nebo zadej **ID soutěže** ručně (ručně
   zadané ID se v menu dohledá); historie nahoře slouží jako rychlá volba.
   **Kolo** se vybírá ze seznamu s datem (např. *3. kolo · ne 23. 11. 2025*,
   z rozpisu `/schedule`) a předvybere se poslední odehrané kolo podle
   dnešního data (před začátkem soutěže 1. kolo). Pak přepínač **Rozhodčí**
   (výchozí *Ano*). Výsledky se párují s rozpisem kola (podle ID družstev),
   čísla zápasů jdou podle rozpisu. Kolo, které ještě nemá výsledky (API
   vrací 404), se vygeneruje taky — jen s dvojicemi družstev. Když chybí
   výsledky jen některých zápasů (nezadané nebo nenastoupené družstvo),
   jsou v náhledu bez skóre a varování je vyjmenuje. Volno a kontumace
   (`gameForfeited`) se nehlásí; u neobsazené šachovnice se nepíše ELO 0.
   Klikni na **Generovat**.
2. **Náhled a úpravy** — náhled má stejné šířky tabulek jako DOCX. Žlutá pole
   lze přepsat přímo v náhledu: jméno rozhodčího pod každým zápasem
   (řádek „Rozhodčí: …“ přes celou šířku tabulky) a celou sekci *Různé*
   včetně jména vedoucího a data. Různé má lištu: **tučně**, *kurzíva*,
   podtržení, odrážky, velikost písma (tlačítka 9–16 pt; zvýrazněná = velikost
   u kurzoru) a ↺ návrat k výchozímu textu.
   Ze schránky se vkládá jen prostý text.
   Přepínač Rozhodčí lze měnit i po vygenerování, jména zůstanou.
   Stejně tak přepínač **Vzhled** (pamatuje se v prohlížeči) — tři profily,
   které se liší záhlavím stránky, hlavičkou a nadpisy kapitol:
   - *Klasický* — záhlaví vpravo, „Zpravodaj z kola č. N“, „1. Výsledky“ …
   - *Úřední* — záhlaví kraj – soutěž vlevo / ročník vpravo s linkou,
     dominantní název soutěže (18 pt) + „Zpravodaj z kola č. N · ročník …“,
     kapitoly „I. VÝSLEDKY N. KOLA“ … podtržené
   - *Moderní* — šedé záhlaví uprostřed, modré „N. kolo“ + soutěž s linkou,
     modré kapitoly „Výsledky“, „Průběžné pořadí“, „Informace řídícího soutěže“
   A přepínač **Písmo** 9 / 10 / 11 / 12 pt (výchozí 10, pamatuje se) — jedna
   velikost pro tabulky, řádek Rozhodčí i text v Různé; nadpisy kapitol se
   posunou o stejný rozdíl. Šířky sloupců se přepočítají z naměřených textů.
   Když se nejdelší jméno nebo název družstva nevejde na řádek, náhled to
   ohlásí (v DOCX/PDF se zalomí). Na reálných datech (Extraliga, KP SŠS):
   9–10 pt čisté, 11 pt zalomí jen extrémně dlouhé názvy družstev
   (~30+ znaků), 12 pt i delší jména hráčů.
3. **Stažení** — název souboru (šablona s `[soutez]` a `[kolo]`), **Stáhnout
   DOCX** nebo **Stáhnout PDF**. Obojí se sestaví až teď, se všemi úpravami.
   PDF generuje přímo prohlížeč (pdfmake, písmo Roboto) ze stejných dat
   a rozměrů jako DOCX — žádný tiskový dialog ani převod. Knihovna (~1,9 MB)
   se načítá na pozadí až po vygenerování náhledu.

## Vlastnosti

- Data z API `https://api.chess.cz/api` (seznam soutěží, detaily, rozpis kol,
  výsledky kola, tabulka pořadí).
- **Šetrnost k API** (stejně jako sscr-soupiska): serializovaná fronta
  s rozestupem ≥ 300 ms, po `429`/síťové chybě se aplikace sama na 10 min
  zablokuje. Cache odpovědí v `localStorage` — výsledky kola a tabulka 10 min,
  ostatní 1 h; tlačítko *Vymazat cache*.
- Výsledky: každý zápas jako samostatná tabulka, jména a ELO v oddělených
  buňkách; šířky sloupců se počítají podle nejdelšího textu při zvolené
  velikosti písma (měřeno přes canvas) — jména hráčů, názvy týmů i číslo
  zápasu (např. „11.6“), ELO a výsledek, aby se nic nezalomilo.
- Tabulky se nedělí mezi stránky (`cantSplit` + `keepNext`).
- Jméno vedoucího se bere z API (`compManagerName`).
- Záhlaví stránky na jednom řádku (9 pt, profil Klasický): *Kraj - Soutěž - Ročník*; ročník se
  dohledá v seznamu soutěží (endpoint `details` ho nevrací).

## Nasazení (Cloudflare Workers — static assets)

Statická stránka bez build kroku, nasazuje se přes wrangler (stejně jako
kontrolasoupisky). Konfigurace je ve `wrangler.jsonc`: obsah `public/`,
vlastní doména **zpravodaj.sachytynec.cz** + záložní `zpravodaj.<účet>.workers.dev`.

```
npx wrangler login   # jednorázově
npm run deploy       # = npx wrangler deploy
```

Push na GitHub nic nenasazuje (GitHub Pages zrušeno). Aplikace je zapsaná
v rozcestníku app.sachytynec.cz (`apps.json` v repu `app-sachytynec`)
a vkládá jeho zpětný odkaz `back.js`.

API chess.cz posílá `Access-Control-Allow-Origin: *`, takže frontend volá
`https://api.chess.cz/api` napřímo — žádný backend ani proxy není potřeba.

## Vývoj a testování

Generátor běží v prohlížeči (knihovna `docx` v7.8.2 z jsDelivr se SRI; v8.5
má TDZ bug v UMD bundlu, na cdnjs docx není). Čisté funkce (`fmtHalf`,
`abbrev`, `resolveFname`, `ttlFor`, šířky sloupců
`matchLayout`/`matchCols`/`standingsLayout`, `refLine`, `parseCompetitions`, rozpis kol
`parseSchedule`/`pickRound`/`roundLabel`, profily `profileOf`) i fronta `apiGet`
(rozestup, blokace po 429; s mockem `fetch`) jsou pokryté testy:

```
npm test
```

Testy (`test/pure.test.js`) vytáhnou inline `<script>` z `public/index.html` a spustí
ho v Node bez DOM — bez instalace závislostí.

## Adresáře

- `public/index.html` — celá aplikace (jeden soubor)
- `wrangler.jsonc` — nasazení na Cloudflare
- `test/` — testy čistých funkcí (`node --test`)
- `docs/` — referenční podklady a generované ukázky (mimo git)
