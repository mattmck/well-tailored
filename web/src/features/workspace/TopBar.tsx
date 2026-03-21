import { useWorkspace } from '../../context';
import { Button } from '../../components/ui/button';
import * as api from '../../api/client';
import { TailoringStatus } from './TailoringStatus';
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

  const statusText = state.runFeedback
    ? state.runFeedback.text
    : state.sourceResume
    ? '● Docs loaded'
    : '○ No docs loaded';

  const statusColor = state.runFeedback
    ? state.runFeedback.type === 'error'
      ? 'text-destructive'
      : state.runFeedback.type === 'done'
      ? 'text-green-600'
      : 'text-primary'
    : state.sourceResume
    ? 'text-green-600'
    : 'text-muted-foreground';

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
      await refreshWorkspaceList();
    } catch (err) {
      console.error('Failed to save workspace:', err);
    }
  }

  async function handleDelete() {
    if (!state.activeWorkspaceId) return;

    try {
      await api.deleteWorkspace(state.activeWorkspaceId);
      dispatch({ type: 'SET_ACTIVE_WORKSPACE', id: null });
      await refreshWorkspaceList();
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    }
  }

  return (
    <>
      <div
        className="bg-card border-b border-border flex items-center gap-3 px-4 shrink-0"
        style={{ height: '54px' }}
      >
        {/* Logo */}
        <span
          className="font-semibold text-primary select-none shrink-0"
          style={{ fontFamily: 'Manrope, sans-serif', fontSize: '15px', letterSpacing: '-0.01em' }}
        >
          WT
        </span>

        {/* Workspace name input */}
        <input
          type="text"
          value={state.workspaceName}
          onChange={(e) => dispatch({ type: 'SET_WORKSPACE_NAME', name: e.target.value })}
          placeholder="Workspace name..."
          list="saved-workspaces"
          className="bg-background border border-border rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
        <datalist id="saved-workspaces">
          {state.savedWorkspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.name} />
          ))}
        </datalist>

        <Button variant="outline" size="sm" onClick={() => void handleSave()} disabled={!state.workspaceName.trim()}>
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleLoad()} disabled={!matchedWorkspace}>
          Load
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleDelete()}
          disabled={!matchedWorkspace}
          className="text-destructive hover:text-destructive"
        >
          Delete
        </Button>

        {/* Status */}
        <span className={`text-sm shrink-0 ${statusColor}`}>{statusText}</span>
        {sourceRoot && (
          <span className="text-xs text-muted-foreground font-mono shrink-0">
            {sourceRoot}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />
      </div>
      <TailoringStatus />
    </>
  );
}
