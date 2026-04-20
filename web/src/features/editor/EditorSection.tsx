import { useEffect, useRef } from 'react';
import { cn } from '@/components/ui/utils';
import { genId } from '../../lib/markdown';
import { sectionSync } from '../../lib/section-sync';
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

function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.max(84, element.scrollHeight)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="paper-pane w-full resize-none rounded-[1.1rem] px-3 py-3 text-sm leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
      style={{ minHeight: '84px' }}
      spellCheck={false}
    />
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  danger,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'control-chip inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-25',
        active && 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
        danger
          ? 'hover:bg-destructive/10 hover:text-destructive'
          : 'hover:bg-white hover:text-foreground',
      )}
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
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
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
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={active ? 'text-emerald-700' : ''}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function BulletList({
  items,
  onChange,
}: {
  items: BulletItem[];
  onChange: (items: BulletItem[]) => void;
}) {
  function update(id: string, text: string) {
    onChange(items.map((item) => (item.id === id ? { ...item, text } : item)));
  }

  function move(id: string, dir: -1 | 1) {
    const idx = items.findIndex((item) => item.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const nextItems = [...items];
    [nextItems[idx], nextItems[next]] = [nextItems[next], nextItems[idx]];
    onChange(nextItems);
  }

  function remove(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function add() {
    onChange([...items, { id: genId(), text: '' }]);
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-start gap-2">
          <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/55" />
          <input
            type="text"
            value={item.text}
            onChange={(event) => update(item.id, event.target.value)}
            className="paper-pane flex-1 rounded-[1rem] px-3 py-2 text-sm outline-none transition-colors focus:border-ring min-w-0"
            placeholder="Bullet text…"
          />
          <div className="flex gap-1 pt-1">
            <IconBtn title="Move up" onClick={() => move(item.id, -1)} disabled={idx === 0}><ChevronUp /></IconBtn>
            <IconBtn title="Move down" onClick={() => move(item.id, 1)} disabled={idx === items.length - 1}><ChevronDown /></IconBtn>
            <IconBtn title="Remove bullet" onClick={() => remove(item.id)} danger><XIcon /></IconBtn>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <PlusIcon /> Add bullet
      </button>
    </div>
  );
}

function extractLatestYear(date: string): number {
  if (/present/i.test(date)) return 9999;
  const matches = date.match(/\b(20\d{2}|19\d{2})\b/g);
  if (!matches) return 0;
  return Math.max(...matches.map(Number));
}

function JobEntryEditor({
  job,
  index,
  total,
  onUpdate,
  onMove,
  onRemove,
  moveDisabled,
}: {
  job: JobEntry;
  index: number;
  total: number;
  onUpdate: (updated: JobEntry) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  moveDisabled?: boolean;
}) {
  const detailsMode = job.detailsMode ?? 'bullets';

  function field(fieldName: 'title' | 'company' | 'location' | 'date') {
    return (
      <input
        type="text"
        value={job[fieldName] ?? ''}
        onChange={(event) => onUpdate({ ...job, [fieldName]: event.target.value })}
        className="paper-pane flex-1 rounded-[0.95rem] px-3 py-2 text-sm outline-none transition-colors focus:border-ring min-w-0"
      />
    );
  }

  function handleSetDetailsMode(next: 'bullets' | 'text') {
    if (next === detailsMode) return;
    if (next === 'text') {
      // Convert bullets → text
      const text = job.bullets.map((b) => b.text).filter(Boolean).join('\n');
      onUpdate({ ...job, detailsMode: 'text', detailsText: text });
    } else {
      // Convert text → bullets
      const lines = (job.detailsText ?? '').split('\n').filter((l) => l.trim());
      const bullets = lines.length > 0
        ? lines.map((text) => ({ id: genId(), text: text.trim() }))
        : [{ id: genId(), text: '' }];
      onUpdate({ ...job, detailsMode: 'bullets', bullets });
    }
  }

  function handleTextChange(value: string) {
    onUpdate({ ...job, detailsText: value });
  }

  function handleBulletsChange(bullets: BulletItem[]) {
    onUpdate({ ...job, bullets });
  }

  return (
    <div className="paper-pane rounded-[1.2rem] p-3.5">
      <div className="flex items-center gap-2">
        <span className="editorial-label flex-1">Job {index + 1}</span>
        <IconBtn title="Move job up" onClick={() => onMove(-1)} disabled={moveDisabled || index === 0}><ChevronUp /></IconBtn>
        <IconBtn title="Move job down" onClick={() => onMove(1)} disabled={moveDisabled || index === total - 1}><ChevronDown /></IconBtn>
        <IconBtn title="Remove job" onClick={onRemove} danger><XIcon /></IconBtn>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <label className="w-16 shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Title</label>
          {field('title')}
        </div>
        <div className="flex items-center gap-2">
          <label className="w-16 shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Company</label>
          {field('company')}
        </div>
        <div className="flex items-center gap-2">
          <label className="w-16 shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Location</label>
          {field('location')}
        </div>
        <div className="flex items-center gap-2">
          <label className="w-16 shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Dates</label>
          {field('date')}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-2 flex items-center gap-2">
          <p className="editorial-label flex-1">Details</p>
          <div className="toolbar-segment flex rounded-full p-0.5">
            <button
              type="button"
              onClick={() => handleSetDetailsMode('bullets')}
              disabled={detailsMode === 'bullets'}
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-medium transition-all',
                detailsMode === 'bullets'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-white hover:text-foreground'
              )}
            >
              Bullets
            </button>
            <button
              type="button"
              onClick={() => handleSetDetailsMode('text')}
              disabled={detailsMode === 'text'}
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-medium transition-all',
                detailsMode === 'text'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-white hover:text-foreground'
              )}
            >
              Text
            </button>
          </div>
        </div>

        {detailsMode === 'text' ? (
          <AutoTextarea
            value={job.detailsText ?? ''}
            onChange={handleTextChange}
            placeholder="Job details as free text…"
          />
        ) : (
          <BulletList items={job.bullets} onChange={handleBulletsChange} />
        )}
      </div>
    </div>
  );
}

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
  const sortOrder = section.sortOrder ?? 'relevance';

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
    onUpdate({ ...section, jobs: section.jobs.map((job) => (job.id === jobId ? updated : job)) });
  }

  function moveJob(jobId: string, dir: -1 | 1) {
    const idx = section.jobs.findIndex((job) => job.id === jobId);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= section.jobs.length) return;
    const jobs = [...section.jobs];
    [jobs[idx], jobs[next]] = [jobs[next], jobs[idx]];
    onUpdate({ ...section, jobs });
  }

  function removeJob(jobId: string) {
    onUpdate({ ...section, jobs: section.jobs.filter((job) => job.id !== jobId) });
  }

  function addJob() {
    const newJob: JobEntry = {
      id: genId(), title: '', company: '', location: '', date: '',
      bullets: [{ id: genId(), text: '' }],
    };
    onUpdate({ ...section, jobs: [...section.jobs, newJob] });
  }

  function toggleSortOrder() {
    onUpdate({ ...section, sortOrder: sortOrder === 'relevance' ? 'chronological' : 'relevance' });
  }

  const displayJobs = sortOrder === 'chronological'
    ? [...section.jobs].sort((a, b) => extractLatestYear(b.date) - extractLatestYear(a.date))
    : section.jobs;

  return (
    <section
      data-section-heading={section.heading}
      className="paper-pane rounded-[1.35rem] px-4 py-4"
      onClick={() => sectionSync.emit(section.heading, 'editor')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={section.heading}
          onChange={(event) => onUpdate({ ...section, heading: event.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="min-w-[12rem] flex-1 rounded-[0.9rem] border-none bg-transparent px-1 text-base font-semibold text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:bg-white/45"
          placeholder="Section title…"
        />

        <select
          value={section.type}
          onChange={(event) => handleTypeChange(event.target.value as SectionType)}
          onClick={(e) => e.stopPropagation()}
          className="control-chip rounded-full px-3 py-1 text-[11px] font-medium text-muted-foreground outline-none transition-colors focus:border-ring"
        >
          <option value="text">Text</option>
          <option value="bullets">Bullets</option>
          <option value="jobs">Jobs</option>
        </select>

        {section.type === 'jobs' && (
          <button
            type="button"
            title={sortOrder === 'relevance' ? 'Sort chronologically' : 'Sort by relevance'}
            onClick={(e) => { e.stopPropagation(); toggleSortOrder(); }}
            className={cn(
              'control-chip inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
              sortOrder === 'chronological'
                ? 'border-primary/20 bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-white hover:text-foreground'
            )}
          >
            {sortOrder === 'chronological' ? 'Chrono' : 'Relevance'}
          </button>
        )}

        <IconBtn title="Move section up" onClick={onMoveUp} disabled={!canMoveUp}><ChevronUp /></IconBtn>
        <IconBtn title="Move section down" onClick={onMoveDown} disabled={!canMoveDown}><ChevronDown /></IconBtn>
        <IconBtn title={accepted ? 'Accepted' : 'Mark as accepted'} onClick={onAccept} active={accepted}>
          <CheckIcon active={accepted} />
        </IconBtn>
        <IconBtn title="Regenerate section" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? <SpinnerIcon /> : <RefreshIcon />}
        </IconBtn>
        <IconBtn title="Remove section" onClick={onRemove} danger><XIcon /></IconBtn>
      </div>

      <div className="mt-3">
        {section.type === 'text' && (
          <AutoTextarea
            value={section.content}
            onChange={(content) => onUpdate({ ...section, content })}
            placeholder="Section content…"
          />
        )}

        {section.type === 'bullets' && (
          <BulletList items={section.items} onChange={(items) => onUpdate({ ...section, items })} />
        )}

        {section.type === 'jobs' && (
          <div className="space-y-3">
            {displayJobs.map((job, idx) => (
              <JobEntryEditor
                key={job.id}
                job={job}
                index={idx}
                total={displayJobs.length}
                onUpdate={(updated) => updateJob(job.id, updated)}
                onMove={(dir) => moveJob(job.id, dir)}
                onRemove={() => removeJob(job.id)}
                moveDisabled={sortOrder === 'chronological'}
              />
            ))}

            <button
              type="button"
              onClick={addJob}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <PlusIcon /> Add job
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
