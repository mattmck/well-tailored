import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspace } from '../../context';

interface PasteJDModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PasteJDModal({ open, onOpenChange }: PasteJDModalProps) {
  const { state, dispatch } = useWorkspace();
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [jd, setJd] = useState('');

  function handleSubmit() {
    if (!company.trim() || !title.trim() || !jd.trim()) return;

    const newJob = {
      id: `manual-${Date.now()}`,
      company: company.trim(),
      title: title.trim(),
      jd: jd.trim(),
      stage: 'manual',
      source: 'manual' as const,
      dbJobId: null,
      huntrId: null,
      boardId: null,
      status: 'loaded' as const,
      checked: false,
      scoresStale: false,
      result: null,
      error: null,
      _editorData: null,
    };

    dispatch({ type: 'SET_JOBS', jobs: [...state.jobs, newJob] });
    setCompany('');
    setTitle('');
    setJd('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Job Description</DialogTitle>
          <DialogDescription>
            Paste a job description to tailor your resume manually.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paste-company" className="text-xs">Company</Label>
              <Input
                id="paste-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paste-title" className="text-xs">Job Title</Label>
              <Input
                id="paste-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Senior Engineer"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paste-jd" className="text-xs">Job Description</Label>
            <Textarea
              id="paste-jd"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description here…"
              className="min-h-[200px] text-sm font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!company.trim() || !title.trim() || !jd.trim()}
            onClick={handleSubmit}
          >
            Add Job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
