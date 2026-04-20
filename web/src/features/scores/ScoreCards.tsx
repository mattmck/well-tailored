import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useWorkspace } from '@/context';
import { cn } from '@/components/ui/utils';
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

  function renderCompactDocument(document: typeof documentCards[number]) {
    const colors = getScoreColors(document.overall);
    const verdictStyle = document.verdict ? getVerdictStyle(document.verdict) : null;
    const confidenceStyle = document.confidence !== undefined
      ? getConfidenceStyle(document.confidence)
      : null;

    return (
      <div
        key={document.id}
        className="rounded-[1.05rem] border border-border/80 bg-white/80 px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {document.label}
          </p>
          <span className={cn('font-[Manrope] text-lg font-semibold tracking-[-0.05em]', colors.text)}>
            {document.overall}
          </span>
          <button
            type="button"
            onClick={() => openDetails(document.id)}
            className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="View score details"
            aria-label={`View ${document.label} score details`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>

        {(verdictStyle || confidenceStyle) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
        )}
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-border/70 px-5 py-4">
        <div className="flex items-center gap-2">
          <p className="editorial-label">Match Readiness</p>
          <button
            type="button"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'Expand score cards' : 'Collapse score cards'}
            onClick={() => setIsCollapsed((current) => !current)}
            className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {isCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
          {currentJob.scoresStale && (
            <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              Stale
            </span>
          )}
        </div>

        {isCollapsed ? (
          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
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
