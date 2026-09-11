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
