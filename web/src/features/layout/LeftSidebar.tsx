import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useWorkspace } from '../../context';
import type { Job } from '../../types';
import { Button } from '@/components/ui/button';
import { legacyHuntrMatchKey } from '@/lib/job-match';
import { appendUniqueJobIdsToQueue } from '@/lib/queues';
import * as api from '../../api/client';
import { ScoreCards } from '../scores/ScoreCards';
import { JobList } from '../jobs/JobList';
import { PasteJDModal } from '../jobs/PasteJDModal';
import { TailorConfirmModal } from '../jobs/TailorConfirmModal';
import { KeywordsPanel } from './KeywordsPanel';

function uniqueByLegacyKey(jobs: Job[]): Map<string, Job | null> {
  const byKey = new Map<string, Job | null>();
  for (const job of jobs) {
    const key = legacyHuntrMatchKey(job);
    if (!key) continue;
    byKey.set(key, byKey.has(key) ? null : job);
  }
  return byKey;
}

export function LeftSidebar() {
  const { state, dispatch } = useWorkspace();
  const [tailorModalOpen, setTailorModalOpen] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const checkedCount = state.jobs.filter((job) => job.checked).length;

  async function handleLoadHuntr() {
    dispatch({ type: 'SET_LOADING_HUNTR', loading: true });
    dispatch({ type: 'SET_RUN_FEEDBACK', feedback: { text: 'Loading jobs from Huntr...', type: 'working' } });
    dispatch({ type: 'ADD_ACTIVITY_LOG', message: 'Loading jobs from Huntr.', logType: 'working' });
    console.info('[workbench] Loading jobs from Huntr');
    try {
      const response = await api.getHuntrJobs();
      const jobs: Job[] = response.jobs.map((huntrJob) => ({
        id: huntrJob.id,
        company: huntrJob.company,
        title: huntrJob.title,
        jd: huntrJob.descriptionText,
        stage: huntrJob.listName,
        source: 'huntr',
        dbJobId: null,
        huntrId: huntrJob.id,
        boardId: huntrJob.boardId,
        listAddedAt: huntrJob.listAddedAt ?? null,
        listPosition: huntrJob.listPosition ?? null,
        status: 'loaded',
        checked: false,
        scoresStale: false,
        result: null,
        error: null,
        _editorData: null,
      }));
      if (state.activeWorkspaceId) {
        const incomingByKey = uniqueByLegacyKey(jobs);
        const repairs = state.jobs
          .filter((job) => job.source !== 'manual' && !job.huntrId)
          .map((job) => ({ job, incoming: incomingByKey.get(legacyHuntrMatchKey(job) ?? '') ?? null }))
          .filter((entry): entry is { job: Job; incoming: Job } => Boolean(entry.incoming));

        await Promise.all(repairs.map(({ job, incoming }) =>
          api.updateJob(state.activeWorkspaceId as string, job.id, {
            company: incoming.company,
            title: incoming.title,
            jd: incoming.jd,
            stage: incoming.stage,
            source: 'huntr',
            huntrId: incoming.huntrId ?? incoming.id,
            listAddedAt: incoming.listAddedAt ?? null,
          }),
        ));

        if (repairs.length > 0) {
          dispatch({
            type: 'ADD_ACTIVITY_LOG',
            message: `Backfilled Huntr ids for ${repairs.length} saved jobs.`,
            logType: 'done',
          });
          console.info('[workbench] Backfilled legacy Huntr job ids', { count: repairs.length });
        }
      }
      dispatch({ type: 'MERGE_JOBS', jobs });
      dispatch({
        type: 'SET_RUN_FEEDBACK',
        feedback: { text: `Loaded ${jobs.length} jobs from Huntr`, type: 'done' },
      });
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: `Loaded ${jobs.length} jobs from Huntr.`,
        logType: 'done',
      });
      console.info('[workbench] Loaded Huntr jobs', { count: jobs.length });
    } catch (err) {
      console.error('Failed to load Huntr jobs:', err);
      dispatch({ type: 'SET_RUN_FEEDBACK', feedback: { text: 'Failed to load Huntr jobs', type: 'error' } });
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: `Failed to load Huntr jobs: ${err instanceof Error ? err.message : String(err)}`,
        logType: 'error',
      });
    } finally {
      dispatch({ type: 'SET_LOADING_HUNTR', loading: false });
    }
  }

  function handleTailorConfirm(jobIds: string[]) {
    const next = appendUniqueJobIdsToQueue({
      queue: state.tailorQueue,
      runningId: state.tailorRunning,
      total: state.tailorQueueTotal,
      incomingIds: jobIds,
    });
    dispatch({ type: 'SET_TAILOR_QUEUE', queue: next.queue, total: next.total });
    if (next.added.length > 0) {
      dispatch({
        type: 'ADD_ACTIVITY_LOG',
        message: `Queued ${next.added.length} job${next.added.length === 1 ? '' : 's'} for tailoring.`,
        logType: 'working',
      });
      console.info('[workbench] Queued tailoring jobs', { jobIds: next.added });
    }
  }

  return (
    <aside className="flex flex-col gap-3 overflow-y-auto h-full pr-1 py-1">
      <div className="panel-surface rounded-2xl px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="editorial-label">Opportunity Queue</p>
          <button
            type="button"
            aria-expanded={!queueCollapsed}
            aria-label={queueCollapsed ? 'Expand opportunity queue' : 'Collapse opportunity queue'}
            onClick={() => setQueueCollapsed((current) => !current)}
            className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {queueCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {!queueCollapsed && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleLoadHuntr()}
              disabled={state.isLoadingHuntr}
              className="justify-center"
            >
              {state.isLoadingHuntr ? 'Loading...' : 'Load Huntr'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPasteModalOpen(true)}
              className="justify-center"
            >
              <Plus className="size-3.5" />
              Add JD
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setTailorModalOpen(true)}
              className="col-span-2 justify-center"
            >
              Tailor Selected{checkedCount > 0 ? ` (${checkedCount})` : ''}
            </Button>
          </div>
        )}
      </div>

      <ScoreCards />
      <KeywordsPanel />

      <JobList variant="sidebar" />

      <TailorConfirmModal
        open={tailorModalOpen}
        onOpenChange={setTailorModalOpen}
        onConfirm={handleTailorConfirm}
      />
      <PasteJDModal
        open={pasteModalOpen}
        onOpenChange={setPasteModalOpen}
      />
    </aside>
  );
}
