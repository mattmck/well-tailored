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
    <div className="border-t border-border bg-card px-3 py-2 flex items-center gap-3 shrink-0">
      <span className={`text-xs font-semibold whitespace-nowrap ${fitRatingColor(fitRating)}`}>
        {fitRating}
      </span>
      <div className="flex-1 overflow-x-auto">
        <div className="flex items-center gap-1.5 w-max">
          {matched.map((kw) => (
            <Badge
              key={`matched-${kw}`}
              variant="outline"
              className="bg-green-100 text-green-800 border-green-200 rounded-full text-xs"
            >
              {kw}
            </Badge>
          ))}
          {partial.map((kw) => (
            <Badge
              key={`partial-${kw}`}
              variant="outline"
              className="bg-yellow-100 text-yellow-800 border-yellow-200 rounded-full text-xs"
            >
              {kw}
            </Badge>
          ))}
          {missing.map((kw) => (
            <Badge
              key={`missing-${kw}`}
              variant="outline"
              className="bg-red-100 text-red-800 border-red-200 rounded-full text-xs"
            >
              {kw}
            </Badge>
          ))}
        </div>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {matched.length}/{total} matched
      </span>
    </div>
  );
}
