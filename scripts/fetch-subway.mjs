#!/usr/bin/env node
/**
 * Fetches the Beijing subway network from OpenStreetMap and writes it to
 * public/data/beijing-subway.geojson.
 *
 * Run by hand, not on every build — the result is committed, so the site builds
 * without needing Overpass to be up (and so a future cohort isn't broken by an
 * API that changed or went away).
 *
 *   npm run fetch:subway
 *
 * The Protomaps basemap does carry a generic "rail" class, but it has no line
 * colours, no line names and no station names — useless for working out how to
 * actually get somewhere. OSM route relations carry the official line colour,
 * which is what makes a subway map readable.
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

// A bounding box rather than an area lookup: resolving "Beijing" as an admin
// area is a lot more work for a shared public service, and the box is exactly
// the region our basemap covers anyway.
const BBOX = '39.70,116.10,40.15,116.70';

const QUERY = `
[out:json][timeout:120];
(
  relation["type"="route"]["route"="subway"](${BBOX});
);
out geom;
(
  node["station"="subway"](${BBOX});
  node["railway"="station"]["subway"="yes"](${BBOX});
);
out;
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass() {
	let lastErr;
	// Overpass hands out 429s freely when it is busy; that is a "wait", not a
	// "no". Three passes over both mirrors with growing gaps is usually enough.
	for (let attempt = 1; attempt <= 3; attempt++) {
		for (const url of ENDPOINTS) {
			try {
				process.stdout.write(`  [${attempt}/3] ${new URL(url).host} … `);
				const res = await fetch(url, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						// Overpass throttles anonymous clients hard, and Node's fetch
						// sends no User-Agent at all — which is what the 429s were.
						// Identifying the tool (as Overpass asks you to) fixes it.
						'User-Agent': 'how-to-fl-guide/1.0 (https://github.com/how-to-fl; one-off build script)',
					},
					body: 'data=' + encodeURIComponent(QUERY),
					signal: AbortSignal.timeout(280_000),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const json = await res.json();
				console.log(`ok (${json.elements?.length ?? 0} elements)`);
				return json;
			} catch (e) {
				console.log(`failed: ${e.message}`);
				lastErr = e;
				await sleep(5000);
			}
		}
		if (attempt < 3) {
			const wait = attempt * 45;
			console.log(`  waiting ${wait}s before trying again…`);
			await sleep(wait * 1000);
		}
	}
	throw lastErr;
}

/** Beijing Subway line colours, for the lines OSM leaves untagged. */
const FALLBACK = '#8a8f98';

const data = await overpass();
const features = [];
const seenStation = new Set();

for (const el of data.elements ?? []) {
	if (el.type === 'relation' && el.tags?.route === 'subway') {
		const colour = el.tags.colour || el.tags.color || FALLBACK;
		const name = el.tags['name:en'] || el.tags.name || '';
		const nameZh = el.tags.name || '';
		// `out geom` gives each member way its own coordinate list; keep them as a
		// MultiLineString so a line with branches stays one feature.
		const coords = (el.members ?? [])
			.filter((m) => m.type === 'way' && Array.isArray(m.geom) && m.geom.length > 1)
			.map((m) => m.geom.map((p) => [p.lon, p.lat]));
		if (!coords.length) continue;
		features.push({
			type: 'Feature',
			geometry: { type: 'MultiLineString', coordinates: coords },
			properties: { kind: 'line', name, name_zh: nameZh, colour, ref: el.tags.ref ?? '' },
		});
	}

	if (el.type === 'node') {
		const name = el.tags?.['name:en'] || el.tags?.name || '';
		if (!name || typeof el.lat !== 'number' || typeof el.lon !== 'number') continue;
		const key = `${name}@${el.lat.toFixed(4)},${el.lon.toFixed(4)}`;
		if (seenStation.has(key)) continue;
		seenStation.add(key);
		features.push({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
			properties: { kind: 'station', name, name_zh: el.tags?.name ?? '' },
		});
	}
}

const lines = features.filter((f) => f.properties.kind === 'line');
const stations = features.filter((f) => f.properties.kind === 'station');

if (!lines.length) {
	console.error('\n  No subway lines came back — refusing to overwrite the existing file.');
	console.error('  Usually this means Overpass rate-limited you. Check your quota at');
	console.error('  https://overpass-api.de/api/status and try again in a few minutes.\n');
	process.exit(1);
}

await mkdir(join(ROOT, 'public', 'data'), { recursive: true });
await writeFile(OUT, JSON.stringify({ type: 'FeatureCollection', features }), 'utf8');

const kb = (JSON.stringify(features).length / 1024).toFixed(0);
console.log(`\n  ✔ ${lines.length} lines, ${stations.length} stations → public/data/beijing-subway.geojson (${kb} KB)`);
console.log('    Commit it: the site builds from the committed file, not from Overpass.\n');
