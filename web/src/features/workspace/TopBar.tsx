import { Bookmark, Files, FolderOpen, Save, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../../context';
import { Button } from '../../components/ui/button';
import * as api from '../../api/client';
import { TailoringStatus } from './TailoringStatus';
import { RegradingStatus } from './RegradingStatus';
import { WorkspaceCombobox } from './WorkspaceCombobox';
import {
  buildWorkspaceSnapshot,
  getWorkspaceHuntrIdsMissingStage,
  workspaceRecordToState,
} from './workspacePersistence';

function findSavedWorkspace(
  workspaces: { id: string; name: string }[],
  query: string,
  activeWorkspaceId: string | null,
) {
  const trimmed = query.trim();
  const normalized = trimmed.toLowerCase();

  return workspaces.find((workspace) =>
    workspace.id === trimmed
    || workspace.name.toLowerCase() === normalized,
  ) ?? (trimmed === '' && activeWorkspaceId !== null
    ? workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null
    : null);
}

function deriveSourceRoot(paths: {
  resume?: string;
  bio?: string;
  baseCoverLetter?: string;
  resumeSupplemental?: string;
}): string | null {
  const firstPath = paths.resume || paths.bio || paths.baseCoverLetter || paths.resumeSupplemental;
  if (!firstPath) return null;

  const root = firstPath.replace(/[\\/][^\\/]+$/, '');
  return root.replace(/^\/Users\/[^/]+/, '~');
}

export function TopBar() {
  const { state, dispatch } = useWorkspace();
  const matchedWorkspace = findSavedWorkspace(state.savedWorkspaces, state.workspaceName, state.activeWorkspaceId);
  const sourceRoot = deriveSourceRoot(state.sourcePaths);
  const totalJobs = state.jobs.length;
  const draftedJobs = state.jobs.filter((job) => Boolean(job.result)).length;
  const activeJob = state.activeJobId
    ? state.jobs.find((job) => job.id === state.activeJobId) ?? null
    : null;

  const statusText = state.runFeedback
    ? state.runFeedback.text
    : state.sourceResume
    ? '● Docs loaded'
    : '○ No docs loaded';

  const statusColor = state.runFeedback
    ? state.runFeedback.type === 'error'
      ? 'border-destructive/20 bg-destructive/10 text-destructive'
      : state.runFeedback.type === 'done'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
      : 'border-primary/20 bg-primary/10 text-primary'
    : state.sourceResume
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
    : 'border-border bg-white/70 text-muted-foreground';

  const workspaceStateLabel = matchedWorkspace
    ? 'Saved workspace'
    : state.workspaceName.trim()
    ? 'Unsaved workspace'
    : 'Scratch workspace';

  async function refreshWorkspaceList() {
    const list = await api.listWorkspaces();
    dispatch({ type: 'SET_SAVED_WORKSPACES', workspaces: list.workspaces });
  }

  async function handleLoad() {
    if (!matchedWorkspace) return;
    dispatch({ type: 'SET_ACTIVE_WORKSPACE', id: matchedWorkspace.id });

    try {
      const data = await api.loadWorkspace(matchedWorkspace.id);
      const nextState = workspaceRecordToState(data);
      dispatch({ type: 'LOAD_WORKSPACE', state: nextState });
      toast.success(`Loaded "${matchedWorkspace.name}"`);

      const huntrIdsMissingStage = getWorkspaceHuntrIdsMissingStage(data);
      if (huntrIdsMissingStage.length > 0 && nextState.jobs) {
        void api.getHuntrJobStages()
          .then((response) => {
            const missingIds = new Set(huntrIdsMissingStage);
            const stagesById = Object.fromEntries(
              response.jobs
                .filter((job) => missingIds.has(job.id))
                .filter((job) => job.listName.trim().length > 0)
                .map((job) => [job.id, job.listName]),
            );

            if (Object.keys(stagesById).length === 0) return;

            dispatch({
              type: 'MERGE_JOB_STAGES',
              stages: stagesById,
            });
          })
          .catch((error) => {
            console.warn('Failed to refresh Huntr stages for saved workspace:', error);
          });
      }
    } catch (err) {
      console.error('Failed to load workspace:', err);
      toast.error('Failed to load workspace');
    }
  }

  async function handleSave() {
    const name = state.workspaceName.trim();
    if (!name) return;

    try {
      const saved = await api.saveWorkspace({
        id: state.activeWorkspaceId ?? undefined,
        name,
        snapshot: buildWorkspaceSnapshot(state),
      });
      dispatch({ type: 'SET_ACTIVE_WORKSPACE', id: saved.id });
      dispatch({ type: 'SET_WORKSPACE_NAME', name: saved.name });
      toast.success(`Saved "${saved.name}"`);
      refreshWorkspaceList().catch((err) => console.error('Failed to refresh workspace list:', err));
    } catch (err) {
      console.error('Failed to save workspace:', err);
      toast.error('Failed to save workspace');
    }
  }

  async function handleDelete() {
    if (!state.activeWorkspaceId) return;

    try {
      await api.deleteWorkspace(state.activeWorkspaceId);
      dispatch({ type: 'SET_ACTIVE_WORKSPACE', id: null });
      toast.success('Workspace deleted');
      refreshWorkspaceList().catch((err) => console.error('Failed to refresh workspace list:', err));
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      toast.error('Failed to delete workspace');
    }
  }

  return (
    <>
      <div className="shrink-0 border-b border-border/70 px-4 pb-3 pt-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex min-w-[16rem] flex-1 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-[1.1rem] bg-primary text-primary-foreground shadow-[0_12px_26px_rgba(49,74,116,0.2)]">
              <span
                className="select-none text-sm font-semibold"
                style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}
              >
                WT
              </span>
            </div>

            <div className="min-w-0">
              <p className="editorial-label">Well-Tailored Workbench</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="font-[Manrope] text-[1.25rem] font-semibold tracking-[-0.045em] text-foreground">
                  Drafting Desk
                </h1>
                <span className="text-sm text-muted-foreground">
                  Calm editing, scoring, and export for each application.
                </span>
              </div>

              {activeJob && (
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  Active review: <span className="text-foreground">{activeJob.company}</span>
                  {' '}· {activeJob.title}
                </p>
              )}
            </div>
          </div>

          <div className="flex min-w-[18rem] flex-[1.15] flex-col gap-2">
            <WorkspaceCombobox
              value={state.workspaceName}
              onChange={(name) => dispatch({ type: 'SET_WORKSPACE_NAME', name })}
              onSelect={(name) => dispatch({ type: 'SET_WORKSPACE_NAME', name })}
              options={state.savedWorkspaces}
              placeholder="Name or load a saved workspace"
            />

            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusColor}`}>
                {statusText}
              </span>
              <span className="control-chip inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-foreground">
                <Bookmark className="mr-1.5 size-3.5 text-primary" />
                {workspaceStateLabel}
              </span>
              <span className="control-chip inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-foreground">
                <Files className="mr-1.5 size-3.5 text-primary" />
                {totalJobs} roles
              </span>
              <span className="control-chip inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-foreground">
                <Sparkles className="mr-1.5 size-3.5 text-primary" />
                {draftedJobs} drafted
              </span>
              {sourceRoot && (
                <span className="control-chip inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  {sourceRoot}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => void handleSave()} disabled={!state.workspaceName.trim()}>
              <Save className="size-3.5" />
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleLoad()} disabled={!matchedWorkspace}>
              <FolderOpen className="size-3.5" />
              Load
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleDelete()}
              disabled={!matchedWorkspace}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>
      <TailoringStatus />
      <RegradingStatus />
    </>
  );
}
