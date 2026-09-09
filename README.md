# next-multi-app

Build several Next.js applications from one repository, sharing the route files
they do not override.

Each application gets its own routes, its own build, and its own deployment
target. Route files at the top of `apps/` are inherited by every application,
and any application can replace one by creating the same path inside its own
directory.

```text
apps/
  api/health/route.ts     inherited by every application
  layout.tsx              inherited by every application
  admin/
    page.tsx              only the admin application
    api/health/route.ts   replaces the shared handler, for this one only
  customer/
    page.tsx
```

Overriding is per file, not per subtree. The admin application above still
inherits every other handler under `apps/api/`.

## Install

```bash
npm install --save-dev next-multi-app
```

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

Declare your applications in `multi-app.config.mjs`:

```js
import { defineConfig } from "next-multi-app";

export default defineConfig({
  apps: {
    customer: { default: true },
    admin: { noindex: true },
  },
});
```

```bash
npm run apps                    # what is available, and which is the default
npm run dev                     # the application marked default
npm run build -- --app admin    # a specific one
```

An application directory holds route files and nothing else. There is no
`next.config.ts`, `tsconfig.json`, `package.json`, or `postcss.config.mjs` to
write per application; the build configuration is generated.

A repository that still has `app/` at its root keeps working untouched and
stays the default, so this can be adopted one application at a time.

## Documentation

| Guide                                      | What it covers                                               |
| ------------------------------------------ | ------------------------------------------------------------ |
| [Getting started](docs/getting-started.md) | Install, wire the scripts, create a first application        |
| [Configuration](docs/configuration.md)     | Every option, its default, and what it changes               |
| [Inheritance](docs/inheritance.md)         | How sharing and overriding resolve, with worked examples     |
| [CLI](docs/cli.md)                         | Actions, flags, environment variables, and CI                |
| [Adapters](docs/adapters.md)               | Deployment targets, Cloudflare, and writing your own         |
| [How it works](docs/how-it-works.md)       | The generated project, and the constraints behind the design |
| [Troubleshooting](docs/troubleshooting.md) | Failures you are likely to hit, and what causes them         |

## Deployment

Without an adapter you get `dev`, `build`, `start` and `typecheck`, which is all
a Vercel or Node deployment needs. A Cloudflare adapter ships with the package
and is off unless you set `adapter` in your config; opting in adds `deploy`,
`preview`, `upload` and `cf-typegen`. See [Adapters](docs/adapters.md).

## Platform support

Route files are linked rather than copied, and the mode is probed at runtime,
not chosen per operating system. Developed and tested on macOS. Linux takes the
same path and is expected to behave identically, but is not yet verified.
Windows has no file symlinks without Developer Mode, so the package falls back
to copying; that path is unit tested and has not yet run on a Windows machine.
Verification on both is planned for a coming release. Details in
[Getting started](docs/getting-started.md#platform-support).

## Reach for this last

Most requirements that look like several applications are better served inside
one. One deployment that changes by the signed-in user's role should stay one
application and authorize on the server. Deployments that differ mainly by
branding or feature flags are usually better as a build-time edition
configuration. This package is for route trees that are genuinely independent or
overlapping.

Selecting a build is not authorization. Every application and every backend
endpoint must still enforce the signed-in user's permissions on the server.

## Requirements

Node 20.19 or newer, and Next.js 15 or newer. The package is ESM.

## Licence

MIT
