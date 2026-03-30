import { Briefcase, FileText, Settings, MessageSquare } from 'lucide-react';
import { useWorkspace } from '../../context';
import type { ActivePanel } from '../../types';

interface RailItem {
  id: ActivePanel;
  icon: React.ElementType;
  label: string;
}

const ITEMS: RailItem[] = [
  { id: 'jobs', icon: Briefcase, label: 'Jobs' },
  { id: 'sources', icon: FileText, label: 'Sources' },
  { id: 'config', icon: Settings, label: 'Config' },
  { id: 'prompts', icon: MessageSquare, label: 'Prompts' },
];

export function IconRail() {
  const { state, dispatch } = useWorkspace();

  function handleClick(id: ActivePanel) {
    // Toggle: clicking the active panel closes it
    const next = state.activePanel === id ? null : id;
    dispatch({ type: 'SET_ACTIVE_PANEL', panel: next });
  }

  return (
    <div
      className="panel-surface flex w-full shrink-0 flex-row items-center justify-center gap-2 rounded-[1.55rem] px-3 py-2 lg:w-[74px] lg:flex-col lg:px-2 lg:py-3"
    >
      <div className="control-chip inline-flex h-9 w-9 items-center justify-center rounded-[1rem] text-[11px] font-semibold tracking-[0.16em] text-primary lg:mb-1">
        WT
      </div>

      {ITEMS.map(({ id, icon: Icon, label }) => {
        const isActive = state.activePanel === id;
        return (
          <div key={id} className="relative flex justify-center lg:w-full">
            <button
              title={label}
              onClick={() => handleClick(id)}
              aria-pressed={isActive}
              className={[
                'flex size-11 items-center justify-center rounded-[1rem] border transition-all duration-200',
                isActive
                  ? 'border-primary/15 bg-primary text-primary-foreground shadow-[0_12px_26px_rgba(49,74,116,0.22)]'
                  : 'border-transparent bg-white/50 text-muted-foreground hover:-translate-y-0.5 hover:border-border/80 hover:bg-white/85 hover:text-foreground',
              ].join(' ')}
            >
              <Icon size={18} strokeWidth={1.75} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
