# job-shit

Stop suffering. Pipe your base resume + company info + job description through AI and get a tailored resume **and** cover letter back — in parallel — without touching them yourself.

## The workflow

```
base resume (resume.md)
+ personal bio (bio.md)
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
# Optionally add HUNTR_TOKEN for huntr.co integration
npm install
```

## Usage

### Tailor resume + cover letter

```bash
# Minimal — company name and job description file required
job-shit tailor --company "Acme Corp" --job jd.txt

# Full options
job-shit tailor \
  --company "Acme Corp" \
  --job jd.txt \
  --title "Senior Software Engineer" \
  --resume resume.md \          # default: resume.md
  --bio bio.md \                # default: bio.md
  --output output/              # default: output/
```

Outputs:
- `output/resume-acme-corp.md`
- `output/cover-letter-acme-corp.md`

### Files

| File | Purpose |
|------|---------|
| `resume.md` | Your base resume (markdown). Update this when your experience changes. |
| `bio.md` | A plain-English blurb about you — skills, interests, what you're looking for. The AI uses this for the cover letter voice. |
| `jd.txt` | The job description (copy-paste from the job listing). |

### Huntr.co integration (bonus)

```bash
# List all jobs from your huntr boards
job-shit huntr jobs

# Tailor directly from a huntr job ID
job-shit huntr tailor <jobId> --board <boardId>
```

Requires `HUNTR_TOKEN` in `.env`. Get your personal token from your Huntr account settings.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ✅ | — | OpenAI API key |
| `OPENAI_MODEL` | ❌ | `gpt-4o` | Model to use |
| `HUNTR_TOKEN` | ❌ | — | Huntr personal API token |

## Development

```bash
npm run dev -- tailor --help   # run via tsx without building
npm run build                  # compile to dist/
npm test                       # run tests
npm run lint                   # lint
npm run typecheck              # type check
```

