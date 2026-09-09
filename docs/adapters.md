# Adapters

An adapter teaches the CLI about a deployment target. It contributes files to
the generated project and extra actions to the CLI.

Adapters exist so host-specific dependencies stay out of the core. A repository
deploying to Vercel never loads a Cloudflare package. Without an adapter you get
`dev`, `build`, `start` and `typecheck`, which is all a Vercel or Node
deployment needs.

**No adapter is active by default.** The package declares no host dependency,
and the Cloudflare adapter is inert until you set `adapter` in your config. Its
one runtime import lives in a separate module that only a generated
`next.config.ts` reaches, so an application that has not opted in never loads
it.

## Cloudflare

```js
import { defineConfig } from "next-multi-app";
import cloudflare from "next-multi-app/cloudflare";

export default defineConfig({
  apps: {
    customer: { default: true },
    admin: { noindex: true, deploy: { name: "acme-admin" } },
  },
  adapter: cloudflare(),
});
```

Requires `@opennextjs/cloudflare` and `wrangler` in your repository.

It adds the `deploy`, `preview`, `upload` and `cf-typegen` actions, and writes
two files into each generated project:

- `wrangler.jsonc`, derived from your own so compatibility dates, flags and
  bindings stay in one place and only the Worker name differs. Your file is
  parsed as JSONC, so comments and trailing commas are fine; the generated copy
  is re-serialised as plain JSON and does not carry your comments across.
- `open-next.config.ts`, re-exporting yours.

### Worker names

An application that names no Worker gets `<your worker>-<app>`. Set one
explicitly with `deploy: { name: "..." }`.

Every application must end up with a distinct name. This is not a style
preference: without its own configuration, wrangler walks up the directory tree
and resolves yours, so deploying an application would publish it over your root
application. The adapter always writes a Worker configuration for exactly this
reason.

### Options

| Option           | Default                 | Meaning                                            |
| ---------------- | ----------------------- | -------------------------------------------------- |
| `openNextConfig` | `"open-next.config.ts"` | Path to your OpenNext config, relative to the root |

## Writing an adapter

An adapter is a plain object. Every field except `name` is optional.

```ts
import type { Adapter } from "next-multi-app";

export default function myHost(): Adapter {
  return {
    name: "my-host",

    // Wraps the generated Next.js configuration. The generated file imports
    // this statically by name, so the module is loaded only by applications
    // that use this adapter.
    nextConfig: {
      module: "my-adapter/next-config",
      importName: "withMyHost",
    },

    // Extra files written into the generated project, keyed by relative path.
    files(context) {
      return { "my-host.json": JSON.stringify({ app: context.appName }) };
    },

    // Extra CLI actions, keyed by action name.
    actions() {
      return { deploy: [{ bin: "my-host-cli", args: ["deploy"] }] };
    },
  };
}
```

`context` carries the repository root, the application's name and options, and
the absolute path to its generated project.

A command's `bin` is a module specifier resolved from the consuming repository.
When the executable is a file inside a package rather than its entry point,
append it after a `#`:

```ts
{ bin: "@opennextjs/cloudflare#../cli/index.js", args: ["deploy"] }
```

### Keep the runtime dependency out of the factory

Put the `nextConfig` hook in a separate module from the adapter factory. The
config file imports the factory, so anything the factory imports is loaded
whenever the CLI runs, even for an application that does not use the adapter.
Only the generated `next.config.ts` imports the hook.

The Cloudflare adapter is split this way: `next-multi-app/cloudflare` has no
Cloudflare imports at all, and `next-multi-app/cloudflare/next-config` has them.
