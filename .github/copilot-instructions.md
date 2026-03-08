# Copilot Instructions

This file provides guidance to GitHub Copilot when working with code in this repository.

## Commands

```bash
npm run dev -- <command>   # run without building (uses tsx)
npm run build              # compile to dist/
npm test                   # run tests (vitest)
npm run typecheck          # tsc --noEmit
npm run lint               # eslint
```

Run a single test file: `npx vitest run tests/files.test.ts`

## Architecture

Node.js/TypeScript CLI (`src/cli.ts`) built with Commander. Three top-level commands:

- **`tailor`** — one-off tailoring: `job-shit tailor --company "Acme" --job jd.txt`
- **`huntr`** — Huntr.co integration: `job-shit huntr jobs`, `job-shit huntr tailor <jobId> --board <boardId>`
- **`release`** — batch mode: reads all `jobs/<slug>/config.yml` and `stacks/<slug>.yml`, generates outputs for all of them

### Core lib (`src/lib/`)

- `ai.ts` — thin OpenAI wrapper (`complete()`, takes an injected client)
- `tailor.ts` — `tailorDocuments()` fans out resume + cover letter calls via `Promise.all`
- `prompts.ts` — system/user prompts for resume and cover letter, kept separate
- `files.ts` — `findFile()` auto-discovers `resume*.md` / `bio*.md` from CWD then `~/.job-shit/`

### Commands (`src/commands/`)

- `tailor.ts` — CLI flags → `tailorDocuments()` → writes `output/resume-<slug>.md` + `output/cover-letter-<slug>.md`
- `huntr.ts` — fetches job from Huntr API (inlined HTTP client, no huntr-cli import), strips HTML description, then calls `tailorDocuments()`
- `release.ts` — reads `jobs/*/config.yml` (YAML) and `stacks/*.yml`, calls `tailorDocuments()` for each job (resume + cover letter) and resume-only for stacks; writes to `output/jobs/<slug>/` and `output/stacks/<slug>/`

### Config resolution

`src/config.ts` — loads `OPENAI_API_KEY` / `OPENAI_MODEL`. `resolveHuntrToken()` checks env → `~/.huntr/config.json` → system keychain (keytar), matching huntr-cli's credential chain.

### Directory layout for release

```
jobs/<slug>/config.yml    # company, title, description, url?, notes?
stacks/<slug>.yml         # name, technologies[], emphasis?
output/                   # generated files (gitignored except .gitkeep)
```

## Conventions

- **Language**: TypeScript (ESM, `"type": "module"` in package.json). Always use `.ts` extensions in source.
- **Tests**: Vitest. Test files live in `tests/`. Mock OpenAI via dependency injection — `tailorDocuments()` and `complete()` accept an injected client so tests never hit the network.
- **Linting**: ESLint with `@typescript-eslint`. Run `npm run lint` before committing.
- **Type checking**: Run `npm run typecheck` to ensure no TypeScript errors.
- **Node version**: Requires Node.js >=20.19.0.
- **No side effects at import time**: Config is loaded lazily; commands import only what they need.
- **Output files**: All generated output goes under `output/` which is gitignored (except `output/.gitkeep`). Never commit generated resumes or cover letters.
- **Secrets**: Never commit `.env` or any file containing API keys. Use `.env.example` as the template.
