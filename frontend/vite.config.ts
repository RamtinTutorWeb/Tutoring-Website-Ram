import { defineConfig, loadEnv, type Plugin } from "vite";

/** Public, indexable routes (everything else is behind sign-in or a one-off flow). */
const PUBLIC_ROUTES = ["/", "/courses", "/exam-prep", "/resources", "/assessment", "/contact", "/book", "/policy"];

/**
 * SEO files that need the live origin: absolute og:image/og:url in index.html,
 * plus robots.txt and sitemap.xml. Set VITE_SITE_URL (e.g. https://tutorpro.com) at build;
 * without it, previews use a relative image and no sitemap is emitted.
 */
function seo(siteUrl: string): Plugin {
  const origin = siteUrl.replace(/\/+$/, "");
  return {
    name: "tutorpro-seo",
    transformIndexHtml(html) {
      const image = `${origin}/og-image.jpg`;
      return html
        .replace("__OG_IMAGE__", image)
        .replace("__OG_URL__", origin ? `${origin}/` : "/");
    },
    generateBundle() {
      const disallow = ["/dashboard", "/profile", "/settings", "/students", "/sign-in", "/sign-up"]
        .map((path) => `Disallow: ${path}`)
        .join("\n");
      const sitemapLine = origin ? `\nSitemap: ${origin}/sitemap.xml\n` : "\n";
      this.emitFile({ type: "asset", fileName: "robots.txt", source: `User-agent: *\n${disallow}\n${sitemapLine}` });
      if (!origin) return;
      const urls = PUBLIC_ROUTES.map((path) => `  <url><loc>${origin}${path === "/" ? "/" : path}</loc></url>`).join("\n");
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [seo((env.VITE_SITE_URL ?? "").trim())],
    server: {
      port: 5173
    }
  };
});
