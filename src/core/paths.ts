import path from "node:path";

/**
 * True when `child` resolves to a location strictly below `parent`.
 *
 * Generated output is written, rewritten and deleted, so both callers need to
 * know that a configured or adapter-supplied path has not escaped the
 * directory that owns it. A path equal to `parent` is not inside it: writing
 * directly to the parent is one of the cases being guarded against.
 */
export function isInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));

  if (relative === "") return false;
  if (path.isAbsolute(relative)) return false;
  if (relative === ".." || relative.startsWith(`..${path.sep}`)) return false;

  return true;
}
