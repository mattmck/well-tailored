import type { ElementType, ReactNode } from 'react';
import { cn } from '@/components/ui/utils';

interface WorkbenchEmptyStateProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: ElementType;
  tips?: string[];
  action?: ReactNode;
  className?: string;
}

export function WorkbenchEmptyState({
  eyebrow,
  title,
  description,
  icon: Icon,
  tips = [],
  action,
  className,
}: WorkbenchEmptyStateProps) {
  return (
    <section
      className={cn(
        'empty-state-card page-enter flex min-h-[20rem] flex-col justify-between px-6 py-6',
        className,
      )}
    >
      <div className="empty-state-orb" />

      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-[1.25rem] bg-primary text-primary-foreground shadow-[0_12px_28px_rgba(49,74,116,0.24)]">
            <Icon className="size-6" strokeWidth={1.8} />
          </div>
          <div className="space-y-1">
            <p className="editorial-label">{eyebrow}</p>
            <h2 className="font-[Manrope] text-[1.55rem] font-semibold leading-tight tracking-[-0.04em] text-foreground">
              {title}
            </h2>
          </div>
        </div>

        <p className="max-w-xl text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="relative z-10 mt-8 flex flex-col gap-4">
        {tips.length > 0 && (
          <div className="grid gap-2 md:grid-cols-3">
            {tips.map((tip) => (
              <div
                key={tip}
                className="rounded-2xl border border-border/70 bg-white/60 px-3 py-3 text-sm leading-6 text-foreground/82"
              >
                {tip}
              </div>
            ))}
          </div>
        )}

        {action && (
          <div className="flex flex-wrap items-center gap-3">
            {action}
          </div>
        )}
      </div>
    </section>
  );
}
