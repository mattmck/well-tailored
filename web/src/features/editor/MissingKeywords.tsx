import { useWorkspace } from '../../context';
import { Badge } from '../../components/ui/badge';

function fitRatingColor(rating: string): string {
  const lower = rating.toLowerCase();
  if (lower.includes('strong') || lower.includes('excellent')) return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700';
  if (lower.includes('good') || lower.includes('moderate')) return 'border-amber-500/20 bg-amber-500/10 text-amber-700';
  return 'border-rose-500/20 bg-rose-500/10 text-rose-700';
}

export function MissingKeywords() {
  const { state } = useWorkspace();
  const activeJob = state.jobs.find((j) => j.id === state.activeJobId);

  if (!activeJob || !activeJob.result?.gapAnalysis) return null;

  const { matched, missing, partial, fitRating } = activeJob.result.gapAnalysis;
  const total = matched.length + partial.length + missing.length;
  const coverage = total > 0
    ? Math.round(((matched.length + (partial.length * 0.5)) / total) * 100)
    : 0;

  const groups = [
    {
      label: 'Matched',
      items: matched,
      className: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/16',
    },
    {
      label: 'Partial',
      items: partial,
      className: 'bg-amber-500/10 text-amber-800 border-amber-500/16',
    },
    {
      label: 'Missing',
      items: missing,
      className: 'bg-rose-500/10 text-rose-800 border-rose-500/16',
    },
  ];

  return (
    <aside className="panel-surface flex min-h-0 w-full flex-1 flex-col rounded-[1.65rem] px-4 py-4">
      <div className="shrink-0 border-b border-border/70 pb-4">
        <div className="flex items-start justify-between gap-2">
          <p className="editorial-label">Keyword Fit</p>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${fitRatingColor(fitRating)}`}>
            {fitRating}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {matched.length} matched{partial.length > 0 ? ` · ${partial.length} partial` : ''} · {missing.length} missing
        </p>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(116,121,134,0.12)]">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${coverage}%` }}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pt-4">
        {groups.some((group) => group.items.length > 0) ? (
          <div className="space-y-4">
            {groups.map((group) => (
              group.items.length > 0 && (
                <section key={group.label} className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((keyword) => (
                      <Badge
                        key={`${group.label}-${keyword}`}
                        variant="outline"
                        className={`justify-start rounded-full border px-2.5 py-1 text-xs font-medium ${group.className}`}
                      >
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </section>
              )
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No keyword analysis yet.</p>
        )}
      </div>
    </aside>
  );
}
