import { useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { X, RotateCcw } from 'lucide-react';
import { useWorkspace } from '../../context';
import type { ActivePanel } from '../../types';
import { SourcesPanel } from '../sources/SourcesPanel';
import { PromptsPanel } from '../prompts/PromptsPanel';
import { ConfigPanel } from '../config/ConfigPanel';
import { JobsPanel } from '../jobs/JobsPanel';
import { JdPanel } from '../jobs/JdPanel';
import * as api from '../../api/client';

const PANEL_CONFIG: Record<
  NonNullable<ActivePanel>,
  { title: string; subtitle: string; width: number; placeholder: string }
> = {
  jobs: {
    title: 'Jobs',
    subtitle: 'Opportunity list and application stages',
    width: 340,
    placeholder: 'Jobs panel',
  },
  sources: {
    title: 'Sources',
    subtitle: 'Resume, bio, and supporting source material',
    width: 480,
    placeholder: 'Sources panel',
  },
  config: {
    title: 'Config',
    subtitle: 'Providers, models, and run settings',
    width: 360,
    placeholder: 'Config panel',
  },
  prompts: {
    title: 'Prompts',
    subtitle: 'Prompt source files and prompt review',
    width: 360,
    placeholder: 'Prompts panel',
  },
  jd: {
    title: 'Job Description',
    subtitle: 'Full job description for the selected role',
    width: 420,
    placeholder: 'No job selected',
  },
};

export function PanelContainer() {
  const { state, dispatch } = useWorkspace();
  const [reloading, setReloading] = useState(false);

  if (!state.activePanel) return null;

  const config = PANEL_CONFIG[state.activePanel];
  const canReload = state.activePanel === 'sources' || state.activePanel === 'prompts';
  const showSubtitle = state.activePanel !== 'jobs' && state.activePanel !== 'jd';

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
      className="panel-surface flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-[1.65rem] lg:w-[var(--panel-width)]"
      style={{ '--panel-width': `${config.width}px` } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3 shrink-0">
        <div className="min-w-0">
          <p className="editorial-label">Workbench Panel</p>
          <h2 className="mt-1 font-[Manrope] text-base font-semibold tracking-[-0.03em] text-foreground">
            {config.title}
          </h2>
          {showSubtitle && (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {config.subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canReload && (
            <button
              onClick={handleReload}
              disabled={reloading}
              className="control-chip inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white hover:text-foreground disabled:opacity-40"
              title="Reload from disk"
            >
              <RotateCcw size={13} strokeWidth={2} className={reloading ? 'animate-spin' : ''} />
            </button>
          )}
          <button
            onClick={handleClose}
            className="control-chip inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
            title="Close panel"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {state.activePanel === 'jobs' ? (
          <JobsPanel />
        ) : state.activePanel === 'jd' ? (
          <JdPanel />
        ) : state.activePanel === 'sources' ? (
          <SourcesPanel />
        ) : state.activePanel === 'config' ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <ConfigPanel />
          </div>
        ) : state.activePanel === 'prompts' ? (
          <PromptsPanel />
        ) : (
          <div className="p-4">
            <p className="text-sm text-muted-foreground">{config.placeholder}</p>
          </div>
        )}
      </div>
    </div>
  );
}
