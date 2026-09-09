# CLI

```bash
next-multi-app <action> [--app <name>] [options passed to the tool]
```

## Actions

| Action      | Runs                                    |
| ----------- | --------------------------------------- |
| `list`      | Prints the applications and the default |
| `dev`       | `next dev` in the generated project     |
| `build`     | `next build`                            |
| `start`     | `next start`                            |
| `typecheck` | `tsc --noEmit`                          |

An adapter can add more. The Cloudflare adapter adds `deploy`, `preview`,
`upload` and `cf-typegen`. An unknown action lists what is actually available.

## Choosing an application

Three ways, in precedence order:

```bash
next-multi-app build --app admin     # explicit flag
APP=admin next-multi-app build       # environment variable
next-multi-app build                 # the default, see Configuration
```

The `APP` variable is the one to use in CI, since it needs no change to the
scripts in `package.json`.

## Passing options through

Everything after the action, apart from `--app <name>`, goes straight to the
underlying tool.

```bash
next-multi-app dev --app admin -p 4000
npm run dev -- --app admin -p 4000
```

Named scripts per application, each pinned to its own port, are in
[Getting started](getting-started.md#running-several-applications).

A bare `--`, which is how npm separates its own flags from yours, is dropped
rather than forwarded. Without that, Next reads it as a project directory and
fails.

## Executable resolution

Next.js, TypeScript and any adapter binaries are resolved from **your**
repository, not from inside this package. So the versions you installed are the
versions that run, and a missing one produces a message naming the package to
install rather than a resolution stack trace.

## Continuous integration

Run one job per application. A failure then names the application it came from,
and a broken application cannot pass by riding on another's build.

```yaml
strategy:
  fail-fast: false
  matrix:
    app: [customer, admin]
steps:
  - run: npm ci
  - run: npm run build
    env:
      APP: ${{ matrix.app }}
```

Building one application never builds another. Each produces its own artifact
under the generated directory.
