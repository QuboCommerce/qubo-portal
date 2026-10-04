import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Rendered per request so public URLs come from runtime env, not the build.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl()}/`, changeFrequency: "weekly", priority: 1 }];
}
