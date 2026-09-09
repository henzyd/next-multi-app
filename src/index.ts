import type { MultiAppConfig } from "./types.js";

export type {
  Adapter,
  AdapterCommand,
  AdapterContext,
  AppOptions,
  MultiAppConfig,
  ResolvedConfig,
} from "./types.js";

export { REPLACE_MARKER } from "./core/overlay.js";

/**
 * Identity helper that gives `multi-app.config.mjs` type checking and
 * completion without a type annotation.
 */
export function defineConfig(config: MultiAppConfig): MultiAppConfig {
  return config;
}
