// Testy čistých funkcí z index.html (běží bez prohlížeče).
//
// Funkce jsou definované jako globální `function …()` uvnitř jediného inline
// <script> v index.html. Vytáhneme jeho obsah a spustíme ho v izolovaném
// vm-kontextu, kde:
//   – `document` NEexistuje  → textWidthPx použije Node fallback (odhad šířky),
//   – `window` je stub       → top-level addEventListener(DOMContentLoaded) projde,
//   – `localStorage`/`docx`  → nejsou potřeba (volají se až uvnitř jiných funkcí).
// Tak otestujeme logiku bez závislosti na DOM i na docx.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

// První <script> bez atributů je ten inline (CDN docx má <script src=…>).
const m = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(m, 'inline <script> v index.html nenalezen');

const ctx = { window: { addEventListener() {} }, console };
vm.createContext(ctx);
vm.runInContext(m[1], ctx);

const { fmtHalf, abbrev, seasonYears, suggestFname, resolveFname, matchLayout, ttlFor,
        matchCols, standingsCols, standingsLayout, refLine, richBlocks, headerText, profileOf, parseCzDate, parseSchedule, pickRound, roundLabel, scheduleRound, noResultsText, mergeRound, eloCell, sizeAtNode, matchName, parseCompetitions, findRegionOf } = ctx;
const plain = o => JSON.parse(JSON.stringify(o));
const sum = a => a.reduce((x, y) => x + y, 0);

test('ttlFor — matches+table 10 min (živá data), ostatní 1 h', () => {
  assert.equal(ttlFor('/competitions/3327/round/2/matches'), 600000);
  assert.equal(ttlFor('/competitions/3327/table'), 600000);
  assert.equal(ttlFor('/competitions/3327/details'), 3600000);
  assert.equal(ttlFor('/competitions/3327/round/2/schedule'), 3600000);
});

test('fmtHalf — celé, půlky, nulová půlka, neplatný vstup', () => {
  assert.equal(fmtHalf(null), '0');
  assert.equal(fmtHalf(0), '0');
  assert.equal(fmtHalf(0.5), '½');
  assert.equal(fmtHalf(1), '1');
  assert.equal(fmtHalf(1.5), '1½');
  assert.equal(fmtHalf(2.5), '2½');
  assert.equal(fmtHalf('3'), '3');
  assert.equal(fmtHalf('abc'), 'abc'); // neparsovatelné → vrátí beze změny
});

test('abbrev — počáteční znaky slov, bez diakritiky, fallback', () => {
  assert.equal(abbrev(''), 'soutez');
  assert.equal(abbrev(null), 'soutez');
  assert.equal(abbrev('Krajská soutěž A'), 'ksa');
  assert.equal(abbrev('1. liga'), '1l');     // číslice i písmeno
  assert.equal(abbrev('Přebor / sk. B'), 'psb'); // lomítko je oddělovač
  assert.equal(abbrev('---'), 'soutez');     // jen oddělovače → fallback
});

test('resolveFname — placeholdery, dvouciferné kolo, přípona, sanitizace', () => {
  assert.equal(resolveFname('[soutez]_[kolo]', '3327', '2'), '3327_02.docx');
  assert.equal(resolveFname('[soutez]_[kolo]', '3327', '12'), '3327_12.docx');
  assert.equal(resolveFname('', '3327', '1'), '3327_01.docx'); // prázdná šablona → default
  assert.equal(resolveFname('rs_d_[kolo]', '99', '7'), 'rs_d_07.docx');
  assert.equal(resolveFname('a/b:c', '1', '1'), 'a_b_c.docx');  // nepovolené znaky → _
  assert.equal(resolveFname('hotovo.docx', '1', '1'), 'hotovo.docx'); // přípona se nepřidá 2×
  assert.equal(resolveFname('[soutez]_[kolo]', '1', 'finále'), '1_finále.docx'); // nečíselné kolo beze změny
  assert.equal(resolveFname('[soutez]_[kolo]', '3327', '2', 'pdf'), '3327_02.pdf');
  assert.equal(resolveFname('hotovo.docx', '1', '1', 'pdf'), 'hotovo.pdf');       // .docx v šabloně → .pdf
});

const game = (h, a) => ({ homePlayerName: h, awayPlayerName: a, homePlayerRating: 1800, awayPlayerRating: 2100,
                          homePlayerResult: 1, awayPlayerResult: 0 });
const match = (games, ht = 'A', at = 'B') => ({ homeTeamName: ht, awayTeamName: at, homeTeamScore: 2.5,
                                                awayTeamScore: 1.5, matchGames: games });

test('matchLayout — meze, monotónie, výchozí šířky při 10 pt', () => {
  // Prázdný seznam → minimální šířka jmen 1200 dxa, úzké sloupce výchozí.
  const e = matchLayout([], '1', 10);
  assert.deepEqual(plain(e), { board: 460, name: 1200, elo: 640, result: 1120, fits: true });

  // Delší jméno musí dát širší (nebo stejný, kvůli stropu) sloupec než kratší.
  const krat   = matchLayout([match([game('Jan', 'Eva')])], '1', 10).name;
  const dlouhy = matchLayout([match([game('Bartoloměj Nejdelší-Příjmení', 'Eva')])], '1', 10).name;
  assert.ok(dlouhy >= krat, `delší jméno nedalo širší sloupec: ${dlouhy} < ${krat}`);

  // Strop: celá tabulka se vejde do sazby, fits=false když se jméno nevejde.
  const big = matchLayout([match([game('Z'.repeat(200), '')], 'X'.repeat(200))], '1', 10);
  assert.equal(big.fits, false);
  assert.ok(sum(matchCols(big)) <= 9026);
});

test('matchLayout — větší písmo = širší sloupce, číslo zápasu „11.6“ se vejde', () => {
  const ms = [1, 2, 3, 4, 5, 6].map(() => match([game('Procházka, Jiří', 'Kučera, Martin')], 'ŠK Lokomotiva Brno B', 'TJ Bohunice'));
  const l10 = matchLayout(ms, '11', 10), l12 = matchLayout(ms, '11', 12);
  assert.ok(l12.name > l10.name);
  assert.ok(l12.board >= l10.board && l12.result >= l10.result && l12.elo >= l10.elo);
  assert.ok(l10.board > 460, 'číslo zápasu 11.6 rozšíří první sloupec');
  assert.ok(l12.fits);
  assert.ok(sum(matchCols(l12)) <= 9026);
});

// ── apiGet: serializovaná fronta + self-block po 429 ──────────────
// Vlastní vm-kontext s mockem fetch a localStorage (in-memory).
function apiCtx(fetchImpl) {
  const store = new Map();
  const c = {
    window: { addEventListener() {} }, console: { log() {}, error() {} },
    setTimeout, Promise, btoa, unescape, encodeURIComponent,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    fetch: fetchImpl,
  };
  vm.createContext(c);
  vm.runInContext(m[1], c);
  return c;
}
const okJson = d => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(d) });

test('apiGet — souběžná volání jdou s rozestupem ≥ 300 ms, cache hit bez sítě', async () => {
  const times = [];
  const c = apiCtx(url => { times.push(Date.now()); return okJson({ url }); });
  const [a, b] = await Promise.all([c.apiGet('/a', null, true), c.apiGet('/b', null, true)]);
  assert.match(a.url, /api\.chess\.cz\/api\/a$/);
  assert.match(b.url, /\/api\/b$/);
  assert.equal(times.length, 2);
  assert.ok(times[1] - times[0] >= 295, 'rozestup ' + (times[1] - times[0]) + ' ms');
  await c.apiGet('/a', null, true);           // z cache
  assert.equal(times.length, 2);
});

test('apiGet — po 429 se další dotazy odmítnou bez volání fetch', async () => {
  let calls = 0;
  const c = apiCtx(() => { calls++; return Promise.resolve({ ok: false, status: 429 }); });
  await assert.rejects(c.apiGet('/x', null, true), /429/);
  await assert.rejects(c.apiGet('/y', null, true), /blokováno/);
  assert.equal(calls, 1);
});

test('standingsCols — součet = šířka sazby (9026 DXA), Družstvo dopočítané', () => {
  const ws = standingsCols([], 10);
  assert.deepEqual(plain(ws), [480, 4526, 520, 520, 520, 520, 620, 700, 620]);   // výchozí šířky
  const teams = [{ teamRank: 12, teamName: 'ŠK Lokomotiva Brno B', matchesPlayed: 11, matchWins: 10,
                   matchDraws: 1, matchLosses: 0, points: 31, score: 62.5, wonGames: 120 }];
  for (const f of [9, 10, 11, 12]) {
    const w = standingsCols(teams, f);
    assert.equal(w.length, 9);
    assert.equal(sum(w), 9026);
    assert.ok(w[1] > 3000);
  }
  assert.ok(standingsLayout(teams, 12).fits);
  assert.equal(standingsLayout([{ teamName: 'X'.repeat(200) }], 10).fits, false);
});

test('refLine — „Rozhodčí: " + jméno, prázdné jméno ponechá jen popisek', () => {
  assert.equal(refLine(''), 'Rozhodčí: ');
  assert.equal(refLine(null), 'Rozhodčí: ');
  assert.equal(refLine('  Jan Novák '), 'Rozhodčí: Jan Novák');
});

test('matchName — bez diakritiky, všechna slova', () => {
  assert.ok(matchName('Krajský přebor SŠS', 'krajsky preb'));
  assert.ok(matchName('Regionální soutěž D', 'soutez regio'));
  assert.ok(!matchName('Krajský přebor', 'divize'));
});

test('parseCompetitions + findRegionOf — řazení a dohledání kraje podle ID', () => {
  const regs = parseCompetitions({
    '13': { regionName: 'Středočeský šachový svaz', competitions: [
      { compId: 2, compName: 'Regionální soutěž', compLevel: 3 },
      { compId: 1, compName: 'Krajský přebor', compLevel: 1 }] },
    '98': { regionName: 'Šachový svaz ČR', competitions: { compId: 9, compName: 'Extraliga', compLevel: 0 } },
  });
  assert.deepEqual(plain(regs.map(r => r.key)), ['13', '98']);           // podle názvu (cs)
  assert.deepEqual(plain(regs[0].competitions.map(c => c.compId)), [1, 2]); // podle úrovně
  assert.equal(findRegionOf(regs, '9').key, '98');                         // single → pole
  assert.equal(findRegionOf(regs, 777), null);
});

test('seasonYears / suggestFname — sezóna soutěže, ne dnešní datum', () => {
  assert.equal(seasonYears(2025), '25_26');
  assert.equal(seasonYears('2009'), '09_10');
  assert.match(seasonYears(), /^\d\d_\d\d$/);            // fallback podle data
  assert.equal(suggestFname("Regionální soutěž 'D'", 2025), 'rsd_25_26_[kolo]');
});

// ── richBlocks nad minimálním falešným DOM ───────────────────────
function txt(v) { return { nodeType: 3, nodeValue: v }; }
function el(tag, attrs, ...kids) {
  const n = { nodeType: 1, nodeName: tag, childNodes: kids, style: (attrs && attrs.style) || {},
              getAttribute: k => (attrs && attrs[k] != null ? String(attrs[k]) : null) };
  kids.forEach((k, i) => { k.nextSibling = kids[i + 1] || null; });
  return n;
}
const root = (...kids) => el('DIV', null, ...kids);
const simple = bs => plain(bs).map(b => (b.li ? '• ' : '') + b.runs.map(r =>
  (r.b ? '*' : '') + (r.i ? '/' : '') + (r.u ? '_' : '') + (r.size ? r.size + ':' : '') + r.text).join('|'));

test('richBlocks — řádky z <div>, první řádek jako holý text (Chrome)', () => {
  const r = root(txt('Prosím o kontrolu.'), el('DIV', null, el('B', null, txt('Karel Jukl'))),
                 el('DIV', null, txt('2. 10. 2026')));
  assert.deepEqual(simple(richBlocks(r)), ['Prosím o kontrolu.', '*Karel Jukl', '2. 10. 2026']);
});

test('richBlocks — B/I/U, <font size>, CSS styly, vnořené formáty', () => {
  const r = root(el('DIV', null, txt('a '), el('B', null, txt('b '), el('I', null, txt('c'))), txt(' '),
    el('U', null, txt('d')), txt(' '), el('FONT', { size: 5 }, txt('e')), txt(' '),
    el('SPAN', { style: { fontWeight: '700', fontSize: '12pt' } }, txt('f'))));
  assert.deepEqual(simple(richBlocks(r)), ['a |*b |*/c| |_d| |12:e| |*12:f']);
});

test('richBlocks — odrážky, prázdný řádek, <br>, mezery mezi bloky, koncové prázdné řádky', () => {
  const r = root(txt('\n  '), el('DIV', null, txt('úvod')), txt('\n'),
    el('UL', null, txt('\n'), el('LI', null, txt('jedna')), el('LI', null, el('B', null, txt('dvě')))),
    el('DIV', null, el('BR', null)),
    el('DIV', null, txt('x'), el('BR', null), txt('y')),
    el('DIV', null, el('DIV', null, txt('vnořený'))),
    el('DIV', null, el('BR', null)));
  assert.deepEqual(simple(richBlocks(r)), ['úvod', '• jedna', '• *dvě', '', 'x', 'y', 'vnořený']);
});

test('headerText — „Kraj - Soutěž - Ročník“, chybějící části se vynechají', () => {
  assert.equal(headerText({ regionName: 'Středočeský šachový svaz (SŠS)', compName: "Regionální soutěž 'D'", season: 2025 }),
               "Středočeský šachový svaz (SŠS) - Regionální soutěž 'D' - 2025/2026");
  assert.equal(headerText({ regionName: '', compName: 'Extraliga', season: null }), 'Extraliga');
});

test('sizeAtNode — <font size>, CSS font-size, základ = písmo tabulek', () => {
  const t1 = txt('a'), t2 = txt('b'), t3 = txt('c');
  const ed = root(el('FONT', { size: 5 }, el('B', null, t1)), el('SPAN', { style: { fontSize: '12pt' } }, t2), t3);
  const fix = n => { n.childNodes.forEach(k => { k.parentNode = n; if (k.childNodes) fix(k); }); };
  fix(ed);
  assert.equal(sizeAtNode(t1, ed), 12);
  assert.equal(sizeAtNode(t2, ed), 12);
  assert.equal(sizeAtNode(t3, ed), 10);       // výchozí 10 pt
  assert.equal(sizeAtNode(t3, ed, 12), 12);   // přepínač Písmo 12 pt
});

test('profileOf — Klasický = původní vzhled, neznámý klíč → Klasický', () => {
  const d = { kolo: '2', season: 2025, compName: 'KP', regionName: 'JmKŠS' };
  const k = profileOf('klasik');
  assert.equal(k.hdr(d).r, headerText(d));
  assert.equal(k.title(d)[0].text, 'Zpravodaj z kola č. 2');
  assert.deepEqual(plain(k.chap(d).labels), ['1. Výsledky', '2. Pořadí družstev', '3. Různé a ostatní']);
  assert.equal(profileOf('neexistuje'), k);
  assert.equal(profileOf(null), k);
  // Úřední: ročník vpravo, bez sezóny prázdný
  assert.equal(profileOf('uredni').hdr(d).r, 'Ročník 2025/2026');
  assert.equal(profileOf('uredni').hdr(Object.assign({}, d, { season: null })).r, '');
  assert.equal(profileOf('uredni').chap(d).labels[0], 'I. VÝSLEDKY 2. KOLA');
  assert.equal(profileOf('moderni').title(d)[0].text, '2. kolo');
});

test('profil Úřední — hlavička: název soutěže, pod ním kolo a ročník', () => {
  const d = { kolo: '2', season: 2025, compName: 'Krajský přebor', regionName: 'JmKŠS' };
  const t = profileOf('uredni').title(d);
  assert.equal(t[0].text, 'Krajský přebor');
  assert.ok(t[0].size > t[1].size);
  assert.equal(t[1].text, 'Zpravodaj z kola č. 2  ·  ročník 2025/2026');
  assert.equal(profileOf('uredni').title(Object.assign({}, d, { season: null }))[1].text, 'Zpravodaj z kola č. 2');
});

test('parseCzDate — DD.MM.YYYY, neplatné → null', () => {
  assert.equal(parseCzDate('19.10.2025').getTime(), new Date(2025, 9, 19).getTime());
  assert.equal(parseCzDate('1. 2. 2026').getTime(), new Date(2026, 1, 1).getTime());
  assert.equal(parseCzDate(''), null);
  assert.equal(parseCzDate(null), null);
  assert.equal(parseCzDate('2025-10-19'), null);
});

test('parseSchedule — pole i jeden objekt, řazení podle kola', () => {
  const r = parseSchedule([{ roundNr: 2, roundDate: '09.11.2025' }, { roundNr: 1, roundDate: '19.10.2025' }]);
  assert.deepEqual(r.map(x => x.nr), [1, 2]);
  assert.equal(parseSchedule({ roundNr: 1, roundDate: '' })[0].date, null);
  assert.deepEqual(plain(parseSchedule(null)), []);
});

test('pickRound — poslední kolo s datem ≤ dnes, před sezónou 1. kolo', () => {
  const rs = parseSchedule([
    { roundNr: 1, roundDate: '19.10.2025' }, { roundNr: 2, roundDate: '09.11.2025' }, { roundNr: 3, roundDate: '23.11.2025' }]);
  assert.equal(pickRound(rs, new Date(2025, 8, 1)), 1);            // před začátkem
  assert.equal(pickRound(rs, new Date(2025, 9, 19, 8, 0)), 1);     // v den kola (ráno)
  assert.equal(pickRound(rs, new Date(2025, 10, 20)), 2);          // mezi 2. a 3. kolem
  assert.equal(pickRound(rs, new Date(2026, 5, 1)), 3);            // po skončení
  assert.equal(pickRound([], new Date()), null);
});

test('roundLabel — číslo kola, den v týdnu a datum', () => {
  assert.equal(roundLabel({ nr: 1, date: new Date(2025, 9, 19) }), '1. kolo  ·  ne 19. 10. 2025');
  assert.equal(roundLabel({ nr: 4, date: null }), '4. kolo');
});

test('scheduleRound — dvojice družstev z rozpisu bez skóre, neexistující kolo → null', () => {
  const json = [
    { roundNr: 1, roundDate: '31.10.2026', roundMatches: [
      { homeTeamName: 'Stelar OAZA Praha', awayTeamName: '1. Novoborský ŠK', homeTeamScore: null, awayTeamScore: null }] },
    { roundNr: 2, roundDate: '01.11.2026', roundMatches: { homeTeamName: 'A', awayTeamName: 'B' } }];
  const r1 = scheduleRound(json, '1');
  assert.equal(r1.date.getTime(), new Date(2026, 9, 31).getTime());
  assert.deepEqual(plain(r1.matches), [{ homeTeamName: 'Stelar OAZA Praha', awayTeamName: '1. Novoborský ŠK',
    homeTeamScore: null, awayTeamScore: null, matchGames: [] }]);
  assert.equal(scheduleRound(json, 2).matches.length, 1);   // jeden zápas jako objekt
  assert.equal(scheduleRound(json, '3'), null);
  assert.equal(noResultsText({ kolo: '1', noResults: { date: r1.date } }),
    'Kolo 1 zatím nemá výsledky (hraje se so 31. 10. 2026) — náhled ukazuje jen dvojice zápasů podle rozpisu.');
});

test('mergeRound — pořadí podle rozpisu, chybějící zápas jako dvojice bez skóre', () => {
  const plan = [
    { homeTeamId: 1, awayTeamId: 2, homeTeamName: 'A', awayTeamName: 'B', homeTeamScore: null, awayTeamScore: null, matchGames: [] },
    { homeTeamId: 3, awayTeamId: 4, homeTeamName: 'C', awayTeamName: 'D', homeTeamScore: null, awayTeamScore: null, matchGames: [] },
    { homeTeamId: 5, awayTeamId: 6, homeTeamName: 'E', awayTeamName: 'F', homeTeamScore: null, awayTeamScore: null, matchGames: [] }];
  const res = [
    { homeTeamId: 5, awayTeamId: 6, homeTeamName: 'E', awayTeamName: 'F', homeTeamScore: 3, awayTeamScore: 1, matchGames: [{}] },
    { homeTeamId: 1, awayTeamId: 2, homeTeamName: 'A', awayTeamName: 'B', homeTeamScore: 2, awayTeamScore: 2, matchGames: [{}] }];
  const m = mergeRound(res, plan);
  assert.deepEqual(plain(m.matches).map(x => x.homeTeamName + x.homeTeamScore), ['A2', 'Cnull', 'E3']);
  assert.deepEqual(plain(m.missing), ['C – D']);
  // vše zadané → nic nechybí; bez rozpisu → výsledky beze změny
  assert.deepEqual(plain(mergeRound(res.concat([{ ...plan[1], homeTeamScore: 1, awayTeamScore: 3 }]), plan).missing), []);
  assert.equal(mergeRound(res, null).matches.length, 2);
  // ve výsledcích bez skóre: nezadaný → hlásí se; Volno/kontumace (gameForfeited) → ne
  const noScore = { homeTeamId: 3, awayTeamId: 4, homeTeamName: 'C', awayTeamName: 'D', homeTeamScore: null, awayTeamScore: null,
                    matchGames: [{ homePlayerResult: null, awayPlayerResult: null }] };
  assert.deepEqual(plain(mergeRound(res.concat([noScore]), plan).missing), ['C – D']);
  const volno = { ...noScore, homeTeamName: 'Volno', matchGames: [{ homePlayerResult: 0, awayPlayerResult: 0, gameForfeited: 1 }] };
  assert.deepEqual(plain(mergeRound(res.concat([volno]), plan).missing), []);
  // párování podle názvu, když výsledky nemají ID; zápas mimo rozpis se nezahodí
  const byName = mergeRound([{ homeTeamName: 'Č', awayTeamName: 'D', homeTeamScore: 1, awayTeamScore: 0 },
                             { homeTeamName: 'X', awayTeamName: 'Y', homeTeamScore: 1, awayTeamScore: 0 }],
                            [{ homeTeamId: 3, awayTeamId: 4, homeTeamName: 'C', awayTeamName: 'D' },
                             { homeTeamId: 7, awayTeamId: 8, homeTeamName: 'Č', awayTeamName: 'D' }]);
  assert.deepEqual(plain(byName.matches).map(x => x.homeTeamName + x.homeTeamScore), ['Cundefined', 'Č1', 'X1']);
  assert.equal(byName.matches.length, 3);   // „C“ ≠ „Č“, nic nezmizí
  // kolo bez výsledků → všechno chybí
  assert.equal(mergeRound([], plan).missing.length, 3);
});

test('noResultsText — částečné kolo vyjmenuje chybějící zápasy', () => {
  assert.equal(noResultsText({ kolo: '8', noResults: { partial: true, total: 5, missing: ['nezúčastní se – ŠK Loko Praha C'] } }),
    'Výsledky jsou jen u 4 z 5 zápasů kola 8. Bez výsledku (zatím nezadaný, nebo nehraný): nezúčastní se – ŠK Loko Praha C.');
});

test('eloCell — neobsazená šachovnice prázdná, neregistrovaný hráč 0', () => {
  assert.equal(eloCell(null, null), '');
  assert.equal(eloCell('', null), '');
  assert.equal(eloCell('Novák Jan', null), '0');
  assert.equal(eloCell('Novák Jan', 0), '0');
  assert.equal(eloCell('Novák Jan', 1830), '1830');
});
