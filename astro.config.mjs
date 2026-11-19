import { defineConfig } from "astro/config";

// Production Pages stays at /angela-portfolio. A preview build can set
// ASTRO_BASE (and ASTRO_SITE) without touching the live site config default.
const site = process.env.ASTRO_SITE || "https://laua997.github.io";
const base = process.env.ASTRO_BASE || "/angela-portfolio";

export default defineConfig({
  site,
  base,
  trailingSlash: "always",
});
