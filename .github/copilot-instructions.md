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

Node.js/TypeScript CLI (`src/cli.ts`) built with Commander. Two top-level commands:

- **`tailor`** — one-off tailoring from a local JD file: `job-shit tailor --company "Acme" --job jd.txt`
- **`huntr`** — Huntr.co integration subcommands (see below)

### Core lib (`src/lib/`)

- `ai.ts` — thin OpenAI wrapper (`complete()`, takes an injected client)
- `tailor.ts` — `tailorDocuments()` fans out resume + cover letter calls via `Promise.all`
- `prompts.ts` — system/user prompts for resume and cover letter, kept separate
- `files.ts` — `findFile()` auto-discovers `resume*.md` / `bio*.md` from CWD then `~/.job-shit/`

### Commands (`src/commands/`)

- `tailor.ts` — CLI flags → `tailorDocuments()` → writes `output/resume-<slug>.md` + `output/cover-letter-<slug>.md`
- `huntr.ts` — all Huntr subcommands; inlined HTTP client (huntr-cli has no library exports)
  - `huntr wishlist` — list jobs in the Wishlist stage
  - `huntr jobs` — list all jobs with their current stage
  - `huntr tailor <jobId>` — tailor one job (board auto-detected)
  - `huntr tailor-all` — tailor every wishlist job in one shot

### Config

`src/config.ts` — loads `OPENAI_API_KEY` / `OPENAI_MODEL`. `resolveHuntrToken()` checks env → `~/.huntr/config.json` → system keychain (keytar), matching huntr-cli's credential chain.

### Output

All generated files go under `output/` (gitignored). Naming: `resume-<company>-<title>-<jobId>.md` / `cover-letter-<company>-<title>-<jobId>.md`.

## Conventions

- **Language**: TypeScript (ESM, `"type": "module"` in package.json). Always use `.js` extensions in imports.
- **Tests**: Vitest. Test files live in `tests/`. Mock OpenAI via dependency injection — `tailorDocuments()` and `complete()` accept an injected client so tests never hit the network.
- **Linting**: ESLint with `@typescript-eslint`. Run `npm run lint` before committing.
- **Type checking**: Run `npm run typecheck` before committing.
- **Node version**: Requires Node.js >=20.19.0.
- **Output files**: All generated output goes under `output/` which is gitignored (except `output/.gitkeep`). Never commit generated resumes or cover letters.
- **Secrets**: Never commit `.env`. Use `.env.example` as the template.
