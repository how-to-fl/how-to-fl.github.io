/**
 * Voice checker — the "one guide, written by all of us" rule from AGENTS.md,
 * made runnable.
 *
 * The site used to be addressed from the cohort that arrived first to the one
 * arriving next: "written by us, for you", "the people who did it a year before
 * you". That framing puts the writer outside the guide and makes it finished
 * rather than in progress. This finds the phrasings that do it.
 *
 * Two important non-goals:
 *
 *   1. It does not object to "you". "Insist the meter goes on" is correct, and
 *      degrading it into "one insists" would be worse. What matters is whether
 *      a sentence splits writer from reader, not which pronoun it uses.
 *   2. It does not object to attribution. "Cohort 6's list", "checked August
 *      2026" — that sourcing is the thing the guide rests on.
 *
 * Advisory by design: it prints and exits 0. A voice rule with false positives
 * should not be able to fail a build, and the judgement is the writer's.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ROOTS = ['src/content/docs', 'src/components', 'CONTRIBUTING.md', 'README.md'];

/** Phrases that split the writer from the reader. */
const SPLIT = [
	[/\bwritten by us,? for you\b/i, 'two groups, one senior — try "from us, for us"'],
	[/\b(a year |the year )?before you\b(?=[^.]*\b(we|us|our)\b)/i, 'seniority as the qualification'],
	[/\bfor both of you\b/i, 'writes the author out of the group'],
	[/\bto one of us\b/i, 'implies the reader is not one of us'],
	[/\bwe'?d tell you\b/i, 'one-way — try "what we\'d say to each other"'],
	[/\bwe wrote (it|this|them)?\s?(all )?down for you\b/i, 'finished and delivered, rather than in progress'],
	[/\bpassing (it |this )?on\b/i, 'handover framing'],
	[/\bhand(ing|ed)? (it|this) (on|over|down)\b/i, 'handover framing'],
	[/\bfor the next cohort\b(?![^.]*\bsell\b)/i, 'check: inheritance is fine, handover framing is not'],
	[/\bso you don'?t have to\b/i, 'positions the writer as having done the work for the reader'],
];

/** Third person about the group — never right for this site. */
const THIRD = [
	[/\bstudents should\b/i, 'third person about ourselves'],
	[/\bthe cohorts (are|have|will|do)\b/i, 'third person about ourselves'],
	[/\bone should\b/i, 'third person'],
];

const files = [];
const walk = (p) => {
	const abs = join(ROOT, p);
	let st;
	try { st = statSync(abs); } catch { return; }
	if (st.isDirectory()) for (const e of readdirSync(abs)) walk(join(p, e));
	else if (/\.(md|mdx|astro)$/.test(p)) files.push(p);
};
ROOTS.forEach(walk);

let hits = 0;
for (const f of files.sort()) {
	const lines = readFileSync(join(ROOT, f), 'utf8').split('\n');
	lines.forEach((line, i) => {
		for (const [re, why] of [...SPLIT, ...THIRD]) {
			if (re.test(line)) {
				hits++;
				console.log(`  ${relative('src/content/docs', f) || f}:${i + 1}`);
				console.log(`    ${line.trim().slice(0, 96)}`);
				console.log(`    → ${why}\n`);
				break;
			}
		}
	});
}
console.log(hits === 0
	? `✔ voice: ${files.length} files, nothing splitting writer from reader`
	: `${hits} line(s) to look at, across ${files.length} files`);
