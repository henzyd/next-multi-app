import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
  lstatSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

import {
  applyPlan,
  planOverlay,
  REPLACE_MARKER,
} from "../dist/core/overlay.js";

let root;

function write(relative, contents = "x") {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents);
  return file;
}

function build({ shared = root + "/shared", app = root + "/app", skip } = {}) {
  const out = path.join(root, "out");
  const plan = planOverlay([shared, app], skip ? [skip] : []);
  const changed = applyPlan(out, plan, "symlink");
  return { out, changed };
}

function targetOf(file) {
  return path.basename(path.dirname(readlinkSync(file)));
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "nma-"));
});

after(() => {
  // Each test makes its own directory; the OS reclaims the rest.
});

describe("overlay merge", () => {
  it("inherits a path that only the shared side has", () => {
    write("shared/api/health/route.ts");
    write("app/page.tsx");
    const { out } = build();
    assert.ok(
      lstatSync(path.join(out, "api/health/route.ts")).isSymbolicLink()
    );
    assert.ok(lstatSync(path.join(out, "page.tsx")).isSymbolicLink());
  });

  it("lets the application win a file present on both sides", () => {
    write("shared/globals.css", "shared");
    write("app/globals.css", "mine");
    const { out } = build();
    assert.equal(readFileSync(path.join(out, "globals.css"), "utf8"), "mine");
  });

  it("merges a directory present on both sides, per file", () => {
    write("shared/api/health/route.ts", "shared-health");
    write("shared/api/status/route.ts", "shared-status");
    write("app/api/health/route.ts", "mine-health");
    const { out } = build();

    assert.equal(
      readFileSync(path.join(out, "api/health/route.ts"), "utf8"),
      "mine-health"
    );
    assert.equal(
      readFileSync(path.join(out, "api/status/route.ts"), "utf8"),
      "shared-status"
    );
  });

  it("stops inheriting below a directory carrying the replace marker", () => {
    write("shared/api/health/route.ts", "shared-health");
    write("shared/api/status/route.ts", "shared-status");
    write(`app/api/${REPLACE_MARKER}`, "");
    write("app/api/health/route.ts", "mine-health");
    const { out } = build();

    assert.equal(
      readFileSync(path.join(out, "api/health/route.ts"), "utf8"),
      "mine-health"
    );
    assert.throws(() => lstatSync(path.join(out, "api/status/route.ts")));
  });

  it("never links a directory, only files", () => {
    write("shared/api/health/route.ts");
    const { out } = build();
    const api = lstatSync(path.join(out, "api"));
    assert.ok(api.isDirectory() && !api.isSymbolicLink());
  });

  it("skips named entries in the shared source only", () => {
    write("shared/admin/page.tsx", "another app");
    write("shared/api/route.ts");
    write("app/admin/page.tsx", "my own route named after an app");
    const { out } = build({ skip: new Set(["admin"]) });

    assert.equal(
      readFileSync(path.join(out, "admin/page.tsx"), "utf8"),
      "my own route named after an app"
    );
  });
});

describe("change detection", () => {
  it("reports a change on first build and none on a repeat", () => {
    write("shared/page.tsx");
    const first = build();
    assert.equal(first.changed, true);
    assert.equal(build().changed, false);
  });

  it("reports no change when a linked file's contents change", () => {
    const file = write("shared/page.tsx", "one");
    build();
    writeFileSync(file, "two");
    assert.equal(build().changed, false);
  });

  it("reports a change when a route is added", () => {
    write("shared/page.tsx");
    build();
    write("shared/api/route.ts");
    assert.equal(build().changed, true);
  });

  it("reports a change when a route is removed", () => {
    write("shared/page.tsx");
    write("shared/api/route.ts");
    build();
    rmSync(path.join(root, "shared/api"), { recursive: true });
    assert.equal(build().changed, true);
  });

  it("reports a change when an application starts overriding a shared file", () => {
    write("shared/page.tsx", "shared");
    build();
    write("app/page.tsx", "mine");
    const second = build();
    assert.equal(second.changed, true);
    assert.equal(targetOf(path.join(second.out, "page.tsx")), "app");
  });
});
