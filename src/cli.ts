#!/usr/bin/env node
import type { ChildProcess } from "node:child_process";
import path from "node:path";
import type { AdapterContext, ResolvedConfig } from "./types.js";
import { materialise } from "./core/materialise.js";
import {
  ConfigError,
  SINGLE_APP,
  defaultAppName,
  findProjectRoot,
  hasSingleApp,
  loadConfig,
} from "./core/resolve.js";
import { BinaryNotFound, run, watchApps, type Command } from "./core/run.js";

const NEXT = "next/dist/bin/next";
const TSC = "typescript/bin/tsc";

const CORE_ACTIONS: Record<string, Command[]> = {
  build: [{ bin: NEXT, args: ["build"] }],
  dev: [{ bin: NEXT, args: ["dev"] }],
  start: [{ bin: NEXT, args: ["start"] }],
  typecheck: [{ bin: TSC, args: ["--noEmit"] }],
};

function fail(message: string): never {
  console.error(`\nnext-multi-app: ${message}\n`);
  process.exit(1);
}

function listApps(config: ResolvedConfig, projectRoot: string): void {
  console.log("Available applications:");

  if (hasSingleApp(projectRoot)) {
    console.log(
      `- ${SINGLE_APP}: . (single application at the repository root)`
    );
  }

  for (const name of Object.keys(config.apps)) {
    console.log(`- ${name}: ${config.appsDir}/${name}`);
  }

  if (!hasSingleApp(projectRoot) && Object.keys(config.apps).length === 0) {
    console.log(
      `- none. Create app/ or an application under ${config.appsDir}/.`
    );
    return;
  }

  const fallback = defaultAppName(config, projectRoot);
  if (fallback) console.log(`\nUsed when no application is named: ${fallback}`);
}

async function main(): Promise<void> {
  const [action, ...forwarded] = process.argv.slice(2);

  if (!action || action === "--help" || action === "-h") {
    console.log(
      [
        "Usage: next-multi-app <action> [--app <name>] [next options]",
        "",
        "Actions: list, dev, build, start, typecheck, plus any the adapter adds.",
        "The application can also be chosen with the APP env variable.",
      ].join("\n")
    );
    process.exit(action ? 0 : 1);
  }

  const projectRoot = findProjectRoot();

  let config: ResolvedConfig;
  try {
    config = await loadConfig(projectRoot);
  } catch (error) {
    fail(
      error instanceof ConfigError
        ? error.message
        : `Could not read the configuration: ${(error as Error).message}`
    );
  }

  if (action === "list") {
    listApps(config, projectRoot);
    return;
  }

  // A bare `--` is how npm and npx separate their own flags from the ones meant
  // for the command. Passing it on makes Next read it as a project directory.
  const separator = forwarded.indexOf("--");
  if (separator !== -1) forwarded.splice(separator, 1);

  // `--app <name>` is consumed here; everything else is passed through to the
  // underlying tool untouched.
  const flagIndex = forwarded.indexOf("--app");
  let requested = process.env.APP?.trim();
  if (flagIndex !== -1) {
    requested = forwarded[flagIndex + 1];
    forwarded.splice(flagIndex, 2);
  }

  const selected = requested || defaultAppName(config, projectRoot);

  if (!selected) {
    listApps(config, projectRoot);
    fail(
      "no application selected. Name one with --app, or mark one default in " +
        "the configuration."
    );
  }

  let cwd = projectRoot;
  let context: AdapterContext | undefined;
  let refresh: (() => boolean) | undefined;

  if (selected === SINGLE_APP) {
    if (!hasSingleApp(projectRoot)) {
      listApps(config, projectRoot);
      fail("the repository has no app/ or src/app/ directory.");
    }
    console.log("Using the single application at the repository root.");
  } else {
    if (!Object.hasOwn(config.apps, selected)) {
      listApps(config, projectRoot);
      fail(`${JSON.stringify(selected)} is not declared in the configuration.`);
    }

    try {
      const result = materialise(selected, config, projectRoot);
      cwd = result.generatedRoot;
      if (result.mode === "copy") {
        console.log(
          "Symlinks are unavailable here, so route files are copied instead. " +
            "Edits are picked up by the watcher during dev."
        );
      }
    } catch (error) {
      fail((error as Error).message);
    }

    refresh = () => materialise(selected, config, projectRoot).changed;
    const appOptions = config.apps[selected];
    if (appOptions) {
      context = {
        projectRoot,
        appName: selected,
        appOptions,
        generatedRoot: cwd,
      };
    }
    console.log(
      `Using ${JSON.stringify(selected)} from ${config.appsDir}/${selected}.`
    );
  }

  const adapterActions = context
    ? (config.adapter?.actions?.(context) ?? {})
    : {};
  const actions: Record<string, Command[]> = {
    ...CORE_ACTIONS,
    ...adapterActions,
  };

  const commands = actions[action];
  if (!commands) {
    fail(
      `unknown action ${JSON.stringify(action)}. Expected one of: ` +
        `${["list", ...Object.keys(actions)].join(", ")}.`
    );
  }

  const options = {
    cwd,
    projectRoot,
    forwarded,
    env: { ...process.env, APP: selected },
  };

  try {
    if (action === "dev" && refresh) {
      await runDev(commands, options, config, projectRoot, refresh);
      return;
    }

    for (const command of commands) {
      const code = await run(command, options);
      if (code !== 0) process.exit(code);
    }
  } catch (error) {
    if (error instanceof BinaryNotFound) fail(error.message);
    throw error;
  }
}

async function runDev(
  commands: Command[],
  options: {
    cwd: string;
    projectRoot: string;
    forwarded: string[];
    env: NodeJS.ProcessEnv;
  },
  config: ResolvedConfig,
  projectRoot: string,
  refresh: () => boolean
): Promise<void> {
  const command = commands[0];
  if (!command) return;

  let child: ChildProcess | undefined;
  let restarting = false;

  const stopWatching = watchApps(
    path.resolve(projectRoot, config.appsDir),
    refresh,
    () => {
      if (!child) return;
      restarting = true;
      console.log("\nRoutes changed. Restarting the dev server...");
      child.kill("SIGTERM");
    }
  );

  for (;;) {
    restarting = false;
    const code = await run(command, options, (spawned) => {
      child = spawned;
    });
    child = undefined;
    if (restarting) continue;

    stopWatching();
    process.exit(code);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
