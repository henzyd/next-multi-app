/** Options for one application declared in `multi-app.config.mjs`. */
export interface AppOptions {
  /**
   * Selected when no application is named on the command line. At most one
   * application may set this.
   */
  default?: boolean;
  /**
   * Send `X-Robots-Tag: noindex, nofollow` on every response. Set it for
   * internal surfaces that must never be indexed.
   */
  noindex?: boolean;
  /** Settings read by the configured adapter, such as a deploy target name. */
  deploy?: Record<string, unknown>;
}

/** What an adapter is told about the application being built. */
export interface AdapterContext {
  /** Absolute path to the repository root. */
  projectRoot: string;
  /** Name of the application, as declared in the config. */
  appName: string;
  /** That application's options. */
  appOptions: AppOptions;
  /** Absolute path to the generated Next.js project. */
  generatedRoot: string;
}

/** One process an adapter contributes to a CLI action. */
export interface AdapterCommand {
  /**
   * Module specifier of the executable, resolved from the repository. A path
   * inside the package is appended with `#`, for example
   * `@opennextjs/cloudflare#../cli/index.js`.
   */
  bin: string;
  args: string[];
}

/**
 * Extends the build with a deployment target.
 *
 * Adapters keep host-specific dependencies out of the core, so a project that
 * deploys to Vercel never loads a Cloudflare package.
 */
export interface Adapter {
  name: string;
  /**
   * Wraps the generated Next.js configuration. The generated file imports this
   * statically, so an adapter's dependencies load only for projects using it.
   */
  nextConfig?: {
    /** Module specifier to import from. */
    module: string;
    /** Named export applied to the configuration object. */
    importName: string;
  };
  /** Extra files written into the generated project, keyed by relative path. */
  files?(context: AdapterContext): Record<string, string>;
  /** Extra CLI actions, keyed by action name. */
  actions?(context: AdapterContext): Record<string, AdapterCommand[]>;
}

export interface MultiAppConfig {
  /** Where application route trees live. Defaults to `apps`. */
  appsDir?: string;
  /** Where generated Next.js projects are written. Defaults to `.multi-app`. */
  outDir?: string;
  /**
   * Repository directories linked into every generated project, so `@/…`
   * resolves to the same files it does for a single-application repository.
   * Entries that do not exist are skipped.
   */
  sharedDirs?: string[];
  /** The applications this repository builds. */
  apps: Record<string, AppOptions>;
  /** Optional deployment adapter. */
  adapter?: Adapter;
}

/** Config with defaults applied. */
export interface ResolvedConfig extends Required<
  Omit<MultiAppConfig, "adapter">
> {
  adapter?: Adapter;
}
