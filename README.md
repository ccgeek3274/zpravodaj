# Zpravodaj kola — generátor DOCX (ŠSČR)

Generátor zpravodaje z kola soutěže družstev Šachového svazu ČR. Jednosouborová
webová aplikace, která načte data z API chess.cz a vygeneruje formátovaný
dokument `.docx`.

## Použití

Otevři https://zpravodaj.sachytynec.cz (nebo lokálně `public/index.html`).
Práce má tři kroky:

1. **Zadání** — soutěž vyber přes menu *Sezóna → Kraj → Soutěž* (s našeptáváním,
   bez diakritiky), nebo zadej **ID soutěže** ručně (ručně zadané ID se v menu
   dohledá). Doplň **číslo kola** a přepínač **Rozhodčí** (výchozí *Ano*).
   Klikni na **Generovat**.
2. **Náhled a úpravy** — náhled má stejné šířky tabulek jako DOCX. Žlutá pole
   lze přepsat přímo v náhledu: jméno rozhodčího pod každým zápasem
   (řádek „Rozhodčí: …“ přes celou šířku tabulky) a celou sekci *Různé*
   včetně jména vedoucího a data. Různé má lištu: **tučně**, *kurzíva*,
   podtržení, odrážky, velikost písma (9–16 pt) a ↺ návrat k výchozímu textu.
   Ze schránky se vkládá jen prostý text.
   Přepínač Rozhodčí lze měnit i po vygenerování, jména zůstanou.
3. **Stažení** — název souboru (šablona s `[soutez]` a `[kolo]`), **Stáhnout
   DOCX** nebo **Stáhnout PDF**. Obojí se sestaví až teď, se všemi úpravami.
   PDF generuje přímo prohlížeč (pdfmake, písmo Roboto) ze stejných dat
   a rozměrů jako DOCX — žádný tiskový dialog ani převod. Knihovna (~1,9 MB)
   se načítá na pozadí až po vygenerování náhledu.

## Vlastnosti

- Data z API `https://api.chess.cz/api` (seznam soutěží, detaily, výsledky kola,
  tabulka pořadí).
- **Šetrnost k API** (stejně jako sscr-soupiska): serializovaná fronta
  s rozestupem ≥ 300 ms, po `429`/síťové chybě se aplikace sama na 10 min
  zablokuje. Cache odpovědí v `localStorage` — výsledky kola a tabulka 10 min,
  ostatní 1 h; tlačítko *Vymazat cache*.
- Výsledky: každý zápas jako samostatná tabulka, jména a ELO v oddělených
  buňkách; šířka sloupců se jmény se počítá dynamicky podle nejdelšího jména
  hráče i názvu týmu (měřeno přes canvas), aby se nic nezalomilo.
- Tabulky se nedělí mezi stránky (`cantSplit` + `keepNext`).
- Jméno vedoucího se bere z API (`compManagerName`).

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
`abbrev`, `resolveFname`, `computeNameWidth`, `ttlFor`, šířky sloupců
`matchCols`/`standingsCols`, `refLine`, `parseCompetitions`) i fronta `apiGet`
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
