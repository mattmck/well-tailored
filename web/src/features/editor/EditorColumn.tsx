import { useCallback } from 'react';
import { useWorkspace } from '../../context';
import { ScrollArea } from '../../components/ui/scroll-area';
import { EditorSection } from './EditorSection';
import { Input } from '@/components/ui/input';
import { parseEditorData, reconstructEditorData, genId } from '../../lib/markdown';
import type { EditorData, EditorSection as SectionData } from '../../types';
import * as api from '../../api/client';

export function EditorColumn() {
  const { state, dispatch } = useWorkspace();

  const job = state.activeJobId
    ? state.jobs.find((j) => j.id === state.activeJobId)
    : null;

  const activeMarkdown =
    job?.result
      ? state.activeDoc === 'resume'
        ? job.result.output.resume
        : job.result.output.coverLetter
      : null;

  const editorData: EditorData | null = (() => {
    if (!job || !activeMarkdown) return null;
    if (job._editorData) return job._editorData;

    const newData = parseEditorData(activeMarkdown, state.activeDoc, job._editorData);
    setTimeout(() => {
      dispatch({ type: 'UPDATE_JOB', id: job.id, patch: { _editorData: newData } });
    }, 0);
    return newData;
  })();

  const fullMarkdown = editorData ? reconstructEditorData(editorData) : (activeMarkdown ?? '');

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function patchEditorData(patch: Partial<EditorData>) {
    if (!job || !editorData) return;
    dispatch({
      type: 'UPDATE_JOB',
      id: job.id,
      patch: { _editorData: { ...editorData, ...patch } },
    });
    dispatch({ type: 'SET_SCORES_STALE', stale: true });
  }

  function patchSections(sections: SectionData[]) {
    patchEditorData({ sections });
  }

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullMarkdown).catch(console.error);
  }, [fullMarkdown]);

  const handleHeaderChange = useCallback(
    (field: 'name' | 'role' | 'contact' | 'links', value: string) => {
      if (!job || !editorData || editorData.kind !== 'resume') return;
      const nextHeader = {
        name: editorData.header?.name ?? '',
        role: editorData.header?.role ?? '',
        contact: editorData.header?.contact ?? '',
        links: editorData.header?.links ?? '',
        [field]: value,
      };
      patchEditorData({ header: nextHeader });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [job, editorData],
  );

  const handleSectionUpdate = useCallback(
    (updated: SectionData) => {
      if (!editorData) return;
      patchSections(editorData.sections.map(s => s.id === updated.id ? updated : s));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editorData],
  );

  const handleSectionMove = useCallback(
    (sectionId: string, dir: 'up' | 'down') => {
      if (!editorData) return;
      const idx = editorData.sections.findIndex(s => s.id === sectionId);
      if (idx < 0) return;
      const next = dir === 'up' ? idx - 1 : idx + 1;
      if (next < 0 || next >= editorData.sections.length) return;
      const sections = [...editorData.sections];
      [sections[idx], sections[next]] = [sections[next], sections[idx]];
      patchSections(sections);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editorData],
  );

  const handleSectionRemove = useCallback(
    (sectionId: string) => {
      if (!editorData) return;
      patchSections(editorData.sections.filter(s => s.id !== sectionId));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editorData],
  );

  const handleSectionAccept = useCallback(
    (sectionId: string) => {
      if (!editorData) return;
      patchSections(
        editorData.sections.map(s =>
          s.id === sectionId ? { ...s, accepted: !s.accepted } : s,
        ),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editorData],
  );

  const handleAddSection = useCallback(() => {
    if (!editorData) return;
    const newSection: SectionData = {
      id: genId(),
      heading: 'New Section',
      type: 'text',
      content: '',
      items: [],
      jobs: [],
      accepted: false,
    };
    patchSections([...editorData.sections, newSection]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorData]);

  const handleRegenerate = useCallback(
    async (sectionId: string) => {
      if (!job || !editorData || !activeMarkdown) return;
      const section = editorData.sections.find(s => s.id === sectionId);
      if (!section) return;

      dispatch({ type: 'SET_REGENERATING_SECTION', section: sectionId });

      try {
        const res = await api.regenerateSection({
          sectionId,
          fullResume: fullMarkdown,
          jd: job.jd,
          bio: state.sourceBio,
          jobTitle: job.title,
          provider: state.tailorProvider !== 'auto' ? state.tailorProvider : undefined,
          model: state.tailorModel !== 'auto' ? state.tailorModel : undefined,
        });

        const newHeading = res.section.headingLevel > 0 && res.section.heading
          ? res.section.heading.replace(/^#+\s*/, '')
          : section.heading;
        const newContent = res.section.content;

        // Re-parse the returned content to get structured data
        const reparsed = parseEditorData(
          `## ${newHeading}\n\n${newContent}`,
          state.activeDoc,
        );
        const newSection = reparsed.sections[0]
          ? { ...reparsed.sections[0], id: sectionId, accepted: false, heading: newHeading }
          : { ...section, content: newContent, heading: newHeading, accepted: false };

        patchSections(editorData.sections.map(s => s.id === sectionId ? newSection : s));
      } catch (err) {
        console.error('Regenerate section failed:', err);
      } finally {
        dispatch({ type: 'SET_REGENERATING_SECTION', section: null });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [job, editorData, activeMarkdown, fullMarkdown, state.sourceBio, state.tailorProvider, state.tailorModel],
  );

  const handleDocTab = useCallback(
    (doc: 'resume' | 'cover') => {
      dispatch({ type: 'SET_ACTIVE_DOC', doc });
      if (job) {
        dispatch({ type: 'UPDATE_JOB', id: job.id, patch: { _editorData: null } });
      }
    },
    [dispatch, job],
  );

  // ---------------------------------------------------------------------------
  // Empty states
  // ---------------------------------------------------------------------------
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
    <div className="flex-1 h-full min-h-0 flex flex-col min-w-0 border-r border-border">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
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

        <button
          type="button"
          onClick={handleCopy}
          title="Copy full document to clipboard"
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-border bg-card text-muted-foreground hover:bg-secondary/60 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
          Copy
        </button>
      </div>

      {/* Section list */}
      <ScrollArea className="flex-1 min-h-0 min-w-0">
        {/* Resume header fields */}
        {editorData?.kind === 'resume' && (
          <div className="border-b border-border px-3 py-3 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Resume Header
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Name</label>
                <Input
                  value={editorData.header?.name ?? ''}
                  onChange={e => handleHeaderChange('name', e.target.value)}
                  className="h-9"
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Role</label>
                <Input
                  value={editorData.header?.role ?? ''}
                  onChange={e => handleHeaderChange('role', e.target.value)}
                  className="h-9"
                  placeholder="Role headline"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Contact Line</label>
                <Input
                  value={editorData.header?.contact ?? ''}
                  onChange={e => handleHeaderChange('contact', e.target.value)}
                  className="h-9 font-mono text-xs"
                  placeholder="email | phone | location"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Links Line</label>
                <Input
                  value={editorData.header?.links ?? ''}
                  onChange={e => handleHeaderChange('links', e.target.value)}
                  className="h-9 font-mono text-xs"
                  placeholder="github.com/example | linkedin.com/in/example"
                />
              </div>
            </div>
          </div>
        )}

        {/* Sections */}
        {editorData && editorData.sections.length > 0 ? (
          <>
            {editorData.sections.map((section, idx) => (
              <EditorSection
                key={section.id}
                section={section}
                accepted={section.accepted}
                regenerating={state.regeneratingSection === section.id}
                canMoveUp={idx > 0}
                canMoveDown={idx < editorData.sections.length - 1}
                onUpdate={handleSectionUpdate}
                onMoveUp={() => handleSectionMove(section.id, 'up')}
                onMoveDown={() => handleSectionMove(section.id, 'down')}
                onRemove={() => handleSectionRemove(section.id)}
                onAccept={() => handleSectionAccept(section.id)}
                onRegenerate={() => handleRegenerate(section.id)}
              />
            ))}
            {/* Add section */}
            <div className="px-3 py-3">
              <button
                type="button"
                onClick={handleAddSection}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Section
              </button>
            </div>
          </>
        ) : editorData ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
            {editorData.kind === 'resume' ? 'No sections found.' : 'No sections found'}
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
}
