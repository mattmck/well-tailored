import { useWorkspace } from '../../context';
import { Button } from '../../components/ui/button';

export function TopBar() {
  const { state, dispatch } = useWorkspace();

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

  function handleSave() {
    // Save workspace — wired up in a later task
  }

  function handleDelete() {
    // Delete workspace — wired up in a later task
  }

  return (
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
        className="bg-background border border-border rounded-md px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-ring/50"
      />

      {/* Status */}
      <span className={`text-sm shrink-0 ${statusColor}`}>{statusText}</span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Workspace picker */}
      {state.savedWorkspaces.length > 0 && (
        <select
          className="bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 max-w-[180px]"
          value={state.activeWorkspaceId ?? ''}
          onChange={(e) => {
            const id = e.target.value || null;
            dispatch({ type: 'SET_ACTIVE_WORKSPACE', id });
          }}
        >
          <option value="">Open workspace…</option>
          {state.savedWorkspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>
      )}

      {/* Save button */}
      <Button variant="outline" size="sm" onClick={handleSave}>
        Save
      </Button>

      {/* Delete button */}
      <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
        Delete
      </Button>
    </div>
  );
}
