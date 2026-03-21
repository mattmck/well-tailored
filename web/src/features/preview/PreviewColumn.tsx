import { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkspace } from '../../context';
import { DiffView } from './DiffView';
import { reconstructEditorData } from '../../lib/markdown';
import * as api from '../../api/client';

export function PreviewColumn() {
  const { state, dispatch } = useWorkspace();
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);

  const job = state.activeJobId
    ? state.jobs.find((j) => j.id === state.activeJobId)
    : null;

  // Derive the current markdown for the active document
  const activeMarkdown = (() => {
    if (!job?.result) return null;

    const rawMarkdown =
      state.activeDoc === 'resume'
        ? job.result.output.resume
        : job.result.output.coverLetter;

    // If there is editorData, reconstruct from the edited sections
    if (job._editorData) {
      return reconstructEditorData(job._editorData);
    }

    return rawMarkdown;
  })();

  // Derive the original markdown for diffing
  const originalMarkdown = (() => {
    if (state.activeDoc === 'resume') {
      return state.sourceResume;
    }
    // Cover letter: use the stored baseCoverLetter
    return state.sourceCoverLetter;
  })();

  // Render HTML preview when content or mode changes
  useEffect(() => {
    if (state.viewMode !== 'preview') return;
    if (!activeMarkdown) {
      setPreviewHtml('');
      setPreviewHeight(null);
      return;
    }

    // Debounce to avoid hammering the API on every keystroke
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewLoading(true);
      api
        .renderHtml({
          markdown: activeMarkdown,
          kind: state.activeDoc === 'resume' ? 'resume' : 'coverLetter',
          title: job?.title || 'Tailored document',
        })
        .then((res) => {
          setPreviewHtml(res.html);
        })
        .catch((err) => {
          console.error('PreviewColumn: renderHtml failed', err);
        })
        .finally(() => {
          setPreviewLoading(false);
        });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeMarkdown, job?.title, state.activeDoc, state.viewMode]);

  const handleExportPdf = useCallback(async () => {
    if (!activeMarkdown || exportingPdf) return;
    setExportingPdf(true);
    try {
      const blob = await api.exportPdf({
        markdown: activeMarkdown,
        kind: state.activeDoc === 'resume' ? 'resume' : 'coverLetter',
        title: job?.title || 'Tailored document',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = job
        ? `${job.company}-${job.title}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        : 'document';
      a.download = `${state.activeDoc === 'resume' ? 'resume' : 'cover-letter'}-${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PreviewColumn: exportPdf failed', err);
    } finally {
      setExportingPdf(false);
    }
  }, [activeMarkdown, exportingPdf, job, state.activeDoc]);

  const handleSetViewMode = useCallback(
    (mode: 'preview' | 'diff') => {
      dispatch({ type: 'SET_VIEW_MODE', mode });
    },
    [dispatch]
  );

  const syncPreviewHeight = useCallback(() => {
    const iframe = previewFrameRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;

    const contentRoot = doc.body.firstElementChild as HTMLElement | null;
    const nextHeight = Math.ceil(Math.max(
      contentRoot?.scrollHeight ?? 0,
      contentRoot?.offsetHeight ?? 0,
      contentRoot?.getBoundingClientRect().height ?? 0,
      doc.body?.firstElementChild ? 0 : doc.body?.scrollHeight ?? 0,
    )) + 4;

    if (nextHeight > 0) {
      setPreviewHeight((currentHeight) => (
        currentHeight === nextHeight ? currentHeight : nextHeight
      ));
    }
  }, []);

  const configurePreviewDocument = useCallback(() => {
    const doc = previewFrameRef.current?.contentDocument;
    if (!doc) return;

    doc.documentElement.style.overflow = 'hidden';
    doc.body.style.overflow = 'hidden';
  }, []);

  const handlePreviewLoad = useCallback(() => {
    configurePreviewDocument();
    syncPreviewHeight();
    window.setTimeout(syncPreviewHeight, 120);
    window.setTimeout(syncPreviewHeight, 360);
  }, [configurePreviewDocument, syncPreviewHeight]);

  useEffect(() => {
    if (state.viewMode !== 'preview' || !previewHtml) return;

    const disposers: Array<() => void> = [];
    const scheduleSync = () => {
      window.requestAnimationFrame(syncPreviewHeight);
    };

    const iframe = previewFrameRef.current;
    if (!iframe) return;

    const connectObservers = () => {
      configurePreviewDocument();
      scheduleSync();

      const doc = iframe.contentDocument;
      if (!doc) return;
      const contentRoot = doc.body.firstElementChild as HTMLElement | null;

      if (previewScrollRef.current && 'ResizeObserver' in window) {
        const containerObserver = new ResizeObserver(scheduleSync);
        containerObserver.observe(previewScrollRef.current);
        disposers.push(() => containerObserver.disconnect());
      }

      if (contentRoot && 'ResizeObserver' in window) {
        const contentObserver = new ResizeObserver(scheduleSync);
        contentObserver.observe(contentRoot);
        disposers.push(() => contentObserver.disconnect());
      }

      const previewWindow = iframe.contentWindow;
      if (previewWindow) {
        previewWindow.addEventListener('resize', scheduleSync);
        disposers.push(() => previewWindow.removeEventListener('resize', scheduleSync));
      }

      if (doc.fonts?.ready) {
        void doc.fonts.ready.then(scheduleSync).catch(() => undefined);
      }
    };

    connectObservers();
    window.addEventListener('resize', scheduleSync);
    disposers.push(() => window.removeEventListener('resize', scheduleSync));

    return () => {
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, [configurePreviewDocument, previewHtml, state.viewMode, syncPreviewHeight]);

  // Empty / no-result states
  if (!job) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Select a job to preview
      </div>
    );
  }

  if (!job.result) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        {job.status === 'tailoring' ? 'Tailoring in progress…' : 'Run tailoring to generate a preview'}
      </div>
    );
  }

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col min-w-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        {/* Preview / Diff toggle */}
        <div className="flex rounded-md border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => handleSetViewMode('preview')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              state.viewMode === 'preview'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-secondary/60'
            }`}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => handleSetViewMode('diff')}
            className={`px-3 py-1 text-xs font-medium transition-colors border-l border-border ${
              state.viewMode === 'diff'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-secondary/60'
            }`}
          >
            Diff
          </button>
        </div>

        <div className="flex-1" />

        {/* Export PDF button */}
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={exportingPdf || !activeMarkdown}
          title="Export as PDF"
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-border bg-card text-muted-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {exportingPdf ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden min-h-0 min-w-0">
        {state.viewMode === 'preview' ? (
          previewLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Rendering preview…
            </div>
          ) : previewHtml ? (
            <div
              ref={previewScrollRef}
              className="h-full min-h-0 overflow-auto bg-muted/20 p-3 min-w-0"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <iframe
                ref={previewFrameRef}
                onLoad={handlePreviewLoad}
                srcDoc={previewHtml}
                scrolling="no"
                className="block w-full rounded-lg border border-border bg-white shadow-sm"
                style={{
                  height: previewHeight ? `${previewHeight}px` : '100%',
                  pointerEvents: 'none',
                }}
                title="Document preview"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No content to preview
            </div>
          )
        ) : (
          <DiffView
            original={originalMarkdown}
            modified={activeMarkdown ?? ''}
          />
        )}
      </div>
    </div>
  );
}
