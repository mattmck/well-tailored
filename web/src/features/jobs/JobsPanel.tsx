import { useState } from 'react';
import { BriefcaseBusiness, Sparkles, Target } from 'lucide-react';
import { useWorkspace } from '../../context';
import type { Job } from '../../types';
import * as api from '../../api/client';
import { Button } from '@/components/ui/button';
import { appendUniqueJobIdsToQueue } from '@/lib/queues';
import { StageFilter } from './StageFilter';
import { JobList } from './JobList';
import { JobDetail } from './JobDetail';
import { TailorConfirmModal } from './TailorConfirmModal';
import { PasteJDModal } from './PasteJDModal';

export function JobsPanel() {
  const { state, dispatch } = useWorkspace();
  const [tailorModalOpen, setTailorModalOpen] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const checkedCount = state.jobs.filter((job) => job.checked).length;
  const draftedCount = state.jobs.filter((job) => Boolean(job.result)).length;
  const reviewedCount = state.jobs.filter((job) => job.status === 'reviewed').length;

  async function handleLoadHuntr() {
    dispatch({ type: 'SET_LOADING_HUNTR', loading: true });
    try {
      const response = await api.getHuntrJobs();
      const jobs: Job[] = response.jobs.map((huntrJob) => ({
        id: huntrJob.id,
        company: huntrJob.company,
        title: huntrJob.title,
        jd: huntrJob.descriptionText,
        stage: huntrJob.listName,
        status: 'loaded',
        checked: false,
        scoresStale: false,
        result: null,
        error: null,
        _editorData: null,
      }));
      dispatch({ type: 'MERGE_JOBS', jobs });
    } catch (err) {
      console.error('Failed to load Huntr jobs:', err);
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
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 border-b border-border/70 px-3 py-3">
        <div className="paper-pane rounded-[1.25rem] px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="editorial-label">Opportunity Queue</p>
              <h3 className="mt-1 font-[Manrope] text-base font-semibold tracking-[-0.03em] text-foreground">
                Jobs
              </h3>
            </div>
          </div>

          <div className="-mx-1 mt-3 overflow-x-auto px-1">
            <div className="flex min-w-max gap-2">
              <span className="control-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-foreground">
                <BriefcaseBusiness className="size-3.5 text-primary" />
                {state.jobs.length} roles
              </span>
              <span className="control-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-foreground">
                <Sparkles className="size-3.5 text-primary" />
                {draftedCount} drafted
              </span>
              <span className="control-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-foreground">
                <Target className="size-3.5 text-primary" />
                {reviewedCount} reviewed
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadHuntr}
              disabled={state.isLoadingHuntr}
              className="justify-center"
            >
              {state.isLoadingHuntr ? 'Loading…' : 'Load Huntr'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPasteModalOpen(true)}
              className="justify-center"
            >
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
        </div>
      </div>

      <StageFilter />

      <div className="flex min-h-[12rem] flex-1 flex-col overflow-hidden">
        <JobList />
      </div>

      <div className="shrink-0 border-t border-border/70 bg-card/40">
        <JobDetail />
      </div>

      <TailorConfirmModal
        open={tailorModalOpen}
        onOpenChange={setTailorModalOpen}
        onConfirm={handleTailorConfirm}
      />
      <PasteJDModal
        open={pasteModalOpen}
        onOpenChange={setPasteModalOpen}
      />
    </div>
  );
}
