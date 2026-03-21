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
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading diff…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <style>{`
        .diff-view {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          line-height: 1.6;
        }
        .diff-line {
          display: grid;
          grid-template-columns: 1rem minmax(0, 1fr);
          gap: 0.5rem;
          padding: 0.125rem 0.5rem;
          border-radius: 0.375rem;
          white-space: pre-wrap;
        }
        .diff-line__prefix {
          opacity: 0.8;
        }
        .diff-line--added {
          background-color: #dcfce7;
          color: #166534;
        }
        .diff-line--removed {
          background-color: #fee2e2;
          color: #991b1b;
        }
        .diff-line--unchanged {
          color: #6b7280;
        }
        .diff-view ins {
          background-color: #bbf7d0;
          color: #14532d;
          text-decoration: none;
        }
        .diff-view del {
          background-color: #fecaca;
          color: #7f1d1d;
          text-decoration: line-through;
        }
      `}</style>
      <div
        className="diff-view prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
