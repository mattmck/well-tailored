import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useWorkspace } from '@/context';
import { ScoreCard } from './ScoreCard';
import { ScoreDetailsModal } from './ScoreDetailsModal';
import * as api from '@/api/client';

export function ScoreCards() {
  const { state, dispatch } = useWorkspace();
  const [regrading, setRegrading] = useState(false);

  const activeJob = state.jobs.find((j) => j.id === state.activeJobId);
  const scorecard = activeJob?.result?.scorecard;

  if (!activeJob || !scorecard) return null;

  function openDetails(id: string) {
    dispatch({ type: 'SET_SCORE_DETAILS', id });
  }

  async function handleRegrade() {
    if (!activeJob?.result?.output?.resume || !activeJob?.jd) return;
    setRegrading(true);
    try {
      const [score, gap] = await Promise.all([
        api.getScore({
          resume: activeJob.result.output.resume,
          jd: activeJob.jd,
          provider: state.scoreProvider !== 'auto' ? state.scoreProvider : undefined,
          model: state.scoreModel !== 'auto' ? state.scoreModel : undefined,
        }),
        api.getGapAnalysis({
          resume: activeJob.result.output.resume,
          jd: activeJob.jd,
        }),
      ]);

      dispatch({
        type: 'UPDATE_JOB',
        id: activeJob.id,
        patch: {
          result: {
            ...activeJob.result,
            scorecard: score as import('@/types').Scorecard,
            gapAnalysis: gap,
          },
        },
      });
      dispatch({ type: 'SET_SCORES_STALE', stale: false });
    } catch (err) {
      console.error('Re-grade failed:', err);
    } finally {
      setRegrading(false);
    }
  }

  return (
    <>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground/70">Score</span>
            {state.scoresStale && (
              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                Stale
              </span>
            )}
          </div>
          <button
            onClick={handleRegrade}
            disabled={regrading}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-3 w-3 ${regrading ? 'animate-spin' : ''}`} />
            Re-grade
          </button>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2.5">
          {/* Overall score card */}
          <ScoreCard
            label="Overall"
            score={scorecard.overall}
            summary={scorecard.summary}
            verdict={scorecard.verdict}
            confidence={scorecard.confidence}
            onClick={() => openDetails('overall')}
          />

          {/* Category cards */}
          {scorecard.categories.map((cat, i) => (
            <ScoreCard
              key={cat.name}
              label={cat.name}
              score={cat.score}
              summary={cat.summary}
              issues={cat.issues}
              onClick={() => openDetails(`category-${i}`)}
            />
          ))}
        </div>
      </div>

      <ScoreDetailsModal />
    </>
  );
}
