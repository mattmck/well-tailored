import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: false });

interface MarkdownPreviewProps {
  markdown: string;
  className?: string;
  emptyText?: string;
}

export function MarkdownPreview({ markdown, className, emptyText = 'Nothing to preview.' }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    if (!markdown.trim()) return '';
    const raw = marked.parse(markdown, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [markdown]);

  if (!html) {
    return (
      <div className={`md-preview text-xs italic text-muted-foreground ${className ?? ''}`}>
        {emptyText}
      </div>
    );
  }

  return (
    <div
      className={`md-preview ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
