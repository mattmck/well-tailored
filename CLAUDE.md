# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

- **`tailor`** — one-off tailoring from a local JD file: `tailored tailor --company "Acme" --job jd.txt`
- **`huntr`** — Huntr.co integration subcommands (see below)

### Core lib (`src/lib/`)

- `ai.ts` — thin Anthropic/Claude wrapper (`complete()`, takes an injected client)
- `tailor.ts` — `tailorDocuments()` fans out resume + cover letter calls via `Promise.all`
- `prompts.ts` — system/user prompts for resume and cover letter, kept separate
- `files.ts` — `findFile()` auto-discovers `resume*.md` / `bio*.md` from CWD then `~/.well-tailored/`

### Commands (`src/commands/`)

- `tailor.ts` — CLI flags → `tailorDocuments()` → writes `output/resume-<slug>.md` + `output/cover-letter-<slug>.md`
- `huntr.ts` — all Huntr subcommands; inlined HTTP client (huntr-cli has no library exports)
  - `huntr wishlist` — list jobs in the Wishlist stage
  - `huntr jobs` — list all jobs with their current stage
  - `huntr tailor <jobId>` — tailor one job (board auto-detected)
  - `huntr tailor-all` — tailor every wishlist job in one shot

### Config

`src/config.ts` — loads `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` (falls back to `OPENAI_API_KEY` / `OPENAI_MODEL`, defaults to `claude-sonnet-4-5`). `resolveHuntrToken()` checks env → `~/.huntr/config.json` → system keychain (keytar), matching huntr-cli's credential chain.

### Output

All generated files go under `output/` (gitignored). Naming: `resume-<company>-<title>-<jobId>.md` / `cover-letter-<company>-<title>-<jobId>.md`.

## Conventions

- TypeScript ESM (`"type": "module"`). Use `.js` extensions in imports.
- Tests in `tests/` with Vitest. Anthropic client is injected so tests never hit the network.
- Run `npm run typecheck` and `npm test` before committing.
