# Inheritance

An application sees the merge of the shared route files and its own, with its
own winning. The rule is applied at every level of the tree.

| Situation                                | Result                               |
| ---------------------------------------- | ------------------------------------ |
| Path only in the shared directory        | Inherited                            |
| Path only in the application             | The application's                    |
| Directory in both                        | Merged, and the rule recurses inside |
| File in both, or a file against a folder | The application's                    |

Overriding is **per file, not per subtree**. This is the part worth internalising,
because it is what makes sharing worth having: an application can change one
endpoint without reimplementing its siblings.

## A worked example

```text
apps/
  api/
    health/route.ts      shared
    status/route.ts      shared
  admin/
    api/
      health/route.ts    admin only
```

The admin application gets its own `/api/health` and still inherits
`/api/status`. The customer application gets both shared handlers. Neither has
to know the other exists.

## Replacing a directory outright

Sometimes you want an application to stop inheriting a whole branch. Put an
empty `.override` file in the application's copy of the directory:

```text
apps/
  admin/
    api/
      .override
      health/route.ts
```

Now the admin application has only `/api/health`. Nothing below `api/` is
inherited, including `/api/status`.

Reach for this rarely. It is the blunt instrument, and a merged directory with
one overridden file is almost always what you actually want.

## Naming

Application names are excluded from the shared tree, but **only at the top
level** of the applications directory. Two consequences follow.

An application can own a route segment named after another application.
`apps/admin/customer/page.tsx` serves `/customer` inside the admin application,
and nothing about the `customer` application interferes.

You cannot have a _shared_ route segment whose name is an application name.
`apps/admin/` is the admin application, so it can never also be a shared
`/admin` route. Pick application names that are not route names you intend to
share.

## What is not inherited

Only route files are merged. Components, features, hooks and utilities are
shared the ordinary way, through the repository's own directories, which every
application resolves under `@/`. See `sharedDirs` in
[Configuration](configuration.md).

Files and directories whose name begins with a dot are skipped entirely, apart
from the `.override` marker. So are `node_modules` directories.
