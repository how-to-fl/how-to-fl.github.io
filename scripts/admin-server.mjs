#!/usr/bin/env node
/**
 * The admin panel's local backend.
 *
 * This site is static — GitHub Pages has no server, so there is nothing running
 * in production that could accept a save. Instead this runs on your own laptop,
 * edits the real files in the repo, and you commit the result.
 *
 * That turns out to be the better fit anyway: no login, no OAuth service to rot,
 * works offline, and works fine behind the Great Firewall because it never
 * leaves your machine.
 *
 *   npm run admin   →   http://localhost:4400
 *
 * Binds to 127.0.0.1 only. It is never deployed and must never be — it writes
 * files with no authentication whatsoever, which is safe on loopback and
 * catastrophic anywhere else.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DOCS = join(ROOT, 'src', 'content', 'docs');
const PLACES = join(ROOT, 'data', 'places.yaml');
const UI = join(ROOT, 'scripts', 'admin');
const PORT = 4400;

const CATEGORIES = [
	'food', 'bar', 'club', 'cafe', 'shop',
	'clinic', 'sport', 'study', 'landmark', 'service',
];

// Greater Beijing. Anything outside this is almost certainly a GCJ-02
// coordinate copied out of Amap — see CONTRIBUTING.md.
const BEIJING = { latMin: 39.4, latMax: 40.6, lngMin: 115.7, lngMax: 117.1 };

/** Refuse any path that escapes the directory it is supposed to live in. */
function safeJoin(base, untrusted) {
	const full = resolve(base, untrusted);
	if (full !== base && !full.startsWith(base + sep)) return null;
	return full;
}

const json = (res, code, body) => {
	res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
	res.end(JSON.stringify(body));
};

const readBody = (req) =>
	new Promise((ok, fail) => {
		let raw = '';
		req.on('data', (c) => {
			raw += c;
			if (raw.length > 5e6) fail(new Error('body too large'));
		});
		req.on('end', () => {
			try {
				ok(raw ? JSON.parse(raw) : {});
			} catch (e) {
				fail(e);
			}
		});
	});

// --- Markdown frontmatter -------------------------------------------------

function splitFrontmatter(text) {
	const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
	if (!m) return { frontmatter: {}, body: text };
	return { frontmatter: parse(m[1]) ?? {}, body: m[2] };
}

function joinFrontmatter(frontmatter, body) {
	const fm = stringify(frontmatter).trimEnd();
	return `---\n${fm}\n---\n\n${body.replace(/^\n+/, '')}`;
}

async function listPages(dir = DOCS, acc = []) {
	for (const name of await readdir(dir)) {
		const full = join(dir, name);
		if ((await stat(full)).isDirectory()) await listPages(full, acc);
		else if (['.md', '.mdx'].includes(extname(name))) {
			const { frontmatter } = splitFrontmatter(await readFile(full, 'utf8'));
			acc.push({
				path: relative(DOCS, full).split(sep).join('/'),
				title: frontmatter.title ?? name,
				status: frontmatter.status ?? '',
				last_verified: frontmatter.last_verified ?? '',
				section: relative(DOCS, full).split(sep).length > 1
					? relative(DOCS, full).split(sep)[0]
					: '(top level)',
			});
		}
	}
	return acc;
}

// --- Validation -----------------------------------------------------------

function validatePlace(p) {
	const errors = [];
	for (const f of ['name_en', 'name_zh', 'address_zh', 'category', 'recommended_by', 'last_verified']) {
		if (!p?.[f]) errors.push(`${f} is required`);
	}
	if (p.category && !CATEGORIES.includes(p.category)) errors.push(`unknown category "${p.category}"`);
	if (p.last_verified && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(p.last_verified))) {
		errors.push('last_verified must look like 2026-08');
	}
	const hasLat = p.lat !== undefined && p.lat !== null && p.lat !== '';
	const hasLng = p.lng !== undefined && p.lng !== null && p.lng !== '';
	if (hasLat !== hasLng) errors.push('give both lat and lng, or neither');
	if (hasLat && hasLng) {
		const lat = Number(p.lat), lng = Number(p.lng);
		if (Number.isNaN(lat) || Number.isNaN(lng)) errors.push('lat/lng must be numbers');
		else if (lat < BEIJING.latMin || lat > BEIJING.latMax || lng < BEIJING.lngMin || lng > BEIJING.lngMax) {
			errors.push(
				`${lat},${lng} is outside greater Beijing — did you copy GCJ-02 coordinates from Amap? We need WGS-84.`
			);
		}
	}
	return errors;
}

/** Drop empty optional fields so we don't write `metro: null` into the file. */
function cleanPlace(p) {
	const out = {};
	for (const k of ['name_en','name_zh','address_zh','category','lat','lng','metro','price','note','recommended_by','last_verified']) {
		let v = p[k];
		if (v === undefined || v === null || v === '') continue;
		if (k === 'lat' || k === 'lng') v = Number(v);
		out[k] = v;
	}
	return out;
}

// --- Server ---------------------------------------------------------------

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
	const url = new URL(req.url, `http://localhost:${PORT}`);
	const path = url.pathname;

	try {
		// ---- API ----
		if (path === '/api/meta') {
			return json(res, 200, { categories: CATEGORIES, beijing: BEIJING });
		}

		if (path === '/api/places' && req.method === 'GET') {
			const doc = parse(await readFile(PLACES, 'utf8')) ?? {};
			return json(res, 200, { places: doc.places ?? [] });
		}

		if (path === '/api/places' && req.method === 'PUT') {
			const { places } = await readBody(req);
			if (!Array.isArray(places)) return json(res, 400, { error: 'expected a places array' });

			const problems = [];
			places.forEach((p, i) => {
				validatePlace(p).forEach((e) => problems.push(`${p.name_en || `entry ${i + 1}`}: ${e}`));
			});
			if (problems.length) return json(res, 422, { error: 'Some entries need fixing', problems });

			// Keep the explanatory header comment — it is the documentation.
			const existing = await readFile(PLACES, 'utf8');
			const header = existing.slice(0, existing.indexOf('places:'));
			const body = stringify({ places: places.map(cleanPlace) }, { lineWidth: 0 });
			await writeFile(PLACES, header + body, 'utf8');
			return json(res, 200, { ok: true, count: places.length });
		}

		if (path === '/api/pages' && req.method === 'GET') {
			return json(res, 200, { pages: (await listPages()).sort((a, b) => a.path.localeCompare(b.path)) });
		}

		if (path === '/api/page' && req.method === 'GET') {
			const full = safeJoin(DOCS, url.searchParams.get('path') ?? '');
			if (!full) return json(res, 400, { error: 'bad path' });
			const { frontmatter, body } = splitFrontmatter(await readFile(full, 'utf8'));
			return json(res, 200, { frontmatter, body });
		}

		if (path === '/api/page' && req.method === 'PUT') {
			const { path: rel, frontmatter, body } = await readBody(req);
			const full = safeJoin(DOCS, rel ?? '');
			if (!full) return json(res, 400, { error: 'bad path' });
			if (frontmatter?.last_verified && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(frontmatter.last_verified))) {
				return json(res, 422, { error: 'last_verified must look like 2026-08' });
			}
			await writeFile(full, joinFrontmatter(frontmatter ?? {}, body ?? ''), 'utf8');
			return json(res, 200, { ok: true });
		}

		// ---- Static admin UI ----
		const file = path === '/' ? 'index.html' : path.slice(1);
		const full = safeJoin(UI, file);
		if (!full) return json(res, 400, { error: 'bad path' });
		const data = await readFile(full);
		res.writeHead(200, { 'Content-Type': MIME[extname(full)] ?? 'application/octet-stream' });
		return res.end(data);
	} catch (err) {
		if (err.code === 'ENOENT') return json(res, 404, { error: 'not found' });
		console.error(err);
		return json(res, 500, { error: err.message });
	}
});

// 127.0.0.1, never 0.0.0.0 — this writes files with no auth.
server.listen(PORT, '127.0.0.1', () => {
	console.log(`\n  Admin panel:  http://localhost:${PORT}\n`);
	console.log('  Editing files directly in this repo. When you are happy, commit:');
	console.log('    git add -A && git commit -m "Update the guide"\n');
});
