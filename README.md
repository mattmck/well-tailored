# job-shit

Stop suffering. Pipe your base resume + company info + job description through AI and get a tailored resume **and** cover letter back — in parallel — without touching them yourself.

## The workflow

```
base resume (resume*.md — auto-detected)
+ personal bio (bio*.md — auto-detected)
+ company name
+ job description (jd.txt)
          │
          ▼
    [AI — parallel]
   ┌──────┴───────┐
   ▼              ▼
resume-acme.md   cover-letter-acme.md
```

Both documents are generated simultaneously via a single `job-shit tailor` call.

## Setup

```bash
cp .env.example .env
# Add your OpenAI API key
npm install
```

## Usage

### Tailor resume + cover letter

```bash
# Minimal — company name and job description file required.
# Resume and bio are auto-detected from the current directory
# or ~/.job-shit/ (most recently modified matching file wins).
job-shit tailor --company "Acme Corp" --job jd.txt

# Full options
job-shit tailor \
  --company "Acme Corp" \
  --job jd.txt \
  --title "Senior Software Engineer" \
  --resume path/to/resume.md \   # optional — auto-detected if omitted
  --bio path/to/bio.md \         # optional — auto-detected if omitted
  --output output/               # default: output/
```

Outputs:
- `output/resume-acme-corp.md`
- `output/cover-letter-acme-corp.md`

### Base files

| File | Purpose | Default search locations |
|------|---------|--------------------------|
| `resume*.md` | Your base resume (markdown). | CWD, then `~/.job-shit/` |
| `bio*.md` | Plain-English background blurb. | CWD, then `~/.job-shit/` |
| `jd.txt` | The job description (copy-paste). | Must be explicit (`--job`) |

Within each location the **most recently modified** matching file is used automatically, so saving `resume-2026-03.md` will pick it up without changing any flags.

### Huntr.co integration (bonus)

```bash
# List all jobs from your huntr boards
job-shit huntr jobs

# Tailor directly from a huntr job ID (fetches JD from Huntr automatically)
job-shit huntr tailor <jobId> --board <boardId>
```

**Credentials are read automatically** from huntr-cli in this order:
1. `HUNTR_API_TOKEN` environment variable
2. `~/.huntr/config.json` (set by `huntr config set-token`)
3. System keychain (set by `huntr config set-token --keychain`)

So if you've already run `huntr login` or `huntr config set-token` in huntr-cli, no extra config is needed here.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ✅ | — | OpenAI API key |
| `OPENAI_MODEL` | ❌ | `gpt-4o` | Model to use |
| `HUNTR_API_TOKEN` | ❌ | — | Huntr token (only if not using huntr-cli) |

## Development

```bash
npm run dev -- tailor --help   # run via tsx without building
npm run build                  # compile to dist/
npm test                       # run tests
npm run lint                   # lint
npm run typecheck              # type check
```

