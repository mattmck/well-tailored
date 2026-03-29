import { useState } from 'react';
import { useWorkspace } from '../../context';
import type { Job } from '../../types';
import * as api from '../../api/client';
import { Button } from '@/components/ui/button';
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
    dispatch({ type: 'SET_TAILOR_QUEUE', queue: jobIds, total: jobIds.length });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Action buttons row */}
      <div className="flex items-center gap-1.5 px-2 py-2 border-b border-border shrink-0 overflow-x-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadHuntr}
          disabled={state.isLoadingHuntr}
          className="text-[11px] h-7 px-2 whitespace-nowrap"
        >
          {state.isLoadingHuntr ? 'Loading…' : 'Load Huntr'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPasteModalOpen(true)}
          className="text-[11px] h-7 px-2 whitespace-nowrap"
        >
          Add JD
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTailorModalOpen(true)}
          className="text-[11px] h-7 px-2 whitespace-nowrap"
        >
          Tailor Selected{checkedCount > 0 ? ` (${checkedCount})` : ''}
        </Button>
      </div>

      {/* Stage filter pills */}
      <StageFilter />

      {/* Job list — flex-1 so it fills remaining space */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <JobList />
      </div>

      {/* Job detail stays pinned to the bottom and scrolls internally */}
      <div className="shrink-0 border-t border-border bg-card/60">
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
