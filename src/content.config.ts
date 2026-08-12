import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				// YYYY-MM. The build fails if this is malformed, and the page shows a
				// visible warning once it is more than 12 months old.
				last_verified: z
					.string()
					.regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'last_verified must look like 2026-08')
					.optional(),
				// Who re-checks this page in the May sweep.
				owner: z.string().optional(),
				status: z.enum(['stub', 'draft', 'live']).default('stub'),
			}),
		}),
	}),
};
