import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkspace } from '../../context';

function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(200, el.scrollHeight)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full resize-none rounded-[1.1rem] border border-border/50 bg-white/60 px-3 py-3 text-xs leading-relaxed text-foreground/80 outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-white/80"
      style={{ minHeight: '200px' }}
      spellCheck={false}
    />
  );
}

export function JdPanel() {
  const { state, dispatch } = useWorkspace();
  const activeJob = state.jobs.find((j) => j.id === state.activeJobId);

  if (!activeJob) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">No job selected.</p>
      </div>
    );
  }

  function handleJdChange(value: string) {
    dispatch({ type: 'UPDATE_JOB', id: activeJob!.id, patch: { jd: value } });
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="px-4 pb-4 pt-2">
        <div className="mb-3">
          <p className="text-base font-semibold text-foreground leading-tight">{activeJob.company}</p>
          {activeJob.title && (
            <p className="mt-0.5 text-sm text-muted-foreground">{activeJob.title}</p>
          )}
        </div>
        <AutoTextarea
          value={activeJob.jd}
          onChange={handleJdChange}
          placeholder="Paste job description here…"
        />
      </div>
    </ScrollArea>
  );
}
