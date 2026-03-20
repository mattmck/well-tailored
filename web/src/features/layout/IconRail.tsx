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
      className="bg-card border-r border-border flex flex-col items-center py-2 gap-1 shrink-0"
      style={{ width: '48px' }}
    >
      {ITEMS.map(({ id, icon: Icon, label }) => {
        const isActive = state.activePanel === id;
        return (
          <div key={id} className="relative w-full flex justify-center">
            {/* Active accent bar */}
            {isActive && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-sm bg-primary"
                style={{ width: '3px', height: '24px' }}
              />
            )}
            <button
              title={label}
              onClick={() => handleClick(id)}
              className={[
                'flex items-center justify-center rounded-lg transition-colors',
                isActive
                  ? 'bg-secondary text-primary'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
              ].join(' ')}
              style={{ width: '36px', height: '36px' }}
            >
              <Icon size={18} strokeWidth={1.75} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
