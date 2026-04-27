import { useState } from 'react';
import { MarkdownPreview } from './MarkdownPreview';
import { cn } from '@/components/ui/utils';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  ariaLabel?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minHeight = 140,
  ariaLabel,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  return (
    <div className="rounded border border-border bg-background">
      <div className="flex items-center gap-1 border-b border-border px-1 py-1">
        {(['write', 'preview'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMode(tab)}
            className={cn(
              'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
              mode === tab
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={mode === tab}
          >
            {tab === 'write' ? 'Write' : 'Preview'}
          </button>
        ))}
      </div>

      {mode === 'write' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
          className="block w-full resize-y bg-transparent p-2 font-mono text-xs leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          style={{ minHeight }}
          placeholder={placeholder}
          spellCheck={false}
        />
      ) : (
        <div
          className="overflow-y-auto p-3"
          style={{ minHeight }}
        >
          <MarkdownPreview markdown={value} emptyText="Nothing to preview." />
        </div>
      )}
    </div>
  );
}
