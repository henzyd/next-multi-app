# Contributing

Thanks for taking an interest. This is a small package with a deliberately
small surface, so the bar for a change is that it earns its place.

## Setup

Node 20.19 or newer. The package is ESM and has no runtime dependencies; keep
it that way.

```bash
git clone git@github.com:henzyd/next-multi-app.git
cd next-multi-app
npm install
npm run check
```

`npm run check` is the whole gate: formatting, type checking, a build, and the
test suite. Run it before you open a pull request. Continuous integration runs
the same command, so a green local run is a green build.

## Layout

| Path            | What lives there                                      |
| --------------- | ----------------------------------------------------- |
| `src/cli.ts`    | Argument parsing and the action table                 |
| `src/core/`     | Resolution, the overlay, linking, and process running |
| `src/adapters/` | Deployment targets, one directory entry per host      |
| `test/`         | Node's built-in test runner, one file per area        |
| `docs/`         | The guides, which are part of the product             |

Read [docs/how-it-works.md](docs/how-it-works.md) before changing anything in
`src/core/`. Two of its decisions look arbitrary and are not: route directories
are never symlinked, and the link mode is probed rather than chosen from the
platform name.

## Changes that need a discussion first

Open an issue before writing code if the change would:

- add a runtime dependency;
- change the shape of `multi-app.config.mjs`;
- change what the generated project contains;
- add a CLI action or flag.

Everything else, including bug fixes, documentation, and tests, is welcome as a
pull request directly.

## Adapters

An adapter keeps host-specific dependencies out of the core, and no adapter is
active unless a repository asks for it. If you add one, split the factory from
the `nextConfig` hook so that importing the factory pulls in nothing from the
host. [docs/adapters.md](docs/adapters.md) explains the split and why it
matters.

## Tests

Tests use `node --test` with no framework. Cover the behaviour, not the
implementation: a test that asserts which files were written is more useful
than one that asserts which function was called.

Platform behaviour is the weak spot. Copy mode is unit tested but has not run
on Windows, and Linux has not been verified. If you are on either, running the
suite and reporting what you see is a genuinely useful contribution.

## Pull requests

- Branch from `main`. Direct pushes to `main` are not accepted.
- Keep one concern per pull request.
- Update the guide in `docs/` that your change makes wrong. Documentation drift
  is treated as a defect.
- Write the commit subject in the imperative, under about seventy characters.

## Releases

Maintainers only. Bump the version, confirm `npm run check` and `npx publint`
are clean, then publish. `prepublishOnly` rebuilds `dist`, so the tarball always
matches the tag.

## Licence

Contributions are accepted under the [MIT licence](LICENSE).
