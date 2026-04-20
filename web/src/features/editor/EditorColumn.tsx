import { useCallback, useEffect } from 'react';
import { CheckCircle2, ChevronsLeft, Circle, Copy, FilePenLine, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { useWorkspace } from '../../context';
import { appendUniqueJobIdsToQueue } from '@/lib/queues';
import { sectionSync } from '../../lib/section-sync';
import { ScrollArea } from '../../components/ui/scroll-area';
import { EditorSection } from './EditorSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/components/ui/utils';
import { parseEditorData, reconstructEditorData, genId } from '../../lib/markdown';
import { editorDataMatchesDoc, getJobDocumentMarkdown } from '@/lib/job-documents';
import type { EditorData, EditorSection as SectionData } from '../../types';
import { WorkbenchEmptyState } from '../layout/WorkbenchEmptyState';
import * as api from '../../api/client';

function getToolbarTabClass(isActive: boolean) {
  return cn(
    'rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200',
    isActive
      ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(49,74,116,0.22)]'
      : 'text-muted-foreground hover:bg-white hover:text-foreground',
  );
}

interface EditorColumnProps {
  onCollapse?: () => void;
}

export function EditorColumn({ onCollapse }: EditorColumnProps) {
  const { state, dispatch } = useWorkspace();

  // Scroll editor to matching section when preview heading is clicked
  useEffect(() => {
    return sectionSync.subscribe((heading, source) => {
      if (source !== 'preview') return;
      const all = document.querySelectorAll<HTMLElement>('[data-section-heading]');
      for (const el of all) {
        if (el.getAttribute('data-section-heading')?.toLowerCase() === heading.toLowerCase()) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        }
      }
    });
  }, []);

  const job = state.activeJobId
    ? state.jobs.find((j) => j.id === state.activeJobId)
    : null;

  const activeMarkdown = getJobDocumentMarkdown(job, state.activeDoc);

  const editorData: EditorData | null =
    job && activeMarkdown
      ? (
          editorDataMatchesDoc(job._editorData, state.activeDoc)
            ? job._editorData
            : parseEditorData(activeMarkdown, state.activeDoc, null)
        )
      : null;

  useEffect(() => {
    if (!job || !activeMarkdown || editorDataMatchesDoc(job._editorData, state.activeDoc)) return;
    dispatch({
      type: 'UPDATE_JOB',
      id: job.id,
      patch: { _editorData: parseEditorData(activeMarkdown, state.activeDoc, null) },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, activeMarkdown, state.activeDoc]);

  const fullMarkdown = editorData ? reconstructEditorData(editorData) : (activeMarkdown ?? '');

  function patchEditorData(patch: Partial<EditorData>) {
    if (!job || !editorData) return;
    const nextEditorData = { ...editorData, ...patch };
    const nextMarkdown = reconstructEditorData(nextEditorData);
    dispatch({
      type: 'SET_JOB_DOCUMENT_STATE',
      id: job.id,
      doc: state.activeDoc,
      editorData: nextEditorData,
      markdown: nextMarkdown,
    });
  }

  function patchSections(sections: SectionData[]) {
    patchEditorData({ sections });
  }

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
      patchSections(editorData.sections.map((section) => (
        section.id === updated.id ? updated : section
      )));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editorData],
  );

  const handleSectionMove = useCallback(
    (sectionId: string, dir: 'up' | 'down') => {
      if (!editorData) return;
      const idx = editorData.sections.findIndex((section) => section.id === sectionId);
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
      patchSections(editorData.sections.filter((section) => section.id !== sectionId));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editorData],
  );

  const handleSectionAccept = useCallback(
    (sectionId: string) => {
      if (!job || !editorData) return;
      const nextSections = editorData.sections.map((section) => (
          section.id === sectionId
            ? { ...section, accepted: !section.accepted }
            : section
        ));
      patchSections(nextSections);

      const allAccepted = nextSections.length > 0 && nextSections.every((section) => section.accepted);
      if (allAccepted && job.status === 'tailored') {
        dispatch({ type: 'UPDATE_JOB', id: job.id, patch: { status: 'reviewed' } });
      } else if (!allAccepted && job.status === 'reviewed') {
        dispatch({ type: 'UPDATE_JOB', id: job.id, patch: { status: 'tailored' } });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [job, editorData],
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
      const section = editorData.sections.find((candidate) => candidate.id === sectionId);
      if (!section) return;

      dispatch({ type: 'SET_REGENERATING_SECTION', section: sectionId });
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: `Regenerating "${section.heading}" for ${job.company}.`,
        logType: 'working',
      });
      console.info('[workbench] Regenerating section', {
        jobId: job.id,
        company: job.company,
        sectionId,
        sectionHeading: section.heading,
      });

      try {
        const res = await api.regenerateSection({
          sectionId,
          sectionHeading: section.heading,
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

        const reparsed = parseEditorData(
          `## ${newHeading}\n\n${newContent}`,
          state.activeDoc,
        );
        const newSection = reparsed.sections[0]
          ? { ...reparsed.sections[0], id: sectionId, accepted: false, heading: newHeading }
          : { ...section, content: newContent, heading: newHeading, accepted: false };

        patchSections(editorData.sections.map((candidate) => (
          candidate.id === sectionId ? newSection : candidate
        )));
        dispatch({
          type: 'ADD_ACTIVITY_LOG',
          message: `Regenerated "${newHeading}" for ${job.company}.`,
          logType: 'done',
        });
      } catch (err) {
        console.error('Regenerate section failed:', err);
        dispatch({
          type: 'ADD_ACTIVITY_LOG',
          message: `Section regenerate failed for ${job.company}: ${err instanceof Error ? err.message : String(err)}`,
          logType: 'error',
        });
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
    },
    [dispatch],
  );

  if (!job) {
    return (
      <div className="flex flex-1 p-4">
        <WorkbenchEmptyState
          className="w-full"
          eyebrow="Draft Editor"
          title="Choose a role to start refining."
          description="Select a job from the workbench to open the structured editor, tune resume sections, and shape the cover letter with the same source material."
          icon={FilePenLine}
          tips={[
            'Use the Jobs panel to load roles from Huntr or paste a fresh job description.',
            'The editor keeps resume and cover letter drafts separate so revisions stay clean.',
            'Copy or export only after the score band and keyword fit feel aligned.',
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
          eyebrow="Draft Editor"
          title={job.status === 'tailoring' ? 'Draft in progress.' : 'Generate the first tailored pass.'}
          description={job.status === 'tailoring'
            ? 'The drafting engine is assembling sections for this role now. Once it finishes, the structured editor will populate automatically.'
            : 'Run tailoring for this job to populate editable sections, compare the output, and start making focused revisions.'}
          icon={Sparkles}
          tips={[
            'Resume sections become individually editable once the draft returns.',
            'Reordering and regenerating sections marks the score band as stale so review stays honest.',
          ]}
        />
      </div>
    );
  }

  const currentJob = job;
  const regrading = state.regradeRunning === currentJob.id;
  const queued = !regrading && state.regradeQueue.includes(currentJob.id);
  const canRegrade =
    Boolean(currentJob.result)
    && (currentJob.scoresStale || !currentJob.result?.scorecard || !currentJob.result?.gapAnalysis);
  const canReview = currentJob.status === 'tailored' || currentJob.status === 'reviewed';

  function handleRegrade() {
    const next = appendUniqueJobIdsToQueue({
      queue: state.regradeQueue,
      runningId: state.regradeRunning,
      total: state.regradeQueueTotal,
      incomingIds: [currentJob.id],
    });
    if (next.added.length === 0) return;
    dispatch({ type: 'SET_REGRADE_QUEUE', queue: next.queue, total: next.total });
  }

  function handleToggleReviewed() {
    const nextStatus = currentJob.status === 'reviewed' ? 'tailored' : 'reviewed';
    dispatch({ type: 'UPDATE_JOB', id: currentJob.id, patch: { status: nextStatus } });
  }

  return (
    <div className="flex flex-1 min-h-0 min-w-0 flex-col">
      <div className="shrink-0 border-b border-border/70 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="editorial-label">Draft Editor</p>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="toolbar-segment flex rounded-full p-1">
              <button
                type="button"
                onClick={() => handleDocTab('resume')}
                className={getToolbarTabClass(state.activeDoc === 'resume')}
              >
                Resume
              </button>
              <button
                type="button"
                onClick={() => handleDocTab('cover')}
                className={getToolbarTabClass(state.activeDoc === 'cover')}
              >
                Cover Letter
              </button>
            </div>

            {canReview && (
              <Button
                onClick={handleToggleReviewed}
                variant={job.status === 'reviewed' ? 'default' : 'outline'}
                size="sm"
                className={job.status === 'reviewed' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                {job.status === 'reviewed'
                  ? <CheckCircle2 className="h-3 w-3" />
                  : <Circle className="h-3 w-3" />}
                {job.status === 'reviewed' ? 'Reviewed' : 'Mark reviewed'}
              </Button>
            )}

            <Button
              onClick={handleRegrade}
              disabled={!canRegrade || regrading || queued}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-3 w-3 ${regrading ? 'animate-spin' : ''}`} />
              {regrading ? 'Re-grading…' : queued ? 'Queued' : 'Re-grade'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              title="Copy full document to clipboard"
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
            {onCollapse && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCollapse}
                title="Collapse editor"
                aria-label="Collapse editor"
                className="ml-1 px-2"
              >
                <ChevronsLeft className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0 min-w-0">
        <div className="min-h-full space-y-4 p-4">
          {editorData?.kind === 'resume' && (
            <section className="paper-pane rounded-[1.35rem] px-4 py-4">
              <p className="editorial-label">Resume Header</p>
              <div className="mt-3 grid gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Name</label>
                  <Input
                    value={editorData.header?.name ?? ''}
                    onChange={(event) => handleHeaderChange('name', event.target.value)}
                    className="h-10"
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Role</label>
                  <Input
                    value={editorData.header?.role ?? ''}
                    onChange={(event) => handleHeaderChange('role', event.target.value)}
                    className="h-10"
                    placeholder="Role headline"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Contact Line</label>
                  <Input
                    value={editorData.header?.contact ?? ''}
                    onChange={(event) => handleHeaderChange('contact', event.target.value)}
                    className="h-10 font-mono text-xs"
                    placeholder="email | phone | location"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Links Line</label>
                  <Input
                    value={editorData.header?.links ?? ''}
                    onChange={(event) => handleHeaderChange('links', event.target.value)}
                    className="h-10 font-mono text-xs"
                    placeholder="github.com/example | linkedin.com/in/example"
                  />
                </div>
              </div>
            </section>
          )}

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

              <div className="pt-1">
                <Button type="button" variant="outline" size="sm" onClick={handleAddSection}>
                  <Plus className="size-3.5" />
                  Add Section
                </Button>
              </div>
            </>
          ) : editorData ? (
            <WorkbenchEmptyState
              eyebrow="Draft Editor"
              title="No editable sections yet."
              description={editorData.kind === 'resume'
                ? 'The draft rendered, but no structured resume sections were detected. You can add a section manually and keep shaping from there.'
                : 'The document rendered, but no structured sections were detected yet. Add one manually to keep drafting.'}
              icon={FilePenLine}
              tips={[
                'Use Add Section to create a fresh block and continue editing without rerunning the workflow.',
              ]}
            />
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
