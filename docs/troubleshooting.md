# Troubleshooting

## A route 404s in dev but works after a build

This is the failure mode the design exists to prevent, so it should not happen.
If it does, check whether something in the generated tree is a symlinked
_directory_ rather than a real directory of linked files. A symlinked route
directory is invisible to the dev server's watcher.

Delete the generated directory and let the next command rebuild it.

## A newly added route 404s until I restart

The dev server should restart itself within a second or two of the file
appearing, logging that routes changed. If it does not, the watcher could not
start, and the CLI will have warned about that on startup.

Recursive directory watching is unavailable on some network and container
filesystems. Restart the dev server manually after adding a route.

## `Could not resolve <package> from this repository`

Executables are resolved from your repository, not from inside this package.
Install the named package. For adapter actions this usually means the adapter's
own dependencies, such as `@opennextjs/cloudflare` and `wrangler`.

## `Package subpath './config' is not defined by exports`

The generated `next.config.ts` could not load this package. That means the
installed copy is older than the generated file expects. Delete the generated
directory and rebuild.

## Type errors naming files outside the application

The generated `tsconfig.json` restates `include` and `exclude` rather than
inheriting them. TypeScript resolves an inherited `include` relative to the
configuration that declared it, so inheriting yours would pull your whole
repository into the application's type check.

If you see this, the generated tsconfig is stale or was edited. Delete the
generated directory and rebuild.

## `@/...` imports do not resolve

The directory holding them is probably not in `sharedDirs`. It defaults to a
common set, and anything not listed is not linked into the generated project.
Add it and rebuild. See [Configuration](configuration.md).

## Deploying one application published over another

Every application needs a distinct deployment name. With the Cloudflare adapter,
an application that names no Worker gets `<your worker>-<app>`, which is already
distinct. If you set names explicitly, check they differ.

## Symlinks are unavailable, so route files are copied

Expected on Windows without Developer Mode. Everything works; edits are picked
up by the watcher rather than through a link. Turning on Developer Mode gives
the better experience.

## Changes to `multi-app.config.mjs` seem ignored

The config is read once per command. Restart the dev server after changing it.
Adding or removing an application changes which directories count as shared, so
the generated trees of every application are affected.
