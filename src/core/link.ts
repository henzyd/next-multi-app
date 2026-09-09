import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";

export type LinkMode = "symlink" | "copy";

let cachedMode: LinkMode | undefined;

/**
 * Decides how generated route files point at their sources.
 *
 * Symlinks are strongly preferred: an edit reaches the running dev server with
 * no further work. Windows refuses to create file symlinks without Developer
 * Mode or elevation, so the mode is probed once and falls back to copying,
 * which the watcher then keeps in step.
 */
export function detectLinkMode(scratchDir: string): LinkMode {
  if (cachedMode) return cachedMode;

  const probe = path.join(scratchDir, ".link-probe");
  mkdirSync(scratchDir, { recursive: true });

  try {
    rmSync(probe, { force: true });
    symlinkSync("./nowhere", probe, "file");
    cachedMode = "symlink";
  } catch {
    cachedMode = "copy";
  } finally {
    try {
      rmSync(probe, { force: true });
    } catch {
      // A probe we cannot clean up is harmless; it is a broken link in a
      // generated directory that is rebuilt anyway.
    }
  }

  return cachedMode;
}

/** Only for tests, which need each case in one process. */
export function resetLinkMode(): void {
  cachedMode = undefined;
}

function sameFile(a: string, b: string): boolean {
  try {
    const left = statSync(a);
    const right = statSync(b);
    if (left.size !== right.size) return false;
    return readFileSync(a).equals(readFileSync(b));
  } catch {
    return false;
  }
}

export type FileResult = "unchanged" | "created" | "updated";

/**
 * Points `destination` at `target` and reports what it had to do.
 *
 * The distinction matters to the caller. Under symlinks, both creating a link
 * and repointing one change what the dev server must know about. Under copying,
 * only creation does: rewriting an existing file is an ordinary save that the
 * dev server already watches.
 */
export function materialiseFile(
  destination: string,
  target: string,
  mode: LinkMode
): FileResult {
  const existed = exists(destination);

  if (mode === "copy") {
    if (existed && sameFile(destination, target)) return "unchanged";
    rmSync(destination, { force: true });
    copyFileSync(target, destination);
    return existed ? "updated" : "created";
  }

  const wanted = path.relative(path.dirname(destination), target);

  if (existed) {
    try {
      const stats = lstatSync(destination);
      if (stats.isSymbolicLink() && readlinkSync(destination) === wanted) {
        return "unchanged";
      }
    } catch {
      // Fall through and rebuild the link.
    }
  }

  rmSync(destination, { recursive: true, force: true });
  symlinkSync(wanted, destination, "file");
  return existed ? "updated" : "created";
}

function exists(target: string): boolean {
  try {
    lstatSync(target);
    return true;
  } catch {
    return false;
  }
}

/** True when the entry is a real directory rather than a link or a file. */
export function isRealDirectory(target: string): boolean {
  try {
    const stats = lstatSync(target);
    return !stats.isSymbolicLink() && stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Points a whole directory at `target`. Used only for the repository
 * directories linked beside a generated project, never for route files: a
 * symlinked route directory builds correctly but is invisible to the dev
 * server's watcher, so routes behind one 404 under `next dev`.
 */
export function materialiseDirectoryLink(
  destination: string,
  target: string,
  mode: LinkMode
): void {
  if (mode === "copy") {
    // Copying a whole shared directory per application would be wasteful and
    // would go stale. Leaving it absent is worse. Node can still create
    // directory junctions on Windows without elevation, so try that first.
    try {
      const stats = lstatSync(destination);
      if (stats.isSymbolicLink()) return;
      rmSync(destination, { recursive: true, force: true });
    } catch {
      // Nothing there yet.
    }
    symlinkSync(
      path.relative(path.dirname(destination), target),
      destination,
      "junction"
    );
    return;
  }

  const wanted = path.relative(path.dirname(destination), target);

  try {
    const stats = lstatSync(destination);
    if (stats.isSymbolicLink() && readlinkSync(destination) === wanted) return;
    rmSync(destination, { recursive: true, force: true });
  } catch {
    // Nothing there yet.
  }

  symlinkSync(wanted, destination, "junction");
}

/** Removes a path whether it is a file, a link, or a directory. */
export function remove(target: string): void {
  try {
    const stats = lstatSync(target);
    if (stats.isSymbolicLink()) unlinkSync(target);
    else rmSync(target, { recursive: true, force: true });
  } catch {
    // Already gone.
  }
}
