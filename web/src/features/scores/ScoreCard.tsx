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
          {verdict && (
            <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-foreground/80">
              {verdict}
            </span>
          )}
          {confidence !== undefined && (
            <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {confidence}% confidence
            </span>
          )}
        </div>
      )}
    </div>
  );
}
