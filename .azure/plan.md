# Azure Deployment Plan

> **Status:** Planning

Generated: 2026-03-13 11:30 EDT

---

## 1. Project Overview

**Goal:** Modernize the existing `well-tailored` CLI into an Azure-hosted workbench that can:

- tailor resumes and cover letters from either Huntr jobs or pasted ad-hoc job descriptions
- let the user edit prompts, source documents, and visual theme in one place
- support separate model/agent choices for tailoring and scoring
- score outputs with both heuristic checks and a distinct evaluator agent
- preserve the current local CLI/library workflow so the service is an extension, not a rewrite

**Path:** Modernize Existing

### Product Motivations

- The CLI and render pipeline already work well; the missing piece is a thoughtful workflow around them.
- Huntr support and manual one-off applications both matter; the tool cannot be Huntr-only.
- Prompt quality is part of the product, but prompt tuning needs a safe place to iterate without editing source files by hand.
- A different evaluator agent is preferred over self-scoring; heuristic checks should backstop the model review.
- Existing repo work points toward extraction instead of reinvention:
  - PR #57 added a useful resume content editor prototype.
  - PR #58 moved templates into editable files.
  - PR #62 stabilized compilation, prompts, build output, and smoke coverage.
  - Issue #54 is a reminder to preserve dependency injection and test seams while extracting service code.

---

## 2. Requirements

| Attribute | Value |
|-----------|-------|
| Classification | Development |
| Scale | Small |
| Budget | Balanced |
| **Subscription** | TBD - must confirm with user before Azure execution |
| **Location** | TBD - must confirm with user before Azure execution |

### Assumptions Used For Planning

- This starts as a personal or small-team tool, not a public multi-tenant SaaS.
- Initial traffic is low enough to optimize for maintainability over heavy distributed infrastructure.
- Azure is the primary hosting target, but the app should still run locally with `npm run` commands.
- Existing AI provider flexibility remains a feature; Azure OpenAI can be the default, not the only option.

---

## 3. Components Detected

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| `well-tailored` CLI | API/Worker precursor | Node.js, TypeScript, Commander | `src/cli.ts` |
| Tailoring core | Shared library | TypeScript modules | `src/lib/` |
| Huntr integration | Service candidate | TypeScript + fetch | `src/commands/huntr.ts` |
| Rendering pipeline | Shared library | marked, sanitize-html, Chrome headless | `src/lib/render.ts` |
| Resume editor prototype | Frontend prototype | Standalone HTML/CSS/JS | `docs/resume-editor.html` |
| Palette prototype | Frontend prototype | Standalone HTML/CSS/JS | `docs/palette.html` |
| Test suite | Quality gate | Vitest | `tests/` |

### Gaps Identified

- Product logic is still trapped inside CLI command handlers.
- Huntr API access is not exposed as a reusable service module.
- There is no persisted concept of a project, run, prompt set, or scorecard.
- There is no browser workbench or API boundary for orchestration.
- Scoring is not implemented yet.
- Local editing tools are useful but disconnected from the actual tailoring flow.

---

## 4. Recipe Selection

**Selected:** AZD

**Rationale:** This repo is being modernized into a real application with a frontend, API, storage, secrets, and observability. `azd` gives a cleaner path for repeatable local-to-Azure development than ad hoc CLI deployment, while still leaving room for Bicep-backed infrastructure and later validation/deploy steps.

---

## 5. Architecture

**Stack:** Hybrid PaaS with Static Web Apps + Container Apps

### Core Design Principles

- Keep the current library as the source of tailoring/rendering truth.
- Extract orchestration into service modules before building HTTP endpoints.
- Treat tailoring and scoring as separate workflows with separate agent configuration.
- Combine LLM scoring with deterministic heuristics so evaluation is not purely model vibes.
- Make manual paste and Huntr ingestion equal first-class sources.
- Preserve local usage: the hosted architecture should also support a local workbench command.

### Service Mapping

| Component | Azure Service | SKU |
|-----------|---------------|-----|
| Workbench SPA | Static Web Apps | Standard |
| API service | Container Apps | Consumption or small dedicated workload profile |
| Background run worker | Container Apps Jobs or second Container App | Consumption |
| Run metadata and prompt/workspace state | Azure Database for PostgreSQL Flexible Server | Burstable / small |
| Generated HTML/PDF artifacts | Blob Storage | Hot / standard |
| Secrets for Huntr and AI providers | Key Vault | Standard |
| Container images | Azure Container Registry | Basic |

### Supporting Services

| Service | Purpose |
|---------|---------|
| Log Analytics | Centralized logging |
| Application Insights | Monitoring, APM, run diagnostics |
| Key Vault | Secrets management |
| Managed Identity | Service-to-service auth |

### Application Architecture

#### Backend layers

1. **Core library**
   - Keep `src/lib/tailor.ts`, `src/lib/prompts.ts`, `src/lib/render.ts`, and provider selection as the shared engine.
   - Refactor provider construction in `src/lib/ai.ts` to restore injection seams before the API grows around it.

2. **Service layer**
   - `tailoring-service`: build prompt set, call tailoring model, render outputs, save artifacts.
   - `huntr-service`: move API client and parsing logic out of `src/commands/huntr.ts`.
   - `scoring-service`: run rubric-based scoring with a separate model plus heuristics.
   - `workspace-service`: manage resumes, bios, cover-letter seeds, prompt versions, palettes, and run history.

3. **API layer**
   - `POST /api/runs` for manual or Huntr-driven tailoring jobs.
   - `POST /api/scores` or async score generation embedded into runs.
   - `GET /api/jobs/huntr` and `POST /api/jobs/manual`.
   - `GET/PUT /api/workspace/*` for prompts, documents, and theme settings.
   - `GET /api/runs/:id` for run details, artifacts, and scorecards.

4. **Worker layer**
   - Execute long-running tailoring and scoring jobs asynchronously.
   - Keep HTTP request latency low and isolate rendering/AI retries from the web tier.

#### Frontend workbench

The workbench should replace the disconnected static prototypes with one application that has five primary modes:

1. **Source**
   - Choose Huntr job or paste/upload a manual job description.
   - Inspect extracted company/title/board metadata before running.

2. **Inputs**
   - Edit resume, bio, cover-letter base, and supplemental facts in one place.
   - Reuse the resume editor ideas from `docs/resume-editor.html`.

3. **Prompts & Agents**
   - Edit resume and cover-letter prompts.
   - Select tailoring provider/model separately from scoring provider/model.
   - Default scoring to a different model than tailoring.

4. **Run Review**
   - Compare generated resume and cover letter.
   - View scorecards for ATS fit, AI-obvious language, and recruiter/HR quality.
   - Expose both rubric explanations and deterministic checks.

5. **Theme & Final Polish**
   - Bring the palette controls into the same app.
   - Offer a final content-editing pass before exporting markdown, HTML, or PDF.

### Scoring Strategy

Scoring should be a composite, not a single model opinion.

#### Heuristic checks

- Keyword alignment between job description and resume.
- Quantified bullet density.
- Resume length and structural completeness.
- Repeated phrase / cliche detection.
- AI-obvious language patterns such as generic enthusiasm, filler, and empty claims.
- Contact/link formatting and markdown-to-render sanity checks.

#### LLM evaluator checks

- ATS compatibility review.
- Recruiter skim quality.
- HR clarity and risk flags.
- Factual consistency warnings against the supplied resume/bio/supplemental material.
- Cover-letter specificity and tone.

#### Agent policy

- Default: different evaluator agent/model than the tailoring agent/model.
- Allowed: same-model self-review only as an explicit optional mode.
- The UI should clearly label when the evaluator is the same provider/model used for generation.

### Data Model Direction

Persist enough structure to make the workbench feel like a real tool:

- `workspace_documents`
  - resume
  - bio
  - cover letter seed
  - resume supplemental
- `prompt_profiles`
  - resume system prompt
  - cover-letter system prompt
  - scoring rubric prompt
- `agent_profiles`
  - tailoring provider/model/settings
  - scoring provider/model/settings
- `job_sources`
  - huntr jobs
  - manual pasted job descriptions
- `runs`
  - input snapshot
  - generated outputs
  - artifact paths
  - score summary
  - timestamps/status

### Research Summary

#### AZD

- `azure.yaml` should describe the frontend as `staticwebapp` and the API/worker as `containerapp`.
- Bicep remains the default IaC path unless there is a clear reason to switch providers.

#### Container Apps

- API workloads should use HTTP scaling with `minReplicas: 1` in a serious environment to reduce cold starts.
- Workers can scale to zero and should use event- or queue-based rules once background jobs become persistent.
- Health probes should be part of the first Azure deployment shape: `/health` for liveness/startup and `/ready` for readiness.

#### Static Web Apps

- The frontend should have a distinct build output folder and be tagged correctly for azd-managed deployment.
- Deployment tokens should never be exposed through IaC outputs; store them directly in Key Vault if needed.

#### Node Runtime

- The API should bind to `0.0.0.0` and respect `PORT`.
- When moved behind Azure ingress, the app should trust the first proxy and expose explicit health endpoints.

---

## 6. Execution Checklist

### Phase 1: Planning
- [x] Analyze workspace
- [x] Gather requirements
- [ ] Confirm subscription and location with user
- [x] Scan codebase
- [x] Select recipe
- [x] Plan architecture
- [ ] **User approved this plan**

### Phase 2: Execution
- [ ] Research components (load references, invoke skills)
- [ ] Generate infrastructure files
- [ ] Generate application configuration
- [ ] Generate Dockerfiles (if containerized)
- [ ] Update plan status to "Ready for Validation"

### Phase 3: Validation
- [ ] Invoke azure-validate skill
- [ ] All validation checks pass
- [ ] Update plan status to "Validated"
- [ ] Record validation proof below

### Phase 4: Deployment
- [ ] Invoke azure-deploy skill
- [ ] Deployment successful
- [ ] Update plan status to "Deployed"

### Product Delivery Phases

- [ ] Phase A: extract reusable service modules from CLI commands
- [ ] Phase B: add scoring engine and heuristic evaluator
- [ ] Phase C: build local API plus local workbench runner
- [ ] Phase D: build unified workbench UI
- [ ] Phase E: add persistence, run history, and artifact storage
- [ ] Phase F: add Azure infra and deployment path

---

## 7. Validation Proof

> **⛔ REQUIRED**: The azure-validate skill MUST populate this section before setting status to `Validated`. If this section is empty and status is `Validated`, the validation was bypassed improperly.

| Check | Command Run | Result | Timestamp |
|-------|-------------|--------|-----------|
| Pending | Pending | Pending | Pending |

**Validated by:** Pending
**Validation timestamp:** Pending

---

## 8. Files to Generate

| File | Purpose | Status |
|------|---------|--------|
| `.azure/plan.md` | Azure/workbench source-of-truth plan | ✅ |
| `azure.yaml` | AZD configuration | ⏳ |
| `infra/main.bicep` | Azure infrastructure definition | ⏳ |
| `src/server/*` | API server and routes | ⏳ |
| `src/services/*` | Reusable service layer | ⏳ |
| `src/workbench/*` | Unified frontend workbench | ⏳ |
| `src/worker/*` | Background job execution | ⏳ |

---

## 9. Next Steps

> Current: Planning

1. Approve this architecture and implementation order.
2. Execute Phase A first: extract service modules from CLI command handlers without changing CLI behavior.
3. Implement scoring as a separate pipeline with heuristics plus evaluator-agent output.
4. Add a local API and workbench dev command before introducing Azure infrastructure.
5. After the local workbench is useful, generate `azure.yaml`, Bicep, and containerization artifacts.

---

## 10. Build Order

### Phase A: Service extraction

- Move Huntr client, job normalization, file resolution, and output-writing logic into reusable modules.
- Introduce API-safe result types for runs and artifacts.
- Refactor `complete()` to preserve injection hooks and support service-level provider configuration.
- Keep CLI commands as thin wrappers over the extracted services.

### Phase B: Scoring engine

- Add a heuristic analyzer module with deterministic metrics.
- Add rubric prompts and evaluator-agent execution.
- Produce a normalized scorecard shape that the CLI and UI can both consume.
- Add tests with canned outputs and job descriptions.

### Phase C: Local workbench backend

- Add a Node HTTP service, likely Fastify for low-friction TypeScript APIs.
- Add local persistence using SQLite for development, with PostgreSQL-compatible schema design.
- Add a top-level dev command to run frontend + API together.

### Phase D: Unified workbench frontend

- Build a React/Vite workbench that absorbs the current static HTML prototypes.
- Keep the UI task-oriented: source, inputs, prompts, run review, polish.
- Add prompt diffing, run history, side-by-side comparisons, and export actions.

### Phase E: Azure preparation

- Add containerization for API/worker.
- Add Static Web Apps config for frontend.
- Add Bicep and `azure.yaml`.
- Wire Key Vault, Blob Storage, PostgreSQL, App Insights, and Managed Identity.

### Phase F: Nice-to-have after MVP

- Automatic Huntr polling or sync jobs.
- Saved evaluation baselines across a set of target job descriptions.
- Multiple prompt profiles by application strategy.
- Release workflow for polished exports and application notes.
