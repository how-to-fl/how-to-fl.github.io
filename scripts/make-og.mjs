#!/usr/bin/env node
/**
 * Generates public/og.png — the link preview card.
 *
 * Run by hand when the brand changes; the result is committed.
 *   npm run make:og
 *
 * This matters more here than the usual SEO checkbox: the guide is shared by
 * WeChat message and QR poster far more than by search result, so the OG image
 * is the actual first impression for most people who ever see it.
 *
 * Drawn as SVG and rasterised with sharp (already a dependency). Text is set in
 * a system serif rather than Bodoni Moda — resvg can't load our woff2, and a
 * silent fallback to something ugly would be worse than choosing the fallback
 * deliberately.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const W = 1200;
const H = 630;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#a8202f"/>
      <stop offset="42%" stop-color="#8e1b2c"/>
      <stop offset="100%" stop-color="#c0452a"/>
    </linearGradient>
    <radialGradient id="warm" cx="0.78" cy="0.12" r="0.9">
      <stop offset="0%" stop-color="#d0574a" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#d0574a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="deep" cx="0.12" cy="0.88" r="1.0">
      <stop offset="0%" stop-color="#7d1526" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="#7d1526" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#deep)"/>
  <rect width="${W}" height="${H}" fill="url(#warm)"/>

  <!-- hairline rule, as on the posters -->
  <line x1="72" y1="70" x2="${W - 72}" y2="70" stroke="#f4ecdc" stroke-opacity="0.45" stroke-width="1.5"/>
  <line x1="72" y1="${H - 70}" x2="${W - 72}" y2="${H - 70}" stroke="#f4ecdc" stroke-opacity="0.35" stroke-width="1.5"/>

  <!-- the seal, shapes only: arched text needs font metrics we can't rely on here -->
  <g transform="translate(950 315)">
    <circle r="118" fill="#f4ecdc"/>
    <circle r="113" fill="none" stroke="#8e1b2c" stroke-width="4"/>
    <circle r="102" fill="none" stroke="#8e1b2c" stroke-width="1.6"/>
    <text x="0" y="14" text-anchor="middle" font-family="Didot, 'Bodoni 72', Georgia, serif"
          font-size="96" font-weight="700" fill="#8e1b2c" letter-spacing="2">FL</text>
    <path d="M -32,64 L -12,64 M 12,64 L 32,64" stroke="#8e1b2c" stroke-width="2" stroke-linecap="round"/>
    <path d="M 0,50 C 2.2,61 8,66.8 19,69 C 8,71.2 2.2,77 0,88 C -2.2,77 -8,71.2 -19,69 C -8,66.8 -2.2,61 0,50 Z" fill="#8e1b2c"/>
  </g>

  <text x="72" y="252" font-family="Didot, 'Bodoni 72', Georgia, serif" font-size="94"
        font-weight="700" fill="#f4ecdc" letter-spacing="-1">How to FL</text>

  <text x="72" y="318" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#f4ecdc"
        fill-opacity="0.92">Everything we wish someone had told us</text>
  <text x="72" y="360" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#f4ecdc"
        fill-opacity="0.92">before we landed in Beijing.</text>

  <text x="72" y="470" font-family="Didot, 'Bodoni 72', Georgia, serif" font-size="21"
        fill="#f4ecdc" fill-opacity="0.8" letter-spacing="3.4">FUTURE LEADERS · PEKING UNIVERSITY</text>
</svg>`;

const out = join(ROOT, 'public', 'og.png');
await sharp(Buffer.from(svg)).png({ quality: 90, compressionLevel: 9 }).toFile(out);

const { size } = await import('node:fs').then((m) => m.promises.stat(out));
await writeFile(join(ROOT, 'public', 'og.svg'), svg, 'utf8');
console.log(`  ✔ public/og.png  ${W}×${H}  ${(size / 1024).toFixed(0)} KB`);
console.log('    (og.svg kept alongside so the next person can edit it)');
