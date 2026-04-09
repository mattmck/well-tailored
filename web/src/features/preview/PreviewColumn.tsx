import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, Eye, FileSearch, Sparkles } from 'lucide-react';
import { useWorkspace } from '../../context';
import { DiffView } from './DiffView';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/components/ui/utils';
import { WorkbenchEmptyState } from '../layout/WorkbenchEmptyState';
import { getJobDocumentMarkdown } from '@/lib/job-documents';
import * as api from '../../api/client';

const PREVIEW_THEMES = {
  drafting: {
    label: 'Drafting Desk',
    theme: {
      background: '#F6F0E4',
      body: '#2F2C28',
      accent: '#314A74',
      subheading: '#556070',
      jobTitle: '#22252B',
      date: '#6E7480',
      contact: '#3E4148',
      link: '#314A74',
    },
  },
  classic: {
    label: 'Classic Blue',
    theme: {
      background: '#E5F2FF',
      body: '#323434',
      accent: '#BE503C',
      subheading: '#364D62',
      jobTitle: '#182234',
      date: '#3B72A8',
      contact: '#323434',
      link: '#255F91',
    },
  },
  slate: {
    label: 'Slate Serif',
    theme: {
      background: '#F3F4F6',
      body: '#293241',
      accent: '#3D5A80',
      subheading: '#5C677D',
      jobTitle: '#1B263B',
      date: '#6B7280',
      contact: '#334155',
      link: '#2563EB',
    },
  },
  monochrome: {
    label: 'Monochrome',
    theme: {
      background: '#FFFFFF',
      body: '#374151',
      accent: '#111827',
      subheading: '#1F2937',
      jobTitle: '#111827',
      date: '#6B7280',
      contact: '#4B5563',
      link: '#374151',
    },
  },
} as const;

type PreviewThemeId = keyof typeof PREVIEW_THEMES;

function getToolbarTabClass(isActive: boolean) {
  return cn(
    'rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200',
    isActive
      ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(49,74,116,0.22)]'
      : 'text-muted-foreground hover:bg-white hover:text-foreground',
  );
}

export function PreviewColumn({ layoutControls }: { layoutControls?: ReactNode }) {
  const { state, dispatch } = useWorkspace();
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingHtml, setExportingHtml] = useState(false);
  const [themeId, setThemeId] = useState<PreviewThemeId>('drafting');
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);

  const job = state.activeJobId
    ? state.jobs.find((candidate) => candidate.id === state.activeJobId)
    : null;

  const activeMarkdown = getJobDocumentMarkdown(job, state.activeDoc);

  const originalMarkdown = state.activeDoc === 'resume'
    ? state.sourceResume
    : state.sourceCoverLetter;
  const previewTheme = PREVIEW_THEMES[themeId].theme;

  const getDocumentSlug = useCallback(() => {
    return job
      ? `${job.company}-${job.title}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      : 'document';
  }, [job]);

  const getDocumentBaseName = useCallback(() => {
    return `${state.activeDoc === 'resume' ? 'resume' : 'cover-letter'}-${getDocumentSlug()}`;
  }, [getDocumentSlug, state.activeDoc]);

  const downloadTextFile = useCallback((filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    if (state.viewMode !== 'preview') return;
    if (!activeMarkdown) {
      setPreviewHtml('');
      setPreviewHeight(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewLoading(true);
      api.renderHtml({
        markdown: activeMarkdown,
        kind: state.activeDoc === 'resume' ? 'resume' : 'coverLetter',
        title: job?.title || 'Tailored document',
        theme: previewTheme,
        experienceOrder: state.activeDoc === 'resume' ? state.experienceOrder : undefined,
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
  }, [activeMarkdown, job?.title, previewTheme, state.activeDoc, state.viewMode, state.experienceOrder]);

  const handleExportPdf = useCallback(async () => {
    if (!activeMarkdown || exportingPdf) return;
    setExportingPdf(true);
    try {
      const blob = await api.exportPdf({
        markdown: activeMarkdown,
        kind: state.activeDoc === 'resume' ? 'resume' : 'coverLetter',
        title: job?.title || 'Tailored document',
        theme: previewTheme,
        experienceOrder: state.activeDoc === 'resume' ? state.experienceOrder : undefined,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${getDocumentBaseName()}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PreviewColumn: exportPdf failed', err);
    } finally {
      setExportingPdf(false);
    }
  }, [activeMarkdown, exportingPdf, getDocumentBaseName, job?.title, previewTheme, state.activeDoc]);

  const handleExportMarkdown = useCallback(() => {
    if (!activeMarkdown) return;
    downloadTextFile(`${getDocumentBaseName()}.md`, activeMarkdown, 'text/markdown;charset=utf-8');
  }, [activeMarkdown, downloadTextFile, getDocumentBaseName]);

  const handleExportHtml = useCallback(async () => {
    if (!activeMarkdown || exportingHtml) return;
    setExportingHtml(true);
    try {
      const html = previewHtml || (await api.renderHtml({
        markdown: activeMarkdown,
        kind: state.activeDoc === 'resume' ? 'resume' : 'coverLetter',
        title: job?.title || 'Tailored document',
        theme: previewTheme,
        experienceOrder: state.activeDoc === 'resume' ? state.experienceOrder : undefined,
      })).html;
      downloadTextFile(`${getDocumentBaseName()}.html`, html, 'text/html;charset=utf-8');
    } catch (err) {
      console.error('PreviewColumn: exportHtml failed', err);
    } finally {
      setExportingHtml(false);
    }
  }, [activeMarkdown, downloadTextFile, exportingHtml, getDocumentBaseName, job?.title, previewHtml, previewTheme, state.activeDoc]);

  const handleSetViewMode = useCallback(
    (mode: 'preview' | 'diff') => {
      dispatch({ type: 'SET_VIEW_MODE', mode });
    },
    [dispatch],
  );

  const syncPreviewHeight = useCallback(() => {
    const iframe = previewFrameRef.current;
    const documentRef = iframe?.contentDocument;
    if (!iframe || !documentRef) return;

    const contentRoot = documentRef.body.firstElementChild as HTMLElement | null;
    const nextHeight = Math.ceil(Math.max(
      contentRoot?.scrollHeight ?? 0,
      contentRoot?.offsetHeight ?? 0,
      contentRoot?.getBoundingClientRect().height ?? 0,
      documentRef.body?.firstElementChild ? 0 : documentRef.body?.scrollHeight ?? 0,
    )) + 4;

    if (nextHeight > 0) {
      setPreviewHeight((currentHeight) => (
        currentHeight === nextHeight ? currentHeight : nextHeight
      ));
    }
  }, []);

  const configurePreviewDocument = useCallback(() => {
    const documentRef = previewFrameRef.current?.contentDocument;
    if (!documentRef) return;

    if (documentRef.documentElement) documentRef.documentElement.style.overflow = 'hidden';
    if (documentRef.body) documentRef.body.style.overflow = 'hidden';
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

      const documentRef = iframe.contentDocument;
      if (!documentRef || !documentRef.body) return;
      const contentRoot = documentRef.body.firstElementChild as HTMLElement | null;

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

      if (documentRef.fonts?.ready) {
        void documentRef.fonts.ready.then(scheduleSync).catch(() => undefined);
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

  if (!job) {
    return (
      <div className="flex flex-1 p-4">
        <WorkbenchEmptyState
          className="w-full"
          eyebrow="Output Review"
          title="Choose a role to inspect the draft."
          description="The preview desk renders the polished resume or cover letter, and the diff view shows exactly what changed from your source material."
          icon={Eye}
          tips={[
            'Switch between preview and diff depending on whether you are reviewing polish or substance.',
            'PDF export uses the currently selected document and role title.',
          ]}
        />
      </div>
    );
  }

  if (!job.result) {
    return (
      <div className="flex flex-1 p-4">
        <WorkbenchEmptyState
          className="w-full"
          eyebrow="Output Review"
          title={job.status === 'tailoring' ? 'Preview preparing now.' : 'Run tailoring to populate the review pane.'}
          description={job.status === 'tailoring'
            ? 'Once the draft finishes, this pane will render the finished document and a clean comparison against the source.'
            : 'Generate a tailored draft first, then use preview for final polish and diff for change review.'}
          icon={Sparkles}
          tips={[
            'The preview automatically refreshes after section edits.',
            'Use diff when you want to validate that tailoring still sounds like you.',
          ]}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/70 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="editorial-label">Output Review</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="font-[Manrope] text-base font-semibold tracking-[-0.03em] text-foreground">
                Review pane
              </h2>
              <span className="text-sm text-muted-foreground">
                {job.company} · {job.title}
              </span>
            </div>
          </div>

          <div className="flex min-w-0 flex-col items-end gap-2">
            {layoutControls && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {layoutControls}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="toolbar-segment flex rounded-full p-1">
                <button
                  type="button"
                  onClick={() => handleSetViewMode('preview')}
                  className={getToolbarTabClass(state.viewMode === 'preview')}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => handleSetViewMode('diff')}
                  className={getToolbarTabClass(state.viewMode === 'diff')}
                >
                  Diff
                </button>
              </div>

              {state.activeDoc === 'resume' && (
                <button
                  type="button"
                  onClick={() => dispatch({
                    type: 'SET_EXPERIENCE_ORDER',
                    order: state.experienceOrder === 'relevance' ? 'chronological' : 'relevance',
                  })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-white/75 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
                  title="Toggle experience ordering"
                >
                  {state.experienceOrder === 'relevance' ? 'relevance ↓' : 'chronological ↓'}
                </button>
              )}

              <Select value={themeId} onValueChange={(value) => setThemeId(value as PreviewThemeId)}>
                <SelectTrigger size="sm" className="w-[9.5rem] rounded-full border-border/80 bg-white/75 text-xs">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PREVIEW_THEMES).map(([id, preset]) => (
                    <SelectItem key={id} value={id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportMarkdown}
                disabled={!activeMarkdown}
                title="Download Markdown"
              >
                <Download className="size-3.5" />
                Markdown
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportHtml}
                disabled={exportingHtml || !activeMarkdown}
                title="Download HTML"
              >
                <Download className="size-3.5" />
                {exportingHtml ? 'HTML…' : 'HTML'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={exportingPdf || !activeMarkdown}
                title="Export as PDF"
              >
                <Download className="size-3.5" />
                {exportingPdf ? 'Exporting…' : 'Export PDF'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {state.viewMode === 'preview' ? (
          previewLoading ? (
            <div className="flex h-full p-4">
              <WorkbenchEmptyState
                className="w-full"
                eyebrow="Output Review"
                title="Rendering preview."
                description="The paper view is refreshing so you can inspect the latest changes with the final document styling."
                icon={FileSearch}
              />
            </div>
          ) : previewHtml ? (
            <div
              ref={previewScrollRef}
              className="h-full min-h-0 min-w-0 overflow-auto px-4 pb-4"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div className="paper-pane min-h-full rounded-[1.35rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.4),rgba(243,236,221,0.72))] p-4">
                <div className="mx-auto w-full max-w-[54rem] rounded-[1.5rem] border border-border/80 bg-white p-3 shadow-[0_20px_46px_rgba(43,45,51,0.08)]">
                  <iframe
                    ref={previewFrameRef}
                    onLoad={handlePreviewLoad}
                    srcDoc={previewHtml}
                    className="block w-full rounded-[1rem] border border-border/70 bg-white"
                    style={{
                      height: previewHeight ? `${previewHeight}px` : '100%',
                      pointerEvents: 'none',
                    }}
                    title="Document preview"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full p-4">
              <WorkbenchEmptyState
                className="w-full"
                eyebrow="Output Review"
                title="No preview content yet."
                description="This document does not have any rendered content to display right now. Return to the editor and add or regenerate a section."
                icon={Eye}
              />
            </div>
          )
        ) : (
          <div className="h-full px-4 pb-4">
            <DiffView original={originalMarkdown} modified={activeMarkdown ?? ''} />
          </div>
        )}
      </div>
    </div>
  );
}
