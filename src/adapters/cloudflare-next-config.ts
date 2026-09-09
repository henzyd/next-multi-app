import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * Applied to the generated Next.js configuration.
 *
 * This lives apart from the adapter factory so that declaring the adapter in
 * `multi-app.config.mjs` does not load `@opennextjs/cloudflare`. Only the
 * generated `next.config.ts` imports this module, and only for applications
 * that deploy to Cloudflare.
 */
export function withCloudflare(config: NextConfig): NextConfig {
  initOpenNextCloudflareForDev();
  return config;
}
