import { readFile, readdir, stat, unlink } from 'node:fs/promises';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const errors = [];
const check = (cond, msg) => {
  if (!cond) errors.push(msg);
};

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
  check(
    files.some((f) => rel(f) === page),
    `Missing required page: ${page}`,
  );
}

/*
 * 1b. app-ads.txt must sit at the domain root and parse.
 *
 * Ad-network crawlers fetch it from the root of the developer website named on
 * the Play listing. If it is missing, misnamed or malformed, AdMob and Meta
 * treat the inventory as unauthorized and fill drops — silently, with no build
 * or runtime error anywhere. Hence a build-time check.
 */
/*
 * 1a. .nojekyll must ship at the deploy root.
 *
 * GitHub Pages runs Jekyll over the published output unless this file is
 * present, and Jekyll drops underscore-prefixed directories — which is exactly
 * where Astro puts every hashed asset (/_astro/). Without it the site can
 * deploy "successfully" and serve pages with no CSS and no images.
 */
check(
  files.some((f) => rel(f) === '/.nojekyll'),
  'Missing /.nojekyll — Jekyll would strip the /_astro/ asset directory',
);

const adsFile = files.find((f) => rel(f) === '/app-ads.txt');
check(Boolean(adsFile), 'Missing /app-ads.txt at the site root');
if (adsFile) {
  const lines = (await readFile(adsFile, 'utf8'))
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean);
  check(lines.length > 0, '/app-ads.txt has no records');
  for (const line of lines) {
    const fields = line.split(',').map((f) => f.trim());
    check(
      fields.length >= 3 && /^(DIRECT|RESELLER)$/i.test(fields[2]),
      `/app-ads.txt malformed record: "${line}"`,
    );
  }
}

// 2. Every app has a detail page; every app declaring a policy has one.
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
  if (path === '/') return files.some((f) => rel(f) === '/index.html');
  const asDir = `${path.replace(/\/$/, '')}/index.html`;
  return files.some((f) => rel(f) === asDir || rel(f) === path);
};

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  for (const m of html.matchAll(/href="(\/[^"#][^"]*)"/g)) {
    const href = m[1];
    if (href.startsWith('//')) continue;
    if (extname(href)) {
      check(
        files.some((f) => rel(f) === href),
        `${rel(file)} links to missing asset ${href}`,
      );
    } else {
      check(pageExists(href), `${rel(file)} links to missing page ${href}`);
    }
  }
}

// 4. No page ships a dev-server URL.
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  check(!html.includes('localhost:4321'), `${rel(file)} contains a localhost URL`);
}

// 5. Legal pages: no base64 blob from the migration, and no third-party code.
//    A privacy policy that itself pulls in third-party scripts is a poor look
//    under Play review, so the Buy Me a Coffee additions must stay off these pages.
for (const file of htmlFiles.filter((f) => /\/(privacy|terms)\//.test(rel(f)))) {
  const html = await readFile(file, 'utf8');
  check(!html.includes('data:image'), `${rel(file)} contains an inlined base64 image`);
  check(!/<script/i.test(html), `${rel(file)} contains a <script> tag`);
  check(!/buymeacoffee/i.test(html), `${rel(file)} loads Buy Me a Coffee`);
}

/*
 * 6. Prune orphaned images.
 *
 * Astro emits an original for every asset the content glob matches, even when
 * every page renders only the optimized WebP. Those originals are referenced by
 * nothing and added 5.3MB of dead weight to the deploy. No build flag suppresses
 * them without giving up the content-driven asset model, so they are removed
 * here, once the HTML that would reference them exists.
 */
const textFiles = [...htmlFiles, ...files.filter((f) => f.endsWith('.css'))];
const referenced = new Set();
for (const f of textFiles) {
  const text = await readFile(f, 'utf8');
  for (const m of text.matchAll(/\/_astro\/[A-Za-z0-9._-]+/g)) referenced.add(m[0]);
}

let pruned = 0;
let prunedBytes = 0;
for (const f of files.filter((x) => /\.(png|jpe?g|webp|avif)$/i.test(x))) {
  const r = rel(f);
  if (!r.startsWith('/_astro/')) continue;
  if (referenced.has(r)) continue;
  prunedBytes += (await stat(f)).size;
  await unlink(f);
  pruned++;
}
if (pruned > 0) {
  console.log(`Pruned ${pruned} orphaned image(s), ${(prunedBytes / 1024 / 1024).toFixed(2)} MB`);
}

// 7. Image budget — measured on what actually ships.
const remaining = await walk(DIST);
const images = remaining.filter((f) => /\.(png|jpe?g|webp|avif)$/i.test(f));
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
