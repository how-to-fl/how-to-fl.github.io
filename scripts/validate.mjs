#!/usr/bin/env node
/**
 * Pre-build checks. Runs in CI on every push and pull request.
 *
 *   1. places.yaml conforms to the schema, and every coordinate is plausibly
 *      WGS-84 inside greater Beijing — this is what catches a pin copied out
 *      of Amap, which would otherwise land ~400m off with no visible error.
 *   2. Nothing in the source references an external host. Assets must be
 *      same-origin: a third-party origin is a thing that can be blocked
 *      independently of the site, and raw.githubusercontent.com in particular
 *      is blocked by some Chinese ISPs.
 *
 * Exits non-zero on any error, which fails the build.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

// fileURLToPath, not .pathname — the latter percent-encodes spaces in the path.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const errors = [];
const warnings = [];

// ---------------------------------------------------------------- places.yaml

const REQUIRED = ['name_en', 'name_zh', 'address_zh', 'category', 'lat', 'lng', 'recommended_by', 'last_verified'];
const CATEGORIES = ['food', 'bar', 'club', 'cafe', 'shop', 'clinic', 'sport', 'study', 'landmark', 'service'];

// Generous bounding box around greater Beijing, including both airports.
const BEIJING = { latMin: 39.4, latMax: 40.6, lngMin: 115.7, lngMax: 117.1 };
const CAMPUS = { lat: 39.9915, lng: 116.3051 };

/** Rough great-circle distance in km. Good enough for a sanity check. */
function distanceKm(a, b) {
	const R = 6371;
	const dLat = ((b.lat - a.lat) * Math.PI) / 180;
	const dLng = ((b.lng - a.lng) * Math.PI) / 180;
	const lat1 = (a.lat * Math.PI) / 180;
	const lat2 = (b.lat * Math.PI) / 180;
	const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
	return 2 * R * Math.asin(Math.sqrt(h));
}

const doc = parse(readFileSync(join(ROOT, 'data/places.yaml'), 'utf8'));
const places = doc?.places ?? [];

places.forEach((p, i) => {
	const label = p?.name_en ? `"${p.name_en}"` : `entry #${i + 1}`;

	for (const field of REQUIRED) {
		if (p?.[field] === undefined || p[field] === null || p[field] === '') {
			errors.push(`places.yaml: ${label} is missing required field "${field}"`);
		}
	}

	if (p?.category && !CATEGORIES.includes(p.category)) {
		errors.push(`places.yaml: ${label} has unknown category "${p.category}" (expected one of: ${CATEGORIES.join(', ')})`);
	}

	if (p?.last_verified && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(p.last_verified))) {
		errors.push(`places.yaml: ${label} has last_verified "${p.last_verified}" — expected YYYY-MM, e.g. 2026-08`);
	}

	if (typeof p?.lat === 'number' && typeof p?.lng === 'number') {
		const { lat, lng } = p;
		if (lat < BEIJING.latMin || lat > BEIJING.latMax || lng < BEIJING.lngMin || lng > BEIJING.lngMax) {
			errors.push(
				`places.yaml: ${label} is at ${lat},${lng}, which is outside greater Beijing. ` +
					`Check you copied WGS-84 coordinates and not GCJ-02 from Amap.`
			);
		} else {
			const km = distanceKm(CAMPUS, { lat, lng });
			if (km > 45) {
				warnings.push(`places.yaml: ${label} is ${km.toFixed(0)}km from campus — intentional?`);
			}
		}
	}
});

// ------------------------------------------------------- external asset check

const BANNED = [
	'fonts.googleapis.com',
	'fonts.gstatic.com',
	'ajax.googleapis.com',
	'www.google-analytics.com',
	'maps.googleapis.com',
	'cdn.jsdelivr.net',
	'unpkg.com',
	'cdnjs.cloudflare.com',
	'raw.githubusercontent.com',
	'www.youtube.com/embed',
	'use.fontawesome.com',
];

const SCAN_EXT = new Set(['.astro', '.css', '.js', '.mjs', '.ts', '.tsx', '.jsx', '.html', '.mdx', '.md']);

function walk(dir) {
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full);
		else if (SCAN_EXT.has(extname(full))) {
			const text = readFileSync(full, 'utf8');
			for (const host of BANNED) {
				// Ignore it when it appears inside a comment explaining the rule.
				const lines = text.split('\n');
				lines.forEach((line, n) => {
					if (!line.includes(host)) return;
					const trimmed = line.trim();
					if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) return;
					errors.push(
						`${relative(ROOT, full)}:${n + 1} references ${host}. ` +
							`Assets must be same-origin — self-host it instead.`
					);
				});
			}
		}
	}
}

walk(join(ROOT, 'src'));

// ------------------------------------------------------------------- report

for (const w of warnings) console.warn(`warning  ${w}`);

if (errors.length) {
	console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'} found:\n`);
	for (const e of errors) console.error(`  ✖ ${e}`);
	console.error('');
	process.exit(1);
}

console.log(`✔ ${places.length} place${places.length === 1 ? '' : 's'} valid, no external assets referenced`);
