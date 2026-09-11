# CrunchCode Labs Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CrunchCode Labs studio website — a static site presenting the brand and every app under it, where adding a future app is one markdown file plus an image folder.

**Architecture:** Astro with static output. Two content collections (`apps`, `legal`) carry all data; a Zod schema fails the build on malformed entries. Pages are generated from the collections, so no route or component is touched when an app is added. Assets live in `src/assets/` so `astro:assets` can optimize them. Deploys to GitHub Pages from `main` via Actions.

**Tech Stack:** Astro 5, TypeScript (strict), Vitest, Zod (via `astro:content`), Turndown (legal HTML → markdown, build-time only), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-11-crunchcode-labs-website-design.md`

---

## Deviations from the spec

Three spec details were wrong or underspecified. Each is corrected here deliberately.

| Spec | Problem | Resolution |
| --- | --- | --- |
| §5.1 puts app assets in `public/apps/<slug>/` | §7 requires `astro:assets` optimization, which cannot process `public/` — files there are copied verbatim. The two sections contradict. | Assets live in `src/assets/apps/<slug>/`, resolved through an `import.meta.glob` map (Task 4). 3.8MB of PNG becomes optimized WebP with `srcset`. |
| §8 "hero text over gradient is verified per app accent" | Measured: white on studio indigo `#6C63FF` is **4.32:1** — below the 4.5:1 §8 demands for body text. White on My Book Trail's teal `#1EB8AC` is **2.47:1**, below even the 3:1 large-text floor. | Hero text sits over the gradient's **`accentDeep`** end, never the flat accent. Text colour is computed by `onColor(accentDeep)` (Task 2), which measures rather than assumes. Verified: indigo deep 6.89:1, MBT deep 16.77:1 — both white. |
| §6.3 rail band "neutral light grey" | Unspecified value. | `--rail: #F4F4F2`. Sits between `--ground` and `--line`, and does not tint the dark-green My Book Trail panels. |

---

## File structure

```
astro.config.mjs              site URL, sitemap, no base path
package.json / tsconfig.json / vitest.config.ts
src/
  content.config.ts           collections + Zod schema — the scalability contract
  lib/
    urls.ts                   slug -> canonical paths
    contrast.ts               WCAG luminance; white-vs-ink decision
    images.ts                 asset key building + glob resolution
    apps.ts                   collection ordering and filtering
  styles/
    tokens.css                brand tokens from spec §2
    base.css                  reset, typography, focus, reduced-motion
  components/
    Wordmark.astro  SiteHeader.astro  SiteFooter.astro
    StoreBadges.astro  StatusChip.astro  AppCard.astro
    ScreenshotRail.astro  FeatureGrid.astro  LegalCards.astro
  layouts/
    BaseLayout.astro          <head>, header, footer, per-page accent vars
    LegalLayout.astro         document layout, TOC, 68ch measure
  pages/
    index.astro  about.astro  support.astro  404.astro
    apps/[slug]/index.astro
    apps/[slug]/privacy.astro
    apps/[slug]/terms.astro
  content/apps/*.md
  content/legal/*.md
  assets/apps/<slug>/icon.png, feature.png, screens/, screens-tablet/
  assets/brand/
scripts/
  import-assets.mjs           pull store assets out of the app repos
  migrate-legal.mjs           My Book Trail HTML -> markdown
  verify-build.mjs            post-build link and page assertions
tests/                        urls, contrast, images, apps, schema
.github/workflows/deploy.yml
```

---

## Task 1: Scaffold, test harness, URL helpers

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`
- Create: `src/lib/urls.ts`
- Test: `tests/urls.test.ts`

- [ ] **Step 1: Create the project files**

`package.json`:
```json
{
  "name": "crunchcodelabs-site",
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build && node scripts/verify-build.mjs",
    "preview": "astro preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/sitemap": "^3.2.0"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "turndown": "^7.2.0",
    "sharp": "^0.33.0"
  }
}
```

`astro.config.mjs` — note there is **no `base`**; the org Pages site serves from root:
```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://crunchcodelabs.github.io',
  output: 'static',
  integrations: [sitemap()],
  build: { format: 'directory' },
});
```

`tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
```

- [ ] **Step 2: Write the failing test**

`tests/urls.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SITE, appPath, privacyPath, termsPath, absolute } from '../src/lib/urls';

describe('urls', () => {
  it('builds app paths with a trailing slash', () => {
    expect(appPath('my-book-trail')).toBe('/apps/my-book-trail/');
  });

  it('builds legal paths', () => {
    expect(privacyPath('my-book-trail')).toBe('/apps/my-book-trail/privacy/');
    expect(termsPath('my-book-trail')).toBe('/apps/my-book-trail/terms/');
  });

  it('has no base path in the site origin', () => {
    expect(SITE).toBe('https://crunchcodelabs.github.io');
    expect(new URL(SITE).pathname).toBe('/');
  });

  it('makes absolute URLs for canonical tags', () => {
    expect(absolute('/apps/my-book-trail/privacy/'))
      .toBe('https://crunchcodelabs.github.io/apps/my-book-trail/privacy/');
  });

  it('rejects a slug that is not URL-safe', () => {
    expect(() => appPath('My Book Trail')).toThrow(/slug/i);
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

```bash
npm install && npx vitest run tests/urls.test.ts
```
Expected: FAIL — `Failed to resolve import "../src/lib/urls"`.

- [ ] **Step 4: Write the implementation**

`src/lib/urls.ts`:
```ts
export const SITE = 'https://crunchcodelabs.github.io';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertSlug(slug: string): string {
  if (!SLUG.test(slug)) {
    throw new Error(`Invalid slug "${slug}": use lowercase letters, digits and single hyphens.`);
  }
  return slug;
}

export const appPath = (slug: string) => `/apps/${assertSlug(slug)}/`;
export const privacyPath = (slug: string) => `${appPath(slug)}privacy/`;
export const termsPath = (slug: string) => `${appPath(slug)}terms/`;
export const absolute = (path: string) => new URL(path, SITE).href;
```

- [ ] **Step 5: Run the test and verify it passes**

```bash
npx vitest run tests/urls.test.ts
```
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json vitest.config.ts src/lib/urls.ts tests/urls.test.ts
git commit -m "feat: scaffold Astro project with URL helpers"
```

---

## Task 2: Contrast helper

Implements the §8 requirement that hero text colour is measured, not assumed. The measured values in "Deviations" above come from this algorithm.

**Files:**
- Create: `src/lib/contrast.ts`
- Test: `tests/contrast.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/contrast.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { relativeLuminance, contrastRatio, onColor, WHITE, INK } from '../src/lib/contrast';

describe('contrast', () => {
  it('computes known luminance endpoints', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#6C63FF', WHITE)).toBeCloseTo(contrastRatio(WHITE, '#6C63FF'), 10);
  });

  it('matches measured ratios for the brand palette', () => {
    expect(contrastRatio('#6C63FF', WHITE)).toBeCloseTo(4.32, 1);
    expect(contrastRatio('#4B42D6', WHITE)).toBeCloseTo(6.89, 1);
    expect(contrastRatio('#1EB8AC', WHITE)).toBeCloseTo(2.47, 1);
    expect(contrastRatio('#12201F', WHITE)).toBeCloseTo(16.77, 1);
  });

  it('picks ink over the My Book Trail teal, where white would fail', () => {
    expect(onColor('#1EB8AC')).toBe(INK);
  });

  it('picks white over both deep accents, which is where hero text sits', () => {
    expect(onColor('#4B42D6')).toBe(WHITE);
    expect(onColor('#12201F')).toBe(WHITE);
  });

  it('accepts shorthand hex', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5);
  });

  it('rejects a malformed hex so a bad accent fails the build', () => {
    expect(() => relativeLuminance('6C63FF')).toThrow(/hex/i);
    expect(() => relativeLuminance('#GGGGGG')).toThrow(/hex/i);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx vitest run tests/contrast.test.ts
```
Expected: FAIL — cannot resolve `../src/lib/contrast`.

- [ ] **Step 3: Write the implementation**

`src/lib/contrast.ts`:
```ts
export const WHITE = '#FFFFFF';
export const INK = '#141413';

/** WCAG 2.1 minimum for normal-size body text. */
export const AA_BODY = 4.5;
/** WCAG 2.1 minimum for text >= 24px, or >= 18.66px bold. */
export const AA_LARGE = 3;

function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex colour: ${hex}`);
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Whichever of white or ink reads better on `background`. */
export function onColor(background: string): typeof WHITE | typeof INK {
  return contrastRatio(background, WHITE) >= contrastRatio(background, INK) ? WHITE : INK;
}

export function meets(background: string, foreground: string, threshold = AA_BODY): boolean {
  return contrastRatio(background, foreground) >= threshold;
}
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
npx vitest run tests/contrast.test.ts
```
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contrast.ts tests/contrast.test.ts
git commit -m "feat: add WCAG contrast helper for per-app accent colours"
```

---

## Task 3: Content schema

**Files:**
- Create: `src/content.config.ts`, `src/lib/apps.ts`
- Test: `tests/schema.test.ts`, `tests/apps.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { appSchema } from '../src/content.config';

const valid = {
  name: 'My Book Trail',
  tagline: 'Track every book you have read, are reading, and wishing for.',
  category: 'Books & Reference',
  status: 'live' as const,
  order: 1,
  accent: '#1EB8AC',
  accentDeep: '#12201F',
  packageId: 'com.crunchcodelabs.mybooktrail',
  version: '1.30',
  platforms: ['android' as const],
  playUrl: 'https://play.google.com/store/apps/details?id=com.crunchcodelabs.mybooktrail',
  icon: 'my-book-trail/icon.png',
  screenshots: ['my-book-trail/screens/01-your-library.png'],
  features: [{ title: 'Works offline', body: 'Your library lives on your device.' }],
  support: { email: 'crunchcodelabs@gmail.com' },
};

describe('app schema', () => {
  it('accepts a complete entry', () => {
    expect(appSchema.parse(valid)).toMatchObject({ name: 'My Book Trail' });
  });

  it('requires playUrl when status is live', () => {
    const { playUrl, ...noUrl } = valid;
    expect(() => appSchema.parse({ ...noUrl, status: 'live' })).toThrow(/playUrl/);
  });

  it('allows a coming-soon app with no store link', () => {
    const { playUrl, ...noUrl } = valid;
    expect(() => appSchema.parse({ ...noUrl, status: 'coming-soon' })).not.toThrow();
  });

  it('allows an empty screenshot list', () => {
    expect(() => appSchema.parse({ ...valid, screenshots: [] })).not.toThrow();
  });

  it('rejects a non-hex accent', () => {
    expect(() => appSchema.parse({ ...valid, accent: 'teal' })).toThrow();
  });

  it('rejects an unknown platform', () => {
    expect(() => appSchema.parse({ ...valid, platforms: ['windows'] })).toThrow();
  });

  it('requires at least one feature and at most six', () => {
    expect(() => appSchema.parse({ ...valid, features: [] })).toThrow();
    expect(() => appSchema.parse({ ...valid, features: Array(7).fill(valid.features[0]) })).toThrow();
  });

  it('keeps nativeName optional', () => {
    expect(appSchema.parse({ ...valid, nativeName: 'ශුද්ධ ගණිතය සූත්‍ර' }).nativeName)
      .toBe('ශුද්ධ ගණිතය සූත්‍ර');
    expect(appSchema.parse(valid).nativeName).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx vitest run tests/schema.test.ts
```
Expected: FAIL — cannot resolve `../src/content.config`.

- [ ] **Step 3: Write the implementation**

`src/content.config.ts`. The schema is exported standalone so Vitest can exercise it without booting Astro:
```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex colour like #1EB8AC');

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
```

Note: Vitest cannot resolve the `astro:content` virtual module. Add an alias to `vitest.config.ts` pointing it at a thin shim:

`vitest.config.ts` (replace the file from Task 1):
```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      'astro:content': fileURLToPath(new URL('./tests/shims/astro-content.ts', import.meta.url)),
    },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
```

`tests/shims/astro-content.ts`:
```ts
export { z } from 'zod';
export const defineCollection = (config: unknown) => config;
```

Add `zod` to devDependencies:
```bash
npm install -D zod
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
npx vitest run tests/schema.test.ts
```
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the failing test for collection helpers**

`tests/apps.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { byOrder, isLaunched } from '../src/lib/apps';

const mk = (slug: string, order: number, status: 'live' | 'beta' | 'coming-soon') =>
  ({ id: slug, data: { order, status } }) as any;

describe('app helpers', () => {
  it('sorts by the order field', () => {
    const sorted = [mk('b', 2, 'live'), mk('a', 1, 'live')].sort(byOrder);
    expect(sorted.map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('treats live and beta as launched, coming-soon as not', () => {
    expect(isLaunched(mk('a', 1, 'live'))).toBe(true);
    expect(isLaunched(mk('b', 2, 'beta'))).toBe(true);
    expect(isLaunched(mk('c', 3, 'coming-soon'))).toBe(false);
  });
});
```

- [ ] **Step 6: Run it, confirm it fails, then implement**

```bash
npx vitest run tests/apps.test.ts
```
Expected: FAIL — cannot resolve `../src/lib/apps`.

`src/lib/apps.ts`:
```ts
import type { CollectionEntry } from 'astro:content';

export type App = CollectionEntry<'apps'>;

export const byOrder = (a: App, b: App) => a.data.order - b.data.order;
export const isLaunched = (a: App) => a.data.status !== 'coming-soon';
```

- [ ] **Step 7: Run both test files and verify they pass**

```bash
npx vitest run
```
Expected: PASS — urls 5, contrast 7, schema 8, apps 2.

- [ ] **Step 8: Commit**

```bash
git add src/content.config.ts src/lib/apps.ts vitest.config.ts tests/
git commit -m "feat: add app and legal content schemas with build-time validation"
```

---

## Task 4: Asset import and resolution

**Files:**
- Create: `scripts/import-assets.mjs`, `src/lib/images.ts`
- Test: `tests/images.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/images.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { assetKey } from '../src/lib/images';

describe('assetKey', () => {
  it('builds a glob key under src/assets/apps', () => {
    expect(assetKey('my-book-trail/icon.png')).toBe('/src/assets/apps/my-book-trail/icon.png');
  });

  it('tolerates a leading slash', () => {
    expect(assetKey('/my-book-trail/icon.png')).toBe('/src/assets/apps/my-book-trail/icon.png');
  });

  it('rejects traversal out of the assets directory', () => {
    expect(() => assetKey('../../secrets.png')).toThrow(/traversal/i);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
npx vitest run tests/images.test.ts
```
Expected: FAIL — cannot resolve `../src/lib/images`.

- [ ] **Step 3: Write the implementation**

`src/lib/images.ts`:
```ts
export function assetKey(relPath: string): string {
  const clean = relPath.replace(/^\/+/, '');
  if (clean.split('/').includes('..')) {
    throw new Error(`Path traversal is not allowed in asset path: ${relPath}`);
  }
  return `/src/assets/apps/${clean}`;
}

const assets = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/apps/**/*.{png,jpg,jpeg,webp,avif}',
  { eager: true },
);

/** Resolve a content-relative asset path. Throws at build time when missing (spec §9). */
export function resolveImage(relPath: string): ImageMetadata {
  const key = assetKey(relPath);
  const mod = assets[key];
  if (!mod) {
    throw new Error(
      `Image not found: ${relPath}\nExpected a file at ${key}.\n` +
        `Available: ${Object.keys(assets).join(', ') || '(none)'}`,
    );
  }
  return mod.default;
}
```

- [ ] **Step 4: Run it and verify it passes**

```bash
npx vitest run tests/images.test.ts
```
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the import script**

`scripts/import-assets.mjs`. Source repos are siblings of this one. The script is idempotent and reports what it copied:
```js
import { cp, mkdir, readdir, access } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIBLINGS = resolve(ROOT, '..');
const DEST = join(ROOT, 'src', 'assets', 'apps');

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

const JOBS = [
  {
    slug: 'my-book-trail',
    files: [
      [join(SIBLINGS, 'MyBookTrail/store/icon/play-icon-512.png'), 'icon.png'],
      [join(SIBLINGS, 'MyBookTrail/store/icon/feature-graphic-1024x500.png'), 'feature.png'],
    ],
    dirs: [
      [join(SIBLINGS, 'MyBookTrail/store/out'), 'screens'],
      [join(SIBLINGS, 'MyBookTrail/store/out-tablet'), 'screens-tablet'],
    ],
  },
  {
    slug: 'pure-mathematics-sinhala',
    files: [
      [join(SIBLINGS, 'PureMathematicsSinhala/app/src/main/ic_launcher-web.png'), 'icon.png'],
    ],
    dirs: [],
  },
];

let copied = 0;
const missing = [];

for (const job of JOBS) {
  const base = join(DEST, job.slug);
  await mkdir(base, { recursive: true });

  for (const [src, name] of job.files) {
    if (!(await exists(src))) { missing.push(src); continue; }
    await cp(src, join(base, name));
    copied++;
    console.log(`  ${job.slug}/${name}`);
  }

  for (const [src, name] of job.dirs) {
    if (!(await exists(src))) { missing.push(src); continue; }
    const target = join(base, name);
    await mkdir(target, { recursive: true });
    for (const f of await readdir(src)) {
      if (!/\.(png|jpe?g|webp)$/i.test(f)) continue;
      await cp(join(src, f), join(target, f));
      copied++;
    }
    console.log(`  ${job.slug}/${name}/ (${(await readdir(target)).length} files)`);
  }
}

console.log(`\nCopied ${copied} files.`);
if (missing.length) {
  console.log(`\nNot found (expected for assets that do not exist yet):`);
  for (const m of missing) console.log(`  ${m}`);
}
```

- [ ] **Step 6: Run the import and verify the result**

```bash
node scripts/import-assets.mjs
```
Expected output includes `my-book-trail/icon.png`, `my-book-trail/screens/ (8 files)`, `my-book-trail/screens-tablet/ (8 files)`, `pure-mathematics-sinhala/icon.png`, and `Copied 19 files.`

```bash
ls src/assets/apps/my-book-trail/screens/
```
Expected: the eight `01-your-library.png` … `08-safe-portable.png` panels.

- [ ] **Step 7: Commit**

```bash
git add scripts/import-assets.mjs src/lib/images.ts tests/images.test.ts src/assets/
git commit -m "feat: import store assets and add image resolution helper"
```

---

## Task 5: App content entries

**Files:**
- Create: `src/content/apps/my-book-trail.md`, `src/content/apps/pure-mathematics-sinhala.md`

- [ ] **Step 1: Write the My Book Trail entry**

Copy is taken from the existing `MyBookTrail/store/site/index.html`, which is the owner's own wording.

`src/content/apps/my-book-trail.md`:
```markdown
---
name: My Book Trail
tagline: Track every book you've read, are reading, and wishing for.
category: Books & Reference
status: live
order: 1
accent: '#1EB8AC'
accentDeep: '#12201F'
packageId: com.crunchcodelabs.mybooktrail
version: '1.30'
platforms: [android]
playUrl: https://play.google.com/store/apps/details?id=com.crunchcodelabs.mybooktrail
icon: my-book-trail/icon.png
feature: my-book-trail/feature.png
screenshots:
  - my-book-trail/screens/01-your-library.png
  - my-book-trail/screens/02-browse.png
  - my-book-trail/screens/03-every-title.png
  - my-book-trail/screens/04-add-in-seconds.png
  - my-book-trail/screens/05-insights-goals.png
  - my-book-trail/screens/06-organize.png
  - my-book-trail/screens/07-make-it-yours.png
  - my-book-trail/screens/08-safe-portable.png
screenshotsTablet:
  - my-book-trail/screens-tablet/01-your-library.png
  - my-book-trail/screens-tablet/02-browse.png
  - my-book-trail/screens-tablet/03-every-title.png
  - my-book-trail/screens-tablet/04-add-in-seconds.png
  - my-book-trail/screens-tablet/05-insights-goals.png
  - my-book-trail/screens-tablet/06-organize.png
  - my-book-trail/screens-tablet/07-make-it-yours.png
  - my-book-trail/screens-tablet/08-safe-portable.png
features:
  - title: Add books in seconds
    body: Search Google Books, scan a barcode, or snap the cover with your camera.
  - title: Shelves and labels
    body: Read, Reading and Wishlist are one tap apart, plus any labels you invent.
  - title: Stats and yearly goals
    body: See what you finished, how fast, and whether you are on pace.
  - title: Yours, on your device
    body: Your library is stored locally, with optional private backup to your own Google Drive.
support:
  email: crunchcodelabs@gmail.com
  donate: https://buymeacoffee.com/crunchcodelabs
privacy: my-book-trail-privacy
terms: my-book-trail-terms
---

My Book Trail is a personal reading tracker for Android. It gives readers a private,
beautifully organised place to catalogue every book they've read, are currently reading,
or want to read next — with covers, star ratings, notes, custom shelves, reading
statistics, and yearly reading goals.

You can add books in seconds by searching Google Books, scanning a barcode, or snapping
the cover with your camera. Your library is stored on your own device and, if you choose,
privately backed up to your own Google Drive account.
```

- [ ] **Step 2: Write the Pure Mathematics Sinhala entry**

This app has no screenshots yet, which exercises the §6.3 empty state. `accent` is provisional pending spec §11.3 — replace it once the launcher icon is sampled.

`src/content/apps/pure-mathematics-sinhala.md`:
```markdown
---
name: Pure Mathematics Sinhala
nativeName: ශුද්ධ ගණිතය සූත්‍ර
tagline: Every A/L Combined Mathematics formula, in Sinhala, in your pocket.
category: Education
status: live
badge: 2.0 in development
order: 2
accent: '#2F6FED'
accentDeep: '#10214A'
packageId: com.crunchcode.puremathematicssinhala
version: '1.12'
platforms: [android]
playUrl: https://play.google.com/store/apps/details?id=com.crunchcode.puremathematicssinhala
icon: pure-mathematics-sinhala/icon.png
screenshots: []
features:
  - title: Fourteen topics
    body: Full formula coverage of the Sri Lankan A/L Combined Mathematics syllabus.
  - title: Written in Sinhala
    body: Every topic in the language students actually sit the paper in.
  - title: Works offline
    body: All content is bundled in the app. No connection needed, ever.
support:
  email: crunchcodelabs@gmail.com
privacy: pure-mathematics-sinhala-privacy
terms: pure-mathematics-sinhala-terms
---

Pure Mathematics Sinhala is a formula reference for the Sri Lankan A/L Combined
Mathematics syllabus, written entirely in Sinhala. Fourteen topics cover the formulas
students need, laid out for fast lookup rather than for reading end to end.

A 2.0 release is in development: a full Jetpack Compose rewrite with dark mode, full-text
search, section bookmarks, and advertising removed entirely.
```

- [ ] **Step 3: Verify both entries parse**

```bash
npx astro sync && npx astro check
```
Expected: no content collection errors. `astro check` may report missing pages — that is expected until Task 8.

- [ ] **Step 4: Commit**

```bash
git add src/content/apps/
git commit -m "content: add My Book Trail and Pure Mathematics Sinhala entries"
```

---

## Task 6: Design tokens, base styles and BaseLayout

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`
- Create: `src/components/Wordmark.astro`, `SiteHeader.astro`, `SiteFooter.astro`
- Create: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Write the tokens**

`src/styles/tokens.css` — values from spec §2, plus the `--rail` decided in Deviations:
```css
:root {
  --accent: #6C63FF;
  --accent-deep: #4B42D6;
  --ink: #141413;
  --ink-2: #3D3D3A;
  --ink-3: #8E8E86;
  --ground: #FAFAF8;
  --surface: #FFFFFF;
  --line: #EDEDE8;
  --rail: #F4F4F2;

  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --font-sinhala: 'Noto Sans Sinhala', var(--font-sans);

  --measure: 68ch;
  --gutter: clamp(20px, 5vw, 40px);
  --radius: 14px;
  --radius-lg: 20px;

  /* Overridden per app page by BaseLayout. */
  --app-accent: var(--accent);
  --app-accent-deep: var(--accent-deep);
  --app-on-deep: #FFFFFF;
}
```

- [ ] **Step 2: Write the base stylesheet**

`src/styles/base.css`:
```css
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }

html { -webkit-text-size-adjust: 100%; }

body {
  font-family: var(--font-sans);
  background: var(--ground);
  color: var(--ink);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

img, picture, svg { display: block; max-width: 100%; height: auto; }

a { color: var(--accent); text-underline-offset: 2px; }

:where(a, button, [tabindex]):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 4px;
}

h1, h2, h3 { line-height: 1.12; letter-spacing: -0.02em; text-wrap: balance; }
p { text-wrap: pretty; }

:lang(si), .sinhala { font-family: var(--font-sinhala); line-height: 1.9; }

.wrap { width: min(1120px, 100% - var(--gutter) * 2); margin-inline: auto; }
.mono { font-family: var(--font-mono); }

.skip {
  position: absolute; left: -9999px;
  background: var(--surface); color: var(--ink);
  padding: 10px 16px; border-radius: 8px; z-index: 100;
}
.skip:focus { left: var(--gutter); top: 12px; }

.visually-hidden {
  position: absolute; width: 1px; height: 1px;
  padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Write the brand components**

`src/components/Wordmark.astro`:
```astro
---
interface Props { onDark?: boolean; }
const { onDark = false } = Astro.props;
---
<span class:list={['wordmark', { dark: onDark }]}>
  <span class="c">crunch</span><span class="d">code</span><span class="l">labs</span>
</span>

<style>
  .wordmark { font-weight: 600; letter-spacing: -0.03em; font-size: 1.0625rem; }
  .c { color: var(--accent); }
  .d { color: var(--ink); }
  .l { color: var(--ink-2); }
  .dark .c, .dark .d { color: #fff; }
  .dark .l { color: rgba(255, 255, 255, 0.72); }
</style>
```

`src/components/SiteHeader.astro`:
```astro
---
import Wordmark from "./Wordmark.astro";

interface Props { onDark?: boolean; }
const { onDark = false } = Astro.props;
const links = [
  { href: '/', label: 'Apps' },
  { href: '/about/', label: 'About' },
  { href: '/support/', label: 'Support' },
];
---
<header class:list={['site-header', { dark: onDark }]}>
  <a href="/" class="brand" aria-label="CrunchCode Labs home">
    <Wordmark onDark={onDark} />
  </a>
  <nav aria-label="Main">
    {links.map((l) => <a href={l.href}>{l.label}</a>)}
  </nav>
</header>

<style>
  .site-header {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; padding: 18px 0; flex-wrap: wrap;
  }
  .brand { text-decoration: none; }
  nav { display: flex; gap: clamp(14px, 3vw, 24px); font-size: 0.875rem; }
  nav a { color: var(--ink-2); text-decoration: none; }
  nav a:hover { color: var(--ink); text-decoration: underline; }
  .dark nav a { color: rgba(255, 255, 255, 0.85); }
  .dark nav a:hover { color: #fff; }
</style>
```

`src/components/SiteFooter.astro`:
```astro
---
import Wordmark from './Wordmark.astro';
const year = new Date().getFullYear();
---
<footer class="site-footer">
  <div class="wrap inner">
    <div>
      <Wordmark />
      <p class="mono tag">// build · ship · iterate</p>
    </div>
    <nav aria-label="Footer">
      <a href="/">Apps</a>
      <a href="/about/">About</a>
      <a href="/support/">Support</a>
      <a href="mailto:crunchcodelabs@gmail.com">crunchcodelabs@gmail.com</a>
    </nav>
  </div>
  <div class="wrap copy">© {year} CrunchCode Labs</div>
</footer>

<style>
  .site-footer { border-top: 1px solid var(--line); margin-top: 64px; padding: 32px 0 48px; }
  .inner { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
  .tag { color: var(--accent); font-size: 0.75rem; margin-top: 6px; }
  nav { display: flex; gap: 20px; flex-wrap: wrap; font-size: 0.8125rem; }
  nav a { color: var(--ink-2); text-decoration: none; }
  nav a:hover { text-decoration: underline; }
  .copy { color: var(--ink-3); font-size: 0.75rem; margin-top: 24px; }
</style>
```

- [ ] **Step 4: Write BaseLayout**

`src/layouts/BaseLayout.astro`. The per-app accent is injected here as inline custom properties, with the text colour measured by `onColor`:
```astro
---
import '../styles/tokens.css';
import '../styles/base.css';
import SiteFooter from '../components/SiteFooter.astro';
import { onColor } from '../lib/contrast';
import { absolute } from '../lib/urls';

interface Props {
  title: string;
  description: string;
  accent?: string;
  accentDeep?: string;
  ogImage?: string;
}
const { title, description, accent, accentDeep, ogImage } = Astro.props;

const canonical = absolute(Astro.url.pathname);
const style = accent && accentDeep
  ? `--app-accent:${accent};--app-accent-deep:${accentDeep};--app-on-deep:${onColor(accentDeep)};`
  : undefined;
---
<!doctype html>
<html lang="en" style={style}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:type" content="website" />
    {ogImage && <meta property="og:image" content={absolute(ogImage)} />}
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="sitemap" href="/sitemap-index.xml" />
  </head>
  <body>
    <a href="#main" class="skip">Skip to content</a>
    <main id="main"><slot /></main>
    <SiteFooter />
  </body>
</html>
```

- [ ] **Step 5: Verify the build compiles**

```bash
npx astro check
```
Expected: no TypeScript errors in the files created so far.

- [ ] **Step 6: Commit**

```bash
git add src/styles/ src/components/Wordmark.astro src/components/SiteHeader.astro src/components/SiteFooter.astro src/layouts/BaseLayout.astro
git commit -m "feat: add design tokens, base styles and site chrome"
```

---

## Task 7: App card, store badges, status chip

**Files:**
- Create: `src/components/StatusChip.astro`, `StoreBadges.astro`, `AppCard.astro`

- [ ] **Step 1: Write StatusChip**

`src/components/StatusChip.astro`:
```astro
---
interface Props { status: 'live' | 'beta' | 'coming-soon'; badge?: string; }
const { status, badge } = Astro.props;
const LABEL = { live: 'Live', beta: 'Beta', 'coming-soon': 'Coming soon' } as const;
---
<span class:list={['chip', status]}>{badge ?? LABEL[status]}</span>

<style>
  .chip {
    display: inline-block; font-size: 0.6875rem; font-weight: 600;
    padding: 4px 10px; border-radius: 999px; white-space: nowrap;
  }
  .live { background: #E7F6EF; color: #146B45; }
  .beta { background: #FFF1DC; color: #8A5316; }
  .coming-soon { background: var(--line); color: var(--ink-2); }
</style>
```

- [ ] **Step 2: Write StoreBadges**

Badges are inline SVG-free text blocks so nothing loads from a CDN (spec §7).

`src/components/StoreBadges.astro`:
```astro
---
interface Props { playUrl?: string; appStoreUrl?: string; name: string; }
const { playUrl, appStoreUrl, name } = Astro.props;
---
<div class="badges">
  {playUrl && (
    <a href={playUrl} class="badge" rel="noopener">
      <span class="small">Get it on</span>
      <span class="big">Google Play</span>
      <span class="visually-hidden">— {name} on Google Play</span>
    </a>
  )}
  {appStoreUrl && (
    <a href={appStoreUrl} class="badge" rel="noopener">
      <span class="small">Download on the</span>
      <span class="big">App Store</span>
      <span class="visually-hidden">— {name} on the App Store</span>
    </a>
  )}
</div>

<style>
  .badges { display: flex; gap: 10px; flex-wrap: wrap; }
  .badge {
    background: var(--ink); color: #fff; text-decoration: none;
    border-radius: 10px; padding: 9px 18px; line-height: 1.25;
  }
  .badge:hover { background: #000; }
  .small { display: block; font-size: 0.625rem; opacity: 0.85; }
  .big { display: block; font-size: 0.875rem; font-weight: 600; }
</style>
```

- [ ] **Step 3: Write AppCard**

`src/components/AppCard.astro`:
```astro
---
import { Image } from 'astro:assets';
import StatusChip from './StatusChip.astro';
import { resolveImage } from '../lib/images';
import { appPath } from '../lib/urls';
import { onColor } from '../lib/contrast';
import type { App } from '../lib/apps';

interface Props { app: App; }
const { app } = Astro.props;
const d = app.data;
const icon = resolveImage(d.icon);
const href = appPath(app.id);
const headerStyle = `background:linear-gradient(140deg, ${d.accent}, ${d.accentDeep});`;
const onHeader = onColor(d.accentDeep);
---
<a class="card" href={href}>
  <div class="head" style={headerStyle}>
    <Image src={icon} alt="" width={72} height={72} class="icon" loading="eager" />
  </div>
  <div class="body">
    <div class="row">
      <h3>{d.name}</h3>
      <StatusChip status={d.status} badge={d.badge} />
    </div>
    {d.nativeName && <p class="native sinhala" lang="si">{d.nativeName}</p>}
    <p class="cat">{d.category}</p>
    <p class="tag">{d.tagline}</p>
    <span class="go" style={`color:${d.accentDeep}`}>View app →</span>
  </div>
</a>

<style>
  .card {
    display: flex; flex-direction: column;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-lg); overflow: hidden; text-decoration: none;
    color: inherit; transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(20, 20, 19, 0.1); }
  .head { display: grid; place-items: center; padding: 28px 0; }
  .icon { border-radius: 22%; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22); }
  .body { padding: 18px 20px 22px; display: flex; flex-direction: column; gap: 4px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  h3 { font-size: 1.0625rem; font-weight: 700; }
  .native { font-size: 0.9375rem; color: var(--ink-2); }
  .cat { font-size: 0.75rem; color: var(--ink-3); }
  .tag { font-size: 0.8125rem; color: var(--ink-2); margin-top: 6px; }
  .go { font-size: 0.8125rem; font-weight: 600; margin-top: 12px; }
</style>
```

- [ ] **Step 4: Verify it type-checks**

```bash
npx astro check
```
Expected: no errors from the three new components.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatusChip.astro src/components/StoreBadges.astro src/components/AppCard.astro
git commit -m "feat: add app card, store badges and status chip"
```

---

## Task 8: Homepage

**Files:**
- Create: `src/pages/index.astro`
- Create: `public/favicon.svg`

- [ ] **Step 1: Write the favicon**

`public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#6C63FF"/>
  <text x="32" y="44" text-anchor="middle" font-family="ui-monospace, monospace"
        font-size="34" font-weight="700" fill="#fff">c</text>
</svg>
```

- [ ] **Step 2: Write the homepage**

`src/pages/index.astro`. Grid sizing follows spec §6.1 — `auto-fit` with a three-column cap, so two apps read as two comfortable cards:
```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import SiteHeader from '../components/SiteHeader.astro';
import AppCard from '../components/AppCard.astro';
import StoreBadges from '../components/StoreBadges.astro';
import { byOrder } from '../lib/apps';

const apps = (await getCollection('apps')).sort(byOrder);
const anyPlay = apps.find((a) => a.data.playUrl)?.data.playUrl;
---
<BaseLayout
  title="CrunchCode Labs — small, sharp mobile apps"
  description="An independent mobile app studio. We build focused Android apps that respect your time, your battery and your data."
>
  <section class="hero">
    <div class="wrap">
      <SiteHeader onDark />
      <div class="grid">
        <div>
          <h1>Apps that feel<br />good to use.</h1>
          <p class="sub">
            An independent studio building focused mobile tools. Private by default,
            free to try, and never in a hurry to sell you anything.
          </p>
          <StoreBadges playUrl={anyPlay} name="CrunchCode Labs apps" />
        </div>
        <div class="phones" aria-hidden="true">
          <div class="phone back"><div class="scr"><i class="t"></i><i class="l w9"></i><i class="l w6"></i><i class="b"></i><i class="l w7"></i></div></div>
          <div class="phone"><div class="scr"><i class="t w4"></i><i class="b tall"></i><i class="l w9"></i><i class="l w7"></i><i class="l w5"></i></div></div>
        </div>
      </div>
    </div>
  </section>

  <section class="apps wrap" aria-labelledby="apps-h">
    <h2 id="apps-h">Our apps</h2>
    <div class="cards">
      {apps.map((app) => <AppCard app={app} />)}
    </div>
  </section>
</BaseLayout>

<style>
  .hero {
    background: radial-gradient(120% 100% at 12% 0%, var(--accent) 0%, #7D74FF 34%, #A9A2FF 62%, var(--ground) 92%);
    padding-bottom: 56px;
  }
  .grid {
    display: grid; grid-template-columns: 1fr auto; gap: 32px;
    align-items: end; padding-top: 40px;
  }
  h1 { font-size: clamp(2.25rem, 6vw, 3.5rem); font-weight: 700; color: #fff; }
  .sub {
    margin: 16px 0 26px; max-width: 38ch; color: #fff;
    font-size: clamp(0.9375rem, 2vw, 1.0625rem);
  }
  .phones { display: flex; gap: 14px; }
  .phone {
    width: 132px; height: 250px; border-radius: 20px; background: var(--ink);
    padding: 6px; box-shadow: 0 22px 48px rgba(30, 25, 90, 0.34); flex-shrink: 0;
  }
  .phone.back { transform: translateY(-22px) rotate(-5deg); }
  .scr {
    height: 100%; border-radius: 15px; padding: 12px 10px;
    background: linear-gradient(165deg, #F4F3FF, #fff);
  }
  .scr i { display: block; border-radius: 3px; }
  .t { height: 8px; width: 55%; background: var(--accent); margin-bottom: 10px; }
  .l { height: 5px; background: #E4E2F6; margin-bottom: 7px; }
  .b { height: 40px; background: #EDEBFF; border-radius: 9px; margin: 12px 0 10px; }
  .b.tall { height: 56px; }
  .w4 { width: 40%; } .w5 { width: 50%; } .w6 { width: 60%; }
  .w7 { width: 70%; } .w9 { width: 90%; }

  .apps { padding: 48px 0 8px; }
  h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 20px; }
  .cards {
    display: grid; gap: 20px;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    max-width: 1120px;
  }

  @media (max-width: 860px) {
    .grid { grid-template-columns: 1fr; }
    .phones { justify-content: flex-start; margin-top: 8px; }
    .phone { width: 108px; height: 204px; }
  }
</style>
```

- [ ] **Step 3: Build and look at it**

```bash
npx astro build
```
Expected: builds with no errors; `dist/index.html` exists.

```bash
npx astro dev
```
Open `http://localhost:4321/` and confirm: gradient hero, two app cards, My Book Trail's card header is teal, Pure Maths shows its `2.0 in development` badge.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro public/favicon.svg
git commit -m "feat: add studio homepage with generated app grid"
```

---

## Task 9: Screenshot rail

Reuses the pre-framed `out/` panels, so the rail adds **no device chrome** (spec §6.3 and Deviations).

**Files:**
- Create: `src/components/ScreenshotRail.astro`

- [ ] **Step 1: Write the component**

`src/components/ScreenshotRail.astro`:
```astro
---
import { Image } from 'astro:assets';
import { resolveImage } from '../lib/images';

interface Props { screenshots: string[]; tablet?: string[]; appName: string; }
const { screenshots, tablet = [], appName } = Astro.props;

const shots = screenshots.map((path, i) => ({
  img: resolveImage(path),
  tabletImg: tablet[i] ? resolveImage(tablet[i]) : undefined,
  alt: `${appName} screenshot ${i + 1}`,
}));
---
{shots.length > 0 && (
  <section class="rail-section" aria-labelledby="shots-h">
    <div class="wrap"><h2 id="shots-h">Take a look inside</h2></div>
    <ul class="rail" tabindex="0" role="list" aria-label={`${appName} screenshots`}>
      {shots.map((s) => (
        <li>
          <Image src={s.img} alt={s.alt} widths={[320, 480, 720]}
                 sizes="(max-width: 640px) 62vw, 300px" loading="lazy" />
        </li>
      ))}
    </ul>
  </section>
)}

<style>
  .rail-section { background: var(--rail); border-block: 1px solid var(--line); padding: 36px 0 40px; }
  h2 { font-size: 1.375rem; font-weight: 700; margin-bottom: 20px; }
  .rail {
    display: flex; gap: 16px; list-style: none; padding: 0 var(--gutter) 8px; margin: 0;
    overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain;
  }
  .rail > li { flex: 0 0 auto; scroll-snap-align: start; }
  .rail :global(img) {
    width: min(62vw, 300px); height: auto; border-radius: var(--radius);
    border: 1px solid var(--line); background: var(--surface);
  }
  .rail:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
</style>
```

The rail is a focusable scroll container, so browsers give it arrow-key scrolling natively — no client JS is needed, which keeps the spec §7 "zero client JS" claim true.

- [ ] **Step 2: Verify the empty state renders nothing**

The `shots.length > 0` guard means an app with no screenshots emits no section and no heading — spec §6.3. This is verified against the real Pure Maths page in Task 10, Step 3.

- [ ] **Step 3: Commit**

```bash
git add src/components/ScreenshotRail.astro
git commit -m "feat: add screenshot rail reusing pre-framed store panels"
```

---

## Task 10: App detail page

**Files:**
- Create: `src/components/FeatureGrid.astro`, `src/components/LegalCards.astro`
- Create: `src/pages/apps/[slug]/index.astro`

- [ ] **Step 1: Write FeatureGrid**

`src/components/FeatureGrid.astro`:
```astro
---
interface Props { features: { title: string; body: string }[]; }
const { features } = Astro.props;
---
<ul class="feats" role="list">
  {features.map((f, i) => (
    <li>
      <span class="n" aria-hidden="true">{i + 1}</span>
      <h3>{f.title}</h3>
      <p>{f.body}</p>
    </li>
  ))}
</ul>

<style>
  .feats {
    display: grid; gap: 16px; list-style: none; padding: 0; margin: 28px 0 0;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  }
  li { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px 20px; }
  .n {
    display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px;
    background: color-mix(in srgb, var(--app-accent) 16%, #fff);
    color: var(--app-accent-deep); font-size: 0.75rem; font-weight: 700; margin-bottom: 10px;
  }
  h3 { font-size: 0.9375rem; font-weight: 600; }
  p { font-size: 0.8125rem; color: var(--ink-2); margin-top: 6px; }
</style>
```

- [ ] **Step 2: Write LegalCards**

Omits a card whose target is unset, so no dead link is ever rendered (spec §9).

`src/components/LegalCards.astro`:
```astro
---
import { privacyPath, termsPath } from '../lib/urls';

interface Props { slug: string; hasPrivacy: boolean; hasTerms: boolean; }
const { slug, hasPrivacy, hasTerms } = Astro.props;

const cards = [
  hasPrivacy && { href: privacyPath(slug), title: 'Privacy Policy' },
  hasTerms && { href: termsPath(slug), title: 'Terms & Conditions' },
].filter(Boolean) as { href: string; title: string }[];
---
{cards.length > 0 && (
  <section class="wrap legal" aria-labelledby="legal-h">
    <h2 id="legal-h">Legal</h2>
    <div class="cards">
      {cards.map((c) => (
        <a href={c.href}>
          <span class="t">{c.title} <span aria-hidden="true">→</span></span>
          <span class="u mono">{c.href}</span>
        </a>
      ))}
    </div>
  </section>
)}

<style>
  .legal { padding: 8px 0 16px; }
  h2 { font-size: 1.375rem; font-weight: 700; margin-bottom: 16px; }
  .cards { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  a {
    display: flex; flex-direction: column; gap: 6px; text-decoration: none; color: inherit;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius); padding: 18px 20px;
  }
  a:hover { border-color: var(--app-accent); }
  .t { font-size: 0.9375rem; font-weight: 600; }
  .t span { color: var(--app-accent); }
  .u { font-size: 0.6875rem; color: var(--ink-3); word-break: break-all; }
</style>
```

- [ ] **Step 3: Write the app detail page**

`src/pages/apps/[slug]/index.astro`:
```astro
---
import { getCollection, render } from 'astro:content';
import { Image } from 'astro:assets';
import BaseLayout from '../../../layouts/BaseLayout.astro';
import SiteHeader from '../../../components/SiteHeader.astro';
import StoreBadges from '../../../components/StoreBadges.astro';
import ScreenshotRail from '../../../components/ScreenshotRail.astro';
import FeatureGrid from '../../../components/FeatureGrid.astro';
import LegalCards from '../../../components/LegalCards.astro';
import { resolveImage } from '../../../lib/images';

export async function getStaticPaths() {
  const apps = await getCollection('apps');
  return apps.map((app) => ({ params: { slug: app.id }, props: { app } }));
}

const { app } = Astro.props;
const d = app.data;
const { Content } = await render(app);
const icon = resolveImage(d.icon);

const PLATFORM = { android: 'Android', ios: 'iOS' } as const;
const chips = [
  d.category,
  d.platforms.map((p) => PLATFORM[p]).join(' · '),
  `v${d.version}`,
].filter(Boolean);
---
<BaseLayout
  title={`${d.name} — CrunchCode Labs`}
  description={d.tagline}
  accent={d.accent}
  accentDeep={d.accentDeep}
>
  <section class="hero">
    <div class="wrap">
      <SiteHeader onDark />
      <nav class="crumb" aria-label="Breadcrumb">
        <a href="/">Apps</a> <span aria-hidden="true">/</span> <span>{d.name}</span>
      </nav>
      <div class="id">
        <Image src={icon} alt={`${d.name} app icon`} width={96} height={96} class="icon" />
        <h1>{d.name}</h1>
        {d.nativeName && <p class="native sinhala" lang="si">{d.nativeName}</p>}
        <p class="tagline">{d.tagline}</p>
        <ul class="chips" role="list">
          {chips.map((c) => <li>{c}</li>)}
          {d.badge && <li>{d.badge}</li>}
        </ul>
        <StoreBadges playUrl={d.playUrl} appStoreUrl={d.appStoreUrl} name={d.name} />
      </div>
    </div>
  </section>

  <ScreenshotRail screenshots={d.screenshots} tablet={d.screenshotsTablet} appName={d.name} />

  <section class="wrap about" aria-labelledby="about-h">
    <h2 id="about-h">About</h2>
    <div class="prose"><Content /></div>
    <FeatureGrid features={d.features} />
  </section>

  <LegalCards slug={app.id} hasPrivacy={Boolean(d.privacy)} hasTerms={Boolean(d.terms)} />
</BaseLayout>

<style>
  .hero {
    background: radial-gradient(105% 135% at 50% -12%,
      var(--app-accent) 0%, var(--app-accent-deep) 52%, var(--ground) 92%);
    padding-bottom: 44px; text-align: center;
  }
  .hero :global(.site-header) { text-align: left; }
  .crumb { font-size: 0.75rem; color: var(--app-on-deep); opacity: 0.85; margin: 18px 0 24px; }
  .crumb a { color: inherit; }
  .id { display: flex; flex-direction: column; align-items: center; }
  .icon { border-radius: 24%; box-shadow: 0 14px 32px rgba(0, 0, 0, 0.3); }
  h1 {
    font-size: clamp(2rem, 5.5vw, 2.75rem); font-weight: 700;
    color: var(--app-on-deep); margin-top: 18px;
  }
  .native { font-size: 1.125rem; color: var(--app-on-deep); opacity: 0.9; margin-top: 8px; }
  .tagline {
    font-size: clamp(0.9375rem, 2vw, 1.0625rem); color: var(--app-on-deep);
    opacity: 0.92; max-width: 44ch; margin: 12px auto 0;
  }
  .chips {
    display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;
    list-style: none; padding: 0; margin: 18px 0 20px;
  }
  .chips li {
    font-size: 0.6875rem; padding: 5px 12px; border-radius: 999px;
    color: var(--app-on-deep);
    background: color-mix(in srgb, var(--app-on-deep) 16%, transparent);
    border: 1px solid color-mix(in srgb, var(--app-on-deep) 28%, transparent);
  }
  .about { padding: 44px 0 8px; }
  h2 { font-size: 1.375rem; font-weight: 700; margin-bottom: 14px; }
  .prose { max-width: var(--measure); color: var(--ink-2); }
  .prose :global(p + p) { margin-top: 14px; }
</style>
```

- [ ] **Step 4: Build and check both app pages**

```bash
npx astro build
```
Expected: `dist/apps/my-book-trail/index.html` and `dist/apps/pure-mathematics-sinhala/index.html` both exist.

```bash
npx astro dev
```
Verify at `http://localhost:4321/apps/my-book-trail/`:
- Hero text is white and legible (its `accentDeep` is `#12201F`, 16.77:1).
- Eight screenshots scroll horizontally, with **no** extra device frame around them.

Verify at `http://localhost:4321/apps/pure-mathematics-sinhala/`:
- **No screenshot section at all** — not an empty band and not a bare heading.
- The Sinhala name renders as glyphs, not boxes. If it shows tofu, Task 12 fixes it.

- [ ] **Step 5: Commit**

```bash
git add src/components/FeatureGrid.astro src/components/LegalCards.astro src/pages/apps/
git commit -m "feat: add generated app detail pages"
```

---

## Task 11: Legal migration and pages

**Files:**
- Create: `scripts/migrate-legal.mjs`
- Create: `src/content/legal/*.md` (4 files)
- Create: `src/layouts/LegalLayout.astro`
- Create: `src/pages/apps/[slug]/privacy.astro`, `src/pages/apps/[slug]/terms.astro`

- [ ] **Step 1: Write the migration script**

Converts the existing My Book Trail HTML to markdown with wording unchanged (spec §6.4).

`scripts/migrate-legal.mjs`:
```js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, '..', 'MyBookTrail', 'store', 'site');
const OUT = join(ROOT, 'src', 'content', 'legal');

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
td.remove(['script', 'style', 'nav']);

const JOBS = [
  { file: 'privacy-policy.html', slug: 'my-book-trail-privacy', kind: 'privacy', title: 'Privacy Policy' },
  { file: 'terms.html',          slug: 'my-book-trail-terms',   kind: 'terms',   title: 'Terms & Conditions' },
];

await mkdir(OUT, { recursive: true });

for (const job of JOBS) {
  const html = await readFile(join(SRC, job.file), 'utf8');
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html;

  // Drop the page's own H1 — LegalLayout renders the title.
  const stripped = body.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');

  const md = td.turndown(stripped).replace(/\n{3,}/g, '\n\n').trim();
  const updated = new Date().toISOString().slice(0, 10);

  const front = [
    '---',
    `app: ${job.slug.replace(/-(privacy|terms)$/, '')}`,
    `kind: ${job.kind}`,
    `title: ${job.title}`,
    `updated: ${updated}`,
    '---',
    '',
  ].join('\n');

  await writeFile(join(OUT, `${job.slug}.md`), front + md + '\n', 'utf8');
  console.log(`wrote ${job.slug}.md (${md.length} chars)`);
}
```

- [ ] **Step 2: Run the migration**

```bash
npm install -D turndown && node scripts/migrate-legal.mjs
```
Expected: `wrote my-book-trail-privacy.md` and `wrote my-book-trail-terms.md`, each several thousand characters.

- [ ] **Step 3: Spot-check the converted output**

```bash
head -40 src/content/legal/my-book-trail-privacy.md
```
Confirm headings survived and the body reads as prose. **Read the whole file before continuing** — wording must be unchanged from the original, and a bad conversion silently mangles a legal document.

- [ ] **Step 4: Write the two Pure Maths legal stubs**

Spec §11.2 records that final copy is the owner's to write. These describe 1.12 as shipped, which is the honest current state, and are flagged for replacement.

`src/content/legal/pure-mathematics-sinhala-privacy.md`:
```markdown
---
app: pure-mathematics-sinhala
kind: privacy
title: Privacy Policy
updated: 2026-09-11
---

> **Draft.** This policy describes version 1.12 as currently published. It must be
> reviewed and replaced by the app owner before the 2.0 release, which removes
> advertising entirely.

## What this app collects

Pure Mathematics Sinhala stores no account, profile, or personal information. All
formula content is bundled inside the app and read from local storage.

## Advertising

Version 1.12 displays advertising supplied by Google AdMob. AdMob may collect device
identifiers for advertising purposes. See
[Google's advertising policies](https://policies.google.com/technologies/partner-sites).

Version 2.0 removes advertising entirely, along with the advertising identifier
permission.

## Contact

Questions or data-deletion requests: crunchcodelabs@gmail.com
```

`src/content/legal/pure-mathematics-sinhala-terms.md`:
```markdown
---
app: pure-mathematics-sinhala
kind: terms
title: Terms & Conditions
updated: 2026-09-11
---

> **Draft.** To be reviewed and replaced by the app owner before the 2.0 release.

## Use of the app

Pure Mathematics Sinhala is provided free of charge as a study aid for the Sri Lankan
A/L Combined Mathematics syllabus. It is offered as-is, without warranty of any kind.

## Accuracy of content

Formula content is provided for reference and revision. While care is taken over
accuracy, the app is not a substitute for official syllabus materials, and no liability
is accepted for errors or for outcomes arising from its use.

## Contact

Questions: crunchcodelabs@gmail.com
```

- [ ] **Step 5: Write LegalLayout**

`src/layouts/LegalLayout.astro`:
```astro
---
import BaseLayout from './BaseLayout.astro';
import SiteHeader from '../components/SiteHeader.astro';
import { appPath } from '../lib/urls';

interface Props {
  appName: string; appSlug: string; title: string;
  updated: Date; accent: string; accentDeep: string;
}
const { appName, appSlug, title, updated, accent, accentDeep } = Astro.props;
const stamp = updated.toISOString().slice(0, 10);
---
<BaseLayout
  title={`${title} — ${appName} — CrunchCode Labs`}
  description={`${title} for ${appName}.`}
  accent={accent}
  accentDeep={accentDeep}
>
  <div class="wrap">
    <SiteHeader />
    <article class="doc">
      <nav class="crumb" aria-label="Breadcrumb">
        <a href="/">Apps</a> <span aria-hidden="true">/</span>
        <a href={appPath(appSlug)}>{appName}</a> <span aria-hidden="true">/</span>
        <span>{title}</span>
      </nav>
      <h1>{title}</h1>
      <p class="meta">{appName} · Last updated <time datetime={stamp}>{stamp}</time></p>
      <div class="prose"><slot /></div>
    </article>
  </div>
</BaseLayout>

<style>
  .doc { padding: 24px 0 8px; max-width: var(--measure); }
  .crumb { font-size: 0.75rem; color: var(--ink-3); margin-bottom: 22px; }
  .crumb a { color: var(--ink-2); }
  h1 { font-size: clamp(1.75rem, 4vw, 2.25rem); font-weight: 700; }
  .meta { font-size: 0.8125rem; color: var(--ink-3); margin-top: 10px; }
  .prose { margin-top: 32px; color: var(--ink-2); font-size: 0.9375rem; }
  .prose :global(h2) { font-size: 1.125rem; color: var(--ink); margin: 32px 0 10px; }
  .prose :global(h3) { font-size: 1rem; color: var(--ink); margin: 24px 0 8px; }
  .prose :global(p) { margin-bottom: 14px; }
  .prose :global(ul), .prose :global(ol) { margin: 0 0 14px 1.25rem; }
  .prose :global(li) { margin-bottom: 6px; }
  .prose :global(blockquote) {
    border-left: 3px solid var(--app-accent); padding: 10px 16px; margin: 0 0 18px;
    background: var(--surface); border-radius: 0 8px 8px 0;
  }
  .prose :global(a) { color: var(--app-accent-deep); }
</style>
```

- [ ] **Step 6: Write the two legal routes**

`src/pages/apps/[slug]/privacy.astro`:
```astro
---
import { getCollection, getEntry, render } from 'astro:content';
import LegalLayout from '../../../layouts/LegalLayout.astro';

export async function getStaticPaths() {
  const apps = await getCollection('apps');
  return apps
    .filter((app) => Boolean(app.data.privacy))
    .map((app) => ({ params: { slug: app.id }, props: { app } }));
}

const { app } = Astro.props;
const entry = await getEntry('legal', app.data.privacy!);
if (!entry) throw new Error(`Missing legal entry "${app.data.privacy}" for app "${app.id}"`);
const { Content } = await render(entry);
---
<LegalLayout
  appName={app.data.name}
  appSlug={app.id}
  title={entry.data.title}
  updated={entry.data.updated}
  accent={app.data.accent}
  accentDeep={app.data.accentDeep}
>
  <Content />
</LegalLayout>
```

`src/pages/apps/[slug]/terms.astro` — identical but for `terms`:
```astro
---
import { getCollection, getEntry, render } from 'astro:content';
import LegalLayout from '../../../layouts/LegalLayout.astro';

export async function getStaticPaths() {
  const apps = await getCollection('apps');
  return apps
    .filter((app) => Boolean(app.data.terms))
    .map((app) => ({ params: { slug: app.id }, props: { app } }));
}

const { app } = Astro.props;
const entry = await getEntry('legal', app.data.terms!);
if (!entry) throw new Error(`Missing legal entry "${app.data.terms}" for app "${app.id}"`);
const { Content } = await render(entry);
---
<LegalLayout
  appName={app.data.name}
  appSlug={app.id}
  title={entry.data.title}
  updated={entry.data.updated}
  accent={app.data.accent}
  accentDeep={app.data.accentDeep}
>
  <Content />
</LegalLayout>
```

- [ ] **Step 7: Build and verify the four legal pages**

```bash
npx astro build && ls dist/apps/*/privacy/index.html dist/apps/*/terms/index.html
```
Expected: four files, one privacy and one terms per app.

- [ ] **Step 8: Commit**

```bash
git add scripts/migrate-legal.mjs src/content/legal/ src/layouts/LegalLayout.astro src/pages/apps/
git commit -m "feat: migrate legal copy and add per-app privacy and terms pages"
```

---

## Task 12: Sinhala font, About, Support, 404

**Files:**
- Create: `src/pages/about.astro`, `src/pages/support.astro`, `src/pages/404.astro`
- Create: `public/fonts/noto-sans-sinhala-subset.woff2`
- Modify: `src/styles/base.css`

- [ ] **Step 1: Add the Sinhala webfont**

Download the Noto Sans Sinhala regular WOFF2 from Google Fonts and place it at
`public/fonts/noto-sans-sinhala-subset.woff2`. It must be **self-hosted** — spec §7 forbids
a runtime CDN dependency.

Append to `src/styles/base.css`:
```css
@font-face {
  font-family: 'Noto Sans Sinhala';
  src: url('/fonts/noto-sans-sinhala-subset.woff2') format('woff2');
  font-weight: 400 700;
  font-display: swap;
  unicode-range: U+0D80-0DFF, U+200C-200D;
}
```

The `unicode-range` means the font downloads **only** for visitors who actually render
Sinhala glyphs — the My Book Trail page never fetches it.

- [ ] **Step 2: Verify the Sinhala name renders**

```bash
npx astro dev
```
At `http://localhost:4321/apps/pure-mathematics-sinhala/`, confirm `ශුද්ධ ගණිතය සූත්‍ර`
renders as Sinhala glyphs rather than boxes, and that the network panel shows the font
fetched on this page but **not** on `/apps/my-book-trail/`.

- [ ] **Step 3: Write the About page**

`src/pages/about.astro`:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import SiteHeader from '../components/SiteHeader.astro';
---
<BaseLayout
  title="About — CrunchCode Labs"
  description="An independent mobile app studio building small, focused Android apps."
>
  <div class="wrap">
    <SiteHeader />
    <article class="doc">
      <p class="kicker mono">// build · ship · iterate</p>
      <h1>A small studio that ships small apps.</h1>
      <div class="prose">
        <p>
          CrunchCode Labs is an independent mobile app studio. We build focused Android
          apps — the kind that do one thing properly rather than ten things adequately.
        </p>
        <p>
          Every app we ship is built on the same three commitments: your data stays on
          your device unless you explicitly choose otherwise, there are no dark patterns
          engineered to keep you opening the app, and nothing is hidden behind a
          subscription you will forget you are paying for.
        </p>
        <p>
          The name is the method. Build the smallest useful version, ship it, then iterate
          on what people actually use rather than what we guessed they would.
        </p>
        <p>
          Questions, bug reports and feature requests all go to
          <a href="mailto:crunchcodelabs@gmail.com">crunchcodelabs@gmail.com</a>, and
          they are read by the person who wrote the code.
        </p>
      </div>
    </article>
  </div>
</BaseLayout>

<style>
  .doc { padding: 32px 0 8px; max-width: var(--measure); }
  .kicker { color: var(--accent); font-size: 0.75rem; margin-bottom: 16px; }
  h1 { font-size: clamp(1.875rem, 5vw, 2.5rem); font-weight: 700; }
  .prose { margin-top: 24px; color: var(--ink-2); }
  .prose p { margin-bottom: 16px; }
</style>
```

- [ ] **Step 4: Write the Support page**

`src/pages/support.astro`:
```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import SiteHeader from '../components/SiteHeader.astro';
import { byOrder } from '../lib/apps';
import { appPath } from '../lib/urls';

const apps = (await getCollection('apps')).sort(byOrder);
const donate = apps.find((a) => a.data.support.donate)?.data.support.donate;
---
<BaseLayout
  title="Support — CrunchCode Labs"
  description="Get help with a CrunchCode Labs app, or request deletion of your data."
>
  <div class="wrap">
    <SiteHeader />
    <article class="doc">
      <h1>Support</h1>
      <div class="prose">
        <p>
          Email <a href="mailto:crunchcodelabs@gmail.com">crunchcodelabs@gmail.com</a> for
          anything: a bug, a feature request, or a data-deletion request. Naming the app
          and your Android version in the first line gets you a faster answer.
        </p>
      </div>

      <h2>Per app</h2>
      <ul class="apps" role="list">
        {apps.map((a) => (
          <li>
            <div>
              <a class="name" href={appPath(a.id)}>{a.data.name}</a>
              <p class="meta mono">{a.data.packageId} · v{a.data.version}</p>
            </div>
            <a class="mail" href={`mailto:${a.data.support.email}?subject=${encodeURIComponent(`${a.data.name} — support`)}`}>
              Email about {a.data.name}
            </a>
          </li>
        ))}
      </ul>

      {donate && (
        <>
          <h2>Support the work</h2>
          <div class="prose">
            <p>
              These apps are free and carry no subscription. If one of them has been
              useful, <a href={donate} rel="noopener">buying a coffee</a> is a kind way
              to say so.
            </p>
          </div>
        </>
      )}
    </article>
  </div>
</BaseLayout>

<style>
  .doc { padding: 32px 0 8px; max-width: var(--measure); }
  h1 { font-size: clamp(1.875rem, 5vw, 2.5rem); font-weight: 700; }
  h2 { font-size: 1.25rem; font-weight: 700; margin: 36px 0 14px; }
  .prose { margin-top: 20px; color: var(--ink-2); }
  .prose p { margin-bottom: 16px; }
  .apps { list-style: none; padding: 0; display: grid; gap: 12px; }
  .apps li {
    display: flex; justify-content: space-between; align-items: center; gap: 16px;
    flex-wrap: wrap; background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius); padding: 16px 18px;
  }
  .name { font-weight: 600; color: var(--ink); text-decoration: none; }
  .meta { font-size: 0.6875rem; color: var(--ink-3); margin-top: 4px; }
  .mail { font-size: 0.8125rem; font-weight: 600; }
</style>
```

- [ ] **Step 5: Write the 404 page**

`src/pages/404.astro`:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import SiteHeader from '../components/SiteHeader.astro';
---
<BaseLayout title="Page not found — CrunchCode Labs" description="That page does not exist.">
  <div class="wrap">
    <SiteHeader />
    <div class="mid">
      <p class="mono code">// 404</p>
      <h1>That page does not exist.</h1>
      <p class="sub">It may have moved, or it may never have existed in the first place.</p>
      <a class="btn" href="/">Back to the apps</a>
    </div>
  </div>
</BaseLayout>

<style>
  .mid { padding: 80px 0 120px; max-width: 46ch; }
  .code { color: var(--accent); font-size: 0.8125rem; margin-bottom: 14px; }
  h1 { font-size: clamp(1.625rem, 4.5vw, 2.25rem); font-weight: 700; }
  .sub { color: var(--ink-2); margin-top: 12px; }
  .btn {
    display: inline-block; margin-top: 26px; background: var(--accent); color: #fff;
    text-decoration: none; font-size: 0.875rem; font-weight: 600;
    padding: 11px 22px; border-radius: 10px;
  }
</style>
```

- [ ] **Step 6: Build and verify**

```bash
npx astro build && ls dist/about/index.html dist/support/index.html dist/404.html
```
Expected: all three exist.

- [ ] **Step 7: Commit**

```bash
git add public/fonts/ src/styles/base.css src/pages/about.astro src/pages/support.astro src/pages/404.astro
git commit -m "feat: add Sinhala webfont, about, support and 404 pages"
```

---

## Task 13: Build verification

Turns spec §12's acceptance criteria into an executable check that runs on every build.

**Files:**
- Create: `scripts/verify-build.mjs`

- [ ] **Step 1: Write the verifier**

`scripts/verify-build.mjs`:
```js
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const files = await walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const rel = (f) => f.slice(DIST.length).replace(/\\/g, '/');

// 1. Required pages exist (spec §4).
for (const page of ['/index.html', '/about/index.html', '/support/index.html', '/404.html']) {
  check(files.some((f) => rel(f) === page), `Missing required page: ${page}`);
}

// 2. Every app has a detail page; every declared legal ref has a page (spec §12.2, §12.3).
const appDirs = files
  .filter((f) => /^\/apps\/[^/]+\/index\.html$/.test(rel(f)))
  .map((f) => rel(f).split('/')[2]);
check(appDirs.length > 0, 'No app detail pages were generated');
for (const slug of appDirs) {
  check(
    files.some((f) => rel(f) === `/apps/${slug}/privacy/index.html`),
    `App "${slug}" has no privacy page`,
  );
}

// 3. Internal links resolve (spec §12.1).
const pageExists = (href) => {
  const path = href.split('#')[0].split('?')[0];
  if (path === '/' ) return files.some((f) => rel(f) === '/index.html');
  const asDir = `${path.replace(/\/$/, '')}/index.html`;
  return files.some((f) => rel(f) === asDir || rel(f) === path);
};

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  for (const m of html.matchAll(/href="(\/[^"#][^"]*)"/g)) {
    const href = m[1];
    if (href.startsWith('//')) continue;
    if (extname(href)) {
      check(files.some((f) => rel(f) === href), `${rel(file)} links to missing asset ${href}`);
    } else {
      check(pageExists(href), `${rel(file)} links to missing page ${href}`);
    }
  }
}

// 4. No page ships an unresolved base path or localhost reference.
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  check(!html.includes('localhost:4321'), `${rel(file)} contains a localhost URL`);
}

// 5. Image budget — the optimizer should have beaten the 3.8MB source set (spec §7).
const images = files.filter((f) => /\.(png|jpe?g|webp|avif)$/i.test(f));
let bytes = 0;
for (const f of images) bytes += (await stat(f)).size;
const mb = bytes / 1024 / 1024;
console.log(`Images: ${images.length} files, ${mb.toFixed(2)} MB`);
check(mb < 6, `Image payload is ${mb.toFixed(2)} MB — investigate before shipping`);

if (errors.length) {
  console.error(`\nBuild verification FAILED (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`\nBuild verification passed: ${htmlFiles.length} pages, ${appDirs.length} apps.`);
```

- [ ] **Step 2: Run the full build with verification**

```bash
npm run build
```
Expected: `Build verification passed: 9 pages, 2 apps.` and exit code 0.

- [ ] **Step 3: Prove the verifier actually catches breakage**

Temporarily add a bad link to `src/pages/about.astro` — inside the `.prose` div, add:
```html
<p><a href="/does-not-exist/">broken</a></p>
```
Then:
```bash
npm run build
```
Expected: FAIL with `about/index.html links to missing page /does-not-exist/` and exit code 1.

**Remove the bad link** and re-run `npm run build` to confirm it passes again. A verifier that has never failed is not a verifier.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-build.mjs package.json
git commit -m "feat: add post-build link and asset verification"
```

---

## Task 14: GitHub Pages deployment

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `public/robots.txt`

- [ ] **Step 1: Write robots.txt**

`public/robots.txt`:
```
User-agent: *
Allow: /

Sitemap: https://crunchcodelabs.github.io/sitemap-index.xml
```

- [ ] **Step 2: Write the workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`npm test` runs before `npm run build`, so a schema or contrast regression fails the deploy rather than shipping.

- [ ] **Step 3: Verify the workflow parses and the build is reproducible**

```bash
npm ci && npm test && npm run build
```
Expected: tests pass, build passes verification. This is exactly what CI will run.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml public/robots.txt
git commit -m "ci: add GitHub Pages deployment workflow"
```

- [ ] **Step 5: Owner action — create the remote and enable Pages**

These steps need the owner's GitHub account and are **not** done by the implementing agent:

1. Create a GitHub organization named `crunchcodelabs`.
2. Create a public repository `crunchcodelabs.github.io` inside it.
3. `git remote add origin https://github.com/crunchcodelabs/crunchcodelabs.github.io.git`
4. `git push -u origin main`
5. Repository → Settings → Pages → Source: **GitHub Actions**.
6. Confirm the site is live at `https://crunchcodelabs.github.io/`.

---

## Task 15: Accessibility and performance pass

**Files:**
- Modify: whichever files the audit implicates

- [ ] **Step 1: Verify contrast of everything sitting on an accent**

```bash
npx vitest run tests/contrast.test.ts
```
Then confirm by eye in the browser that hero text on both app pages is legible. The
measured basis: My Book Trail's deep `#12201F` gives white 16.77:1; the studio's deep
`#4B42D6` gives white 6.89:1. Neither hero puts body text on the flat accent, which would
be 4.32:1 for indigo and 2.47:1 for teal.

- [ ] **Step 2: Run Lighthouse against the built site**

```bash
npm run build && npx astro preview
```
In Chrome DevTools → Lighthouse, audit `http://localhost:4321/` and
`http://localhost:4321/apps/my-book-trail/`.

Expected (spec §12.6): Performance ≥ 95, Accessibility 100.

Record any failure and fix it before continuing. The most likely findings, and their fixes:
- *Image elements do not have explicit width and height* → add `width`/`height` to the
  `<Image>` in `ScreenshotRail.astro`.
- *Largest Contentful Paint image was lazily loaded* → set `loading="eager"` and
  `fetchpriority="high"` on the app-page hero icon.

- [ ] **Step 3: Check the three required viewports**

In DevTools device toolbar, check `/` and `/apps/my-book-trail/` at **320px**, **768px**
and **1440px** (spec §12.7).

At every width confirm: no horizontal scrollbar on `<body>` (the screenshot rail scrolls
inside itself), the hero headline does not overflow, and the app grid reflows rather than
squashing.

- [ ] **Step 4: Keyboard-only pass**

Tab through the homepage and one app page. Confirm: the skip link appears first and works,
every link shows a visible focus ring, the screenshot rail can be focused and scrolled with
arrow keys, and focus order follows reading order.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address accessibility and performance audit findings"
```

---

## Self-review

**Spec coverage.** §1 goals → Tasks 5, 8, 10, 11. §2 brand → Task 6. §3 visual direction →
Tasks 6–10. §4 routes → Tasks 8, 10, 11, 12, verified in Task 13. §5 content model →
Tasks 3, 4, 5. §6 page designs → Tasks 8–12. §7 stack → Tasks 1, 4, 14. §8 a11y/perf →
Tasks 6, 15. §9 failure modes → Task 3 (schema), Task 4 (missing image), Task 9 (empty
screenshots), Task 10 (absent App Store URL and `nativeName`), Task 11 (omitted legal
cards). §10 scaling triggers → deliberately unbuilt. §11 open items → surfaced in Task 5
(provisional accent), Task 11 Step 4 (draft legal copy) and Task 14 Step 5 (owner actions).
§12 acceptance → Task 13 automates 1–3 and 5; Task 15 covers 6–7; criterion 4 is verified
in Task 10 Step 4 and Task 12 Step 2.

**Placeholder scan.** No TBD, TODO, or "similar to Task N". Every code step carries complete
code. The two Pure Maths legal documents contain real, usable copy rather than a stub, and
carry an explicit draft banner because spec §11.2 assigns the final wording to the owner.

**Type consistency.** `appSchema`/`legalSchema` (Task 3) are the names imported in Task 3's
tests. `resolveImage`/`assetKey` (Task 4) are used in Tasks 7, 9, 10. `byOrder`/`isLaunched`
(Task 3) are used in Tasks 8, 12 — note `isLaunched` is exported and tested but not consumed
by any page, since both current apps are live; it exists for the `coming-soon` case the
schema already supports. `onColor`/`WHITE`/`INK` (Task 2) are used in Tasks 6, 7. `appPath`/
`privacyPath`/`termsPath`/`absolute` (Task 1) are used in Tasks 6, 10, 11, 12. The
`--app-accent`, `--app-accent-deep` and `--app-on-deep` custom properties are declared in
Task 6's tokens and set by `BaseLayout` in the same task; they are consumed in Tasks 10
and 11.
