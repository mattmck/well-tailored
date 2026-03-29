import { useRef, useEffect } from 'react';
import { genId } from '../../lib/markdown';
import type { EditorSection as SectionData, BulletItem, JobEntry, SectionType } from '../../types';

interface EditorSectionProps {
  section: SectionData;
  accepted: boolean;
  regenerating: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: (updated: SectionData) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onAccept: () => void;
  onRegenerate: () => void;
}

// ---------------------------------------------------------------------------
// Auto-resizing textarea
// ---------------------------------------------------------------------------
function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(60, el.scrollHeight)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full resize-none rounded-md border border-border bg-card text-sm leading-relaxed px-2 py-1.5 outline-none focus:border-ring transition-colors text-foreground placeholder:text-muted-foreground"
      style={{ minHeight: '60px' }}
      spellCheck={false}
    />
  );
}

// ---------------------------------------------------------------------------
// Small icon buttons shared across the section editor
// ---------------------------------------------------------------------------
function IconBtn({
  title,
  onClick,
  disabled,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-1 rounded transition-colors disabled:opacity-25 disabled:cursor-not-allowed ${
        danger
          ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:bg-secondary/60'
      }`}
    >
      {children}
    </button>
  );
}

const ChevronUp = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);
const ChevronDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const SpinnerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);
const CheckIcon = ({ active }: { active: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={active ? 'text-emerald-600' : ''}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ---------------------------------------------------------------------------
// Bullet list editor (shared between flat sections and job entries)
// ---------------------------------------------------------------------------
function BulletList({
  items,
  onChange,
}: {
  items: BulletItem[];
  onChange: (items: BulletItem[]) => void;
}) {
  function update(id: string, text: string) {
    onChange(items.map(b => b.id === id ? { ...b, text } : b));
  }
  function move(id: string, dir: -1 | 1) {
    const idx = items.findIndex(b => b.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const arr = [...items];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    onChange(arr);
  }
  function remove(id: string) {
    onChange(items.filter(b => b.id !== id));
  }
  function add() {
    onChange([...items, { id: genId(), text: '' }]);
  }

  return (
    <div className="space-y-1">
      {items.map((b, idx) => (
        <div key={b.id} className="flex items-center gap-1">
          <span className="text-muted-foreground text-xs shrink-0 w-3">–</span>
          <input
            type="text"
            value={b.text}
            onChange={e => update(b.id, e.target.value)}
            className="flex-1 rounded border border-border bg-card px-2 py-1 text-sm outline-none focus:border-ring transition-colors"
            placeholder="Bullet text…"
          />
          <IconBtn title="Move up" onClick={() => move(b.id, -1)} disabled={idx === 0}><ChevronUp /></IconBtn>
          <IconBtn title="Move down" onClick={() => move(b.id, 1)} disabled={idx === items.length - 1}><ChevronDown /></IconBtn>
          <IconBtn title="Remove bullet" onClick={() => remove(b.id)} danger><XIcon /></IconBtn>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
      >
        <PlusIcon /> bullet
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single job entry editor
// ---------------------------------------------------------------------------
function JobEntryEditor({
  job,
  index,
  total,
  onUpdate,
  onMove,
  onRemove,
}: {
  job: JobEntry;
  index: number;
  total: number;
  onUpdate: (updated: JobEntry) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  function field(f: 'title' | 'company' | 'location' | 'date') {
    return (
      <input
        type="text"
        value={job[f] ?? ''}
        onChange={e => onUpdate({ ...job, [f]: e.target.value })}
        className="flex-1 rounded border border-border bg-card px-2 py-1 text-sm outline-none focus:border-ring transition-colors min-w-0"
      />
    );
  }

  return (
    <div className="rounded-md border border-border bg-background/50 p-2.5 space-y-2">
      {/* Job entry header */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex-1">
          Job {index + 1}
        </span>
        <IconBtn title="Move job up" onClick={() => onMove(-1)} disabled={index === 0}><ChevronUp /></IconBtn>
        <IconBtn title="Move job down" onClick={() => onMove(1)} disabled={index === total - 1}><ChevronDown /></IconBtn>
        <IconBtn title="Remove job" onClick={onRemove} danger><XIcon /></IconBtn>
      </div>

      {/* Fields */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-medium text-muted-foreground w-16 shrink-0">Title</label>
          {field('title')}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-medium text-muted-foreground w-16 shrink-0">Company</label>
          {field('company')}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-medium text-muted-foreground w-16 shrink-0">Location</label>
          {field('location')}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-medium text-muted-foreground w-16 shrink-0">Dates</label>
          {field('date')}
        </div>
      </div>

      {/* Bullets */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Bullets</p>
        <BulletList
          items={job.bullets}
          onChange={bullets => onUpdate({ ...job, bullets })}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main EditorSection component
// ---------------------------------------------------------------------------
export function EditorSection({
  section,
  accepted,
  regenerating,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onRemove,
  onAccept,
  onRegenerate,
}: EditorSectionProps) {
  function handleTypeChange(newType: SectionType) {
    if (newType === section.type) return;
    const updates: Partial<SectionData> = { type: newType };
    if (newType === 'bullets' && section.items.length === 0) {
      updates.items = [{ id: genId(), text: '' }];
    }
    if (newType === 'jobs' && section.jobs.length === 0) {
      updates.jobs = [{
        id: genId(), title: '', company: '', location: '', date: '',
        bullets: [{ id: genId(), text: '' }],
      }];
    }
    onUpdate({ ...section, ...updates });
  }

  function updateJob(jobId: string, updated: JobEntry) {
    onUpdate({ ...section, jobs: section.jobs.map(j => j.id === jobId ? updated : j) });
  }
  function moveJob(jobId: string, dir: -1 | 1) {
    const idx = section.jobs.findIndex(j => j.id === jobId);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= section.jobs.length) return;
    const jobs = [...section.jobs];
    [jobs[idx], jobs[next]] = [jobs[next], jobs[idx]];
    onUpdate({ ...section, jobs });
  }
  function removeJob(jobId: string) {
    onUpdate({ ...section, jobs: section.jobs.filter(j => j.id !== jobId) });
  }
  function addJob() {
    const newJob: JobEntry = {
      id: genId(), title: '', company: '', location: '', date: '',
      bullets: [{ id: genId(), text: '' }],
    };
    onUpdate({ ...section, jobs: [...section.jobs, newJob] });
  }

  return (
    <div className="border-b border-border py-3 px-3 space-y-2.5">
      {/* Section header row */}
      <div className="flex items-center gap-1.5">
        {/* Editable section title */}
        <input
          type="text"
          value={section.heading}
          onChange={e => onUpdate({ ...section, heading: e.target.value })}
          className="flex-1 min-w-0 text-sm font-semibold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground focus:bg-secondary/30 rounded px-1 -ml-1 transition-colors"
          placeholder="Section title…"
        />

        {/* Type selector */}
        <select
          value={section.type}
          onChange={e => handleTypeChange(e.target.value as SectionType)}
          className="text-[10px] bg-card border border-border rounded px-1.5 py-0.5 text-muted-foreground cursor-pointer outline-none focus:border-ring transition-colors"
        >
          <option value="text">Text</option>
          <option value="bullets">Bullets</option>
          <option value="jobs">Jobs</option>
        </select>

        {/* Move up/down */}
        <IconBtn title="Move section up" onClick={onMoveUp} disabled={!canMoveUp}><ChevronUp /></IconBtn>
        <IconBtn title="Move section down" onClick={onMoveDown} disabled={!canMoveDown}><ChevronDown /></IconBtn>

        {/* Accept */}
        <IconBtn title={accepted ? 'Accepted' : 'Mark as accepted'} onClick={onAccept}>
          <CheckIcon active={accepted} />
        </IconBtn>

        {/* Regenerate */}
        <IconBtn title="Regenerate section" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? <SpinnerIcon /> : <RefreshIcon />}
        </IconBtn>

        {/* Remove section */}
        <IconBtn title="Remove section" onClick={onRemove} danger><XIcon /></IconBtn>
      </div>

      {/* Type-specific content */}
      {section.type === 'text' && (
        <AutoTextarea
          value={section.content}
          onChange={content => onUpdate({ ...section, content })}
          placeholder="Section content…"
        />
      )}

      {section.type === 'bullets' && (
        <BulletList
          items={section.items}
          onChange={items => onUpdate({ ...section, items })}
        />
      )}

      {section.type === 'jobs' && (
        <div className="space-y-2">
          {section.jobs.map((job, idx) => (
            <JobEntryEditor
              key={job.id}
              job={job}
              index={idx}
              total={section.jobs.length}
              onUpdate={updated => updateJob(job.id, updated)}
              onMove={dir => moveJob(job.id, dir)}
              onRemove={() => removeJob(job.id)}
            />
          ))}
          <button
            type="button"
            onClick={addJob}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <PlusIcon /> Add job
          </button>
        </div>
      )}
    </div>
  );
}
