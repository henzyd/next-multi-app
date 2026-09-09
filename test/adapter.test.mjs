import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";

import cloudflare from "../dist/adapters/cloudflare.js";
import { applyPlan, planOverlay } from "../dist/core/overlay.js";

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

describe("copy fallback", () => {
  // Windows refuses file symlinks without Developer Mode or elevation, so the
  // whole tree is copied instead. These assertions stand in for that platform.
  function build() {
    const out = path.join(root, "out");
    const plan = planOverlay([
      path.join(root, "shared"),
      path.join(root, "app"),
    ]);
    return { out, changed: applyPlan(out, plan, "copy") };
  }

  it("copies file contents rather than linking", () => {
    write("shared/page.tsx", "hello");
    const { out } = build();
    assert.equal(readFileSync(path.join(out, "page.tsx"), "utf8"), "hello");
  });

  it("refreshes a file whose source changed", () => {
    const file = write("shared/page.tsx", "one");
    build();
    writeFileSync(file, "two");
    build();
    assert.equal(readFileSync(path.join(root, "out/page.tsx"), "utf8"), "two");
  });

  it("does not report an edit as a change of shape", () => {
    const file = write("shared/page.tsx", "one");
    build();
    writeFileSync(file, "two");
    // A rewritten file is an ordinary save the dev server already watches.
    // Reporting it would restart the dev server on every keystroke.
    assert.equal(build().changed, false);
  });

  it("reports an added route as a change of shape", () => {
    write("shared/page.tsx");
    build();
    write("shared/api/route.ts");
    assert.equal(build().changed, true);
  });
});

describe("cloudflare adapter", () => {
  const context = () => ({
    projectRoot: root,
    appName: "admin",
    appOptions: {},
    generatedRoot: path.join(root, ".multi-app/admin"),
  });

  it("derives a Worker name from the repository's when none is given", () => {
    write(
      "wrangler.jsonc",
      '{\n  "name": "acme",\n  "main": "./worker.js"\n}\n'
    );
    const files = cloudflare().files(context());
    assert.match(files["wrangler.jsonc"], /"name": "acme-admin"/);
  });

  it("prefers an explicitly configured Worker name", () => {
    write("wrangler.jsonc", '{\n  "name": "acme"\n}\n');
    const files = cloudflare().files({
      ...context(),
      appOptions: { deploy: { name: "acme-console" } },
    });
    assert.match(files["wrangler.jsonc"], /"name": "acme-console"/);
  });

  it("repoints repository-relative paths at the repository", () => {
    write(
      "wrangler.jsonc",
      '{\n  "$schema": "./node_modules/wrangler/config-schema.json",\n  "name": "acme"\n}\n'
    );
    const files = cloudflare().files(context());
    assert.match(
      files["wrangler.jsonc"],
      /"\$schema": "\.\.\/\.\.\/node_modules\/wrangler\/config-schema\.json"/
    );
  });

  it("takes the Worker name from the top level, not from a binding", () => {
    // `name` is a legal key inside a binding. Matching the first one in the
    // text renamed the binding and left the Worker sharing the repository's
    // name, so two applications deployed over each other.
    write(
      "wrangler.jsonc",
      `{
  "durable_objects": {
    "bindings": [{ "name": "COUNTER", "class_name": "Counter" }]
  },
  "name": "acme"
}
`
    );
    const config = JSON.parse(cloudflare().files(context())["wrangler.jsonc"]);
    assert.equal(config.name, "acme-admin");
    assert.equal(config.durable_objects.bindings[0].name, "COUNTER");
  });

  it("ignores a name written in a comment", () => {
    write(
      "wrangler.jsonc",
      `{
  // "name": "not-the-worker"
  "name": "acme"
}
`
    );
    const config = JSON.parse(cloudflare().files(context())["wrangler.jsonc"]);
    assert.equal(config.name, "acme-admin");
  });

  it("accepts block comments and trailing commas", () => {
    write(
      "wrangler.jsonc",
      `{
  /* the Worker */
  "name": "acme",
  "compatibility_date": "2026-01-01",
}
`
    );
    const config = JSON.parse(cloudflare().files(context())["wrangler.jsonc"]);
    assert.equal(config.name, "acme-admin");
    assert.equal(config.compatibility_date, "2026-01-01");
  });

  it("leaves a string that only looks like a path alone", () => {
    write(
      "wrangler.jsonc",
      `{
  "name": "acme",
  "vars": { "NOTE": "see ./docs for details", "MAIN": "./worker.js" }
}
`
    );
    const config = JSON.parse(cloudflare().files(context())["wrangler.jsonc"]);
    assert.equal(config.vars.NOTE, "see ./docs for details");
    assert.equal(config.vars.MAIN, "../../worker.js");
  });

  it("names the file when it cannot be parsed", () => {
    write("wrangler.jsonc", '{ "name": }');
    assert.throws(
      () => cloudflare().files(context()),
      /wrangler\.jsonc could not be parsed/
    );
  });

  it("emits nothing when the repository has no Worker configuration", () => {
    const files = cloudflare().files(context());
    assert.equal(files["wrangler.jsonc"], undefined);
  });

  it("re-exports the repository's OpenNext configuration", () => {
    write("open-next.config.ts", "export default {};\n");
    const files = cloudflare().files(context());
    assert.match(
      files["open-next.config.ts"],
      /export \{ default \} from "\.\.\/\.\.\/open-next\.config";/
    );
  });

  it("keeps its runtime dependency out of the generated import", () => {
    // The factory must be usable without @opennextjs/cloudflare installed;
    // only the generated next.config imports the module that needs it.
    assert.equal(
      cloudflare().nextConfig.module,
      "next-multi-app/cloudflare/next-config"
    );
  });
});
