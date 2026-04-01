# Claude Code 2.1.88 Recovered

English | [简体中文](./README.zh-CN.md)

This repository is a reconstructed Claude Code `2.1.88` project derived from `cli.js.map` recovery output and reorganized into a source-first npm project for research, rebuilding, and continued repair work.

## Overview

This repository is intended to make the recovered code easier to:

- inspect and study
- install with npm
- build locally
- run as a CLI after building
- continue repairing and extending

The repository has been cleaned up to keep only the practical project files:

- `src/`
- `scripts/`
- `vendor/`
- `package.json`
- `package-lock.json`
- `README.md`
- `README.zh-CN.md`

Large archives, extracted duplicates, PDFs, source maps, `dist/`, and `node_modules/` are intentionally not tracked.

## Important Notes

This is not the official upstream repository.

It is a recovered and reconstructed project built from sourcemap-derived output. Because reverse recovery is imperfect, the codebase still contains compatibility layers, generated shims, and stubbed replacements so that the project remains installable and buildable.

That means:

- it is suitable for research, debugging, and iterative restoration
- it is not guaranteed to behave exactly like the official published bundle
- some private integrations, native paths, or advanced features may still require additional manual recovery

## Requirements

- Node.js `>= 18`
- npm `>= 9`

Recommended environment check:

```bash
node -v
npm -v
```

## Quick Start

```bash
npm install
npm run build
node dist/cli.js --help
```

## Installation

Install dependencies from the project root:

```bash
npm install
```

This uses [package.json](./package.json) and `package-lock.json`.

## Build

Build the project with:

```bash
npm run build
```

The build output is generated locally into:

- `dist/cli.js`
- `dist/src/**`
- `dist/vendor/**`

The build pipeline is implemented in [scripts/build.mjs](./scripts/build.mjs). It currently handles:

- transpiling `src/` and `vendor/` into Node.js-compatible ESM output
- rewriting `bun:*` imports into Node/npm-compatible shims
- resolving `src/*` alias imports
- generating compatibility stubs for unresolved recovered modules
- injecting build-time constants required during CLI startup

## Run

Run the built CLI directly:

```bash
node dist/cli.js --help
```

Print the version:

```bash
node dist/cli.js --version
```

Run through npm:

```bash
npm start -- --help
```

## Install as a Local CLI

After building, you can install it as a global command:

```bash
npm install -g .
```

Then run:

```bash
claude-recovered --help
```

For local development, `npm link` also works:

```bash
npm link
```

## Common Commands

```bash
npm install
npm run build
npm run clean
npm start -- --help
node dist/cli.js --version
```

## Project Structure

```text
.
├── package.json
├── package-lock.json
├── scripts/
│   └── build.mjs
├── src/
├── vendor/
├── README.md
└── README.zh-CN.md
```

Notes:

- `src/`: recovered main source tree
- `vendor/`: local compatibility replacements for unavailable native or private modules
- `scripts/build.mjs`: custom npm build pipeline
- `dist/`: generated locally during build, not committed

## Verified Workflow

The current repository has been validated for the basic local workflow:

- `npm install`
- `npm run build`
- `node dist/cli.js --help`
- `node dist/cli.js --version`

## Known Limitations

- some original dependencies are unavailable on npm and are replaced with local shims
- some modules could not be fully recovered and are still stubbed during build
- "builds and starts" does not mean full parity with the official bundle
- private services, private protocols, and native-platform integrations may still need further restoration

## Troubleshooting

If you hit build or runtime issues, use this order:

1. Confirm Node.js is at least version 18.
2. Remove old build output.
3. Reinstall dependencies.
4. Rebuild.
5. Validate the CLI entrypoint.

Useful commands:

```bash
npm run clean
npm install
npm run build
node dist/cli.js --help
```

## Development Focus

If you want to continue improving this recovered project, the highest-value next steps are usually:

- fixing startup-time runtime errors
- replacing generated stubs with real implementations
- restoring missing private dependency behavior with compatible replacements
- validating important commands against the original bundle behavior

## License and Source Considerations

This repository contains code reconstructed from sourcemap-derived output. Before redistributing or publishing it, review the original project's license, copyright, and usage terms carefully.
