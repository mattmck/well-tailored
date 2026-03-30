import { useState, useEffect, useRef } from 'react';
import * as api from '../../api/client';

interface DiffViewProps {
  original: string;
  modified: string;
}

export function DiffView({ original, modified }: DiffViewProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!original && !modified) {
      setHtml('');
      return;
    }

    // Abort any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    api
      .getDiff({ original, modified })
      .then((res) => {
        setHtml(res.html);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('DiffView: getDiff failed', err);
          setHtml(`<p style="color:red">Failed to load diff: ${err.message}</p>`);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [original, modified]);

  if (loading) {
    return (
      <div className="paper-pane flex h-full items-center justify-center rounded-[1.35rem] text-sm text-muted-foreground">
        Loading diff…
      </div>
    );
  }

  return (
    <div className="paper-pane h-full overflow-auto rounded-[1.35rem] p-4">
      <style>{`
        .diff-view {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          line-height: 1.6;
          color: #2b2d33;
        }
        .diff-line {
          display: grid;
          grid-template-columns: 1rem minmax(0, 1fr);
          gap: 0.5rem;
          padding: 0.18rem 0.75rem;
          border-radius: 0.85rem;
          border: 1px solid transparent;
          white-space: pre-wrap;
        }
        .diff-line__prefix {
          opacity: 0.8;
        }
        .diff-line--added {
          background-color: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.14);
          color: #166534;
        }
        .diff-line--removed {
          background-color: rgba(244, 63, 94, 0.1);
          border-color: rgba(244, 63, 94, 0.14);
          color: #991b1b;
        }
        .diff-line--unchanged {
          color: #6b7280;
        }
        .diff-view ins {
          background-color: rgba(34, 197, 94, 0.14);
          color: #14532d;
          text-decoration: none;
        }
        .diff-view del {
          background-color: rgba(244, 63, 94, 0.16);
          color: #7f1d1d;
          text-decoration: line-through;
        }
      `}</style>
      <div
        className="diff-view max-w-none space-y-1"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
