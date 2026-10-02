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

const { fmtHalf, abbrev, seasonYears, suggestFname, resolveFname, computeNameWidth, ttlFor,
        matchCols, standingsCols, refLine, richBlocks, matchName, parseCompetitions, findRegionOf } = ctx;
const plain = o => JSON.parse(JSON.stringify(o));

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

test('computeNameWidth — meze a monotónie', () => {
  // Prázdný seznam → minimální šířka 1200 dxa.
  assert.equal(computeNameWidth([]), 1200);

  // Delší jméno musí dát širší (nebo stejný, kvůli stropu) sloupec než kratší.
  const krat = computeNameWidth([{ homeTeamName: 'A', awayTeamName: 'B',
    matchGames: [{ homePlayerName: 'Jan', awayPlayerName: 'Eva' }] }]);
  const dlouhy = computeNameWidth([{ homeTeamName: 'A', awayTeamName: 'B',
    matchGames: [{ homePlayerName: 'Bartoloměj Nejdelší-Příjmení', awayPlayerName: 'Eva' }] }]);
  assert.ok(krat >= 1200, `krátké jméno pod minimem: ${krat}`);
  assert.ok(dlouhy >= krat, `delší jméno nedalo širší sloupec: ${dlouhy} < ${krat}`);

  // Nikdy nepřekročí strop (polovina zbylé šířky po pevných sloupcích).
  const maxAllowed = computeNameWidth([{ homeTeamName: 'X'.repeat(200),
    awayTeamName: 'Y', matchGames: [{ homePlayerName: 'Z'.repeat(200), awayPlayerName: '' }] }]);
  assert.ok(maxAllowed < 9026, `šířka přesáhla obsah stránky: ${maxAllowed}`);
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
  const ws = standingsCols();
  assert.equal(ws.length, 9);
  assert.equal(ws.reduce((a, b) => a + b, 0), 9026);
  assert.ok(ws[1] > 3000);
});

test('matchCols — 6 sloupců, max. šířka jmen se vejde do sazby', () => {
  const ws = matchCols(computeNameWidth([{ homeTeamName: 'X'.repeat(200), matchGames: [] }]));
  assert.equal(ws.length, 6);
  assert.ok(ws.reduce((a, b) => a + b, 0) <= 9026);
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
  assert.deepEqual(simple(richBlocks(r)), ['a |*b |*/c| |_d| |14:e| |*12:f']);
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
