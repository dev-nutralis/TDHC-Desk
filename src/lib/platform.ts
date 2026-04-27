// Platform ID resolver with in-memory cache (server-side only)
import { prisma } from "@/lib/prisma";

const cache = new Map<string, string>();

export async function getPlatformId(slug: string): Promise<string | null> {
  if (cache.has(slug)) return cache.get(slug)!;
  const platform = await prisma.platform.findUnique({ where: { slug } });
  if (platform) cache.set(slug, platform.id);
  return platform?.id ?? null;
}

export async function getPlatformSlug(id: string): Promise<string | null> {
  // reverse lookup
  for (const [slug, pid] of cache) {
    if (pid === id) return slug;
  }
  const platform = await prisma.platform.findUnique({ where: { id } });
  if (platform) cache.set(platform.slug, platform.id);
  return platform?.slug ?? null;
}
