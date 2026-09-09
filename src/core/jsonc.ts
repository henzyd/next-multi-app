/**
 * A JSON parser that tolerates the extensions wrangler and other tools allow:
 * line and block comments, and trailing commas.
 *
 * Written by hand rather than taken from a package because this is the only
 * place the package needs it, and a runtime dependency would be loaded by
 * every consumer including those that never touch an adapter.
 */

export class JsoncError extends Error {}

/** Copies a string literal, including its escapes, from `source` at `start`. */
function readString(
  source: string,
  start: number
): { text: string; next: number } {
  let text = source.charAt(start);
  let i = start + 1;

  while (i < source.length) {
    const character = source.charAt(i);
    text += character;
    i += 1;

    if (character === "\\") {
      if (i < source.length) {
        text += source.charAt(i);
        i += 1;
      }
      continue;
    }

    if (character === '"') break;
  }

  return { text, next: i };
}

/** Replaces comments with nothing, leaving string literals untouched. */
function stripComments(source: string): string {
  let out = "";
  let i = 0;

  while (i < source.length) {
    const character = source.charAt(i);

    if (character === '"') {
      const { text, next } = readString(source, i);
      out += text;
      i = next;
      continue;
    }

    if (character === "/" && source.charAt(i + 1) === "/") {
      while (i < source.length && source.charAt(i) !== "\n") i += 1;
      continue;
    }

    if (character === "/" && source.charAt(i + 1) === "*") {
      i += 2;
      while (
        i < source.length &&
        !(source.charAt(i) === "*" && source.charAt(i + 1) === "/")
      ) {
        i += 1;
      }
      i += 2;
      continue;
    }

    out += character;
    i += 1;
  }

  return out;
}

/** Drops a comma that is followed only by whitespace and a closing bracket. */
function stripTrailingCommas(source: string): string {
  let out = "";
  let i = 0;

  while (i < source.length) {
    const character = source.charAt(i);

    if (character === '"') {
      const { text, next } = readString(source, i);
      out += text;
      i = next;
      continue;
    }

    if (character === ",") {
      let ahead = i + 1;
      while (ahead < source.length && /\s/.test(source.charAt(ahead)))
        ahead += 1;
      const following = source.charAt(ahead);
      if (following === "}" || following === "]") {
        i += 1;
        continue;
      }
    }

    out += character;
    i += 1;
  }

  return out;
}

/**
 * Parses JSONC into a plain object.
 *
 * `label` names the file in any error, because the caller reads a file the
 * user wrote and a bare parser message would not say which one.
 */
export function parseJsoncObject(
  source: string,
  label: string
): Record<string, unknown> {
  let value: unknown;

  try {
    value = JSON.parse(stripTrailingCommas(stripComments(source)));
  } catch (error) {
    throw new JsoncError(
      `${label} could not be parsed: ${(error as Error).message}`
    );
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new JsoncError(`${label} must contain a JSON object.`);
  }

  return value as Record<string, unknown>;
}
