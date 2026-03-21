import { useRef, useEffect } from 'react';
import type { MarkdownSection } from '../../lib/markdown';

interface EditorSectionProps {
  section: MarkdownSection;
  accepted: boolean;
  regenerating: boolean;
  onContentChange: (content: string) => void;
  onAccept: () => void;
  onRegenerate: () => void;
}

export function EditorSection({
  section,
  accepted,
  regenerating,
  onContentChange,
  onAccept,
  onRegenerate,
}: EditorSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(60, el.scrollHeight)}px`;
  }, [section.content]);

  const headingText = section.heading.replace(/^#+\s*/, '');

  return (
    <div className="border-b border-border py-3 px-3">
      {/* Header row */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="flex-1 text-sm font-semibold text-foreground truncate">
          {headingText || <span className="text-muted-foreground italic">Untitled</span>}
        </span>

        {/* Accept button */}
        <button
          type="button"
          title={accepted ? 'Accepted' : 'Mark as accepted'}
          onClick={onAccept}
          className={`p-1 rounded transition-colors hover:bg-secondary/60 ${
            accepted ? 'text-emerald-600' : 'text-muted-foreground'
          }`}
        >
          {/* Checkmark icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>

        {/* Regenerate button */}
        <button
          type="button"
          title="Regenerate section"
          onClick={onRegenerate}
          disabled={regenerating}
          className="p-1 rounded transition-colors hover:bg-secondary/60 text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {regenerating ? (
            /* Spinner */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-spin"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            /* Refresh icon */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
          )}
        </button>
      </div>

      {/* Content textarea */}
      <textarea
        ref={textareaRef}
        value={section.content}
        onChange={(e) => onContentChange(e.target.value)}
        className="w-full resize-none rounded-md border border-border bg-card text-sm leading-relaxed px-2 py-1.5 outline-none focus:border-ring transition-colors text-foreground placeholder:text-muted-foreground"
        style={{ minHeight: '60px' }}
        spellCheck={false}
        placeholder="Section content…"
      />
    </div>
  );
}
