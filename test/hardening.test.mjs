import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";

import { materialise } from "../dist/core/materialise.js";
import { isInside } from "../dist/core/paths.js";
import { loadConfig } from "../dist/core/resolve.js";

let root;

function write(relative, contents = "x") {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents);
  return file;
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "nma-"));
});

describe("path containment", () => {
  it("accepts a path below the parent", () => {
    assert.equal(isInside("/a", "/a/b"), true);
    assert.equal(isInside("/a", "/a/b/c"), true);
  });

  it("rejects the parent itself", () => {
    // Writing directly to the parent is one of the cases being guarded
    // against, so equality is not containment.
    assert.equal(isInside("/a", "/a"), false);
  });

  it("rejects a path that climbs out", () => {
    assert.equal(isInside("/a", "/a/../b"), false);
    assert.equal(isInside("/a/b", "/a"), false);
    assert.equal(isInside("/a", "/b"), false);
  });

  it("does not mistake a leading dot-dot in a name for climbing", () => {
    assert.equal(isInside("/a", "/a/..config"), true);
  });
});

describe("outDir validation", () => {
  const config = (value) =>
    write(
      "multi-app.config.mjs",
      `export default { apps: { admin: {} }, outDir: ${JSON.stringify(value)} };\n`
    );

  it("accepts a directory inside the repository", async () => {
    config("build/apps");
    const resolved = await loadConfig(root);
    assert.equal(resolved.outDir, "build/apps");
  });

  it("rejects the repository root", async () => {
    // The generated tree carries a .gitignore holding `*`. At the root, that
    // one file would hide the whole repository from git.
    config(".");
    await assert.rejects(loadConfig(root), /must name a directory inside/);
  });

  it("rejects a directory above the repository", async () => {
    config("../elsewhere");
    await assert.rejects(loadConfig(root), /resolves outside it/);
  });
});

describe("adapter file containment", () => {
  const config = (files) => ({
    appsDir: "apps",
    outDir: ".multi-app",
    sharedDirs: [],
    apps: { admin: {} },
    adapter: { name: "rogue", files: () => files },
  });

  beforeEach(() => {
    write("apps/admin/page.tsx");
  });

  it("writes a file nested inside the generated project", () => {
    materialise("admin", config({ "nested/ok.txt": "x" }), root);
    assert.ok(existsSync(path.join(root, ".multi-app/admin/nested/ok.txt")));
  });

  it("refuses a file that escapes the generated project", () => {
    assert.throws(
      () => materialise("admin", config({ "../../escape.txt": "x" }), root),
      /rogue tried to write .* outside the generated project/
    );
    assert.equal(existsSync(path.join(root, "escape.txt")), false);
  });
});
