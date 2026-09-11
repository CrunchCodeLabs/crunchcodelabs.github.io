import { defineCollection } from 'astro:content';
import { z } from 'zod';
import { glob } from 'astro/loaders';

const hex = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex colour like #1EB8AC');

export const appSchema = z
  .object({
    name: z.string().min(1),
    nativeName: z.string().optional(),
    tagline: z.string().min(1).max(160),
    category: z.string().min(1),
    status: z.enum(['live', 'beta', 'coming-soon']),
    badge: z.string().optional(),
    order: z.number().int().nonnegative(),
    accent: hex,
    accentDeep: hex,
    packageId: z.string().min(1),
    version: z.string().min(1),
    platforms: z.array(z.enum(['android', 'ios'])).min(1),
    playUrl: z.string().url().optional(),
    appStoreUrl: z.string().url().optional(),
    icon: z.string().min(1),
    feature: z.string().optional(),
    screenshots: z.array(z.string()).default([]),
    screenshotsTablet: z.array(z.string()).default([]),
    features: z
      .array(z.object({ title: z.string().min(1), body: z.string().min(1) }))
      .min(1, 'list at least one feature')
      .max(6, 'six features is the most the grid reads well with'),
    support: z.object({ email: z.string().email(), donate: z.string().url().optional() }),
    privacy: z.string().optional(),
    terms: z.string().optional(),
  })
  .refine((a) => a.status !== 'live' || Boolean(a.playUrl), {
    message: 'playUrl is required when status is "live"',
    path: ['playUrl'],
  });

export const legalSchema = z.object({
  app: z.string().min(1),
  kind: z.enum(['privacy', 'terms']),
  title: z.string().min(1),
  updated: z.coerce.date(),
});

const apps = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/apps' }),
  schema: appSchema,
});

const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: legalSchema,
});

export const collections = { apps, legal };
