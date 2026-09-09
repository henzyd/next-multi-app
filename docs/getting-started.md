# Getting started

## Install

```bash
npm install --save-dev next-multi-app
```

Point your scripts at the CLI. It wraps the Next.js CLI, so anything you passed
to `next` still works.

```json
{
  "scripts": {
    "apps": "next-multi-app list",
    "dev": "next-multi-app dev",
    "build": "next-multi-app build",
    "start": "next-multi-app start",
    "typecheck": "next-multi-app typecheck"
  }
}
```

## Declare your applications

Create `multi-app.config.mjs` at the repository root:

```js
import { defineConfig } from "next-multi-app";

export default defineConfig({
  apps: {
    customer: { default: true },
    admin: { noindex: true },
  },
});
```

## Lay out the routes

Route files shared by every application go at the top of `apps/`. Each
application gets a subdirectory named after its entry in the config.

```text
apps/
  layout.tsx              every application
  api/health/route.ts     every application
  customer/
    page.tsx
  admin/
    page.tsx
    globals.css
```

An application directory holds route files and nothing else. Its build
configuration is generated, so there is no `next.config.ts`, `tsconfig.json`,
`package.json`, or `postcss.config.mjs` to write per application.

## Run it

```bash
npm run apps                    # what is available, and which is the default
npm run dev                     # the application marked default
npm run dev -- --app admin      # a specific one
npm run build -- --app admin
```

## Running several applications

Give each application its own script and its own port. They are separate dev
servers, so they can run side by side.

```json
{
  "scripts": {
    "dev": "next-multi-app dev",
    "dev:customer": "next-multi-app dev --app customer -p 3000",
    "dev:admin": "next-multi-app dev --app admin -p 3001"
  }
}
```

```bash
npm run dev:customer            # http://localhost:3000
npm run dev:admin               # http://localhost:3001
```

Each application is generated into its own directory, so two dev servers never
write over each other. Only the port has to differ.

`-p` is the ordinary Next.js flag, not something this package defines.
Everything after the action is forwarded, so the same pattern works for
`start`:

```json
{
  "scripts": {
    "start:admin": "next-multi-app start --app admin -p 3001"
  }
}
```

## Platform support

Nothing here is written per operating system. Generated route files point at
their sources with symlinks, and the mode is probed once at runtime rather than
chosen from the platform name.

| Platform | State                                                         |
| -------- | ------------------------------------------------------------- |
| macOS    | Developed and tested here                                     |
| Linux    | Same symlink path as macOS, not yet verified                  |
| Windows  | Falls back to copying, unit tested but not yet run on Windows |

Windows refuses to create file symlinks without Developer Mode or an elevated
shell. The probe detects that and copies route files instead, with the watcher
keeping them in step, so the package still works. Shared directories use
junctions, which Windows allows without elevation.

Verification on Linux and Windows is planned for a coming release. If you hit
something on either, please open an issue:
https://github.com/henzyd/next-multi-app/issues

## Deployment targets

Out of the box you get `dev`, `build`, `start` and `typecheck`, which is all a
Vercel or Node deployment needs. Nothing host-specific is installed or loaded.

A Cloudflare adapter ships with the package and is off unless you ask for it.
Opt in from your config:

```js
import { defineConfig } from "next-multi-app";
import cloudflare from "next-multi-app/cloudflare";

export default defineConfig({
  apps: { customer: { default: true }, admin: { noindex: true } },
  adapter: cloudflare(),
});
```

That adds `deploy`, `preview`, `upload` and `cf-typegen`, and requires
`@opennextjs/cloudflare` and `wrangler` in your repository. See
[Adapters](adapters.md), which also covers writing your own.

## Adopting it in an existing repository

A repository with `app/` at its root keeps working untouched. It stays the
default, and declaring applications changes nothing until you name one, so you
can adopt this one application at a time.

When you are ready to move fully across, move `app/` into `apps/<name>/`,
dropping the `app` level: what was `app/page.tsx` becomes
`apps/<name>/page.tsx`. Route files that every application should share go
directly in `apps/` instead. Then declare each application in the config and
verify with `npm run build -- --app <name>`.

Keeping the root `app/` is also fine. It stays the default application, and the
declared applications are then additions rather than a migration.

## Should you use this at all?

Most requirements that look like several applications are better served inside
one. Prefer the simpler option where it fits.

| Requirement                                                    | Approach                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| One deployment changes by the authenticated user's role        | Keep one app and authorize the role on the server per request |
| Deployments share routes but vary by branding or feature flags | Consider a build-time edition configuration inside one app    |
| Deployments have independent or overlapping route trees        | Use this package                                              |

Selecting a build is not authorization. Every application and every backend
endpoint must still enforce the signed-in user's permissions on the server.
