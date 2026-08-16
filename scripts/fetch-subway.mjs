#!/usr/bin/env node
/**
 * Fetches the Beijing subway — lines and stations — from OpenStreetMap into
 * public/data/beijing-subway.geojson.
 *
 * Run by hand; the result is committed, so the site builds without Overpass
 * being up and a future cohort isn't broken by an API that moved.
 *
 *   npm run fetch:subway
 *
 * Why the lines come from here and not from our own basemap:
 * the Protomaps extract does carry kind_detail=subway, but only in z14 tiles —
 * decoding z8 through z13 finds zero subway features. So a basemap-derived
 * overlay vanishes the moment you zoom out, which is exactly the wrong
 * behaviour for a map whose job is showing how places connect.
 *
 * Two deliberately small queries rather than one big one:
 *  - `relation[route=subway]; out geom;` is the "proper" way to ask, and it
 *    times out (504) on this dataset every single time, even for one district.
 *  - `way[railway=subway]; out geom;` returns the same geometry in one cheap
 *    pass. It loses the route relations' tidy names, so we normalise the messy
 *    per-way names ourselves below.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public', 'data', 'beijing-subway.geojson');

const ENDPOINTS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.private.coffee/api/interpreter',
];

const BBOX = '39.70,116.10,40.15,116.70';

// [!"service"] drops depot track: yards, crossovers and sidings are tagged
// railway=subway too, and they were 40%+ of what came back — a spider's web of
// non-revenue track around the depots that made the map look wrong.
const QUERY_LINES = `
[out:json][timeout:180];
way["railway"="subway"][!"service"](${BBOX});
out geom;
`;

const QUERY_STATIONS = `
[out:json][timeout:90];
(
  node["station"="subway"](${BBOX});
  node["railway"="station"]["subway"="yes"](${BBOX});
);
out;
`;

// Five decimals ≈ 1.1 m, which is finer than a subway line is drawn at any zoom
// this map offers. Overpass returns seven (≈1 cm); keeping them cost ~90 KB of
// the file for precision no one can see, on the one asset the map page must
// download in full before it can draw anything.
const c5 = (n) => Math.round(n * 1e5) / 1e5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query, label) {
	let lastErr;
	for (let attempt = 1; attempt <= 3; attempt++) {
		for (const url of ENDPOINTS) {
			try {
				process.stdout.write(`  ${label} [${attempt}/3] ${new URL(url).host} … `);
				const res = await fetch(url, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						// Overpass throttles anonymous clients hard, and Node's fetch
						// sends no User-Agent at all — that was the source of blanket 429s.
						'User-Agent': 'how-to-fl-guide/1.0 (https://github.com/how-to-fl; one-off build script)',
					},
					body: 'data=' + encodeURIComponent(query),
					signal: AbortSignal.timeout(280_000),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const json = await res.json();
				console.log(`ok (${json.elements?.length ?? 0} elements)`);
				return json;
			} catch (e) {
				console.log(`failed: ${e.message}`);
				lastErr = e;
				await sleep(4000);
			}
		}
		if (attempt < 3) {
			const wait = attempt * 40;
			console.log(`  waiting ${wait}s…`);
			await sleep(wait * 1000);
		}
	}
	throw lastErr;
}

/**
 * OSM names these ways every which way — "北京地铁8号线", "8号线", "地铁13号线",
 * "Beijing Subway Line 10", "Beijing Subway line 4". Pull them all back to a
 * single canonical label so one line gets one colour.
 */
const NAMED_LINES = [
	[/机场|airport|capital/i, 'Airport Express'],
	[/大兴|daxing/i, 'Daxing Line'],
	[/昌平|changping/i, 'Changping Line'],
	[/房山|fangshan/i, 'Fangshan Line'],
	[/亦庄|yizhuang/i, 'Yizhuang Line'],
	[/八通|batong/i, 'Batong Line'],
	[/燕房|yanfang/i, 'Yanfang Line'],
	[/西郊|xijiao/i, 'Xijiao Line'],
];

function canonicalLine(tags) {
	const candidates = [tags?.name, tags?.['name:en'], tags?.ref, tags?.line].filter(Boolean);
	for (const raw of candidates) {
		for (const [re, label] of NAMED_LINES) if (re.test(raw)) return label;
		const zh = /(\d+)\s*号线/.exec(raw); // "…8号线"
		if (zh) return `Line ${Number(zh[1])}`;
		const en = /line\s*0*(\d+)/i.exec(raw); // "Beijing Subway Line 10"
		if (en) return `Line ${Number(en[1])}`;
		const s = /\bS0*(\d+)\b/i.exec(raw); // "S1线"
		if (s) return `S${Number(s[1])} Line`;
	}
	return '';
}

// Official-ish Beijing Subway colours.
const COLOURS = {
	'Line 1': '#a12b2f', 'Line 2': '#006ab7', 'Line 4': '#008e9c', 'Line 5': '#a6228c',
	'Line 6': '#b6a12b', 'Line 7': '#f2a900', 'Line 8': '#009b77', 'Line 9': '#8fc31f',
	'Line 10': '#009bc0', 'Line 11': '#5f2d8c', 'Line 12': '#7a6a55', 'Line 13': '#f7c800',
	'Line 14': '#d5a3ce', 'Line 15': '#653279', 'Line 16': '#6bae45', 'Line 17': '#00a1a5',
	'Line 19': '#0079c1', 'Daxing Line': '#008e9c', 'Changping Line': '#e56db1',
	'Fangshan Line': '#d4802a', 'Yizhuang Line': '#d40f5a', 'Batong Line': '#a12b2f',
	'Yanfang Line': '#f2a900', 'Xijiao Line': '#6bae45', 'Airport Express': '#a28e6b',
	'S1 Line': '#c85a9c',
};
const FALLBACK = '#4a7fb5';

const features = [];

// ---- Lines ---------------------------------------------------------------
const lineData = await overpass(QUERY_LINES, 'lines   ');
let unnamed = 0;
for (const el of lineData.elements ?? []) {
	if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) continue;
	const line = canonicalLine(el.tags);
	if (!line) unnamed++;
	features.push({
		type: 'Feature',
		geometry: { type: 'LineString', coordinates: el.geometry.map((p) => [c5(p.lon), c5(p.lat)]) },
		properties: {
			kind: 'line',
			line,
			colour: COLOURS[line] ?? el.tags?.colour ?? el.tags?.['colour:back'] ?? FALLBACK,
		},
	});
}

// ---- Stations ------------------------------------------------------------
await sleep(3000); // be polite between queries
const stationData = await overpass(QUERY_STATIONS, 'stations');
const seen = new Set();
for (const el of stationData.elements ?? []) {
	if (el.type !== 'node' || typeof el.lat !== 'number' || typeof el.lon !== 'number') continue;
	const name = el.tags?.['name:en'] || el.tags?.name || '';
	if (!name) continue;
	const key = `${name}@${el.lat.toFixed(4)},${el.lon.toFixed(4)}`;
	if (seen.has(key)) continue;
	seen.add(key);
	features.push({
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [c5(el.lon), c5(el.lat)] },
		properties: { kind: 'station', name, name_zh: el.tags?.name ?? '' },
	});
}

const lines = features.filter((f) => f.properties.kind === 'line');
const stations = features.filter((f) => f.properties.kind === 'station');

if (!lines.length || !stations.length) {
	console.error('\n  Came back empty — refusing to overwrite the existing file.');
	console.error('  Usually Overpass rate-limiting. Check https://overpass-api.de/api/status\n');
	process.exit(1);
}

await mkdir(join(ROOT, 'public', 'data'), { recursive: true });
await writeFile(OUT, JSON.stringify({ type: 'FeatureCollection', features }), 'utf8');

const named = [...new Set(lines.map((l) => l.properties.line).filter(Boolean))].sort();
const kb = (JSON.stringify(features).length / 1024).toFixed(0);
console.log(`\n  ✔ ${lines.length} line segments (${unnamed} unnamed), ${stations.length} stations`);
console.log(`    lines identified: ${named.join(', ')}`);
console.log(`    → public/data/beijing-subway.geojson (${kb} KB) — commit it.\n`);
