import { useWorkspace } from '../../context';
import { Badge } from '../../components/ui/badge';

function fitRatingColor(rating: string): string {
  const lower = rating.toLowerCase();
  if (lower.includes('strong') || lower.includes('excellent')) return 'text-green-700';
  if (lower.includes('good') || lower.includes('moderate')) return 'text-yellow-700';
  return 'text-red-700';
}

export function MissingKeywords() {
  const { state } = useWorkspace();
  const activeJob = state.jobs.find((j) => j.id === state.activeJobId);

  if (!activeJob || !activeJob.result?.gapAnalysis) return null;

  const { matched, missing, partial, fitRating } = activeJob.result.gapAnalysis;
  const total = matched.length + missing.length;

  return (
    <aside className="w-40 shrink-0 border-l border-border bg-card/70 px-3 py-3 flex flex-col min-h-0">
      <div className="shrink-0 space-y-1 pb-3 border-b border-border">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Keyword Fit
        </p>
        <p className={`text-sm font-semibold ${fitRatingColor(fitRating)}`}>
          {fitRating}
        </p>
        <p className="text-xs text-muted-foreground">
          {matched.length}/{total} matched
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pt-3 space-y-1.5">
        {matched.map((kw) => (
          <Badge
            key={`matched-${kw}`}
            variant="outline"
            className="w-full justify-start bg-green-100 text-green-800 border-green-200 rounded-full text-xs"
          >
            {kw}
          </Badge>
        ))}
        {partial.map((kw) => (
          <Badge
            key={`partial-${kw}`}
            variant="outline"
            className="w-full justify-start bg-yellow-100 text-yellow-800 border-yellow-200 rounded-full text-xs"
          >
            {kw}
          </Badge>
        ))}
        {missing.map((kw) => (
          <Badge
            key={`missing-${kw}`}
            variant="outline"
            className="w-full justify-start bg-red-100 text-red-800 border-red-200 rounded-full text-xs"
          >
            {kw}
          </Badge>
        ))}
        {matched.length === 0 && partial.length === 0 && missing.length === 0 && (
          <p className="text-xs text-muted-foreground">No keyword analysis yet.</p>
        )}
      </div>
    </aside>
  );
}
