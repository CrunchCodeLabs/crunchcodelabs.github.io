import { cp, mkdir, readdir, access } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

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
      [join(SIBLINGS, 'MyBookTrail/listing-resources/playstore-graphics/app_icon_512x512.png'), 'icon.png'],
      [join(SIBLINGS, 'MyBookTrail/listing-resources/playstore-graphics/feature_graphic_1024x500.png'), 'feature.png'],
    ],
    dirs: [
      [join(SIBLINGS, 'MyBookTrail/listing-resources/screenshots-mobile'), 'screens'],
      [join(SIBLINGS, 'MyBookTrail/listing-resources/screenshots-tablet'), 'screens-tablet'],
    ],
  },
  {
    slug: 'al-pure-mathematics',
    files: [],
    dirs: [
      // Phone mockups only. The tablet set in mockups-2.0/tablet is a phone in a
      // phone frame on a tablet-shaped canvas — fine for a Play tablet slot, but
      // it would add nothing here, and the rail does not render tablet assets.
      [
        join(SIBLINGS, 'PureMathematicsSinhala/listing-resources/mockups-2.0/phone'),
        'screens',
      ],
    ],
    // Play graphics ship as .jfif — JPEG under an extension neither the asset
    // glob nor astro:assets matches. Re-encoded to PNG on import.
    convert: [
      [
        join(SIBLINGS, 'PureMathematicsSinhala/listing-resources/playstore_graphics/app_icon.jfif'),
        'icon.png',
        512,
      ],
      [
        join(
          SIBLINGS,
          'PureMathematicsSinhala/listing-resources/playstore_graphics/feature_graphic.jfif',
        ),
        'feature.png',
        1488,
      ],
    ],
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

  for (const [src, name, width] of job.convert ?? []) {
    if (!(await exists(src))) {
      missing.push(src);
      continue;
    }
    await sharp(src).resize(width, null, { withoutEnlargement: true }).png().toFile(join(base, name));
    copied++;
    console.log(`  ${job.slug}/${name} (re-encoded from ${src.split(/[\\/]/).pop()})`);
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
