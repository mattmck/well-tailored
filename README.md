# job-shit

Automated resume tailoring pipeline. Drop your base resume, define jobs and tech-stack profiles, and let the AI churn out a tailored version for every application — hands-free.

---

## How it works

```
resume/base.md          ← your canonical resume
jobs/<slug>/config.yml  ← one file per job application
stacks/<slug>.yml       ← one file per tech-stack emphasis

          ↓  npm run release  ↓

output/jobs/<slug>/resume.md    ← tailored for that specific role
output/stacks/<slug>/resume.md  ← tailored to lead with that stack
output/release-report.json      ← metadata for the run
```

The **release** command reads every job and stack config, calls OpenAI GPT-4o for each one, and writes tailored Markdown resumes to `output/`. A GitHub Actions workflow runs the pipeline automatically whenever you push changes to `resume/`, `jobs/`, or `stacks/`, and commits the results back to the repo (also available as a downloadable artifact).

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/mattmck/job-shit
cd job-shit
npm install
```

### 2. Set your OpenAI API key

```bash
cp .env.example .env
# edit .env and fill in OPENAI_API_KEY
```

The CLI automatically loads `.env` via `dotenv`, so `npm run release` will pick up the key without any extra steps.

Add `OPENAI_API_KEY` as a repository secret in GitHub → Settings → Secrets → Actions for the CI workflow.

### 3. Fill in your base resume

Edit `resume/base.md`. Plain Markdown works great — no special formatting required.

---

## Adding a job

Create a directory under `jobs/` with a `config.yml`:

```bash
mkdir jobs/acme-corp
```

```yaml
# jobs/acme-corp/config.yml
company: Acme Corp
title: Principal Engineer
url: https://jobs.acme.com/principal-eng

description: |
  We are looking for a Principal Engineer to own our payments platform...
  (paste the full JD here)

notes: |
  Anything personal you want the AI to weigh — why you want the role, etc.
```

Run `npm run release -- --job acme-corp` to generate just this resume.

---

## Adding a stack profile

Create a `.yml` file under `stacks/`:

```yaml
# stacks/gcp-python.yml
name: GCP / Python
technologies:
  - Google Cloud Run
  - BigQuery
  - Pub/Sub
  - Python
  - FastAPI

emphasis: |
  Surface all GCP and Python work. Emphasise data pipelines and serverless.
```

Run `npm run release -- --stack gcp-python` to generate just this resume.

---

## CLI reference

```bash
npm run release                         # tailor all jobs + stacks
npm run release -- --dry-run            # preview without calling the AI
npm run release -- --job <slug>         # one job only
npm run release -- --stack <slug>       # one stack only
npm run release -- --resume <path>      # override base resume path
npm run release -- --output-dir <path>  # override output directory
```

---

## GitHub Actions

The workflow at `.github/workflows/release-resumes.yml` triggers on:

- **Push to `main`** when `resume/`, `jobs/`, `stacks/`, or `src/` files change → runs full release and commits `output/` back.
- **Manual dispatch** (`workflow_dispatch`) → supports dry-run, single-job, and single-stack inputs.

Tailored resumes are also uploaded as a workflow artifact (`tailored-resumes-<run-number>`).

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | *(required)* | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o` | Model to use for tailoring |
| `RESUME_PATH` | `resume/base.md` | Path to the base resume |
| `JOBS_DIR` | `jobs` | Directory containing job configs |
| `STACKS_DIR` | `stacks` | Directory containing stack profiles |
| `OUTPUT_DIR` | `output` | Where to write tailored resumes |
