import { cn } from '@/components/ui/utils';

export interface ScoreCardProps {
  label: string;
  score: number;
  maxScore?: number;
  summary: string;
  verdict?: string;
  confidence?: number;
  issues?: string[];
  onClick?: () => void;
}

function getScoreColors(score: number) {
  if (score >= 80) return { text: 'text-emerald-600', bar: 'bg-emerald-500' };
  if (score >= 60) return { text: 'text-amber-600', bar: 'bg-amber-500' };
  return { text: 'text-red-500', bar: 'bg-red-500' };
}

function getVerdictStyle(verdict: string): { className: string; label: string } {
  switch (verdict) {
    case 'strong_submit':
      return { className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30', label: 'Strong Submit' };
    case 'submit_after_minor_edits':
      return { className: 'bg-amber-400/15 text-amber-700 border-amber-400/30', label: 'Minor Edits' };
    case 'needs_revision':
      return { className: 'bg-orange-500/15 text-orange-700 border-orange-500/30', label: 'Needs Revision' };
    case 'do_not_submit':
      return { className: 'bg-red-500/15 text-red-700 border-red-500/30', label: 'Do Not Submit' };
    default:
      return {
        className: 'bg-muted text-muted-foreground border-border',
        label: verdict.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      };
  }
}

// confidence is a 0–100 integer (percentage points, not a 0–1 fraction)
function getConfidenceStyle(confidence: number): string {
  if (confidence >= 80) return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
  if (confidence >= 60) return 'bg-amber-400/10 text-amber-700 border-amber-400/20';
  return 'bg-red-500/10 text-red-700 border-red-500/20';
}

export function ScoreCard({
  label,
  score,
  maxScore = 100,
  summary,
  verdict,
  confidence,
  onClick,
}: ScoreCardProps) {
  const colors = getScoreColors(score);
  const pct = Math.min(100, Math.round((score / maxScore) * 100));

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-xl p-3.5 flex flex-col gap-1.5',
        onClick && 'cursor-pointer hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all',
      )}
      onClick={onClick}
    >
      {/* Eyebrow */}
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">
        {label}
      </p>

      {/* Score value */}
      <p className={cn('text-[34px] font-bold leading-none', colors.text)}>
        {score}
      </p>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', colors.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Summary */}
      <p className="text-[12px] text-muted-foreground leading-snug line-clamp-2">
        {summary}
      </p>

      {/* Badges */}
      {(verdict || confidence !== undefined) && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {verdict && (() => {
            const vs = getVerdictStyle(verdict);
            return (
              <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', vs.className)}>
                {vs.label}
              </span>
            );
          })()}
          {confidence !== undefined && (
            <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', getConfidenceStyle(confidence))}>
              {confidence}% confidence
            </span>
          )}
        </div>
      )}
    </div>
  );
}
