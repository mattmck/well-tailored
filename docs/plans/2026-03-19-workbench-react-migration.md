# Workbench React Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the workbench UI from `src/workbench/index-v2.html` (5,778-line monolith) to a Vite + React + Tailwind + shadcn/ui app in `web/`, applying the Well-Tailored brand.

**Architecture:** Separate `web/` package with its own build. Vite dev server proxies `/api/*` to the existing Node backend on :4312. Components and styles copied from `docs/branding/`. State via `useReducer`. Server falls back to old HTML until cutover.

**Tech Stack:** Vite 6, React 19, Tailwind CSS 4, shadcn/ui (Radix), TypeScript

**Model guidance:** Use Sonnet for Tasks 1-14 (mechanical porting). Use Opus for review checkpoints.

---

## Phase 1: Scaffold

### Task 1: Create web/ package and build config

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.ts`
- Create: `web/postcss.config.mjs`
- Create: `web/tsconfig.json`
- Create: `web/index.html`
- Create: `web/.gitignore`
- Modify: `package.json` (root — add `web` and `web:build` scripts)

**Step 1: Create `web/package.json`**

Use npm as package manager (matches root project). Dependencies based on `docs/branding/package.json` but trimmed to only what the workbench needs:

```json
{
  "name": "well-tailored-web",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "1.1.6",
    "@radix-ui/react-dropdown-menu": "2.1.6",
    "@radix-ui/react-popover": "1.1.6",
    "@radix-ui/react-progress": "1.1.2",
    "@radix-ui/react-scroll-area": "1.2.3",
    "@radix-ui/react-select": "2.1.6",
    "@radix-ui/react-separator": "1.1.2",
    "@radix-ui/react-slot": "1.1.2",
    "@radix-ui/react-tabs": "1.1.3",
    "@radix-ui/react-tooltip": "1.1.8",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "lucide-react": "0.487.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-resizable-panels": "2.1.7",
    "tailwind-merge": "3.2.0",
    "tw-animate-css": "1.3.8"
  },
  "devDependencies": {
    "@tailwindcss/vite": "4.1.12",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.14",
    "@vitejs/plugin-react": "4.7.0",
    "tailwindcss": "4.1.12",
    "typescript": "^5.9.3",
    "vite": "6.3.5"
  }
}
```

Note: Add more Radix packages later as needed. Start lean.

**Step 2: Create `web/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4312',
    },
  },
  build: {
    outDir: 'dist',
  },
});
```

**Step 3: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Step 4: Create `web/postcss.config.mjs`**

```js
export default {};
```

**Step 5: Create `web/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Well-Tailored Workbench</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 6: Create `web/.gitignore`**

```
node_modules/
dist/
```

**Step 7: Add scripts to root `package.json`**

Add these to root `package.json` scripts:
```json
"web": "cd web && npm run dev",
"web:build": "cd web && npm run build"
```

**Step 8: Install dependencies**

Run: `cd web && npm install`

**Step 9: Commit**

```bash
git add web/ package.json
git commit -m "feat(web): scaffold Vite + React + Tailwind package"
```

---

### Task 2: Copy styles and base UI components from branding

**Files:**
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Copy: `docs/branding/src/styles/` → `web/src/styles/`
- Copy: `docs/branding/src/app/components/ui/utils.ts` → `web/src/components/ui/utils.ts`
- Copy select shadcn/ui components → `web/src/components/ui/`

**Step 1: Copy styles**

Copy these files from `docs/branding/src/styles/` to `web/src/styles/`:
- `fonts.css`
- `tailwind.css`
- `theme.css`
- `index.css`

These are used as-is. The theme.css already has light + dark mode tokens.

**Step 2: Copy base UI utilities**

Copy `docs/branding/src/app/components/ui/utils.ts` to `web/src/components/ui/utils.ts`.

**Step 3: Copy shadcn/ui components needed for the shell**

For now, copy only the components needed for Tasks 3-4 (shell + layout):
- `button.tsx`
- `separator.tsx`
- `tooltip.tsx`
- `scroll-area.tsx`
- `tabs.tsx`

Copy from `docs/branding/src/app/components/ui/` to `web/src/components/ui/`.

**Step 4: Create `web/src/main.tsx`**

```tsx
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(<App />);
```

**Step 5: Create placeholder `web/src/App.tsx`**

```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Well-Tailored Workbench
      </h1>
    </div>
  );
}
```

**Step 6: Verify it runs**

Run: `cd web && npm run dev`
Open: `http://localhost:5173`
Expected: Centered heading on ivory background with Manrope font.

**Step 7: Commit**

```bash
git add web/src/
git commit -m "feat(web): add brand styles, base UI components, and hello-world app"
```

---

## Phase 2: Shell Components

### Task 3: Create state types and reducer

**Files:**
- Create: `web/src/types.ts`
- Create: `web/src/state.ts`

**Step 1: Create `web/src/types.ts`**

Define TypeScript types matching v2's `state` object shape. Reference `src/workbench/index-v2.html` lines 2525-2565 and `src/types/index.ts` for the server-side types.

```ts
export interface Job {
  id: string;
  company: string;
  title: string;
  jd: string;
  stage: string;
  status: 'loaded' | 'tailoring' | 'tailored' | 'reviewed' | 'error';
  checked: boolean;
  result: TailorResult | null;
  error: string | null;
  _editorData: EditorData | null;
}

export interface TailorResult {
  output: {
    resume: string;
    coverLetter: string;
  };
  scorecard?: Scorecard;
  gapAnalysis?: GapAnalysis;
}

export interface Scorecard {
  overall: number;
  verdict: string;
  confidence: number;
  summary: string;
  categories: ScorecardCategory[];
}

export interface ScorecardCategory {
  name: string;
  score: number;
  weight: number;
  summary: string;
  issues: string[];
}

export interface GapAnalysis {
  matched: string[];
  missing: string[];
  partial: string[];
  fitRating: string;
}

export interface EditorData {
  sections: EditorSection[];
}

export interface EditorSection {
  id: string;
  heading: string;
  content: string;
  accepted: boolean;
}

export interface SourcePaths {
  resume?: string;
  bio?: string;
  baseCoverLetter?: string;
  resumeSupplemental?: string;
}

export interface PromptSources {
  resumeSystem?: string;
  coverLetterSystem?: string;
  scoringSystem?: string;
}

export type ActivePanel = 'jobs' | 'sources' | 'config' | 'prompts' | null;
export type ActiveDoc = 'resume' | 'cover';
export type ViewMode = 'preview' | 'diff';
export type JobListFilter = 'all' | 'wishlist' | 'applied' | 'interviewing' | 'offer';

export interface WorkspaceState {
  // Jobs
  jobs: Job[];
  activeJobId: string | null;
  jobListFilter: JobListFilter;
  isLoadingHuntr: boolean;

  // Workspace
  workspaceName: string;
  savedWorkspaces: { id: string; name: string }[];
  activeWorkspaceId: string | null;

  // Config
  configProviders: { id: string; name: string; models: string[] }[];
  tailorProvider: string;
  tailorModel: string;
  scoreProvider: string;
  scoreModel: string;

  // Sources
  sourceResume: string;
  sourceBio: string;
  sourceCoverLetter: string;
  sourceSupplemental: string;
  sourcePaths: SourcePaths;

  // Prompts
  promptSources: PromptSources;

  // Tailoring
  tailorQueue: string[];
  tailorRunning: string | null;
  tailorRunningStartedAt: number;
  tailorLastSummary: { tailored: number; failed: number } | null;
  scoresStale: boolean;

  // Editor/Preview
  activeDoc: ActiveDoc;
  viewMode: ViewMode;
  regeneratingSection: string | null;

  // UI
  activePanel: ActivePanel;
  activeScoreDetailsId: string | null;
  runFeedback: { text: string; type: 'working' | 'done' | 'error' } | null;
}
```

**Step 2: Create `web/src/state.ts`**

```ts
import { WorkspaceState } from './types';

export const initialState: WorkspaceState = {
  jobs: [],
  activeJobId: null,
  jobListFilter: 'all',
  isLoadingHuntr: false,

  workspaceName: '',
  savedWorkspaces: [],
  activeWorkspaceId: null,

  configProviders: [],
  tailorProvider: 'auto',
  tailorModel: 'auto',
  scoreProvider: 'auto',
  scoreModel: 'auto',

  sourceResume: '',
  sourceBio: '',
  sourceCoverLetter: '',
  sourceSupplemental: '',
  sourcePaths: {},

  promptSources: {},

  tailorQueue: [],
  tailorRunning: null,
  tailorRunningStartedAt: 0,
  tailorLastSummary: null,
  scoresStale: false,

  activeDoc: 'resume',
  viewMode: 'preview',
  regeneratingSection: null,

  activePanel: 'jobs',
  activeScoreDetailsId: null,
  runFeedback: null,
};

export type Action =
  | { type: 'SET_JOBS'; jobs: WorkspaceState['jobs'] }
  | { type: 'SET_ACTIVE_JOB'; id: string | null }
  | { type: 'UPDATE_JOB'; id: string; updates: Partial<WorkspaceState['jobs'][0]> }
  | { type: 'SET_JOB_FILTER'; filter: WorkspaceState['jobListFilter'] }
  | { type: 'SET_LOADING_HUNTR'; loading: boolean }
  | { type: 'SET_WORKSPACE_NAME'; name: string }
  | { type: 'SET_SAVED_WORKSPACES'; workspaces: WorkspaceState['savedWorkspaces'] }
  | { type: 'SET_ACTIVE_WORKSPACE'; id: string | null }
  | { type: 'SET_CONFIG_PROVIDERS'; providers: WorkspaceState['configProviders'] }
  | { type: 'SET_TAILOR_PROVIDER'; provider: string }
  | { type: 'SET_TAILOR_MODEL'; model: string }
  | { type: 'SET_SCORE_PROVIDER'; provider: string }
  | { type: 'SET_SCORE_MODEL'; model: string }
  | { type: 'SET_SOURCE'; key: 'sourceResume' | 'sourceBio' | 'sourceCoverLetter' | 'sourceSupplemental'; value: string }
  | { type: 'SET_SOURCE_PATHS'; paths: WorkspaceState['sourcePaths'] }
  | { type: 'SET_PROMPT_SOURCES'; sources: WorkspaceState['promptSources'] }
  | { type: 'SET_TAILOR_QUEUE'; queue: string[] }
  | { type: 'SET_TAILOR_RUNNING'; id: string | null; startedAt?: number }
  | { type: 'SET_TAILOR_SUMMARY'; summary: WorkspaceState['tailorLastSummary'] }
  | { type: 'SET_SCORES_STALE'; stale: boolean }
  | { type: 'SET_ACTIVE_DOC'; doc: WorkspaceState['activeDoc'] }
  | { type: 'SET_VIEW_MODE'; mode: WorkspaceState['viewMode'] }
  | { type: 'SET_REGENERATING_SECTION'; id: string | null }
  | { type: 'SET_ACTIVE_PANEL'; panel: WorkspaceState['activePanel'] }
  | { type: 'SET_SCORE_DETAILS'; id: string | null }
  | { type: 'SET_RUN_FEEDBACK'; feedback: WorkspaceState['runFeedback'] }
  | { type: 'LOAD_WORKSPACE'; state: Partial<WorkspaceState> };

export function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'SET_JOBS':
      return { ...state, jobs: action.jobs };
    case 'SET_ACTIVE_JOB':
      return { ...state, activeJobId: action.id };
    case 'UPDATE_JOB':
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id === action.id ? { ...j, ...action.updates } : j
        ),
      };
    case 'SET_JOB_FILTER':
      return { ...state, jobListFilter: action.filter };
    case 'SET_LOADING_HUNTR':
      return { ...state, isLoadingHuntr: action.loading };
    case 'SET_WORKSPACE_NAME':
      return { ...state, workspaceName: action.name };
    case 'SET_SAVED_WORKSPACES':
      return { ...state, savedWorkspaces: action.workspaces };
    case 'SET_ACTIVE_WORKSPACE':
      return { ...state, activeWorkspaceId: action.id };
    case 'SET_CONFIG_PROVIDERS':
      return { ...state, configProviders: action.providers };
    case 'SET_TAILOR_PROVIDER':
      return { ...state, tailorProvider: action.provider };
    case 'SET_TAILOR_MODEL':
      return { ...state, tailorModel: action.model };
    case 'SET_SCORE_PROVIDER':
      return { ...state, scoreProvider: action.provider };
    case 'SET_SCORE_MODEL':
      return { ...state, scoreModel: action.model };
    case 'SET_SOURCE':
      return { ...state, [action.key]: action.value };
    case 'SET_SOURCE_PATHS':
      return { ...state, sourcePaths: action.paths };
    case 'SET_PROMPT_SOURCES':
      return { ...state, promptSources: action.sources };
    case 'SET_TAILOR_QUEUE':
      return { ...state, tailorQueue: action.queue };
    case 'SET_TAILOR_RUNNING':
      return { ...state, tailorRunning: action.id, tailorRunningStartedAt: action.startedAt ?? 0 };
    case 'SET_TAILOR_SUMMARY':
      return { ...state, tailorLastSummary: action.summary };
    case 'SET_SCORES_STALE':
      return { ...state, scoresStale: action.stale };
    case 'SET_ACTIVE_DOC':
      return { ...state, activeDoc: action.doc };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };
    case 'SET_REGENERATING_SECTION':
      return { ...state, regeneratingSection: action.id };
    case 'SET_ACTIVE_PANEL':
      return { ...state, activePanel: action.panel };
    case 'SET_SCORE_DETAILS':
      return { ...state, activeScoreDetailsId: action.id };
    case 'SET_RUN_FEEDBACK':
      return { ...state, runFeedback: action.feedback };
    case 'LOAD_WORKSPACE':
      return { ...state, ...action.state };
    default:
      return state;
  }
}
```

**Step 3: Commit**

```bash
git add web/src/types.ts web/src/state.ts
git commit -m "feat(web): add workspace state types and reducer"
```

---

### Task 4: Create API client module

**Files:**
- Create: `web/src/api/client.ts`

**Step 1: Create `web/src/api/client.ts`**

Thin fetch wrappers for every `/api/*` endpoint used by the v2 workbench. These are the endpoints (from `src/server.ts`):

```ts
// All endpoints proxy through Vite in dev, or are same-origin in production.

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Config
export const getConfig = () => request<{
  providers: { id: string; name: string; models: string[] }[];
}>('/api/config');

// Source documents
export const getLocalWorkspace = () => request<{
  resume: string;
  bio: string;
  baseCoverLetter: string;
  resumeSupplemental: string;
  paths: Record<string, string>;
  prompts: Record<string, string>;
  promptSources: Record<string, string>;
}>('/api/workspace/local');

// Huntr
export const getHuntrJobs = () => request<{
  jobs: { id: string; company: string; title: string; jd: string; stage: string; date: string; url: string; boardId: string }[];
}>('/api/huntr/jobs');

// Runs
export const runManualTailor = (body: {
  input: { company: string; jobTitle: string; jobDescription: string; resume: string; bio?: string; baseCoverLetter?: string; resumeSupplemental?: string };
  agents?: { tailor?: string; score?: string };
  promptOverrides?: Record<string, string>;
  includeScoring?: boolean;
  verbose?: boolean;
}) => post<{ output: { resume: string; coverLetter: string }; scorecard?: unknown }>('/api/runs/manual', body);

// Workspaces
export const listWorkspaces = () => request<{ workspaces: { id: string; name: string }[] }>('/api/workspaces');

export const loadWorkspace = (id: string) =>
  request<{ snapshot: unknown }>(`/api/workspaces/${encodeURIComponent(id)}`);

export const saveWorkspace = (body: {
  name: string;
  snapshot: unknown;
}) => post<{ id: string }>('/api/workspaces/save', body);

export const deleteWorkspace = (id: string) =>
  fetch(`/api/workspaces/${encodeURIComponent(id)}`, { method: 'DELETE' });

// Analysis
export const getDiff = (body: { base: string; tailored: string }) =>
  post<{ html: string }>('/api/diff', body);

export const getGapAnalysis = (body: {
  resume: string; sourceResume?: string; sourceSupplemental?: string;
  bio?: string; jobDescription: string; jobTitle?: string;
  useAI?: boolean; model?: string; provider?: string;
}) => post<{ matched: string[]; missing: string[]; partial: string[]; fitRating: string }>('/api/gap', body);

export const getScore = (body: {
  resume: string; sourceResume?: string; sourceSupplemental?: string;
  coverLetter?: string; jobDescription: string; company?: string;
  jobTitle?: string; bio?: string; model?: string; provider?: string;
}) => post<unknown>('/api/score', body);

// Section regeneration
export const regenerateSection = (body: {
  section: string; fullResume: string; jobDescription: string;
  jobTitle?: string; company?: string; model?: string; provider?: string;
}) => post<{ section: string }>('/api/regenerate-section', body);

// Render / Export
export const renderHtml = (body: {
  kind: 'resume' | 'coverLetter'; markdown: string; theme?: Record<string, string>;
}) => post<{ html: string }>('/api/render', body);

export const exportPdf = (body: {
  kind: 'resume' | 'coverLetter' | 'cover-letter'; title?: string;
  markdown?: string; html?: string; theme?: Record<string, string>;
}) => fetch('/api/export/pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then((res) => {
  if (!res.ok) throw new Error('PDF export failed');
  return res.blob();
});
```

**Step 2: Commit**

```bash
git add web/src/api/
git commit -m "feat(web): add API client module with typed fetch wrappers"
```

---

### Task 5: Build app shell — TopBar, IconRail, panel layout

**Files:**
- Create: `web/src/features/workspace/TopBar.tsx`
- Create: `web/src/features/layout/IconRail.tsx`
- Create: `web/src/features/layout/PanelContainer.tsx`
- Create: `web/src/context.tsx`
- Modify: `web/src/App.tsx`

**Step 1: Create `web/src/context.tsx`**

React context to pass dispatch + state down without prop drilling:

```tsx
import { createContext, useContext, Dispatch } from 'react';
import { WorkspaceState } from './types';
import { Action } from './state';

interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: Dispatch<Action>;
}

export const WorkspaceContext = createContext<WorkspaceContextValue>(null!);

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
```

**Step 2: Create `TopBar.tsx`**

Reference v2 HTML `.top-bar` (lines 43-53). Should contain:
- WT monogram/logo (small)
- Workspace name input
- Save / Load dropdown / Delete buttons
- Status indicator (docs loaded, run feedback)
- Styled with brand tokens: `bg-card border-b border-border`

**Step 3: Create `IconRail.tsx`**

Reference v2 HTML `.icon-rail` (lines 152-205). Vertical icon strip:
- Jobs (briefcase icon)
- Sources (file icon)
- Config (settings icon)
- Prompts (message icon)
- Uses `lucide-react` icons
- Active state: `bg-secondary text-primary` with left accent bar

**Step 4: Create `PanelContainer.tsx`**

Wraps the slide-out panel area. Shows/hides based on `state.activePanel`. Contains a resizable splitter between panel and main content area (use `react-resizable-panels`).

**Step 5: Wire up `App.tsx`**

```tsx
import { useReducer, useEffect } from 'react';
import { WorkspaceContext } from './context';
import { initialState, reducer } from './state';
import { TopBar } from './features/workspace/TopBar';
import { IconRail } from './features/layout/IconRail';
import { PanelContainer } from './features/layout/PanelContainer';
import * as api from './api/client';

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load config + source docs on mount
  useEffect(() => {
    api.getConfig().then((cfg) => {
      dispatch({ type: 'SET_CONFIG_PROVIDERS', providers: cfg.providers });
    }).catch(console.error);

    api.getLocalWorkspace().then((ws) => {
      dispatch({ type: 'SET_SOURCE', key: 'sourceResume', value: ws.resume || '' });
      dispatch({ type: 'SET_SOURCE', key: 'sourceBio', value: ws.bio || '' });
      dispatch({ type: 'SET_SOURCE', key: 'sourceCoverLetter', value: ws.baseCoverLetter || '' });
      dispatch({ type: 'SET_SOURCE', key: 'sourceSupplemental', value: ws.resumeSupplemental || '' });
      dispatch({ type: 'SET_SOURCE_PATHS', paths: ws.paths || {} });
      dispatch({ type: 'SET_PROMPT_SOURCES', sources: ws.prompts || {} });
    }).catch(console.error);

    api.listWorkspaces().then((res) => {
      dispatch({ type: 'SET_SAVED_WORKSPACES', workspaces: res.workspaces });
    }).catch(console.error);
  }, []);

  return (
    <WorkspaceContext.Provider value={{ state, dispatch }}>
      <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <TopBar />
        <div className="flex flex-1 min-h-0">
          <IconRail />
          <PanelContainer />
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* ScoreCards, EditorLayout, MissingKeywords go here in later tasks */}
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Workbench shell — panels coming next
            </div>
          </main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
```

**Step 6: Verify it runs**

Run: `cd web && npm run dev` (with `npm run serve` in another terminal)
Expected: Ivory background, top bar with brand styling, icon rail on left, placeholder main area.

**Step 7: Commit**

```bash
git add web/src/
git commit -m "feat(web): app shell with TopBar, IconRail, panel layout, and context"
```

---

## Phase 3: Port Features

> **Parallelization note:** Tasks 6-8 (ConfigPanel, SourcesPanel, PromptsPanel) are independent and can be dispatched as parallel subagents. Tasks 9-13 have some dependencies (JobsPanel must exist before ScoreCards references active job, etc.) and should be sequential.

### Task 6: ConfigPanel

**Files:**
- Create: `web/src/features/config/ConfigPanel.tsx`
- Copy: `web/src/components/ui/select.tsx` (from `docs/branding/`)

**Step 1: Copy `select.tsx` shadcn component**

**Step 2: Build `ConfigPanel.tsx`**

Reference v2 HTML `#panel-config` (lines 628-683). Contains:
- Provider select (tailor) — populated from `state.configProviders`
- Model select (tailor) — models filtered by selected provider
- Provider select (scoring) — defaults to tailor provider
- Model select (scoring)
- Each dispatches the corresponding SET action

Style with brand tokens. Use shadcn `Select` component.

**Step 3: Wire into `PanelContainer` — show when `state.activePanel === 'config'`**

**Step 4: Verify** — panel opens, selects populate from API, selections persist in state.

**Step 5: Commit**

```bash
git commit -m "feat(web): add ConfigPanel with provider/model selection"
```

---

### Task 7: SourcesPanel

**Files:**
- Create: `web/src/features/sources/SourcesPanel.tsx`
- Copy: `web/src/components/ui/textarea.tsx` (from `docs/branding/`)

**Step 1: Copy `textarea.tsx` shadcn component**

**Step 2: Build `SourcesPanel.tsx`**

Reference v2 HTML `#panel-sources` (lines 568-626). Contains four source items:
- Resume, Bio, Cover Letter, Supplemental
- Each shows: label, file path (from `state.sourcePaths`), status text, editable textarea with content
- File upload button (reads file, updates state)
- Uses `SOURCE_FIELDS` pattern from v2 (lines 2567-2572)

**Step 3: Wire into `PanelContainer`**

**Step 4: Verify** — panel shows loaded docs from server, textarea editable, file upload works.

**Step 5: Commit**

```bash
git commit -m "feat(web): add SourcesPanel with document display and editing"
```

---

### Task 8: PromptsPanel

**Files:**
- Create: `web/src/features/prompts/PromptsPanel.tsx`

**Step 1: Build `PromptsPanel.tsx`**

Reference v2 HTML `#panel-prompts` (lines 2574-2578 for PROMPT_FIELDS). Contains three textareas:
- Resume system prompt
- Cover letter system prompt
- Scoring system prompt
- Each shows source label (e.g., "Loaded from local defaults") and allows override
- File upload for custom prompt files

**Step 2: Wire into `PanelContainer`**

**Step 3: Verify** — prompts load from server defaults, editable.

**Step 4: Commit**

```bash
git commit -m "feat(web): add PromptsPanel with prompt override textareas"
```

---

### Task 9: JobsPanel

**Files:**
- Create: `web/src/features/jobs/JobsPanel.tsx`
- Create: `web/src/features/jobs/JobList.tsx`
- Create: `web/src/features/jobs/JobDetail.tsx`
- Create: `web/src/features/jobs/StageFilter.tsx`
- Copy: `web/src/components/ui/badge.tsx`, `web/src/components/ui/checkbox.tsx` (from `docs/branding/`)

**Step 1: Copy needed shadcn components**

**Step 2: Build `StageFilter.tsx`**

Reference v2 `.job-groups` (lines 348-397). Pill-style filter tabs: All, Wishlist, Applied, Interviewing, Offer. Each shows count badge.

**Step 3: Build `JobList.tsx`**

Reference v2 `.job-list` (lines 406-484). Scrollable list of jobs:
- Checkbox for batch selection
- Company name (bold), title (muted)
- Stage badge, status indicator
- Click selects job (`SET_ACTIVE_JOB`)
- Selected state: left accent border

**Step 4: Build `JobDetail.tsx`**

Reference v2 `.job-detail` (lines 486-548). Form for selected job:
- Company, title, date inputs (2-column grid)
- JD textarea
- Error display area

**Step 5: Build `JobsPanel.tsx`**

Composes: action buttons (Load Huntr, Paste JD, Tailor Selected) + StageFilter + JobList + JobDetail.
- "Load Huntr" calls `api.getHuntrJobs()` and dispatches `SET_JOBS`
- "Tailor Selected" opens TailorConfirmModal (placeholder for now)
- "Paste JD" opens PasteJDModal (placeholder for now)

**Step 6: Wire into `PanelContainer`**

**Step 7: Verify** — Load Huntr populates job list, selecting a job shows detail, filters work.

**Step 8: Commit**

```bash
git commit -m "feat(web): add JobsPanel with list, filters, detail form, and Huntr import"
```

---

### Task 10: ScoreCards

**Files:**
- Create: `web/src/features/scores/ScoreCards.tsx`
- Create: `web/src/features/scores/ScoreCard.tsx`
- Create: `web/src/features/scores/ScoreDetailsModal.tsx`
- Copy: `web/src/components/ui/dialog.tsx`, `web/src/components/ui/progress.tsx` (from `docs/branding/`)

**Step 1: Copy needed shadcn components**

**Step 2: Build `ScoreCard.tsx`**

Reference v2 `.score-card` (lines 716-905). Individual score card:
- Eyebrow label, score value (large number), progress bar
- Color-coded: green/yellow/red based on score thresholds
- Verdict badge, confidence badge
- Summary text
- Click opens detail modal

**Step 3: Build `ScoreCards.tsx`**

Grid container for score cards. Shows when active job has a result with scorecard.
- Re-grade button triggers `api.getScore()` + `api.getGapAnalysis()`
- Maps scorecard categories to individual ScoreCard components

**Step 4: Build `ScoreDetailsModal.tsx`**

Reference v2 `#scoreDetailsModal` (lines 2379-2396). Uses shadcn `Dialog`:
- Headline score + verdict
- Grouped metrics with individual scores
- Issues list
- Summary text

**Step 5: Wire into `App.tsx` main area (above editor layout)**

**Step 6: Verify** — after tailoring a job, score cards appear, clicking opens detail modal, re-grade works.

**Step 7: Commit**

```bash
git commit -m "feat(web): add ScoreCards with detail modal and re-grade"
```

---

### Task 11: EditorColumn

**Files:**
- Create: `web/src/features/editor/EditorColumn.tsx`
- Create: `web/src/features/editor/EditorSection.tsx`
- Create: `web/src/lib/markdown.ts`

**Step 1: Extract markdown utilities from v2**

Copy and type these functions from `index-v2.html` lines 2398-2519 into `web/src/lib/markdown.ts`:
- `_isDateSegment`, `_looksLikeDateLine`, `_looksLikeJobTitle`, `_splitDateLocation`
- `formatElapsed`, `linkify`
- `parseDateString`, `parseOneDate`, `dateObjToString`, `ensureDateObj`
- The `parseMarkdown` function (find it in v2 — it splits resume markdown into sections)

Add TypeScript types. Export all.

**Step 2: Build `EditorSection.tsx`**

Reference v2 editor section rendering. Each section shows:
- Heading with accept/regenerate buttons
- Editable textarea for section content
- Regenerate button calls `api.regenerateSection()` and updates section content
- Accept button marks section as accepted

**Step 3: Build `EditorColumn.tsx`**

Reference v2 `.editor-col` (lines 961-998). Contains:
- Toolbar: doc tabs (Resume / Cover Letter), copy button
- Scrollable list of EditorSection components
- Parses active job's result markdown into sections using `parseMarkdown`
- Tracks section edits in job's `_editorData`

**Step 4: Wire into `App.tsx` editor layout area**

**Step 5: Verify** — tailored resume appears as editable sections, regenerate works, doc tab switches to cover letter.

**Step 6: Commit**

```bash
git commit -m "feat(web): add EditorColumn with section editing and regeneration"
```

---

### Task 12: PreviewColumn

**Files:**
- Create: `web/src/features/preview/PreviewColumn.tsx`
- Create: `web/src/features/preview/DiffView.tsx`

**Step 1: Build `PreviewColumn.tsx`**

Reference v2 `.preview-col`. Contains:
- Toolbar: Preview/Diff toggle, Export PDF button
- Preview mode: iframe showing rendered HTML from `api.renderHtml()`
- Export PDF calls `api.exportPdf()` and triggers download
- Resume/cover letter toggle syncs with EditorColumn's active doc

**Step 2: Build `DiffView.tsx`**

Reference v2 diff rendering. Calls `api.getDiff()` with base resume vs tailored resume. Renders the HTML diff output in a scrollable container with appropriate styling.

**Step 3: Wire the editor layout**

EditorColumn and PreviewColumn sit side-by-side with a resizable splitter (use `react-resizable-panels`). Reference v2 `.editor-layout` (lines 962-968).

**Step 4: Verify** — preview shows rendered resume, diff toggle works, PDF export downloads.

**Step 5: Commit**

```bash
git commit -m "feat(web): add PreviewColumn with HTML preview, diff view, and PDF export"
```

---

### Task 13: MissingKeywords + Tailoring Queue

**Files:**
- Create: `web/src/features/editor/MissingKeywords.tsx`
- Add tailoring queue logic to `App.tsx` or a custom hook

**Step 1: Build `MissingKeywords.tsx`**

Reference v2 `.keywords-bar`. Shows gap analysis results as pills:
- Matched keywords (green)
- Partial matches (yellow)
- Missing keywords (red)
- Fit rating label
- Appears below the editor layout

**Step 2: Add tailoring queue logic**

Reference v2's `executeBatchTailor` (around line 3384+). Create a `useTailorQueue` hook or add to App:
- Queue management: enqueue checked jobs, process one at a time
- For each job: call `api.runManualTailor()`, update job status/result
- After all complete: show summary in run feedback
- Elapsed timer display

**Step 3: Wire into `App.tsx`**

**Step 4: Verify** — select multiple jobs, tailor, queue processes sequentially, keywords appear after.

**Step 5: Commit**

```bash
git commit -m "feat(web): add MissingKeywords display and tailoring queue"
```

---

### Task 14: Modals — TailorConfirm, PasteJD

**Files:**
- Create: `web/src/features/jobs/TailorConfirmModal.tsx`
- Create: `web/src/features/jobs/PasteJDModal.tsx`

**Step 1: Build `TailorConfirmModal.tsx`**

Reference v2 `#tailorModal` (lines 2332-2353). shadcn Dialog:
- Lists checked jobs that will be tailored
- Confirm / Cancel buttons
- On confirm: enqueue jobs into tailoring queue

**Step 2: Build `PasteJDModal.tsx`**

Reference v2 `#pasteJdModal` (lines 2355-2377). shadcn Dialog:
- Company name input
- Job title input
- JD textarea
- On confirm: add new job to state, close modal

**Step 3: Wire into `JobsPanel` button handlers**

**Step 4: Verify** — both modals open/close, paste JD adds a job, tailor confirm triggers queue.

**Step 5: Commit**

```bash
git commit -m "feat(web): add TailorConfirm and PasteJD modals"
```

---

## Phase 4: Cut Over

### Task 15: Server fallback + cleanup

**Files:**
- Modify: `src/server.ts`
- Delete: `src/workbench/index.html`
- Delete: `src/workbench/index-v2.html`
- Modify: `package.json` (root — add `web:build` to `build` script)

**Step 1: Update `src/server.ts`**

Add static file serving from `web/dist/` when it exists. The existing `loadWorkbenchV2Html()` function (around line 243) should check for `web/dist/index.html` first:

```ts
function loadWorkbenchHtml(): string {
  // Try React build first
  const reactBuild = join(__dirname, '..', 'web', 'dist', 'index.html');
  if (existsSync(reactBuild)) {
    return readFileSync(reactBuild, 'utf8');
  }
  // Fall back to legacy
  const packaged = join(__dirname, 'workbench', 'index-v2.html');
  if (existsSync(packaged)) return readFileSync(packaged, 'utf8');
  return readFileSync(join(process.cwd(), 'src', 'workbench', 'index-v2.html'), 'utf8');
}
```

Also add static asset serving for JS/CSS from `web/dist/assets/`.

**Step 2: Build and verify**

Run: `npm run web:build && npm run serve`
Open: `http://localhost:4312`
Expected: React app loads from built assets.

**Step 3: Delete old HTML files**

```bash
rm src/workbench/index.html src/workbench/index-v2.html
```

**Step 4: Update root build script**

In root `package.json`, change build to:
```json
"build": "tsc && node scripts/copy-assets.mjs && cd web && npm run build"
```

**Step 5: Run full verification**

```bash
npm run build
npm run typecheck
npm test
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: cut over to React workbench, remove legacy HTML files"
```

---

## Checkpoint Summary

| After Task | What works |
|-----------|------------|
| 1-2 | `web/` builds, hello-world renders on :5173 |
| 3-4 | Types, state, API client ready |
| 5 | App shell with branded TopBar + IconRail visible |
| 6-8 | Config, Sources, Prompts panels functional (parallelizable) |
| 9 | Jobs panel loads from Huntr, job selection works |
| 10 | Score cards display after tailoring |
| 11 | Resume editor with section editing and regeneration |
| 12 | HTML preview + diff + PDF export |
| 13 | Gap analysis keywords + batch tailoring queue |
| 14 | All modals wired up |
| 15 | Server serves React build, legacy HTML deleted |

**Review checkpoints:** After Tasks 5, 9, 12, and 15 — use Opus to review accumulated work against the design doc and BRAND.md.
