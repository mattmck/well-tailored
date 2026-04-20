import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ChevronsRight, Download, Eye, FileSearch, Sparkles } from 'lucide-react';
import { useWorkspace } from '../../context';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkbenchEmptyState } from '../layout/WorkbenchEmptyState';
import { getJobDocumentMarkdown } from '@/lib/job-documents';
import { sectionSync } from '../../lib/section-sync';
import * as api from '../../api/client';

const SECTION_CLICK_SCRIPT = `
<script>
(function(){
  function attach() {
    document.querySelectorAll('h1,h2,h3,h4').forEach(function(el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        window.parent.postMessage({ type: 'wt-section-click', heading: el.textContent.trim() }, '*');
      });
    });
    document.querySelectorAll('a').forEach(function(a) {
      a.addEventListener('click', function(e) { e.preventDefault(); });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();
</script>
`;

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
} as const;

type PreviewThemeId = keyof typeof PREVIEW_THEMES;

interface PreviewColumnProps {
  onCollapse?: () => void;
}

export function PreviewColumn({ onCollapse }: PreviewColumnProps) {
  const { state } = useWorkspace();
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
  }, [activeMarkdown, job?.title, previewTheme, state.activeDoc]);

  const handleExportPdf = useCallback(async () => {
    if (!activeMarkdown || exportingPdf) return;
    setExportingPdf(true);
    try {
      const blob = await api.exportPdf({
        markdown: activeMarkdown,
        kind: state.activeDoc === 'resume' ? 'resume' : 'coverLetter',
        title: job?.title || 'Tailored document',
        theme: previewTheme,
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
      })).html;
      downloadTextFile(`${getDocumentBaseName()}.html`, html, 'text/html;charset=utf-8');
    } catch (err) {
      console.error('PreviewColumn: exportHtml failed', err);
    } finally {
      setExportingHtml(false);
    }
  }, [activeMarkdown, downloadTextFile, exportingHtml, getDocumentBaseName, job?.title, previewHtml, previewTheme, state.activeDoc]);

  // Inject section-click script into preview HTML
  const previewHtmlWithScript = useMemo(() => {
    if (!previewHtml) return '';
    return previewHtml.replace('</body>', `${SECTION_CLICK_SCRIPT}</body>`);
  }, [previewHtml]);

  // Listen for heading clicks from the preview iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'wt-section-click') {
        sectionSync.emit(event.data.heading as string, 'preview');
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Scroll preview to matching heading when editor section is clicked
  useEffect(() => {
    return sectionSync.subscribe((heading, source) => {
      if (source !== 'editor') return;
      const iframe = previewFrameRef.current;
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc) return;
      const all = iframeDoc.querySelectorAll<HTMLElement>('h1, h2, h3, h4');
      for (const el of all) {
        if (el.textContent?.trim().toLowerCase() === heading.toLowerCase()) {
          const iframeEl = iframe!;
          const scrollContainer = previewScrollRef.current;
          if (!scrollContainer) break;
          const iframeTop = iframeEl.getBoundingClientRect().top;
          const elTop = el.getBoundingClientRect().top;
          const relativeTop = elTop - iframeTop;
          scrollContainer.scrollTo({ top: scrollContainer.scrollTop + relativeTop - 80, behavior: 'smooth' });
          break;
        }
      }
    });
  }, []);

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
    if (!previewHtml) return;

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
  }, [configurePreviewDocument, previewHtml, syncPreviewHeight]);

  if (!job) {
    return (
      <div className="flex flex-1 p-4">
        <WorkbenchEmptyState
          className="w-full"
          eyebrow="Output Review"
          title="Choose a role to inspect the draft."
          description="The preview desk renders the polished resume or cover letter for final review and export."
          icon={Eye}
          tips={[
            'Use the live preview to check polish after section edits.',
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
            ? 'Once the draft finishes, this pane will render the finished document.'
            : 'Generate a tailored draft first, then use preview for final polish and export.'}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="editorial-label">Output Review</p>

          <div className="flex flex-wrap items-center justify-end gap-2">
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
            {onCollapse && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCollapse}
                title="Collapse preview"
                aria-label="Collapse preview"
                className="ml-1 px-2"
              >
                <ChevronsRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {previewLoading ? (
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
            className="h-full min-h-0 min-w-0 overflow-auto bg-white"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <iframe
              ref={previewFrameRef}
              onLoad={handlePreviewLoad}
              srcDoc={previewHtmlWithScript}
              className="block min-h-full w-full border-0 bg-white"
              style={{ height: previewHeight ? `${Math.max(previewHeight, previewScrollRef.current?.clientHeight ?? 0)}px` : '100%' }}
              title="Document preview"
              sandbox="allow-scripts"
            />
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
        )}
      </div>
    </div>
  );
}
