# docwalker

A modern Node.js CLI that walks DOCX design-control outputs, converts them into Markdown, and extracts embedded images into a tidy folder structure ready for LLM ingestion.

## Features

- Converts individual DOCX files or entire directories into Markdown with preserved heading hierarchy, lists, tables, and inline formatting.
- Exports embedded images to a dedicated assets folder with descriptive, collision-safe filenames and rewrites Markdown links accordingly.
- Adds YAML front matter (title, source, conversion timestamp) so downstream tooling can index provenance metadata.
- CLI built with Commander, rich terminal feedback via kleur, and ergonomic options (`--dry-run`, `--image-dir`, `--overwrite`).
- Production-ready toolchain: TypeScript, Vitest, ESLint (flat config), Prettier, tsup bundling, Makefile automation, and GitHub Actions CI.

## Quick start

```bash
# install dependencies
git clone <repo> && cd docwalker
npm install

# run the CLI directly in dev mode
npm run dev -- convert ./Documents ./output

# (optional) produce an optimized build
npm run build
./dist/cli.js convert ./Documents ./output
```

Running `docwalker convert` with a directory will mirror the Markdown files into the target output directory while keeping images under `<output>/<image-dir>/<doc-slug>/`.

## CLI usage

```
docwalker convert <input> <output>

Arguments:
  <input>   Path to a DOCX file or a directory containing DOCX files
  <output>  Directory where Markdown and assets should be written

Options:
  -i, --image-dir <name>  Directory name (inside <output>) for extracted images (default: "images")
  --dry-run               Perform the conversion without writing to disk (reports planned outputs)
  --overwrite             Allow Markdown files to be overwritten if they already exist
  -h, --help              Display help for command
```

Example:

```bash
# convert all DOCX files in the current directory
npx docwalker convert . ./markdown-output

# simulate the conversion, inspect the plan, and keep existing files intact
npx docwalker convert ./Documents ./export --dry-run
```

Each generated Markdown file includes:

```markdown
---
title: "D0000060721_EnterpriseAppLabelingRequirements_RevB"
source: "D0000060721_EnterpriseAppLabelingRequirements_RevB.docx"
converted: "2025-02-14T12:34:56.000Z"
---
```

Images referenced in the DOCX will be written to `./export/images/<doc-slug>/` with names such as `d0000060721-enterpriseapplabelingrequirements-revb-image-001-diagram.png`. The Markdown links are rewritten to use those relative paths, so the file can be rendered anywhere without additional tooling.

## Development workflow

Use the provided npm scripts or Makefile targets depending on your preference.

| Task        | npm script        | Make target |
|-------------|-------------------|-------------|
| Install     | `npm install`     | `make install` |
| Lint        | `npm run lint`    | `make lint` |
| Format      | `npm run format`  | `make format` |
| Typecheck   | `npm run typecheck` | `make typecheck` |
| Test        | `npm run test`    | `make test` |
| Build       | `npm run build`   | `make build` |
| Full CI     | `npm run ci`      | `make ci` |

Vitest powers the test suite (`tests/**/*.test.ts`), and `npm run dev` launches the CLI via `tsx` for quick iterative runs. Husky/lint-staged are configured; run `npm run prepare` after initializing git hooks if you want pre-commit enforcement.

## Continuous integration

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs the standard checks (install, lint, typecheck, test, build) on pushes and pull requests targeting the main branches. The workflow caches npm dependencies and targets Node.js 22 to satisfy the stricter engine ranges of modern tooling.

## Project layout

```
.
├── src/
│   ├── cli.ts           # Commander-powered CLI entry point
│   ├── index.ts         # Public library exports
│   └── lib/
│       └── converter.ts # Core DOCX → Markdown conversion logic
├── tests/               # Vitest specs (`npm run test`)
├── types/               # Ambient type declarations for third-party libs
├── dist/                # Build artifacts (`npm run build`)
├── tsup.config.ts       # Bundler configuration (tsup)
├── vitest.config.ts     # Test runner configuration
├── eslint.config.js     # Flat ESLint configuration
├── Makefile             # Convenience commands
└── README.md            # This document
```

## Requirements

- Node.js ≥ 18.18.0 (Node 20+ recommended to align with eslint/typescript-eslint engine constraints).
- DOCX files with embedded images; linked external images are not fetched.

## Roadmap ideas

- Parallel conversion with concurrency limits for very large repositories.
- Configurable naming templates for Markdown and image assets.
- Optional HTML output alongside Markdown for previews.
- Plug-in architecture for custom transformers (e.g., redact sections, inject metadata).

Contributions and feedback are welcome—open an issue or PR with your ideas!
