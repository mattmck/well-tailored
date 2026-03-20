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
  const { dispatch } = useWorkspace();
  const [isLoadingHuntr, setIsLoadingHuntr] = useState(false);
  const [tailorModalOpen, setTailorModalOpen] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);

  async function handleLoadHuntr() {
    setIsLoadingHuntr(true);
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
      dispatch({ type: 'SET_JOBS', jobs });
    } catch (err) {
      console.error('Failed to load Huntr jobs:', err);
    } finally {
      setIsLoadingHuntr(false);
    }
  }

  function handleTailorConfirm(jobIds: string[]) {
    dispatch({ type: 'SET_TAILOR_QUEUE', queue: jobIds });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Action buttons row */}
      <div className="flex items-center gap-1.5 px-2 py-2 border-b border-border shrink-0 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadHuntr}
          disabled={isLoadingHuntr}
          className="text-[11px] h-7 px-2"
        >
          {isLoadingHuntr ? 'Loading…' : 'Load Huntr'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPasteModalOpen(true)}
          className="text-[11px] h-7 px-2"
        >
          Paste JD
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTailorModalOpen(true)}
          className="text-[11px] h-7 px-2"
        >
          Tailor Selected
        </Button>
      </div>

      {/* Stage filter pills */}
      <StageFilter />

      {/* Job list — flex-1 so it fills remaining space */}
      <div className="flex-1 min-h-0 flex flex-col">
        <JobList />
      </div>

      {/* Job detail — shrinks to fit its content */}
      <JobDetail />

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
