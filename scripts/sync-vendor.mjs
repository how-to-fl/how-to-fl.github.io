#!/usr/bin/env node
/**
 * Copies MapLibre into public/ so it is served, whole and unbundled, from our
 * own origin.
 *
 * Why it is done this way: MapLibre runs its tile parsing in a Web Worker and
 * finds that worker relative to its own `import.meta.url`. If a bundler inlines
 * MapLibre into an application chunk, two things break — the worker URL resolves
 * next to *our* bundle where no worker exists, and the worker ends up running a
 * different copy of the shared module than the main thread. The handshake never
 * completes, no tiles are ever requested, and the map hangs on a blank canvas
 * without emitting a single error. It is a genuinely silent failure.
 *
 * Pointing MapLibre at a vendored worker with setWorkerUrl() fixes the first
 * problem but not the second. So instead we ship MapLibre unbundled and import
 * it at runtime from this directory, which is exactly the layout it expects.
 *
 * Runs automatically before `dev` and `build`; the output is gitignored, so it
 * always matches whatever version of maplibre-gl is actually installed.
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const from = join(root, 'node_modules', 'maplibre-gl', 'dist');
const to = join(root, 'public', 'vendor', 'maplibre');

// All four must land side by side: maplibre-gl.mjs and the worker both import
// './maplibre-gl-shared.mjs' as a sibling, and the worker is resolved relative
// to maplibre-gl.mjs at runtime.
const FILES = [
	'maplibre-gl.mjs',
	'maplibre-gl-worker.mjs',
	'maplibre-gl-shared.mjs',
	'maplibre-gl.css',
];

if (!existsSync(from)) {
	console.error('sync-vendor: maplibre-gl is not installed — run `npm install` first.');
	process.exit(1);
}

mkdirSync(to, { recursive: true });

for (const file of FILES) {
	const src = join(from, file);
	if (!existsSync(src)) {
		console.error(`sync-vendor: expected ${file} in maplibre-gl/dist but it is not there.`);
		console.error('The package layout may have changed in a new major version.');
		process.exit(1);
	}
	copyFileSync(src, join(to, file));
}

console.log(`✔ vendored ${FILES.length} MapLibre worker files to public/vendor/maplibre/`);
