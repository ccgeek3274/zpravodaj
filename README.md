# Zpravodaj kola — generátor DOCX (ŠSČR)

Generátor zpravodaje z kola soutěže družstev Šachového svazu ČR. Jednosouborová
webová aplikace, která načte data z API chess.cz a vygeneruje formátovaný
dokument `.docx`.

## Použití

Otevři `src/index.html` v prohlížeči. Vyplň:

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

## Vývoj a testování

Generátor běží v prohlížeči (knihovna `docx` v7.8.2 z CDN). Lokálně lze logiku
otestovat v Node — viz historie commitů / poznámky k extrakci `<script>` z HTML
a renderu přes LibreOffice.

## Adresáře

- `src/` — zdrojový kód aplikace
- `docs/` — referenční podklady a generované ukázky (mimo git)
