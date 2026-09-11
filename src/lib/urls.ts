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
