import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Circle, RefreshCw } from 'lucide-react';
import { useWorkspace } from '@/context';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/components/ui/utils';
import { appendUniqueJobIdsToQueue } from '@/lib/queues';
import {
  getConfidenceStyle,
  getScoreColors,
  getVerdictStyle,
  ScoreCard,
} from './ScoreCard';
import { ScoreDetailsModal } from './ScoreDetailsModal';

export function ScoreCards() {
  const { state, dispatch } = useWorkspace();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const activeJob = state.jobs.find((j) => j.id === state.activeJobId);
  const scorecard = activeJob?.result?.scorecard;

  if (!activeJob || !scorecard) return null;
  const currentJob = activeJob;

  const regrading = state.regradeRunning === currentJob.id;
  const queued = !regrading && state.regradeQueue.includes(currentJob.id);
  const canRegrade =
    Boolean(currentJob.result)
    && (
      currentJob.scoresStale
      || !currentJob.result?.scorecard
      || !currentJob.result?.gapAnalysis
    );
  const canReview = currentJob.status === 'tailored' || currentJob.status === 'reviewed';

  const documentCards = scorecard.documents.length > 0
    ? scorecard.documents
    : [
        {
          id: 'resume',
          label: 'Resume',
          overall: scorecard.overall,
          summary: scorecard.summary,
          verdict: scorecard.verdict,
          confidence: scorecard.confidence,
        },
      ];

  function openDetails(id: string) {
    dispatch({ type: 'SET_SCORE_DETAILS', id });
  }

  function handleRegrade() {
    const next = appendUniqueJobIdsToQueue({
      queue: state.regradeQueue,
      runningId: state.regradeRunning,
      total: state.regradeQueueTotal,
      incomingIds: [currentJob.id],
    });

    if (next.added.length === 0) return;

    dispatch({
      type: 'SET_REGRADE_QUEUE',
      queue: next.queue,
      total: next.total,
    });
  }

  function handleToggleReviewed() {
    const next = currentJob.status === 'reviewed' ? 'tailored' : 'reviewed';
    dispatch({ type: 'UPDATE_JOB', id: currentJob.id, patch: { status: next } });
  }

  function renderCompactDocument(document: typeof documentCards[number]) {
    const colors = getScoreColors(document.overall);
    const verdictStyle = document.verdict ? getVerdictStyle(document.verdict) : null;
    const confidenceStyle = document.confidence !== undefined
      ? getConfidenceStyle(document.confidence)
      : null;

    return (
      <button
        key={document.id}
        type="button"
        onClick={() => openDetails(document.id)}
        className="group rounded-[1.05rem] border border-border/80 bg-white/80 px-4 py-3 text-left transition-all duration-200 hover:border-primary/20 hover:bg-white/90"
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {document.label}
              </p>
              <span className={cn('font-[Manrope] text-lg font-semibold tracking-[-0.05em]', colors.text)}>
                {document.overall}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="shrink-0 text-sm font-medium text-foreground">
                {document.label}
              </span>
              <Progress
                value={document.overall}
                className="h-2.5 flex-1 bg-[rgba(116,121,134,0.14)]"
              />
            </div>
          </div>

          <div className="flex flex-col items-start gap-1 lg:items-end">
            {verdictStyle && (
              <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', verdictStyle.className)}>
                {verdictStyle.label}
              </span>
            )}
            {confidenceStyle && document.confidence !== undefined && (
              <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', confidenceStyle)}>
                {document.confidence}% confidence
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <>
      <div className="border-b border-border/70 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="editorial-label">Match Readiness</p>
            <div className="mt-2 flex flex-wrap items-start gap-3">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() => setIsCollapsed((current) => !current)}
                className={cn(
                  'group relative inline-flex max-w-full items-center gap-3 rounded-t-[1.2rem] rounded-b-[0.9rem] border px-4 py-2.5 text-left shadow-[0_12px_28px_rgba(43,45,51,0.06)] transition-all duration-200',
                  isCollapsed
                    ? 'border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,245,238,0.92))] hover:border-primary/25 hover:bg-white'
                    : 'border-primary/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,237,229,0.96))] hover:border-primary/30',
                )}
              >
                <span className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-[rgba(255,255,255,0.72)]" />
                <span className="min-w-0">
                  <span className="block font-[Manrope] text-base font-semibold tracking-[-0.04em] text-foreground">
                    Score band
                  </span>
                  <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {isCollapsed ? 'Condensed' : 'Expanded'}
                  </span>
                </span>
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-y-0.5" />
                ) : (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5" />
                )}
              </button>

              <span className="pt-2 text-sm text-muted-foreground">
                {currentJob.company} · {currentJob.title}
              </span>
            </div>

            {currentJob.scoresStale && (
              <span className="mt-2 inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                Stale
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {canReview && (
              <Button
                onClick={handleToggleReviewed}
                variant={currentJob.status === 'reviewed' ? 'default' : 'outline'}
                size="sm"
                className={currentJob.status === 'reviewed' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                {currentJob.status === 'reviewed'
                  ? <CheckCircle2 className="h-3 w-3" />
                  : <Circle className="h-3 w-3" />}
                {currentJob.status === 'reviewed' ? 'Reviewed' : 'Mark reviewed'}
              </Button>
            )}

            <Button
              onClick={handleRegrade}
              disabled={!canRegrade || regrading || queued}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-3 w-3 ${regrading ? 'animate-spin' : ''}`} />
              {regrading ? 'Re-grading…' : queued ? 'Queued' : 'Re-grade'}
            </Button>
          </div>
        </div>

        {isCollapsed ? (
          <div className="mt-4 space-y-2.5">
            {documentCards.map((document) => renderCompactDocument(document))}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            {documentCards.map((document) => (
              <ScoreCard
                key={document.id}
                label={document.label}
                score={document.overall}
                summary={document.summary}
                verdict={document.verdict}
                confidence={document.confidence}
                onClick={() => openDetails(document.id)}
              />
            ))}
          </div>
        )}
      </div>

      <ScoreDetailsModal />
    </>
  );
}
