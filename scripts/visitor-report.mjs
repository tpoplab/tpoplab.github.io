#!/usr/bin/env node
// Quarterly visitor report for tpoplab.org, built from GoatCounter statistics.
//
// Usage:
//   node scripts/visitor-report.mjs                      # last complete quarter
//   node scripts/visitor-report.mjs --start 2026-11-01 --end 2026-12-31 --label "Nov–Dec 2026"
//
// Reads the read-only API key from ~/.goatcounter-key and writes an HTML report to
// visitor-reports/ (git-ignored, so reports never get published). Prints a short
// text summary to stdout.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://tpoplab.goatcounter.com';
const KEY = readFileSync(join(homedir(), '.goatcounter-key'), 'utf8').trim();
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'visitor-reports');

// ── Period ─────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), [])
);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

function lastCompleteQuarter(today = new Date()) {
  const q = Math.floor(today.getUTCMonth() / 3); // current quarter index 0–3
  const year = q === 0 ? today.getUTCFullYear() - 1 : today.getUTCFullYear();
  const pq = q === 0 ? 3 : q - 1;
  const start = new Date(Date.UTC(year, pq * 3, 1));
  const end = addDays(new Date(Date.UTC(year, pq * 3 + 3, 1)), -1);
  return { start, end, label: `Q${pq + 1} ${year}`, file: `${year}-Q${pq + 1}` };
}

let period;
if (args.start && args.end) {
  const start = new Date(`${args.start}T00:00:00Z`);
  const end = new Date(`${args.end}T00:00:00Z`);
  period = { start, end, label: args.label ?? `${args.start} to ${args.end}`, file: `${args.start}_to_${args.end}` };
} else {
  period = lastCompleteQuarter();
}
const days = Math.round((period.end - period.start) / 86400000) + 1;
const prev = { start: addDays(period.start, -days), end: addDays(period.start, -1) };

// ── GoatCounter API ────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path, range, extra = '') {
  const q = `start=${iso(range.start)}T00:00:00Z&end=${iso(range.end)}T23:59:59Z${extra}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${SITE}/api/v0/${path}${path.includes('?') ? '&' : '?'}${q}`, {
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    if (res.status === 404 && path === 'stats/total') return { total: 0, stats: [] }; // no visits yet
    if (!res.ok) throw new Error(`GoatCounter ${path}: HTTP ${res.status} ${await res.text()}`);
    await sleep(300); // stay well under the API rate limit
    return res.json();
  }
  throw new Error(`GoatCounter ${path}: rate limited`);
}

const total = await api('stats/total', period);
const prevTotal = await api('stats/total', prev);
const pages = (await api('stats/hits', period, '&limit=25')).hits ?? [];
const countries = (await api('stats/locations', period, '&limit=100')).stats ?? [];
const prevCountries = (await api('stats/locations', prev, '&limit=100')).stats ?? [];
const refs = (await api('stats/toprefs', period, '&limit=15')).stats ?? [];
const browsers = (await api('stats/browsers', period, '&limit=8')).stats ?? [];
const systems = (await api('stats/systems', period, '&limit=8')).stats ?? [];
const sizes = (await api('stats/sizes', period)).stats ?? [];
const regions = {};
for (const c of countries.slice(0, 4)) {
  regions[c.id] = ((await api(`stats/locations/${c.id}`, period, '&limit=10')).stats ?? []).filter((r) => r.count > 0);
}

// ── Shape the data ─────────────────────────────────────────────
const daily = (total.stats ?? []).map((d) => ({ day: d.day, count: d.daily ?? 0 }));
const visits = total.total ?? 0;
const prevVisits = prevTotal.total ?? 0;
const change = prevVisits ? Math.round(((visits - prevVisits) / prevVisits) * 100) : null;
const nCountries = countries.filter((c) => c.count > 0).length;
const deviceNames = { phone: 'Phone', tablet: 'Tablet', desktop: 'Laptop / desktop', desktophd: 'Large desktop', unknown: 'Unknown' };
const devices = sizes.filter((s) => s.count > 0).map((s) => ({ name: deviceNames[s.id] ?? s.id, count: s.count }));
const referrers = refs.map((r) => ({ name: r.name || 'Direct (typed address, bookmark, or email link)', count: r.count }));
const pageRows = pages.map((p) => ({ path: p.path, title: p.path === '/' ? 'Home' : (p.title || p.path).replace(/ · T-Pop Research Lab$/, ''), count: p.count }));
const newCountries = countries.filter((c) => c.count > 0 && !prevCountries.some((p) => p.id === c.id && p.count > 0)).map((c) => c.name);

const data = {
  label: period.label, start: iso(period.start), end: iso(period.end), prevStart: iso(prev.start), prevEnd: iso(prev.end),
  visits, prevVisits, change, nCountries, daily, countries, regions, pages: pageRows, referrers, browsers, systems, devices, newCountries,
  generated: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
};

// ── Report page ────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function barList(rows, { label = (r) => esc(r.name), limit = 10, empty = 'No data for this period.' } = {}) {
  const shown = rows.filter((r) => r.count > 0).slice(0, limit);
  if (!shown.length) return `<p class="empty">${empty}</p>`;
  const max = Math.max(...shown.map((r) => r.count));
  const sum = rows.reduce((a, r) => a + r.count, 0);
  return `<table class="bars"><tbody>${shown.map((r) => `
    <tr><td class="name">${label(r)}</td>
      <td class="bar"><span style="width:${Math.max(2, (r.count / max) * 100)}%"></span></td>
      <td class="num">${r.count.toLocaleString()}</td>
      <td class="pct">${sum ? Math.round((r.count / sum) * 100) : 0}%</td></tr>`).join('')}
  </tbody></table>`;
}

const changeText = change === null ? 'no earlier data' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% vs previous period`;
const regionBlocks = Object.entries(regions).filter(([, rs]) => rs.length).map(([id, rs]) => {
  const c = countries.find((x) => x.id === id);
  const named = rs.map((r) => ({ name: r.name || 'Region not identified', count: r.count }));
  return `<div><h3>${esc(c?.name ?? id)}</h3>${barList(named, { limit: 6 })}</div>`;
}).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>T-Pop Visitor Report · ${esc(period.label)}</title>
<style>
  :root {
    --bg: #fbfaf7; --surface: #ffffff; --ink: #14181f; --ink-soft: #4a5260; --ink-faint: #8a909b; --line: #e4e1d8;
    --accent: #1f5e57; --zero: #ecebe6;
    --s1: #d7ebe7; --s2: #a9d3ca; --s3: #6fb3a6; --s4: #3a8a7d; --s5: #1f5e57; --s6: #123c37;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1215; --surface: #1a1f25; --ink: #eceae4; --ink-soft: #a9afb8; --ink-faint: #6f7681; --line: #2a3038;
      --accent: #6cc2b4; --zero: #232a31;
      --s1: #1d3a36; --s2: #23534c; --s3: #2f7468; --s4: #4b9a8c; --s5: #79c2b4; --s6: #b3e3da;
      color-scheme: dark;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.55 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  main { width: min(1040px, 100% - 32px); margin: 0 auto; padding: 40px 0 64px; }
  header p { margin: 0; color: var(--ink-soft); }
  .eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); }
  h1 { font: 500 34px/1.15 Georgia, serif; margin: 6px 0 6px; letter-spacing: -.01em; }
  h2 { font: 500 21px/1.2 Georgia, serif; margin: 0 0 14px; }
  h3 { font-size: 13px; font-weight: 600; margin: 0 0 8px; color: var(--ink-soft); }
  section { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 22px 24px; margin-top: 18px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 18px; margin-top: 24px; }
  .kpi { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px 20px; }
  .kpi .v { font: 500 34px/1.1 Georgia, serif; }
  .kpi .l { color: var(--ink-soft); font-size: 13px; margin-top: 4px; }
  .kpi .d { color: var(--ink-faint); font-size: 12px; margin-top: 6px; }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; }
  .grid2 > section { margin-top: 0; }
  .wrap2 { margin-top: 18px; }
  #map { width: 100%; height: auto; display: block; }
  #map path { stroke: var(--surface); stroke-width: .6; }
  #map path:hover { stroke: var(--ink); stroke-width: 1.2; }
  .legend { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-soft); margin-top: 10px; flex-wrap: wrap; }
  .legend i { display: inline-block; width: 26px; height: 10px; border-radius: 2px; }
  .tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--bg); font-size: 12.5px; padding: 6px 9px; border-radius: 7px; opacity: 0; transition: opacity .1s; z-index: 10; }
  table.bars { width: 100%; border-collapse: collapse; }
  table.bars td { padding: 5px 0; vertical-align: middle; font-size: 13.5px; }
  table.bars td.name { width: 42%; padding-right: 12px; overflow-wrap: anywhere; }
  table.bars td.bar { width: 38%; }
  table.bars td.bar span { display: block; height: 10px; background: var(--s4); border-radius: 0 4px 4px 0; }
  table.bars td.num { width: 10%; text-align: right; font-variant-numeric: tabular-nums; padding-left: 10px; }
  table.bars td.pct { width: 10%; text-align: right; color: var(--ink-faint); font-variant-numeric: tabular-nums; }
  .path { color: var(--ink-faint); font-size: 12px; display: block; }
  #daily { width: 100%; height: 170px; display: block; }
  #daily rect { fill: var(--s4); }
  #daily rect.hit { fill: transparent; }
  #daily rect.hit:hover + rect, #daily g:hover rect.v { fill: var(--accent); }
  #daily text { fill: var(--ink-faint); font-size: 11px; }
  #daily line { stroke: var(--line); }
  .empty { color: var(--ink-faint); margin: 0; }
  .note { color: var(--ink-faint); font-size: 12.5px; margin-top: 22px; }
  .highlights { margin: 0; padding-left: 18px; }
  .highlights li { margin-bottom: 4px; }
</style>
</head>
<body>
<main>
  <header>
    <div class="eyebrow">T-Pop Research Lab · tpoplab.org</div>
    <h1>Visitor report · ${esc(period.label)}</h1>
    <p>${fmtDate(data.start)} – ${fmtDate(data.end)}</p>
  </header>

  <div class="kpis">
    <div class="kpi"><div class="v">${visits.toLocaleString()}</div><div class="l">Visits</div><div class="d">${changeText}</div></div>
    <div class="kpi"><div class="v">${nCountries}</div><div class="l">Countries &amp; territories</div><div class="d">${newCountries.length ? `${newCountries.length} new this period` : '&nbsp;'}</div></div>
    <div class="kpi"><div class="v">${esc(countries[0]?.name ?? '—')}</div><div class="l">Top country</div><div class="d">${countries[0] ? `${countries[0].count.toLocaleString()} visit${countries[0].count === 1 ? '' : 's'}` : '&nbsp;'}</div></div>
    <div class="kpi"><div class="v" style="font-size:22px;line-height:1.25">${esc(pageRows[0]?.title ?? '—')}</div><div class="l">Most-viewed page</div><div class="d">${pageRows[0] ? `${pageRows[0].count.toLocaleString()} visit${pageRows[0].count === 1 ? '' : 's'}` : '&nbsp;'}</div></div>
  </div>

  <section>
    <h2>Where visitors came from</h2>
    <svg id="map" viewBox="0 0 960 470" role="img" aria-label="World map of visits by country; the table below lists the same data"></svg>
    <div class="legend" id="legend"></div>
    <p class="empty" id="map-error" hidden>The map couldn't load (it needs an internet connection). The country table below has the same data.</p>
  </section>

  <div class="grid2 wrap2">
    <section><h2>Top countries</h2>${barList(countries, { limit: 15 })}</section>
    <section><h2>Regions in top countries</h2>${regionBlocks || '<p class="empty">No data for this period.</p>'}</section>
  </div>

  <section>
    <h2>Visits per day</h2>
    <svg id="daily" viewBox="0 0 960 170" role="img" aria-label="Bar chart of visits per day"></svg>
  </section>

  <section>
    <h2>Most-viewed pages</h2>
    ${barList(pageRows, { limit: 15, label: (r) => `${esc(r.title)}<span class="path">${esc(r.path)}</span>` })}
  </section>

  <div class="grid2 wrap2">
    <section><h2>How visitors found the site</h2>${barList(referrers, { limit: 10 })}</section>
    <section>
      <h2>Devices</h2>${barList(devices)}
      <h3 style="margin-top:18px">Browsers</h3>${barList(browsers, { limit: 5 })}
      <h3 style="margin-top:18px">Operating systems</h3>${barList(systems, { limit: 5 })}
    </section>
  </div>

  <p class="note">“Visits” are GoatCounter’s unique-visitor counts: one person reading several pages within a few hours counts once per page.
  GoatCounter doesn’t use cookies or store personal data, so visitors can’t be identified individually; locations are approximate (country and region).
  Comparison period: ${fmtDate(data.prevStart)} – ${fmtDate(data.prevEnd)}. Generated ${esc(data.generated)}.</p>
</main>
<div class="tip" id="tip"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
<script>
  const DATA = ${JSON.stringify(data)};
  const tip = document.getElementById('tip');
  const showTip = (e, html) => { tip.innerHTML = html; tip.style.opacity = 1; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; };
  const hideTip = () => { tip.style.opacity = 0; };
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  // Daily bars
  (function () {
    const svg = document.getElementById('daily'); const W = 960, H = 170, pad = { l: 34, r: 6, t: 8, b: 22 };
    const d = DATA.daily; if (!d.length) { svg.outerHTML = '<p class="empty">No data for this period.</p>'; return; }
    const max = Math.max(1, ...d.map((x) => x.count)); const bw = (W - pad.l - pad.r) / d.length;
    const y = (v) => H - pad.b - (v / max) * (H - pad.t - pad.b);
    let s = '';
    const ticks = [0, Math.ceil(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
    for (const t of ticks) s += '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text x="' + (pad.l - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + t + '</text>';
    d.forEach((x, i) => {
      const bx = pad.l + i * bw + Math.min(1, bw * 0.15), w = Math.max(1, bw - Math.min(2, bw * 0.3));
      const h = H - pad.b - y(x.count);
      s += '<g data-i="' + i + '"><rect class="hit" x="' + (pad.l + i * bw) + '" y="' + pad.t + '" width="' + bw + '" height="' + (H - pad.t - pad.b) + '"/>' +
        (x.count ? '<rect class="v" x="' + bx + '" y="' + y(x.count) + '" width="' + w + '" height="' + h + '" rx="' + Math.min(2, w / 2) + '"/>' : '') + '</g>';
      const dt = new Date(x.day + 'T00:00:00Z');
      if (dt.getUTCDate() === 1) s += '<text x="' + (pad.l + i * bw) + '" y="' + (H - 6) + '">' + dt.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) + '</text>';
    });
    svg.innerHTML = s;
    svg.querySelectorAll('g[data-i]').forEach((g) => {
      const x = d[+g.dataset.i];
      g.addEventListener('mousemove', (e) => showTip(e, '<b>' + new Date(x.day + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) + '</b><br>' + x.count + ' visit' + (x.count === 1 ? '' : 's')));
      g.addEventListener('mouseleave', hideTip);
    });
  })();

  // World map: choropleth (one hue, light→dark; zero = neutral) plus a dot per country,
  // sized by visits, so small places like Taiwan, Hong Kong or Singapore stay visible.
  (async function () {
    try {
      const geo = await fetch('https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_110m_admin_0_countries.geojson').then((r) => r.json());
      const feats = geo.features.filter((f) => f.properties.ISO_A2_EH !== 'AQ');
      const byCode = Object.fromEntries(feats.map((f) => [f.properties.ISO_A2_EH, f]));
      const visited = DATA.countries.filter((c) => c.count > 0);
      const counts = Object.fromEntries(visited.map((c) => [c.id, c.count]));
      const max = Math.max(1, ...visited.map((c) => c.count));
      const steps = ['--s2', '--s3', '--s4', '--s5', '--s6'].map(css);
      // Upper bounds of each color class: log-spaced, de-duplicated, so a few large countries don't wash out the rest
      const ub = [...new Set(steps.map((_, k) => Math.max(1, Math.round(Math.pow(max, (k + 1) / steps.length)))))];
      const cls = (v) => Math.min(ub.findIndex((u) => v <= u), ub.length - 1);
      const proj = d3.geoNaturalEarth1().fitExtent([[4, 4], [956, 466]], { type: 'Sphere' });
      const path = d3.geoPath(proj);
      const svg = d3.select('#map');
      const tipFor = (name, n) => '<b>' + name + '</b><br>' + n.toLocaleString() + ' visit' + (n === 1 ? '' : 's');
      svg.append('g').selectAll('path').data(feats).join('path')
        .attr('d', path)
        .attr('fill', (f) => counts[f.properties.ISO_A2_EH] ? steps[cls(counts[f.properties.ISO_A2_EH])] : css('--zero'))
        .on('mousemove', (e, f) => showTip(e, tipFor(f.properties.NAME, counts[f.properties.ISO_A2_EH] || 0)))
        .on('mouseleave', hideTip);
      // Places too small for the 1:110m map (lon, lat)
      const small = { SG: [103.82, 1.35], HK: [114.17, 22.32], MO: [113.55, 22.17], BH: [50.56, 26.07], MT: [14.4, 35.9], MV: [73.5, 4.2], MU: [57.55, -20.3], LI: [9.55, 47.15], MC: [7.42, 43.74], AD: [1.6, 42.55], SM: [12.46, 43.94], BN: [114.73, 4.54], BB: [-59.55, 13.15], AG: [-61.8, 17.08], GU: [144.79, 13.44], PF: [-149.4, -17.68] };
      const r = d3.scaleSqrt().domain([0, max]).range([0, 13]);
      const dots = visited.map((c) => {
        const ll = small[c.id] ?? (byCode[c.id] ? d3.geoCentroid(byCode[c.id]) : null);
        const xy = ll && proj(ll);
        return xy ? { ...c, x: xy[0], y: xy[1] } : null;
      }).filter(Boolean).sort((a, b) => b.count - a.count);
      svg.append('g').selectAll('circle').data(dots).join('circle')
        .attr('cx', (d) => d.x).attr('cy', (d) => d.y).attr('r', (d) => Math.max(4, r(d.count)))
        .attr('fill', css('--accent')).attr('fill-opacity', 0.85)
        .attr('stroke', css('--surface')).attr('stroke-width', 2)
        .on('mousemove', (e, d) => showTip(e, tipFor(d.name, d.count)))
        .on('mouseleave', hideTip);
      const lo = [1, ...ub.slice(0, -1).map((u) => u + 1)];
      document.getElementById('legend').innerHTML = '<span>Visits:</span><i style="background:' + css('--zero') + '"></i><span>0</span>' +
        ub.map((u, i) => '<i style="background:' + steps[i] + '"></i><span>' + (lo[i] === u ? u : lo[i] + '–' + u) + '</span>').join('') +
        '<span style="margin-left:10px">● dot size = visits</span>';
    } catch (e) {
      document.getElementById('map').style.display = 'none';
      document.getElementById('map-error').hidden = false;
    }
  })();
</script>
</body>
</html>`;

mkdirSync(OUT_DIR, { recursive: true });
const outFile = join(OUT_DIR, `T-Pop visitors ${period.file}.html`);
writeFileSync(outFile, html);

// ── Text summary ───────────────────────────────────────────────
const top = (rows, n = 5) => rows.filter((r) => r.count > 0).slice(0, n).map((r) => `${r.name ?? r.title} (${r.count})`).join(', ') || 'none';
console.log(`T-Pop Research Lab — visitor report, ${period.label} (${data.start} to ${data.end})`);
console.log(`Visits: ${visits}${change === null ? '' : ` (${change >= 0 ? '+' : ''}${change}% vs previous period: ${prevVisits})`}`);
console.log(`Countries: ${nCountries}${newCountries.length ? ` — new: ${newCountries.join(', ')}` : ''}`);
console.log(`Top countries: ${top(countries)}`);
console.log(`Top pages: ${top(pageRows.map((p) => ({ name: p.title, count: p.count })))}`);
console.log(`Top referrers: ${top(referrers)}`);
console.log(`Report file: ${outFile}`);
