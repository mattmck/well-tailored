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

export function getScoreColors(score: number) {
  if (score >= 80) {
    return {
      text: 'text-emerald-700',
      bar: 'bg-emerald-500',
      glow: 'from-emerald-500/12 via-emerald-500/4 to-transparent',
    };
  }
  if (score >= 60) {
    return {
      text: 'text-amber-700',
      bar: 'bg-amber-500',
      glow: 'from-amber-500/12 via-amber-500/4 to-transparent',
    };
  }
  return {
    text: 'text-rose-700',
    bar: 'bg-rose-500',
    glow: 'from-rose-500/14 via-rose-500/4 to-transparent',
  };
}

export function getVerdictStyle(verdict: string): { className: string; label: string } {
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
export function getConfidenceStyle(confidence: number): string {
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
        'relative overflow-hidden rounded-[1.35rem] border border-border/80 bg-white/82 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] transition-all duration-200',
        onClick && 'cursor-pointer hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_18px_34px_rgba(43,45,51,0.08)]',
      )}
      onClick={onClick}
    >
      <div className={cn('absolute inset-x-0 top-0 h-20 bg-gradient-to-br opacity-80', colors.glow)} />

      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <span className="text-[11px] font-medium text-muted-foreground">
            {pct}/{maxScore}
          </span>
        </div>

        <div className="flex items-end gap-2">
          <p className={cn('font-[Manrope] text-[2.35rem] font-semibold leading-none tracking-[-0.06em]', colors.text)}>
            {score}
          </p>
          <span className="pb-1 text-sm text-muted-foreground">readiness</span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(116,121,134,0.12)]">
          <div
            className={cn('h-full rounded-full transition-all duration-300', colors.bar)}
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="text-[12px] leading-6 text-muted-foreground line-clamp-2">
          {summary}
        </p>

        {(verdict || confidence !== undefined) && (
          <div className="flex flex-wrap gap-1 pt-1">
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
    </div>
  );
}
