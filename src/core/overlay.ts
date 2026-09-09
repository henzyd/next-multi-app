import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  isRealDirectory,
  materialiseFile,
  remove,
  type LinkMode,
} from "./link.js";

/**
 * A directory carrying this file replaces the one it would otherwise merge
 * with, instead of extending it. Nothing below that point is inherited.
 */
export const REPLACE_MARKER = ".override";

export type PlanNode =
  { kind: "file"; target: string } | { kind: "dir"; plan: Plan };

export type Plan = Map<string, PlanNode>;

interface Layer {
  path: string;
  isDirectory: boolean;
}

function isIgnored(name: string): boolean {
  return name.startsWith(".") || name === "node_modules";
}

/**
 * Builds the merged view of an ordered list of source directories, lowest
 * precedence first.
 *
 * Directories are always recreated as real directories and only files are
 * linked. A symlinked route directory builds correctly but is invisible to the
 * dev server's watcher, so a route behind one returns 404 under `next dev`
 * while working in production. Linking at file level keeps both identical.
 *
 * Where a name appears in several sources the highest-precedence side wins.
 * Directories present in more than one source merge, unless the winning side
 * carries the replace marker.
 *
 * `skipPerSource` excludes top-level names from the source at the same index,
 * which is how a shared directory ignores the subdirectories that are
 * themselves applications.
 */
export function planOverlay(
  sources: string[],
  skipPerSource: Array<Set<string> | undefined> = []
): Plan {
  const layers = new Map<string, Layer[]>();

  for (const [index, source] of sources.entries()) {
    if (!existsSync(source)) continue;
    const skip = skipPerSource[index];

    for (const entry of readdirSync(source, { withFileTypes: true })) {
      if (isIgnored(entry.name)) continue;
      if (skip?.has(entry.name)) continue;

      const layer: Layer = {
        path: path.join(source, entry.name),
        isDirectory: entry.isDirectory(),
      };

      const existing = layers.get(entry.name);
      if (existing) existing.push(layer);
      else layers.set(entry.name, [layer]);
    }
  }

  const plan: Plan = new Map();

  for (const [name, stack] of layers) {
    const winner = stack[stack.length - 1];
    if (!winner) continue;

    if (!winner.isDirectory) {
      plan.set(name, { kind: "file", target: winner.path });
      continue;
    }

    const replaces = existsSync(path.join(winner.path, REPLACE_MARKER));
    const directories = replaces
      ? [winner.path]
      : stack.filter((layer) => layer.isDirectory).map((layer) => layer.path);

    plan.set(name, { kind: "dir", plan: planOverlay(directories) });
  }

  return plan;
}

/**
 * Reconciles `destination` with `plan`, touching only what differs, and reports
 * whether the shape of the tree changed.
 *
 * Editing a file behind an existing link changes nothing here and reaches the
 * dev server through the link. Only added or removed entries need the caller to
 * react, which is what keeps saves from restarting the dev server.
 */
export function applyPlan(
  destination: string,
  plan: Plan,
  mode: LinkMode
): boolean {
  let changed = false;

  if (!existsSync(destination)) {
    mkdirSync(destination, { recursive: true });
    changed = true;
  }

  const stale = new Set(readdirSync(destination));

  for (const [name, node] of plan) {
    stale.delete(name);
    const target = path.join(destination, name);

    if (node.kind === "file") {
      const result = materialiseFile(target, node.target, mode);
      // Under copying, rewriting a file is an ordinary save the dev server
      // already watches, so only a new file counts as a change of shape.
      const shapeChanged =
        mode === "copy" ? result === "created" : result !== "unchanged";
      if (shapeChanged) changed = true;
      continue;
    }

    if (existsSync(target) && !isRealDirectory(target)) {
      remove(target);
      changed = true;
    }

    if (applyPlan(target, node.plan, mode)) changed = true;
  }

  for (const name of stale) {
    remove(path.join(destination, name));
    changed = true;
  }

  return changed;
}
