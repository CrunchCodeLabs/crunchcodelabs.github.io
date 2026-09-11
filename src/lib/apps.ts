import type { CollectionEntry } from 'astro:content';

export type App = CollectionEntry<'apps'>;

export const byOrder = (a: App, b: App) => a.data.order - b.data.order;
export const isLaunched = (a: App) => a.data.status !== 'coming-soon';
