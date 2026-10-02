# Zpravodaj kola — generátor DOCX (ŠSČR)

Generátor zpravodaje z kola soutěže družstev Šachového svazu ČR. Jednosouborová
webová aplikace, která načte data z API chess.cz a vygeneruje formátovaný
dokument `.docx`.

## Použití

Otevři https://zpravodaj.sachytynec.cz (nebo lokálně `public/index.html`).
Vyplň:

- **ID soutěže (compId)** a **číslo kola**
- volitelně doplňující text do sekce *Různé*
- **název souboru** — šablona s placeholdery `[soutez]` (= ID soutěže) a
  `[kolo]` (= číslo kola), výchozí `[soutez]_[kolo]`

Klikni na **Generovat** — zobrazí se náhled a tlačítko ke stažení DOCX.

## Vlastnosti

- Data z API `https://api.chess.cz/api` (detaily, výsledky kola, tabulka pořadí).
- **Šetrnost k API** (stejně jako sscr-soupiska): serializovaná fronta
  s rozestupem ≥ 1,1 s, po `429`/síťové chybě se aplikace sama na 10 min
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
`abbrev`, `resolveFname`, `computeNameWidth`, `ttlFor`) i fronta `apiGet`
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
