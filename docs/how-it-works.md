# How it works

## Why a generated project exists at all

Next.js resolves both its configuration and its route tree from a single
directory, and it only ever looks for routes in `app/` or `src/app/` beneath
that directory. There is no CLI flag and no configuration option that separates
the two: `next build [directory]` sets the project root for everything at once,
and the route lookup is hard-coded to those two locations.

So an application directory cannot itself be a Next.js project. Naming your
routes `apps/admin/page.tsx` and expecting Next to find them cannot work, no
matter how the configuration is arranged.

This package therefore generates a project. `<outDir>/<app>/` is a real Next.js
project whose `app/` directory is the merged view of the shared route files and
the application's own. Your `sharedDirs` are linked in beside it, so imports
through `@/` resolve exactly as they did before.

The generated project holds a `next.config.ts` calling `createAppConfig`, a
`tsconfig.json` extending yours with `@/*` re-pointed, and whatever the adapter
contributes.

## Links, not copies

Route files in the generated tree are symlinks to your real sources. That is
what makes editing work: a change reaches the running dev server through the
link with nothing else happening.

Two behaviours constrain how those links are made. Both are undocumented
Next.js internals, both were established by testing rather than reading, and
both look arbitrary until you hit them.

### Only files are linked, never directories

A symlinked route _directory_ builds correctly in production and is invisible to
the dev server's watcher. A route behind one returns 404 under `next dev` while
working perfectly in `next build`.

Linking one file at a time costs more entries in the generated tree and makes
the merge recurse further, but it means development and production behave
identically. That is worth far more than the saving.

### A route added after startup is not registered

Next.js picks up a newly created route in an ordinary project without a
restart. It does not do so in a generated one. So `dev` watches the applications
directory and restarts the dev server when the _shape_ of the tree changes: a
route added, removed, renamed, or newly overridden.

Editing a file does not change the shape and restarts nothing. This distinction
is why the merge reports whether it changed anything, rather than just doing the
work.

Both behaviours are covered by this package's tests, so a Next.js release that
changes them fails here rather than silently in your application.

## Link modes

The link mode is probed once per run, by attempting a symlink in the generated
directory.

**Symlink mode** is the normal path. Editing a source file is picked up through
the link with no further work.

**Copy mode** is the fallback, used when the platform refuses to create file
symlinks. Windows requires Developer Mode or elevation for them. Route files are
copied instead, and the watcher refreshes a copy whose source changed. A
refreshed copy is an ordinary file write that the dev server already watches, so
it is deliberately **not** treated as a change of shape; treating it as one
would restart the dev server on every save.

Directory links for `sharedDirs` use junctions, which Windows allows without
elevation, so they work in both modes.

Turning on Developer Mode on Windows gives the better experience.

## What the merge does, precisely

The applications directory and the application's own directory are walked in
parallel, lowest precedence first.

- A path present in only one source is linked or recursed from that source.
- A path present in several, where every side is a directory, becomes a real
  directory and the merge continues inside it.
- Any other collision resolves to the highest-precedence side, which is the
  application.

Application names are excluded from the shared source at the top level only, so
an application can still own a route segment named after another application.

The reconciliation touches only what differs. An unchanged link is left alone,
which is what keeps a running dev server from noticing anything.
