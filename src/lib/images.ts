export function assetKey(relPath: string): string {
  const clean = relPath.replace(/^\/+/, '');
  if (clean.split('/').includes('..')) {
    throw new Error(`Path traversal is not allowed in asset path: ${relPath}`);
  }
  return `/src/assets/apps/${clean}`;
}

/*
 * Lazy, not eager. An eager glob makes Vite emit every file under
 * src/assets/apps into dist whether or not a page renders it — that shipped
 * 5.3MB of orphaned PNGs that no HTML referenced. Loading on demand emits only
 * what is actually used.
 */
const assets = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/apps/**/*.{png,jpg,jpeg,webp,avif}',
);

/** Resolve a content-relative asset path. Throws at build time when missing (spec §9). */
export async function resolveImage(relPath: string): Promise<ImageMetadata> {
  const key = assetKey(relPath);
  const load = assets[key];
  if (!load) {
    throw new Error(
      `Image not found: ${relPath}\nExpected a file at ${key}.\n` +
        `Available: ${Object.keys(assets).join(', ') || '(none)'}`,
    );
  }
  return (await load()).default;
}
