import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useWorkspace } from '../../context';
import { cn } from '../../components/ui/utils';

type KeywordGroup = {
  label: string;
  items: string[];
  className: string;
};

function KeywordChips({ group, limit }: { group: KeywordGroup; limit?: number }) {
  const items = limit === undefined ? group.items : group.items.slice(0, limit);
  const remaining = limit === undefined ? 0 : Math.max(0, group.items.length - items.length);

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((kw) => (
        <span key={`${group.label}-${kw}`} className={cn('rounded-full px-2 py-0.5 text-xs', group.className)}>
          {kw}
        </span>
      ))}
      {remaining > 0 && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          +{remaining}
        </span>
      )}
    </div>
  );
}

export function KeywordsPanel() {
  const { state } = useWorkspace();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const activeJob = state.jobs.find(j => j.id === state.activeJobId);
  const gap = activeJob?.result?.gapAnalysis;
  if (!activeJob) return null;

  const matched = gap?.matched ?? [];
  const missing = gap?.missing ?? [];
  const partial = gap?.partial ?? [];
  const total = matched.length + missing.length + partial.length;
  const coverage = total > 0 ? Math.round(((matched.length + (partial.length * 0.5)) / total) * 100) : 0;
  const primaryGroup = missing.length > 0
    ? 'Missing'
    : partial.length > 0
      ? 'Partial'
      : 'Represented';
  const groups: KeywordGroup[] = [
    {
      label: 'Missing',
      items: missing,
      className: 'bg-destructive/15 text-destructive',
    },
    {
      label: 'Partial',
      items: partial,
      className: 'bg-yellow-400/15 text-yellow-700 dark:text-yellow-300',
    },
    {
      label: 'Represented',
      items: matched,
      className: 'bg-green-500/15 text-green-700 dark:text-green-300',
    },
  ];
  const previewGroup = groups.find((group) => group.label === primaryGroup && group.items.length > 0);

  return (
    <div className="panel-surface rounded-2xl px-4 py-3 space-y-2">
      <button
        type="button"
        aria-expanded={!isCollapsed}
        onClick={() => setIsCollapsed((current) => !current)}
        className="group flex w-full items-center justify-between gap-3 text-left"
      >
        <p className="editorial-label">Keyword Fit</p>
        <span className="inline-flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span>{total > 0 ? `${matched.length}/${total}` : 'Pending'}</span>
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5" />
          ) : (
            <ChevronUp className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
          )}
        </span>
      </button>
      {total > 0 && (
        <p className="text-xs text-muted-foreground">
          {coverage}% coverage · {matched.length} represented · {missing.length} missing
        </p>
      )}

      {total === 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">
          No keyword analysis yet. Tailor or re-grade this role to populate missing, partial, and represented terms.
        </p>
      ) : (
        <>
          <div className="flex h-2 w-full overflow-hidden rounded-full">
            {missing.length > 0 && (
              <div className="bg-destructive" style={{ width: `${(missing.length / total) * 100}%` }} />
            )}
            {partial.length > 0 && (
              <div className="bg-yellow-400" style={{ width: `${(partial.length / total) * 100}%` }} />
            )}
            {matched.length > 0 && (
              <div className="bg-green-500" style={{ width: `${(matched.length / total) * 100}%` }} />
            )}
          </div>

          {isCollapsed ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {partial.length} partial · {missing.length} missing
              </p>
              {previewGroup && (
                <KeywordChips group={previewGroup} limit={3} />
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                group.items.length > 0 && (
                  <div key={group.label}>
                    <p className="text-xs text-muted-foreground mb-1">{group.label}</p>
                    <KeywordChips group={group} />
                  </div>
                )
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
