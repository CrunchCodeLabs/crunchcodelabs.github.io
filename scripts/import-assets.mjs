import { cp, mkdir, readdir, access } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIBLINGS = resolve(ROOT, '..');
const DEST = join(ROOT, 'src', 'assets', 'apps');

const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

const JOBS = [
  {
    slug: 'my-book-trail',
    files: [
      [join(SIBLINGS, 'MyBookTrail/listing-resources/apk-graphics/play_store_512.png'), 'icon.png'],
      [join(SIBLINGS, 'MyBookTrail/listing-resources/apk-graphics/feature-graphic-1024x500.png'), 'feature.png'],
    ],
    dirs: [
      [join(SIBLINGS, 'MyBookTrail/listing-resources/screenshots-mobile'), 'screens'],
      [join(SIBLINGS, 'MyBookTrail/listing-resources/screenshots-tablet'), 'screens-tablet'],
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
    if (!(await exists(src))) {
      missing.push(src);
      continue;
    }
    await cp(src, join(base, name));
    copied++;
    console.log(`  ${job.slug}/${name}`);
  }

  for (const [src, name] of job.dirs) {
    if (!(await exists(src))) {
      missing.push(src);
      continue;
    }
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
