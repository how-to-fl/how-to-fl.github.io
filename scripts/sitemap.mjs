#!/usr/bin/env node
/**
 * Enriches the generated sitemap with <lastmod>, <changefreq> and <priority>.
 *
 * Runs as `postbuild`. Starlight bundles @astrojs/sitemap internally, and its
 * output is already *correct* — it lists exactly the routes that were built, so
 * it can't drift out of sync with the site. What it doesn't carry is any of the
 * optional metadata, which is what this adds.
 *
 * Every value below is derived from something real rather than guessed:
 *
 *   lastmod    git's last commit date for the page's source file. Not the build
 *              date — a build touches every page, and claiming they all changed
 *              is exactly the lie that makes lastmod worthless. This is also the
 *              only one of the three that Google still uses.
 *
 *   changefreq the page's own `status` frontmatter. A stub is queued for content
 *              and will change; a draft collects corrections; a live page has
 *              settled. The site already maintains this field, so the sitemap
 *              stays honest for free.
 *
 *   priority   position in the information architecture — see TIERS below.
 *
 * A note worth keeping: Google has said publicly it ignores <priority> and
 * <changefreq> entirely. Other crawlers still read them, and they're cheap and
 * accurate here, so there's no reason not to emit them — but don't expect them
 * to move anything in Google.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const DOCS = join(ROOT, 'src/content/docs');
const SITEMAP = join(DIST, 'sitemap-0.xml');

/**
 * Priority tiers, mapped onto what this site actually has.
 *
 * The brief's middle tier is "section hubs", and strictly this site has none —
 * the four sections are sidebar groups generated from a directory, not landing
 * pages. The nearest real thing is each section's first page, which is where a
 * reader entering that section lands, so that's what sits at 0.8.
 */
const TIERS = [
	// 1.0 — the site root and the pages that aren't articles: how to read the
	// guide, and the two standalone tools.
	{ priority: '1.0', paths: ['/', '/how-to-use-this/', '/map/', '/emergency/'] },
	// 0.8 — the entry page of each section (sidebar order 0), the closest thing
	// this IA has to a hub.
	{
		priority: '0.8',
		paths: [
			'/china/before-you-fly/',
			'/pku/campus-map/',
			'/lifestyle/favourite-spots/',
			'/misc/arrival-card/',
		],
	},
];
const DEFAULT_PRIORITY = '0.6'; // individual articles

// How often each kind of page realistically changes.
const FREQ_BY_STATUS = {
	stub: 'monthly', // queued for content — someone will write it
	draft: 'monthly', // in use, collecting corrections from readers
	live: 'yearly', // settled; changes only when a fact does
};
const FREQ_OVERRIDES = {
	'/': 'weekly', // the index moves whenever anything is added
	'/map/': 'weekly', // pins are the most frequently added thing on the site
};
const DEFAULT_FREQ = 'monthly';

/** Walk src/content/docs and map each built URL path to its source file. */
function sourceFiles() {
	const out = new Map();
	const walk = (dir) => {
		for (const name of readdirSync(dir)) {
			const full = join(dir, name);
			if (statSync(full).isDirectory()) {
				walk(full);
				continue;
			}
			if (!/\.(md|mdx)$/.test(name)) continue;
			const rel = relative(DOCS, full).replace(/\.(md|mdx)$/, '');
			// index.mdx is the site root; everything else keeps its directory path.
			const url = rel === 'index' ? '/' : `/${rel}/`;
			out.set(url, full);
		}
	};
	walk(DOCS);
	return out;
}

const frontmatter = (file) => {
	const m = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!m) return {};
	const fm = {};
	for (const line of m[1].split(/\r?\n/)) {
		const kv = line.match(/^(\w+):\s*(.+)$/);
		if (kv) fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
	}
	return fm;
};

/** Last commit date for a file, as YYYY-MM-DD. Falls back to mtime. */
function lastmod(file) {
	try {
		const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], {
			cwd: ROOT,
			encoding: 'utf8',
		}).trim();
		if (out) return out;
	} catch {
		/* not a git checkout, or the file is untracked — fall through */
	}
	return statSync(file).mtime.toISOString().slice(0, 10);
}

if (!existsSync(SITEMAP)) {
	console.error('  sitemap: dist/sitemap-0.xml not found — did the build run?');
	process.exit(1);
}

const sources = sourceFiles();
const xml = readFileSync(SITEMAP, 'utf8');
const origin = new URL(xml.match(/<loc>([^<]+)<\/loc>/)[1]).origin;

const priorityFor = (path) =>
	TIERS.find((t) => t.paths.includes(path))?.priority ?? DEFAULT_PRIORITY;

let enriched = 0;
const missingSource = [];

const updated = xml.replace(/<url>\s*<loc>([^<]+)<\/loc>\s*<\/url>/g, (_, loc) => {
	const path = new URL(loc).pathname;
	const file = sources.get(path);
	if (!file) {
		missingSource.push(path);
		return `<url><loc>${loc}</loc><priority>${priorityFor(path)}</priority></url>`;
	}
	const fm = frontmatter(file);
	const freq = FREQ_OVERRIDES[path] ?? FREQ_BY_STATUS[fm.status] ?? DEFAULT_FREQ;
	enriched++;
	return (
		`<url><loc>${loc}</loc>` +
		`<lastmod>${lastmod(file)}</lastmod>` +
		`<changefreq>${freq}</changefreq>` +
		`<priority>${priorityFor(path)}</priority>` +
		`</url>`
	);
});

writeFileSync(SITEMAP, updated);

const count = (re) => (updated.match(re) ?? []).length;
console.log(
	`  sitemap: ${enriched} URLs enriched · ` +
		`1.0×${count(/<priority>1\.0</g)} 0.8×${count(/<priority>0\.8</g)} 0.6×${count(/<priority>0\.6</g)} · ` +
		`origin ${origin}`,
);
if (missingSource.length) {
	console.log(`  sitemap: no source file matched ${missingSource.join(', ')} — priority only`);
}
