import { useCallback } from 'react';
import { useWorkspace } from '../../context';
import { ScrollArea } from '../../components/ui/scroll-area';
import { EditorSection } from './EditorSection';
import { parseMarkdownSections, reconstructMarkdown } from '../../lib/markdown';
import type { EditorData, EditorSection as EditorSectionType } from '../../types';
import * as api from '../../api/client';

export function EditorColumn() {
  const { state, dispatch } = useWorkspace();

  const job = state.activeJobId
    ? state.jobs.find((j) => j.id === state.activeJobId)
    : null;

  // Derive the active document markdown
  const activeMarkdown =
    job?.result
      ? state.activeDoc === 'resume'
        ? job.result.output.resume
        : job.result.output.coverLetter
      : null;

  // Initialize _editorData from the parsed markdown if not set
  const editorData: EditorData | null = (() => {
    if (!job || !activeMarkdown) return null;
    if (job._editorData) return job._editorData;

    // Build fresh EditorData from parsed sections
    const parsed = parseMarkdownSections(activeMarkdown);
    const sections: EditorSectionType[] = parsed.map((s) => ({
      id: s.id,
      heading: s.heading,
      content: s.content,
      accepted: false,
    }));
    const newData: EditorData = { sections };

    // Persist it into state (deferred to avoid dispatch-during-render)
    setTimeout(() => {
      dispatch({ type: 'UPDATE_JOB', id: job.id, patch: { _editorData: newData } });
    }, 0);

    return newData;
  })();

  // Reconstruct the full markdown from editorData sections
  const fullMarkdown = editorData
    ? reconstructMarkdown(
        editorData.sections.map((s) => ({ id: s.id, heading: s.heading, content: s.content }))
      )
    : (activeMarkdown ?? '');

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullMarkdown).catch(console.error);
  }, [fullMarkdown]);

  const handleContentChange = useCallback(
    (sectionId: string, content: string) => {
      if (!job || !editorData) return;
      const sections = editorData.sections.map((s) =>
        s.id === sectionId ? { ...s, content } : s
      );
      dispatch({
        type: 'UPDATE_JOB',
        id: job.id,
        patch: { _editorData: { ...editorData, sections } },
      });
      dispatch({ type: 'SET_SCORES_STALE', stale: true });
    },
    [job, editorData, dispatch]
  );

  const handleAccept = useCallback(
    (sectionId: string) => {
      if (!job || !editorData) return;
      const sections = editorData.sections.map((s) =>
        s.id === sectionId ? { ...s, accepted: !s.accepted } : s
      );
      dispatch({
        type: 'UPDATE_JOB',
        id: job.id,
        patch: { _editorData: { ...editorData, sections } },
      });
    },
    [job, editorData, dispatch]
  );

  const handleRegenerate = useCallback(
    async (sectionId: string) => {
      if (!job || !editorData || !activeMarkdown) return;
      const section = editorData.sections.find((s) => s.id === sectionId);
      if (!section) return;

      dispatch({ type: 'SET_REGENERATING_SECTION', section: sectionId });

      try {
        const sectionText = section.heading
          ? `${section.heading}\n${section.content}`
          : section.content;

        const res = await api.regenerateSection({
          section: sectionText,
          sectionId,
          fullResume: fullMarkdown,
          jd: job.jd,
          provider: state.tailorProvider !== 'auto' ? state.tailorProvider : undefined,
          model: state.tailorModel !== 'auto' ? state.tailorModel : undefined,
        });

        // Parse the returned section text back into heading + content
        const lines = res.section.split('\n');
        let newHeading = section.heading;
        let newContent = section.content;
        if (lines[0]?.trimStart().startsWith('#')) {
          newHeading = lines[0];
          newContent = lines.slice(1).join('\n').replace(/^\n+/, '');
        } else {
          newContent = res.section;
        }

        const sections = editorData.sections.map((s) =>
          s.id === sectionId
            ? { ...s, heading: newHeading, content: newContent, accepted: false }
            : s
        );
        dispatch({
          type: 'UPDATE_JOB',
          id: job.id,
          patch: { _editorData: { ...editorData, sections } },
        });
        dispatch({ type: 'SET_SCORES_STALE', stale: true });
      } catch (err) {
        console.error('Regenerate section failed:', err);
      } finally {
        dispatch({ type: 'SET_REGENERATING_SECTION', section: null });
      }
    },
    [job, editorData, activeMarkdown, fullMarkdown, state.tailorProvider, state.tailorModel, dispatch]
  );

  const handleDocTab = useCallback(
    (doc: 'resume' | 'cover') => {
      dispatch({ type: 'SET_ACTIVE_DOC', doc });
      // Clear editor data so it re-parses for the new doc
      if (job) {
        dispatch({ type: 'UPDATE_JOB', id: job.id, patch: { _editorData: null } });
      }
    },
    [dispatch, job]
  );

  // Empty state
  if (!job) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Select a job to start editing
      </div>
    );
  }

  if (!job.result) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        {job.status === 'tailoring' ? 'Tailoring in progress…' : 'Run tailoring to generate content'}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 border-r border-border">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        {/* Doc tabs */}
        <div className="flex rounded-md border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => handleDocTab('resume')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              state.activeDoc === 'resume'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-secondary/60'
            }`}
          >
            Resume
          </button>
          <button
            type="button"
            onClick={() => handleDocTab('cover')}
            className={`px-3 py-1 text-xs font-medium transition-colors border-l border-border ${
              state.activeDoc === 'cover'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-secondary/60'
            }`}
          >
            Cover Letter
          </button>
        </div>

        <div className="flex-1" />

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          title="Copy full document to clipboard"
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-border bg-card text-muted-foreground hover:bg-secondary/60 transition-colors"
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
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
          Copy
        </button>
      </div>

      {/* Section list */}
      <ScrollArea className="flex-1">
        {editorData && editorData.sections.length > 0 ? (
          editorData.sections.map((section) => (
            <EditorSection
              key={section.id}
              section={{ id: section.id, heading: section.heading, content: section.content }}
              accepted={section.accepted}
              regenerating={state.regeneratingSection === section.id}
              onContentChange={(content) => handleContentChange(section.id, content)}
              onAccept={() => handleAccept(section.id)}
              onRegenerate={() => handleRegenerate(section.id)}
            />
          ))
        ) : (
          <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
            No sections found
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
