# Workbench React UI — Bugfix TODOs

Post-migration bugs found during first manual testing session (2026-03-20).

## DONE ✅

### 1. ConfigPanel duplicate "auto" in model dropdowns + "autoauto" display
**File:** `web/src/features/config/ConfigPanel.tsx`
**Root cause:** Server model lists already include `"auto"` as first entry, but the UI was also hardcoding `<SelectItem value="auto">`. Radix Select with duplicate `value` concatenates display text → "autoauto".
**Fix:** Removed hardcoded auto from model dropdowns (kept for provider dropdowns which don't come from server). Also reset model to `auto` when switching providers.

### 2. API client types didn't match server response shapes
**File:** `web/src/api/client.ts`, `web/src/App.tsx`, `web/src/features/jobs/JobsPanel.tsx`
**Already committed** as `4e7912d`.

---

## REMAINING 🔧

### 3. Stage filter pills don't match actual Huntr stages
**File:** `web/src/features/jobs/StageFilter.tsx`
**Root cause:** Hardcoded pills are `wishlist, applied, interviewing, offer`. Actual Huntr `listName` values are: `wishlist, applied, interview, offer, rejected, timeout, old wishlist`. Note "interview" not "interviewing".
**Fix:** Update `JobListFilter` type in `web/src/types.ts` to include all stages. Update `StageFilter.tsx` pills to match actual stages. Consider making pills dynamic based on loaded jobs instead of hardcoded.

Current type:
```ts
export type JobListFilter = 'all' | 'wishlist' | 'applied' | 'interviewing' | 'offer';
```

Should be dynamic or at least:
```ts
export type JobListFilter = 'all' | 'wishlist' | 'applied' | 'interview' | 'offer' | 'rejected' | 'timeout' | 'old wishlist';
```

Better approach: make pills dynamic from `state.jobs`:
```tsx
const stages = [...new Set(state.jobs.map(j => j.stage))].sort();
// Render "All" pill, then one pill per unique stage
```

### 4. `useTailorQueue` hook is defined but never called
**File:** `web/src/hooks/useTailorQueue.ts` (exists), `web/src/App.tsx` (needs to call it)
**Root cause:** The hook was created in Task 13 but never wired into App.tsx.
**Fix:** Add `useTailorQueue()` call inside `App()` component in `web/src/App.tsx`:
```tsx
import { useTailorQueue } from './hooks/useTailorQueue';

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  useTailorQueue(); // <-- Add this line after useReducer
  // ...
}
```
This activates the effect that watches `state.tailorQueue` and processes jobs sequentially.

### 5. Workspace selection does nothing (listed but not loaded)
**File:** `web/src/features/workspace/TopBar.tsx`
**Root cause:** `onChange` dispatches `SET_ACTIVE_WORKSPACE` but never calls `api.loadWorkspace()` to fetch the data.
**Fix:** In TopBar.tsx, the workspace picker onChange should:
```tsx
async function handleWorkspaceSelect(id: string) {
  dispatch({ type: 'SET_ACTIVE_WORKSPACE', id });
  if (!id) return;
  try {
    const data = await api.loadWorkspace(id);
    // data.snapshot contains the workspace state
    dispatch({ type: 'LOAD_WORKSPACE', state: data.snapshot as Partial<WorkspaceState> });
  } catch (err) {
    console.error('Failed to load workspace:', err);
  }
}
```
Also wire up Save button:
```tsx
async function handleSave() {
  if (!state.workspaceName.trim()) return;
  const snapshot = { /* relevant state fields */ };
  const res = await api.saveWorkspace({ name: state.workspaceName, snapshot });
  dispatch({ type: 'SET_ACTIVE_WORKSPACE', id: res.id });
  // Refresh workspace list
  const list = await api.listWorkspaces();
  dispatch({ type: 'SET_SAVED_WORKSPACES', workspaces: list.workspaces });
}
```
And Delete button:
```tsx
async function handleDelete() {
  if (!state.activeWorkspaceId) return;
  await api.deleteWorkspace(state.activeWorkspaceId);
  dispatch({ type: 'SET_ACTIVE_WORKSPACE', id: null });
  const list = await api.listWorkspaces();
  dispatch({ type: 'SET_SAVED_WORKSPACES', workspaces: list.workspaces });
}
```

### 6. "Tailor Selected" button should show count `(n)`
**File:** `web/src/features/jobs/JobsPanel.tsx`
**Fix:** Change the button text to include checked count:
```tsx
const checkedCount = state.jobs.filter(j => j.checked).length;
// ...
<Button ...>
  Tailor Selected{checkedCount > 0 ? ` (${checkedCount})` : ''}
</Button>
```
Note: `JobsPanel` currently only has `const { dispatch } = useWorkspace()` — needs to also destructure `state`.

### 7. Tailoring status indicator / queue progress bar is missing
**Root cause:** The old v2 workbench had a status bar showing "Tailoring job 2/5... (elapsed: 12s)" with a progress indicator. The React app shows `runFeedback` in the TopBar status area but doesn't show queue progress or elapsed time.
**Fix:** Add a `TailoringStatus` component or enhance TopBar status. Should show:
- Which job is currently being tailored
- Queue position (e.g., "2 of 5")
- Elapsed time (use `state.tailorRunningStartedAt` with a `setInterval`)
- Queue progress bar

Could be a thin bar below TopBar or overlay the existing status text. Example:
```tsx
function TailoringStatus() {
  const { state } = useWorkspace();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!state.tailorRunning) { setElapsed(0); return; }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - state.tailorRunningStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [state.tailorRunning, state.tailorRunningStartedAt]);

  if (!state.tailorRunning) return null;
  const job = state.jobs.find(j => j.id === state.tailorRunning);
  const queuePos = state.tailorQueue.indexOf(state.tailorRunning);
  const total = state.tailorQueue.length;

  return (
    <div className="...">
      Tailoring {job?.company} ({queuePos + 1}/{total}) — {elapsed}s
    </div>
  );
}
```

### 8. Job status dot clipped by scrollbar
**File:** `web/src/features/jobs/JobList.tsx`
**Root cause:** The status character (`○`, `●`, `✓`, etc.) is at the far right of the row and gets partially hidden by the ScrollArea's scrollbar.
**Fix:** Add right padding to the job item to account for scrollbar width:
```tsx
// In JobItem, add pr-3 or pr-4 to the outer div:
<div className={cn(
  'flex items-center gap-2 px-2 pr-4 py-1.5 ...',
  // ...
)}>
```

### 9. Job stage badge styling doesn't handle all Huntr stages
**File:** `web/src/features/jobs/JobList.tsx`
**Root cause:** `getStageBadgeClass` only handles `wishlist, applied, interviewing, offer`. Huntr also has `interview, rejected, timeout, old wishlist`.
**Fix:**
```ts
function getStageBadgeClass(stage: string): string {
  const lower = stage.toLowerCase();
  if (lower === 'wishlist' || lower === 'old wishlist') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (lower === 'applied') return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  if (lower === 'interview' || lower === 'interviewing') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (lower === 'offer') return 'bg-green-50 text-green-700 border-green-200';
  if (lower === 'rejected') return 'bg-red-50 text-red-700 border-red-200';
  if (lower === 'timeout') return 'bg-gray-50 text-gray-500 border-gray-200';
  return 'bg-secondary text-muted-foreground border-border';
}
```

---

## Notes
- Provider labels (e.g., "Azure OpenAI" vs "OpenAI") come from the server's `label` field. If the server returns "OpenAI" instead of "Azure OpenAI", that's a server-side fix in `src/server.ts` or config, not a React issue.
- Workspace picker UI redesign (hybrid dropdown + text) is a bigger UX change — consider doing as a separate task.
