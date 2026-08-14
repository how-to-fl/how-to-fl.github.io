#!/usr/bin/env node
/**
 * Fetches the Peking University campus — boundary, water, named buildings and
 * gates — from OpenStreetMap into public/data/pku-campus.geojson.
 *
 * Run by hand; the result is committed, exactly like the subway data, so the
 * site builds without Overpass being up.
 *
 *   npm run fetch:campus
 *
 * Why we draw our own campus map rather than shipping PKU's:
 * the official map (地图 北京大学) is PKU's artwork and it is stylised — buildings
 * are drawn as little illustrations at whatever size looked good, not where they
 * are. It is an excellent source for what everything is *called* in both
 * languages, and a useless source for where anything *is*. So names came from
 * it by hand; every coordinate here comes from OSM.
 *
 * Several small queries rather than one big one — the same lesson the subway
 * script learned. A single combined query 504s on a busy Overpass; four cheap
 * ones get through.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public', 'data', 'pku-campus.geojson');

const ENDPOINTS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.private.coffee/api/interpreter',
];

// The main campus, plus enough margin east to reach Zhongguanyuan Global Village
// (where we actually live) and the Line 4 station.
const BBOX = '39.9830,116.2930,40.0060,116.3260';

// way/1330709889 is 北京大学 / Peking University — the campus polygon itself.
// Asked for by id because `amenity=university` in this bbox also returns
// Tsinghua, CAS and three PKU sub-schools.
const Q_BOUNDARY = `
[out:json][timeout:90];
way(1330709889);
out geom;
`;

const Q_WATER = `
[out:json][timeout:90];
(
  way["natural"="water"](${BBOX});
  relation["natural"="water"](${BBOX});
);
out geom;
`;

// Named things worth putting on a map somebody uses to find a building.
//
// nwr, not node+way: the PKU library and the campus hospital are both mapped as
// multipolygon *relations*, so a node+way query silently returns neither — and
// they are two of the places a new arrival most needs to find.
const Q_PLACES = `
[out:json][timeout:120];
(
  nwr["amenity"~"^(library|university|hospital|clinic|police|restaurant|canteen|cafe|bank|post_office|pharmacy)$"]["name"](${BBOX});
  nwr["leisure"~"^(sports_centre|stadium|swimming_pool|pitch)$"]["name"](${BBOX});
  nwr["tourism"~"^(museum|hotel|attraction)$"]["name"](${BBOX});
  nwr["building"]["name"](${BBOX});
  nwr["historic"]["name"](${BBOX});
);
out tags center;
`;

const Q_ACCESS = `
[out:json][timeout:90];
(
  node["barrier"="gate"](${BBOX});
  node["entrance"](${BBOX});
  node["railway"="station"](${BBOX});
  node["station"="subway"](${BBOX});
);
out tags center;
`;

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
						// Same reason as fetch-subway: Node's fetch sends no User-Agent,
						// and anonymous clients get throttled into blanket 429s.
						'User-Agent': 'how-to-fl-guide/1.0 (https://github.com/how-to-fl; one-off build script)',
					},
					body: 'data=' + encodeURIComponent(query),
					signal: AbortSignal.timeout(280_000),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const text = await res.text();
				// A busy Overpass answers 200 with an HTML error page, not JSON.
				if (!text.trimStart().startsWith('{')) {
					const m = text.match(/Error<\/strong>:\s*([^<]+)/);
					throw new Error(m ? m[1].trim().slice(0, 80) : 'non-JSON response');
				}
				const json = JSON.parse(text);
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

const feat = (geometry, properties) => ({ type: 'Feature', geometry, properties });
const ring = (geom) => geom.map((p) => [round(p.lon), round(p.lat)]);
// ~1 cm precision. Full float precision triples the file size and means nothing.
const round = (n) => Math.round(n * 1e7) / 1e7;

// ── Keeping Tsinghua out ────────────────────────────────────────────────────
// A bbox big enough to reach Global Village also reaches Tsinghua, the Chinese
// Academy of Sciences and Yuanmingyuan, and they arrive tagged identically —
// three different "South Gate"s, four different libraries. So everything is
// tested against the campus polygon itself.
//
// KEEP_M is a margin, not sloppiness: Zhongguanyuan Global Village and the Line 4
// station are genuinely outside the wall and are the two places a new arrival
// needs most. 350 m reaches both and stops ~1 km short of Tsinghua.
const KEEP_M = 350;

const pointInRing = ([x, y], ring) => {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
};

// Equirectangular metres — fine at this latitude over a few hundred metres, and
// it avoids pulling in a geo library for one distance check.
const M_PER_DEG_LAT = 111_320;
const mPerDegLon = (lat) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

function metresToRing([x, y], ring) {
	const kx = mPerDegLon(y);
	let best = Infinity;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [ax, ay] = ring[i];
		const [bx, by] = ring[j];
		const px = (x - ax) * kx;
		const py = (y - ay) * M_PER_DEG_LAT;
		const vx = (bx - ax) * kx;
		const vy = (by - ay) * M_PER_DEG_LAT;
		const len2 = vx * vx + vy * vy;
		const t = len2 ? Math.max(0, Math.min(1, (px * vx + py * vy) / len2)) : 0;
		const dx = px - vx * t;
		const dy = py - vy * t;
		best = Math.min(best, Math.hypot(dx, dy));
	}
	return best;
}

const nearCampus = (pt, ring) => pointInRing(pt, ring) || metresToRing(pt, ring) <= KEEP_M;

/** Pick the best English label OSM offers, falling back to the Chinese name. */
function labels(tags = {}) {
	const zh = tags['name:zh'] || tags.name || '';
	const en = tags['name:en'] || tags['int_name'] || '';
	return { name_zh: zh, name_en: en };
}

/** What kind of thing this is, in the handful of buckets the map draws. */
function kind(tags = {}) {
	if (tags.railway === 'station' || tags.station === 'subway') return 'subway';
	if (tags.barrier === 'gate' || tags.entrance) return 'gate';
	if (tags.amenity === 'library') return 'library';
	if (tags.amenity === 'hospital' || tags.amenity === 'clinic' || tags.amenity === 'pharmacy')
		return 'health';
	if (tags.amenity === 'police') return 'police';
	if (tags.amenity === 'bank' || tags.amenity === 'post_office') return 'service';
	if (['restaurant', 'canteen', 'cafe', 'fast_food'].includes(tags.amenity)) return 'food';
	if (tags.leisure) return 'sport';
	if (tags.tourism === 'hotel') return 'stay';
	if (tags.tourism === 'museum' || tags.historic || tags.tourism === 'attraction')
		return 'landmark';
	return 'building';
}

console.log('\nPKU campus → OpenStreetMap\n');

const [boundary, water, places, access] = [
	await overpass(Q_BOUNDARY, 'boundary'),
	await overpass(Q_WATER, 'water   '),
	await overpass(Q_PLACES, 'places  '),
	await overpass(Q_ACCESS, 'access  '),
];

const features = [];

const boundaryEl = (boundary.elements ?? []).find((e) => e.geometry);
if (!boundaryEl) throw new Error('campus boundary way/1330709889 came back without geometry');
const CAMPUS = ring(boundaryEl.geometry);

features.push(
	feat({ type: 'Polygon', coordinates: [CAMPUS] }, { layer: 'boundary', ...labels(boundaryEl.tags) }),
);

for (const e of water.elements ?? []) {
	if (!e.geometry || e.geometry.length < 4) continue;
	const r = ring(e.geometry);
	// A pond counts as ours if any part of it is on campus — Weiming Lake's
	// centroid sits on an island, so a centroid test would drop the one lake
	// everybody actually means.
	if (!r.some((pt) => nearCampus(pt, CAMPUS))) continue;
	features.push(feat({ type: 'Polygon', coordinates: [r] }, { layer: 'water', ...labels(e.tags) }));
}

// Points. `out tags center` gives ways a centroid, so nodes and ways land in the
// same shape and the drawing code doesn't have to care which it was.
const seen = new Set();
for (const e of [...(places.elements ?? []), ...(access.elements ?? [])]) {
	const lat = e.lat ?? e.center?.lat;
	const lon = e.lon ?? e.center?.lon;
	if (lat == null || lon == null) continue;
	if (!nearCampus([round(lon), round(lat)], CAMPUS)) continue;
	const { name_zh, name_en } = labels(e.tags);
	// Unnamed gates still matter — an unnamed building does not.
	const k = kind(e.tags);
	if (!name_zh && !name_en && k !== 'gate' && k !== 'subway') continue;
	// OSM often carries the same place as both a node and a building way.
	const key = `${k}:${name_zh || name_en}:${lat.toFixed(4)}`;
	if (seen.has(key)) continue;
	seen.add(key);
	features.push(
		feat(
			{ type: 'Point', coordinates: [round(lon), round(lat)] },
			{ layer: 'place', kind: k, name_zh, name_en },
		),
	);
}

const geojson = { type: 'FeatureCollection', features };

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(geojson));

const counts = features.reduce((a, f) => {
	const k = f.properties.layer === 'place' ? f.properties.kind : f.properties.layer;
	a[k] = (a[k] ?? 0) + 1;
	return a;
}, {});

console.log(`\n  ${features.length} features → public/data/pku-campus.geojson`);
console.log(
	'  ' +
		Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.map(([k, n]) => `${k} ${n}`)
			.join(' · '),
);
console.log('\nCommit the result.\n');
