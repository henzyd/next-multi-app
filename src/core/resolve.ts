import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isInside } from "./paths.js";
import type { AppOptions, MultiAppConfig, ResolvedConfig } from "../types.js";

const CONFIG_NAMES = ["multi-app.config.mjs", "multi-app.config.js"];

const DEFAULTS = {
  appsDir: "apps",
  outDir: ".multi-app",
  sharedDirs: [
    "components",
    "config",
    "features",
    "hooks",
    "lib",
    "public",
    "types",
  ],
} as const;

export class ConfigError extends Error {}

function configPathIn(directory: string): string | undefined {
  for (const name of CONFIG_NAMES) {
    const candidate = path.join(directory, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Finds the repository root by walking up from `start`, preferring the nearest
 * directory holding a config file and falling back to the nearest package.
 */
export function findProjectRoot(start: string = process.cwd()): string {
  const from = path.resolve(start);

  for (let dir = from; ;) {
    if (configPathIn(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  for (let dir = from; ;) {
    if (existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return from;
    dir = parent;
  }
}

/** True when the repository also has a conventional single application. */
export function hasSingleApp(projectRoot: string): boolean {
  return (
    existsSync(path.join(projectRoot, "app")) ||
    existsSync(path.join(projectRoot, "src", "app"))
  );
}

function assertPlainObject(
  value: unknown,
  what: string
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConfigError(`${what} must be an object.`);
  }
}

export async function loadConfig(projectRoot: string): Promise<ResolvedConfig> {
  const file = configPathIn(projectRoot);

  // A repository with no config is a single-application repository. That is a
  // valid state, not an error: the package should stay invisible until an
  // application is declared.
  const raw: MultiAppConfig = file ? await importConfig(file) : { apps: {} };

  assertPlainObject(raw, "The configuration");
  assertPlainObject(raw.apps ?? {}, "`apps`");

  const apps = (raw.apps ?? {}) as Record<string, AppOptions>;

  for (const [name, options] of Object.entries(apps)) {
    assertPlainObject(options, `apps.${name}`);
    if (name.startsWith(".") || name.includes("/") || name.includes("\\")) {
      throw new ConfigError(
        `Application name ${JSON.stringify(name)} must be a single directory name.`
      );
    }
  }

  const defaults = Object.entries(apps).filter(([, o]) => o.default);
  if (defaults.length > 1) {
    throw new ConfigError(
      `More than one application is marked default: ${defaults
        .map(([name]) => name)
        .join(", ")}.`
    );
  }

  const outDir = raw.outDir ?? DEFAULTS.outDir;

  // The generated tree is written, rewritten and cleaned here, and a
  // .gitignore holding `*` is placed at its top. Pointed at the repository
  // root, that one file would hide the whole repository from git.
  if (!isInside(projectRoot, path.resolve(projectRoot, outDir))) {
    throw new ConfigError(
      `\`outDir\` must name a directory inside the repository, and not the ` +
        `repository root itself. ${JSON.stringify(outDir)} resolves outside it.`
    );
  }

  return {
    appsDir: raw.appsDir ?? DEFAULTS.appsDir,
    outDir,
    sharedDirs: raw.sharedDirs ?? [...DEFAULTS.sharedDirs],
    apps,
    adapter: raw.adapter,
  };
}

async function importConfig(file: string): Promise<MultiAppConfig> {
  const loaded: unknown = await import(pathToFileURL(file).href);
  const value = (loaded as { default?: unknown }).default;

  if (!value) {
    throw new ConfigError(`${path.basename(file)} must have a default export.`);
  }

  return value as MultiAppConfig;
}

/**
 * The application to build when none is named: the single application if the
 * repository still has one, then the one marked default, then the only one.
 */
export function defaultAppName(
  config: ResolvedConfig,
  projectRoot: string
): string | undefined {
  if (hasSingleApp(projectRoot)) return SINGLE_APP;

  const marked = Object.entries(config.apps).find(([, o]) => o.default);
  if (marked) return marked[0];

  const names = Object.keys(config.apps);
  return names.length === 1 ? names[0] : undefined;
}

/** Reserved name for the application living at the repository root. */
export const SINGLE_APP = "default";
