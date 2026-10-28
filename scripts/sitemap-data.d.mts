export function sitemapSlug(label: string): string;
export const accountSitemapRoutes: Array<{ loc: string; changefreq: string; priority: string }>;
export function categorySitemapRoutes(): Array<{ loc: string; changefreq: string; priority: string }>;
export function readSitemapPages<T>(queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, pageSize?: number): Promise<T[]>;