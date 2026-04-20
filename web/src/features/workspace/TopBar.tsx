import { Bookmark, CheckCircle2, Files, FolderOpen, MessageSquare, Save, Settings, Sparkles, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../../context';
import type { ActivePanel } from '../../types';
import { Button } from '../../components/ui/button';
import * as api from '../../api/client';
import { TailoringStatus } from './TailoringStatus';
import { RegradingStatus } from './RegradingStatus';
import { WorkspaceCombobox } from './WorkspaceCombobox';
import {
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

function shortenHomePath(path: string): string {
  return path.replace(/^\/Users\/[^/]+/, '~');
}

export function TopBar() {
  const { state, dispatch } = useWorkspace();
  const matchedWorkspace = findSavedWorkspace(state.savedWorkspaces, state.workspaceName, state.activeWorkspaceId);
  const sourceRoot = deriveSourceRoot(state.sourcePaths);
  const dbPath = state.dbPath ? shortenHomePath(state.dbPath) : '';
  const totalJobs = state.jobs.length;
  const draftedJobs = state.jobs.filter((job) => Boolean(job.result)).length;
  const reviewedJobs = state.jobs.filter((job) => job.status === 'reviewed').length;
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
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: `Loaded workspace "${matchedWorkspace.name}".`,
        logType: 'done',
      });
      toast.success(`Loaded "${matchedWorkspace.name}"`);
      console.info('[workbench] Loaded workspace', { id: matchedWorkspace.id, name: matchedWorkspace.name });

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
            dispatch({
              type: 'ADD_ACTIVITY_LOG',
              message: `Refreshed stages for ${Object.keys(stagesById).length} Huntr jobs.`,
              logType: 'done',
            });
          })
          .catch((error) => {
            console.warn('Failed to refresh Huntr stages for saved workspace:', error);
            dispatch({
              type: 'ADD_ACTIVITY_LOG',
              message: `Could not refresh Huntr stages: ${error instanceof Error ? error.message : String(error)}`,
              logType: 'error',
            });
          });
      }
    } catch (err) {
      console.error('Failed to load workspace:', err);
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: `Failed to load workspace: ${err instanceof Error ? err.message : String(err)}`,
        logType: 'error',
      });
      toast.error('Failed to load workspace');
    }
  }

  async function handleSave() {
    const name = state.workspaceName.trim();
    if (!name) return;

    try {
      const payload = {
        name,
        sourceResume: state.sourceResume,
        sourceBio: state.sourceBio,
        sourceCoverLetter: state.sourceCoverLetter,
        sourceSupplemental: state.sourceSupplemental,
        promptResumeSystem: state.promptSources.resumeSystem ?? '',
        promptCoverLetterSystem: state.promptSources.coverLetterSystem ?? '',
        promptScoringSystem: state.promptSources.scoringSystem ?? '',
        agentConfigJson: JSON.stringify({
          tailoringProvider: state.tailorProvider,
          tailoringModel: state.tailorModel,
          scoringProvider: state.scoreProvider,
          scoringModel: state.scoreModel,
        }),
      };
      const saved = state.activeWorkspaceId
        ? await api.updateWorkspace(state.activeWorkspaceId, payload)
        : await api.createWorkspace({ ...payload, name });
      dispatch({ type: 'SET_ACTIVE_WORKSPACE', id: saved.id });
      dispatch({ type: 'SET_WORKSPACE_NAME', name: saved.name });
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: `Saved workspace "${saved.name}".`,
        logType: 'done',
      });
      toast.success(`Saved "${saved.name}"`);
      console.info('[workbench] Saved workspace', { id: saved.id, name: saved.name });
      refreshWorkspaceList().catch((err) => console.error('Failed to refresh workspace list:', err));
    } catch (err) {
      console.error('Failed to save workspace:', err);
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: `Failed to save workspace: ${err instanceof Error ? err.message : String(err)}`,
        logType: 'error',
      });
      toast.error('Failed to save workspace');
    }
  }

  async function handleDelete() {
    if (!state.activeWorkspaceId) return;

    try {
      await api.deleteWorkspace(state.activeWorkspaceId);
      dispatch({ type: 'SET_ACTIVE_WORKSPACE', id: null });
      dispatch({ type: 'ADD_ACTIVITY_LOG', message: 'Deleted workspace.', logType: 'done' });
      toast.success('Workspace deleted');
      console.info('[workbench] Deleted workspace');
      refreshWorkspaceList().catch((err) => console.error('Failed to refresh workspace list:', err));
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: `Failed to delete workspace: ${err instanceof Error ? err.message : String(err)}`,
        logType: 'error',
      });
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

          <div className="flex min-w-[18rem] flex-[1.15] flex-col gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="min-w-[13rem] flex-1">
                <WorkspaceCombobox
                  value={state.workspaceName}
                  onChange={(name) => dispatch({ type: 'SET_WORKSPACE_NAME', name })}
                  onSelect={(name) => dispatch({ type: 'SET_WORKSPACE_NAME', name })}
                  options={state.savedWorkspaces}
                  placeholder="Name or load a saved workspace"
                />
              </div>
              {dbPath && (
                <span
                  className="control-chip inline-flex h-9 max-w-[18rem] shrink items-center truncate rounded-lg px-2.5 font-mono text-[11px] text-muted-foreground"
                  title={`DB ${dbPath}`}
                >
                  DB {dbPath}
                </span>
              )}
            </div>

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
              <span className="control-chip inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-foreground">
                <CheckCircle2 className="mr-1.5 size-3.5 text-primary" />
                {reviewedJobs} reviewed
              </span>
              {sourceRoot && (
                <span className="control-chip inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  {sourceRoot}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Panel toggle buttons (sources, prompts, config) */}
            {(
              [
                { id: 'sources' as ActivePanel, icon: FileText, label: 'Sources' },
                { id: 'prompts' as ActivePanel, icon: MessageSquare, label: 'Prompts' },
                { id: 'config' as ActivePanel, icon: Settings, label: 'Config' },
              ] as const
            ).map(({ id, icon: Icon, label }) => {
              const isActive = state.activePanel === id;
              return (
                <button
                  key={id}
                  title={label}
                  onClick={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: isActive ? null : id })}
                  aria-pressed={isActive}
                  className={[
                    'flex size-8 items-center justify-center rounded-[0.8rem] border transition-all duration-200',
                    isActive
                      ? 'border-primary/15 bg-primary text-primary-foreground shadow-[0_12px_26px_rgba(49,74,116,0.22)]'
                      : 'border-transparent bg-white/50 text-muted-foreground hover:-translate-y-0.5 hover:border-border/80 hover:bg-white/85 hover:text-foreground',
                  ].join(' ')}
                >
                  <Icon size={14} strokeWidth={1.75} />
                </button>
              );
            })}

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
      {state.activityLog.length > 0 && (
        <div className="shrink-0 border-b border-border/70 bg-white/45 px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span className="editorial-label">Log</span>
            {state.activityLog.slice(0, 3).map((entry) => (
              <span
                key={entry.id}
                className={[
                  'rounded-full border px-2 py-0.5 font-medium',
                  entry.type === 'error'
                    ? 'border-destructive/20 bg-destructive/10 text-destructive'
                    : entry.type === 'done'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                    : entry.type === 'working'
                    ? 'border-primary/20 bg-primary/10 text-primary'
                    : 'border-border bg-white/70 text-muted-foreground',
                ].join(' ')}
                title={new Date(entry.timestamp).toLocaleTimeString()}
              >
                {entry.message}
              </span>
            ))}
          </div>
        </div>
      )}
      <RegradingStatus />
    </>
  );
}
