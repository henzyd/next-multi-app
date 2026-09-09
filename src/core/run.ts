import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, watch, type FSWatcher } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export interface Command {
  /**
   * Module specifier of the executable, resolved from the repository. A path
   * inside the package may follow a `#`, for example
   * `@opennextjs/cloudflare#../cli/index.js`.
   */
  bin: string;
  args: string[];
}

export class BinaryNotFound extends Error {}

/** Resolves an executable from the consuming repository, not from this package. */
export function resolveBin(spec: string, projectRoot: string): string {
  const require = createRequire(pathToFileURL(path.join(projectRoot, "_.js")));
  const [packageSpec, inner] = spec.split("#");

  if (!packageSpec) throw new BinaryNotFound(`Empty command: ${spec}`);

  try {
    const entry = require.resolve(packageSpec);
    return inner ? path.resolve(path.dirname(entry), inner) : entry;
  } catch {
    throw new BinaryNotFound(
      `Could not resolve ${packageSpec} from this repository. Install it first.`
    );
  }
}

export interface RunOptions {
  /** Working directory for the child, usually the generated project. */
  cwd: string;
  /** Where executables are resolved from, always the repository root. */
  projectRoot: string;
  forwarded: string[];
  env: NodeJS.ProcessEnv;
}

export function run(
  command: Command,
  options: RunOptions,
  onSpawn?: (child: ChildProcess) => void
): Promise<number> {
  return new Promise((resolve) => {
    const bin = resolveBin(command.bin, options.projectRoot);

    const child = spawn(
      process.execPath,
      [bin, ...command.args, ...options.forwarded],
      { cwd: options.cwd, env: options.env, stdio: "inherit" }
    );

    onSpawn?.(child);

    const forward = (signal: NodeJS.Signals) => child.kill(signal);
    process.on("SIGINT", forward);
    process.on("SIGTERM", forward);

    child.on("error", (error) => {
      process.off("SIGINT", forward);
      process.off("SIGTERM", forward);
      console.error(error.message);
      resolve(1);
    });

    child.on("close", (code) => {
      process.off("SIGINT", forward);
      process.off("SIGTERM", forward);
      resolve(code ?? 0);
    });
  });
}

/**
 * Watches the applications directory and calls back when the shape of the
 * generated tree changes.
 *
 * Editing a file needs no reaction: under symlinks the change reaches the dev
 * server through the link, and under copying the refresh rewrites the file the
 * dev server is already watching. Only added, removed, or repointed routes
 * matter, because Next does not register a route that appears in a generated
 * project after startup.
 */
export function watchApps(
  appsDir: string,
  refresh: () => boolean,
  onShapeChange: () => void
): () => void {
  if (!existsSync(appsDir)) return () => {};

  let timer: NodeJS.Timeout | undefined;
  let watcher: FSWatcher;

  try {
    watcher = watch(appsDir, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          if (refresh()) onShapeChange();
        } catch (error) {
          console.error(
            `Could not refresh the generated tree: ${(error as Error).message}`
          );
        }
      }, 120);
    });
  } catch {
    console.warn(
      "Could not watch the applications directory. Restart the dev server " +
        "after adding a route."
    );
    return () => {};
  }

  return () => {
    clearTimeout(timer);
    watcher.close();
  };
}
