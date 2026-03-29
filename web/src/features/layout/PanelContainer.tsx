import { useState } from 'react';
import { toast } from 'sonner';
import { X, RotateCcw } from 'lucide-react';
import { useWorkspace } from '../../context';
import type { ActivePanel } from '../../types';
import { SourcesPanel } from '../sources/SourcesPanel';
import { PromptsPanel } from '../prompts/PromptsPanel';
import { ConfigPanel } from '../config/ConfigPanel';
import { JobsPanel } from '../jobs/JobsPanel';
import * as api from '../../api/client';

const PANEL_CONFIG: Record<
  NonNullable<ActivePanel>,
  { title: string; width: number; placeholder: string }
> = {
  jobs: { title: 'JOBS', width: 340, placeholder: 'Jobs panel' },
  sources: { title: 'SOURCES', width: 480, placeholder: 'Sources panel' },
  config: { title: 'CONFIG', width: 360, placeholder: 'Config panel' },
  prompts: { title: 'PROMPTS', width: 360, placeholder: 'Prompts panel' },
};

export function PanelContainer() {
  const { state, dispatch } = useWorkspace();
  const [reloading, setReloading] = useState(false);

  if (!state.activePanel) return null;

  const config = PANEL_CONFIG[state.activePanel];
  const canReload = state.activePanel === 'sources' || state.activePanel === 'prompts';

  function handleClose() {
    dispatch({ type: 'SET_ACTIVE_PANEL', panel: null });
  }

  async function handleReload() {
    setReloading(true);
    try {
      const ws = await api.getLocalWorkspace();
      if (state.activePanel === 'sources') {
        const docs = ws.documents || {} as Record<string, string>;
        dispatch({ type: 'SET_SOURCE', field: 'sourceResume', value: docs.resume || '' });
        dispatch({ type: 'SET_SOURCE', field: 'sourceBio', value: docs.bio || '' });
        dispatch({ type: 'SET_SOURCE', field: 'sourceCoverLetter', value: docs.baseCoverLetter || '' });
        dispatch({ type: 'SET_SOURCE', field: 'sourceSupplemental', value: docs.resumeSupplemental || '' });
        dispatch({ type: 'SET_SOURCE_PATHS', paths: ws.paths || {} });
      } else if (state.activePanel === 'prompts') {
        dispatch({ type: 'SET_PROMPT_SOURCES', sources: ws.prompts || {} });
      }
      toast.success('Reloaded from disk');
    } catch (err) {
      console.error('Reload from disk failed:', err);
      toast.error('Reload from disk failed');
    } finally {
      setReloading(false);
    }
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
        <div className="flex items-center gap-1">
          {canReload && (
            <button
              onClick={handleReload}
              disabled={reloading}
              className="text-muted-foreground hover:text-foreground transition-colors rounded p-0.5 hover:bg-secondary/50 disabled:opacity-40"
              title="Reload from disk"
            >
              <RotateCcw size={13} strokeWidth={2} className={reloading ? 'animate-spin' : ''} />
            </button>
          )}
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors rounded p-0.5 hover:bg-secondary/50"
            title="Close panel"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
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
