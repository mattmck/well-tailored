import { X } from 'lucide-react';
import { useWorkspace } from '../../context';
import type { ActivePanel } from '../../types';
import { SourcesPanel } from '../sources/SourcesPanel';
import { PromptsPanel } from '../prompts/PromptsPanel';
import { ConfigPanel } from '../config/ConfigPanel';
import { JobsPanel } from '../jobs/JobsPanel';

const PANEL_CONFIG: Record<
  NonNullable<ActivePanel>,
  { title: string; width: number; placeholder: string }
> = {
  jobs: { title: 'JOBS', width: 340, placeholder: 'Jobs panel' },
  sources: { title: 'SOURCES', width: 360, placeholder: 'Sources panel' },
  config: { title: 'CONFIG', width: 360, placeholder: 'Config panel' },
  prompts: { title: 'PROMPTS', width: 360, placeholder: 'Prompts panel' },
};

export function PanelContainer() {
  const { state, dispatch } = useWorkspace();

  if (!state.activePanel) return null;

  const config = PANEL_CONFIG[state.activePanel];

  function handleClose() {
    dispatch({ type: 'SET_ACTIVE_PANEL', panel: null });
  }

  return (
    <div
      className="flex flex-col border-r border-border bg-card shrink-0 min-h-0"
      style={{ width: `${config.width}px` }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold tracking-widest text-muted-foreground">
          {config.title}
        </span>
        <button
          onClick={handleClose}
          className="text-muted-foreground hover:text-foreground transition-colors rounded p-0.5 hover:bg-secondary/50"
          title="Close panel"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Panel body */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {state.activePanel === 'jobs' ? (
          <JobsPanel />
        ) : state.activePanel === 'sources' ? (
          <SourcesPanel />
        ) : state.activePanel === 'config' ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <ConfigPanel />
          </div>
        ) : state.activePanel === 'prompts' ? (
          <PromptsPanel />
        ) : (
          <div className="p-3">
            <p className="text-sm text-muted-foreground">{config.placeholder}</p>
          </div>
        )}
      </div>
    </div>
  );
}
