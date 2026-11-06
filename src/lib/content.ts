import { createReader } from '@keystatic/core/reader';
import type { ImageMetadata } from 'astro';
import keystaticConfig from '../../keystatic.config';

export const reader = createReader(process.cwd(), keystaticConfig);

const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/images/**/*.{png,jpg,jpeg,webp,gif,avif}',
  { eager: true },
);

/** Resolve an image path stored by the admin ("/src/assets/images/...") to Astro image metadata. */
export function img(path: string | null | undefined): ImageMetadata | undefined {
  if (!path) return undefined;
  const key = path.startsWith('/') ? path : `/${path}`;
  const found = images[key]?.default;
  if (!found && import.meta.env.DEV) console.warn(`[content] image not found: ${path}`);
  return found;
}

export const isGif = (path?: string | null) => !!path && /\.gif$/i.test(path);

export async function getSettings() {
  return (await reader.singletons.settings.read())!;
}

export async function getHome() {
  return (await reader.singletons.home.read({ resolveLinkedFiles: true }))!;
}

export async function getProjects() {
  const all = await reader.collections.projects.all();
  return all
    .map((p) => ({ slug: p.slug, ...p.entry }))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export type Project = Awaited<ReturnType<typeof getProjects>>[number];
export type Section = Project['sections'][number];
