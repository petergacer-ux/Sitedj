import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/preparer-ma-soiree/", "/mentions-legales/"].map((p) => ({ url: `${siteUrl}${p}` }));
}
