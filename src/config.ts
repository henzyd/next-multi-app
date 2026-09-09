import path from "node:path";
import type { NextConfig } from "next";

export interface AppConfigOptions {
  /** Absolute path to the generated project. Pass `__dirname`. */
  root: string;
  /** Relative path from `root` back to the repository root. */
  projectRoot: string;
  /** Send `X-Robots-Tag: noindex, nofollow` on every response. */
  noindex?: boolean;
  /** Merged over the generated configuration. */
  extend?: NextConfig;
}

/**
 * Builds the Next.js configuration for a generated application.
 *
 * Generated `next.config.ts` files call this. It is exported publicly so a
 * project can read what its applications are configured with, but it is not
 * meant to be called by hand.
 */
export function createAppConfig(options: AppConfigOptions): NextConfig {
  const repositoryRoot = path.resolve(options.root, options.projectRoot);

  const config: NextConfig = {
    // The generated project sits below the repository root, and its route
    // files are links to sources above it. Tracing has to start high enough to
    // reach them, or standalone and adapter builds miss files that are really
    // part of the application.
    outputFileTracingRoot: repositoryRoot,
  };

  if (options.noindex) {
    config.headers = async () => [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  }

  return { ...config, ...options.extend };
}
