import { useWorkspace } from '@/context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/components/ui/utils';

function getScoreColors(score: number) {
  if (score >= 80) return { text: 'text-emerald-600', bar: 'bg-emerald-500' };
  if (score >= 60) return { text: 'text-amber-600', bar: 'bg-amber-500' };
  return { text: 'text-red-500', bar: 'bg-red-500' };
}

function MiniBar({ score, maxScore = 100 }: { score: number; maxScore?: number }) {
  const colors = getScoreColors(score);
  const pct = Math.min(100, Math.round((score / maxScore) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-all', colors.bar)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ScoreDetailsModal() {
  const { state, dispatch } = useWorkspace();

  const isOpen = state.activeScoreDetailsId !== null;
  const activeJob = state.jobs.find((j) => j.id === state.activeJobId);
  const scorecard = activeJob?.result?.scorecard;
  const activeDocument = scorecard?.documents.find((document) => document.id === state.activeScoreDetailsId)
    ?? scorecard?.documents[0];

  function onOpenChange(open: boolean) {
    if (!open) {
      dispatch({ type: 'SET_SCORE_DETAILS', id: null });
    }
  }

  if (!scorecard) return null;

  const overallScore = activeDocument?.overall ?? scorecard.overall;
  const overallColors = getScoreColors(overallScore);
  const detailTitle = activeDocument?.label ?? 'Score Details';
  const detailSummary = activeDocument?.summary ?? scorecard.summary;
  const detailVerdict = activeDocument?.verdict ?? scorecard.verdict;
  const detailConfidence = activeDocument?.confidence ?? scorecard.confidence;
  const detailCategories = activeDocument?.categories.length ? activeDocument.categories : scorecard.categories;
  const detailNotes = activeDocument?.notes.length ? activeDocument.notes : scorecard.notes;
  const detailIssues = activeDocument?.blockingIssues.length ? activeDocument.blockingIssues : scorecard.blockingIssues;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-semibold">{detailTitle}</DialogTitle>
        </DialogHeader>

        {/* Overall strip */}
        <div className="shrink-0 border-b border-border px-6 py-4">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">Overall Assessment</h3>
                {detailVerdict && (
                  <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-foreground/80">
                    {detailVerdict}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {detailConfidence}% confidence
                </span>
              </div>
              <MiniBar score={overallScore} />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {detailSummary}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={cn('text-4xl font-bold leading-none', overallColors.text)}>
                {overallScore}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Overall
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable body: Notes + Issues (left) | Category Breakdown (right) */}
        <div className="flex-1 grid gap-6 overflow-y-auto px-6 py-4 md:grid-cols-2">
          <div className="space-y-6">
            {detailNotes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Notes</h3>
                <ul className="space-y-2">
                  {detailNotes.map((note, index) => (
                    <li
                      key={`${detailTitle}-note-${index}`}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground leading-relaxed"
                    >
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detailIssues.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Blocking Issues</h3>
                <ul className="space-y-2">
                  {detailIssues.map((issue, index) => (
                    <li
                      key={`${detailTitle}-issue-${index}`}
                      className="flex items-start gap-2 rounded-md bg-red-500/8 px-3 py-2 text-sm text-red-700 dark:text-red-400"
                    >
                      <span className="mt-0.5 shrink-0 text-red-500">•</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {detailCategories.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Category Breakdown</h3>
              {detailCategories.map((cat, i) => {
                const catColors = getScoreColors(cat.score);
                return (
                  <div key={i} className="space-y-2 rounded-lg border border-border p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">{cat.name}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          weight {Math.round(cat.weight * 100)}%
                        </span>
                      </div>
                      <span className={cn('shrink-0 text-xl font-bold', catColors.text)}>
                        {cat.score}
                      </span>
                    </div>
                    <MiniBar score={cat.score} />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {cat.summary}
                    </p>
                    {cat.issues && cat.issues.length > 0 && (
                      <ul className="mt-1 space-y-1">
                        {cat.issues.map((issue, j) => (
                          <li
                            key={j}
                            className="flex items-start gap-2 rounded-md bg-red-500/8 px-2.5 py-1.5 text-xs text-red-700 dark:text-red-400"
                          >
                            <span className="mt-0.5 shrink-0 text-red-500">•</span>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
