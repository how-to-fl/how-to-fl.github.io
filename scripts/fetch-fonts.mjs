#!/usr/bin/env node
/**
 * Downloads our two brand typefaces and vendors them into public/fonts/.
 *
 * Run by hand; the result is committed. We download from Google's font CDN once,
 * here, on a laptop — the published site never references it. That matters twice
 * over: fonts.gstatic.com is unreliable from the mainland, and a webfont that
 * hangs takes the whole page's text rendering with it.
 *
 *   npm run fetch:fonts
 *
 * Playfair Display — the high-contrast Didone from our Instagram. Display only.
 * DM Sans — body and UI. Geometric, warm, unfussy at small sizes.
 * Both are SIL Open Font License, so vendoring and redistributing is fine.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public', 'fonts');

// A modern UA is required, otherwise Google serves ttf instead of woff2.
const UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const FAMILIES = [
	{
		css: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap',
		slug: 'playfair-display',
	},
	{
		css: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,400..500&display=swap',
		slug: 'dm-sans',
	},
];

// Latin only. Cyrillic/Greek/Vietnamese would roughly triple the payload and we
// have no use for them; Chinese is drawn from the reader's own system fonts.
const KEEP = new Set(['latin', 'latin-ext']);

await mkdir(OUT, { recursive: true });
let css = `/* Brand typefaces, vendored by scripts/fetch-fonts.mjs — do not edit by hand.
   Playfair Display & DM Sans, both SIL Open Font License 1.1. */\n`;
let total = 0;

for (const family of FAMILIES) {
	const sheet = await (await fetch(family.css, { headers: { 'User-Agent': UA } })).text();

	// Google's CSS emits a comment naming each subset before its @font-face block.
	const blocks = sheet.split('/*').slice(1);
	let n = 0;

	for (const block of blocks) {
		const subset = block.slice(0, block.indexOf('*/')).trim();
		if (!KEEP.has(subset)) continue;

		const url = /src:\s*url\((https:[^)]+\.woff2)\)/.exec(block)?.[1];
		if (!url) continue;

		const style = /font-style:\s*(\w+)/.exec(block)?.[1] ?? 'normal';
		const weight = /font-weight:\s*([\d\s]+)/.exec(block)?.[1].trim() ?? '400';
		const range = /unicode-range:\s*([^;]+)/.exec(block)?.[1].trim();
		const familyName = /font-family:\s*'([^']+)'/.exec(block)?.[1] ?? family.slug;

		const file = `${family.slug}-${subset}-${style}.woff2`;
		const bytes = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
		await writeFile(join(OUT, file), bytes);
		total += bytes.length;
		n++;

		css += `
@font-face {
  font-family: '${familyName}';
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url('/fonts/${file}') format('woff2');
  unicode-range: ${range};
}
`;
	}
	console.log(`  ${family.slug}: ${n} files`);
}

await writeFile(join(OUT, 'fonts.css'), css, 'utf8');
console.log(`\n  ✔ ${(total / 1024).toFixed(0)} KB → public/fonts/ (+ fonts.css)\n`);
