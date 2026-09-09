# Configuration

The CLI looks for `multi-app.config.mjs` or `multi-app.config.js`, walking up
from the working directory. The nearest one found is the repository root. With
no config file at all, the repository is treated as a single application, which
is a valid state rather than an error.

`defineConfig` is an identity helper. It exists so an editor can complete and
type-check the object without a type annotation.

```js
import { defineConfig } from "next-multi-app";

export default defineConfig({
  apps: {
    customer: { default: true },
    admin: { noindex: true, deploy: { name: "acme-admin" } },
  },
});
```

## Top level

| Key          | Type                         | Default                                                               | Meaning                                              |
| ------------ | ---------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| `apps`       | `Record<string, AppOptions>` | required                                                              | The applications this repository builds              |
| `appsDir`    | `string`                     | `"apps"`                                                              | Where application route trees live                   |
| `outDir`     | `string`                     | `".multi-app"`                                                        | Where generated Next.js projects are written         |
| `sharedDirs` | `string[]`                   | `components`, `config`, `features`, `hooks`, `lib`, `public`, `types` | Repository directories linked into every application |
| `adapter`    | `Adapter`                    | none                                                                  | Deployment target. See [Adapters](adapters.md)       |

### `apps`

A directory inside `appsDir` is an application **only if it is named here**.
Everything else in that directory is shared route content. An application name
must be a single directory name: no slashes, and no leading dot.

### `sharedDirs`

These are the repository directories linked in beside each generated project,
which is why `@/components/ui/button` resolves inside an application exactly as
it does in a single-application repository. Entries that do not exist are
skipped, so the default list is safe even if you have only some of them.

Set it explicitly when your repository uses different names, and include every
directory your route files import through `@/`.

### `outDir`

Generated projects are build output. The directory ignores itself with its own
`.gitignore`, so it never needs adding to yours. Delete it whenever you like;
the next command rebuilds it. Never edit it by hand.

## Per application

| Key       | Type      | Meaning                                                                   |
| --------- | --------- | ------------------------------------------------------------------------- |
| `default` | `boolean` | Selected when no application is named. At most one application may set it |
| `noindex` | `boolean` | Sends `X-Robots-Tag: noindex, nofollow` on every response                 |
| `deploy`  | `object`  | Passed to the adapter. See [Adapters](adapters.md) for the keys it reads  |

`noindex` is for internal surfaces that must never be indexed and are never
linked publicly. It sets a real response header, not just page metadata, so it
covers responses that no page metadata reaches.

## Selection order

With no application named on the command line, the CLI picks, in order:

1. the single application at the repository root, if `app/` or `src/app/` exists;
2. the application marked `default`;
3. the only declared application, if there is exactly one.

If none of those apply it stops and lists what is available, rather than
guessing.

## Validation

The config is checked before anything is generated. These are rejected with a
message naming the problem:

- a config file with no default export;
- `apps`, or any application's options, that is not an object;
- an application name containing a slash or starting with a dot;
- more than one application marked `default`.
