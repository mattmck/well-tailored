import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '../../context';

interface TailorConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (jobIds: string[]) => void;
}

export function TailorConfirmModal({ open, onOpenChange, onConfirm }: TailorConfirmModalProps) {
  const { state } = useWorkspace();

  const checkedJobs = state.jobs.filter((j) => j.checked);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tailor Selected Jobs</DialogTitle>
          <DialogDescription>
            {checkedJobs.length === 0
              ? 'No jobs selected. Check jobs in the list first.'
              : `The following ${checkedJobs.length} job${checkedJobs.length > 1 ? 's' : ''} will be tailored:`}
          </DialogDescription>
        </DialogHeader>

        {checkedJobs.length > 0 && (
          <ul className="max-h-48 overflow-y-auto space-y-1 text-sm">
            {checkedJobs.map((job) => (
              <li key={job.id} className="flex items-center gap-2 px-2 py-1 rounded bg-secondary/40">
                <span className="font-medium text-foreground">{job.company}</span>
                <span className="text-muted-foreground">—</span>
                <span className="text-muted-foreground truncate">{job.title}</span>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={checkedJobs.length === 0}
            onClick={() => {
              onConfirm(checkedJobs.map((j) => j.id));
              onOpenChange(false);
            }}
          >
            Tailor {checkedJobs.length} Job{checkedJobs.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
