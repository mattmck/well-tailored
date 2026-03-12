# job-shit

Stop suffering. Pipe your base resume + company info + job description through AI and get a tailored resume **and** cover letter back — in parallel — without touching them yourself.

## How it works

See [`docs/generation-flow.html`](docs/generation-flow.html) for a full architecture diagram (also in [landscape](docs/generation-flow-landscape.html)).

Two entry points, one pipeline:

```
  [manual]  resume.md + bio.md + job.txt + --company
  [huntr]   Wishlist jobs pulled automatically via Huntr API
       │
       ▼
  Provider (first matching env var wins)
  Gemini → Azure OpenAI → OpenAI → Anthropic
       │
       ▼
  Generate (Promise.all — concurrent)
  ┌─────────────────┬──────────────────┐
  │  resume         │  cover letter    │
  │  systemPrompt() │  systemPrompt()  │
  │  userPrompt()   │  userPrompt()    │
  └─────────────────┴──────────────────┘
       │
       ▼
  Render: markdown → marked → sanitize-html → HTML → Chrome headless → PDF
       │
       ▼
  output/resume-<slug>.{md,html,pdf}
  output/cover-letter-<slug>.{md,html,pdf}
```

Stack resume maintenance runs as a separate track using `tailorResume()` — single AI call, no cover letter.

## Setup

```bash
cp .env.example .env
# Add at least one AI provider key (see Environment variables below)
npm install
npm run build
```

## Usage

### Tailor resume + cover letter for a job

```bash
# Minimal — resume and bio are auto-detected from CWD or ~/.job-shit/
job-shit tailor --company "Acme Corp" --job jd.txt

# Full options
job-shit tailor \
  --company "Acme Corp" \
  --job jd.txt \
  --title "Senior Software Engineer" \
  --resume path/to/resume.md \
  --bio path/to/bio.md \
  --supplemental path/to/resume-supplemental.md \
  --output output/
```

Outputs (written to `output/`, gitignored):
- `resume-<slug>.md` / `.html` / `.pdf`
- `cover-letter-<slug>.md` / `.html` / `.pdf`

`<slug>` is a date-prefixed, URL-safe identifier derived from the job (for example, including the date plus normalized title and job ID parts).
PDF generation requires Google Chrome installed.

### Base files

| File | Purpose | Auto-discovery |
|------|---------|----------------|
| `resume*.md` | Base resume (markdown) | CWD, then `~/.job-shit/` — most recently modified wins |
| `bio*.md` | Personal background blurb | CWD, then `~/.job-shit/` |
| `cover-letter*.md` | Voice/tone reference for cover letter | CWD, then `~/.job-shit/` — optional |
| `resume-supplemental*.md` | Extra factual context for AI | CWD, then `~/.job-shit/` — optional |

### Huntr.co integration

```bash
# List jobs in your Wishlist (not yet applied to)
job-shit huntr wishlist

# List all jobs across boards with their current stage
job-shit huntr jobs

# Tailor a specific job (board auto-detected)
job-shit huntr tailor <jobId>

# Tailor every Wishlist job in one shot
job-shit huntr tailor-all
```

**Credentials** are resolved automatically in this order:
1. `HUNTR_API_TOKEN` environment variable
2. `~/.huntr/config.json` (written by `huntr config set-token`)
3. System keychain (written by `huntr config set-token --keychain`)

If you've already used huntr-cli, no extra config is needed.

## Environment variables

At least one AI provider key is required. The first matching key wins.

| Variable | Provider | Default model |
|----------|----------|---------------|
| `GEMINI_API_KEY` | Google Gemini | `gemini-2.0-flash-lite` |
| `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY` | Azure AI Foundry | `gpt-4o-mini` |
| `OPENAI_API_KEY` | OpenAI (or any compatible endpoint) | `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` | Anthropic Claude | `claude-haiku-4-5` |

Optional:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_MODEL` / `OPENAI_MODEL` | Override the default model for that provider |
| `AZURE_OPENAI_DEPLOYMENT` | Azure deployment name (default: `gpt-4o-mini`) |
| `AZURE_OPENAI_API_VERSION` | Azure API version (default: `2024-12-01-preview`) |
| `OPENAI_BASE_URL` | Custom base URL for OpenAI-compatible endpoints |
| `HUNTR_API_TOKEN` | Huntr token (if not using huntr-cli credentials) |

## Development

```bash
npm run dev -- tailor --help   # run via tsx without building
npm run build                  # compile to dist/
npm test                       # run tests (vitest)
npm run typecheck              # tsc --noEmit
npm run lint                   # eslint
```

Sample files for testing without real personal data are in `sample.*.md`.
