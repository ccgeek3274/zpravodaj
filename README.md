# Zpravodaj kola — generátor DOCX (ŠSČR)

Generátor zpravodaje z kola soutěže družstev Šachového svazu ČR. Jednosouborová
webová aplikace, která načte data z API chess.cz a vygeneruje formátovaný
dokument `.docx`.

## Použití

Otevři `index.html` v prohlížeči (nebo nasazenou stránku na Cloudflare Pages).
Vyplň:

- **ID soutěže (compId)** a **číslo kola**
- volitelně doplňující text do sekce *Různé*
- **název souboru** — šablona s placeholdery `[soutez]` (= ID soutěže) a
  `[kolo]` (= číslo kola), výchozí `[soutez]_[kolo]`

Klikni na **Generovat DOCX**.

## Vlastnosti

- Data z API `https://api.chess.cz/api` (detaily, výsledky kola, tabulka pořadí).
- **Rate limit** 1 požadavek / s + cache odpovědí v `localStorage` (TTL 1 h),
  tlačítko *Vymazat cache*.
- Výsledky: každý zápas jako samostatná tabulka, jména a ELO v oddělených
  buňkách; šířka sloupců se jmény se počítá dynamicky podle nejdelšího jména
  hráče i názvu týmu (měřeno přes canvas), aby se nic nezalomilo.
- Tabulky se nedělí mezi stránky (`cantSplit` + `keepNext`).
- Jméno vedoucího se bere z API (`compManagerName`).

## Nasazení (Cloudflare Pages)

Statická stránka bez build kroku. V Cloudflare dashboardu:

1. **Workers & Pages → Create → Pages → Connect to Git** a vyber tento repozitář.
2. **Build command** nech prázdné, **Build output directory** nastav na `/` (root).
3. Deploy. Každý push do `main` se nasadí automaticky.

API chess.cz posílá `Access-Control-Allow-Origin: *`, takže frontend volá
`https://api.chess.cz/api` napřímo — žádný backend ani proxy není potřeba.

## Vývoj a testování

Generátor běží v prohlížeči (knihovna `docx` v7.8.2 z CDN). Čisté funkce
(`fmtHalf`, `abbrev`, `resolveFname`, `computeNameWidth`) jsou pokryté testy:

```
npm test
```

Testy (`test/pure.test.js`) vytáhnou inline `<script>` z `index.html` a spustí
ho v Node bez DOM — bez instalace závislostí.

## Adresáře

- `index.html` — celá aplikace (jeden soubor)
- `test/` — testy čistých funkcí (`node --test`)
- `docs/` — referenční podklady a generované ukázky (mimo git)
