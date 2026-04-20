import { randomUUID } from 'crypto';
import type { DatabaseAdapter } from '../db/adapter.js';

// ── Row types ─────────────────────────────────────────────────────────────

export interface ResumeHeaderRow {
  jobId: string;
  name: string | null;
  role: string | null;
  contact: string | null;
  links: string | null;
  updatedAt: string;
}

export type SectionType = 'text' | 'bullets' | 'jobs';

export interface ResumeSectionRow {
  id: string;
  jobId: string;
  heading: string;
  type: SectionType;
  content: string | null;
  accepted: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeJobEntryRow {
  id: string;
  sectionId: string;
  title: string | null;
  company: string | null;
  location: string | null;
  date: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface ResumeBulletRow {
  id: string;
  sectionId: string | null;
  jobEntryId: string | null;
  text: string;
  sortOrder: number;
  createdAt: string;
}

// ── EditorData shape mirrored here to avoid importing from web/ ───────────

export interface EditorHeaderFields {
  name: string;
  role: string;
  contact: string;
  links: string;
}

export interface EditorBulletItem {
  id: string;
  text: string;
}

export interface EditorJobEntry {
  id: string;
  title: string;
  company: string;
  location: string;
  date: string;
  bullets: EditorBulletItem[];
  detailsMode?: 'bullets' | 'text';
  detailsText?: string;
}

export interface EditorSection {
  id: string;
  heading: string;
  type: SectionType;
  content: string;
  items: EditorBulletItem[];
  jobs: EditorJobEntry[];
  accepted: boolean;
  sortOrder?: 'relevance' | 'chronological';
}

export interface EditorData {
  kind: 'resume' | 'generic';
  header?: EditorHeaderFields;
  sections: EditorSection[];
}

// ── Row mappers ───────────────────────────────────────────────────────────

function toHeaderRow(raw: Record<string, unknown>): ResumeHeaderRow {
  return {
    jobId: raw.job_id as string,
    name: (raw.name as string) ?? null,
    role: (raw.role as string) ?? null,
    contact: (raw.contact as string) ?? null,
    links: (raw.links as string) ?? null,
    updatedAt: raw.updated_at as string,
  };
}

function toSectionRow(raw: Record<string, unknown>): ResumeSectionRow {
  return {
    id: raw.id as string,
    jobId: raw.job_id as string,
    heading: raw.heading as string,
    type: raw.type as SectionType,
    content: (raw.content as string) ?? null,
    accepted: raw.accepted === 1 || raw.accepted === true,
    sortOrder: raw.sort_order as number,
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

function toJobEntryRow(raw: Record<string, unknown>): ResumeJobEntryRow {
  return {
    id: raw.id as string,
    sectionId: raw.section_id as string,
    title: (raw.title as string) ?? null,
    company: (raw.company as string) ?? null,
    location: (raw.location as string) ?? null,
    date: (raw.date as string) ?? null,
    sortOrder: raw.sort_order as number,
    createdAt: raw.created_at as string,
  };
}

function toBulletRow(raw: Record<string, unknown>): ResumeBulletRow {
  return {
    id: raw.id as string,
    sectionId: (raw.section_id as string) ?? null,
    jobEntryId: (raw.job_entry_id as string) ?? null,
    text: raw.text as string,
    sortOrder: raw.sort_order as number,
    createdAt: raw.created_at as string,
  };
}

// ── Repository ────────────────────────────────────────────────────────────

export class ResumeRepo {
  constructor(private db: DatabaseAdapter) {}

  // ── Header ──────────────────────────────────────────────────────────────

  upsertHeader(jobId: string, fields: Partial<EditorHeaderFields>): void {
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO resume_headers (job_id, name, role, contact, links, updated_at)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(job_id) DO UPDATE SET
         name = excluded.name,
         role = excluded.role,
         contact = excluded.contact,
         links = excluded.links,
         updated_at = excluded.updated_at`,
      [
        jobId,
        fields.name ?? null,
        fields.role ?? null,
        fields.contact ?? null,
        fields.links ?? null,
        now,
      ],
    );
  }

  getHeader(jobId: string): ResumeHeaderRow | undefined {
    const raw = this.db.get<Record<string, unknown>>(
      'SELECT * FROM resume_headers WHERE job_id = ?',
      [jobId],
    );
    return raw ? toHeaderRow(raw) : undefined;
  }

  // ── Sections ─────────────────────────────────────────────────────────────

  upsertSection(section: EditorSection & { jobId: string }, position = 0): ResumeSectionRow {
    const now = new Date().toISOString();
    const textContent = section.type === 'text' ? (section.content ?? null) : null;
    this.db.run(
      `INSERT INTO resume_sections
         (id, job_id, heading, type, content, accepted, sort_order, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         heading = excluded.heading,
         type = excluded.type,
         content = excluded.content,
         accepted = excluded.accepted,
         sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`,
      [
        section.id,
        section.jobId,
        section.heading,
        section.type,
        textContent,
        section.accepted ? 1 : 0,
        position,
        now,
        now,
      ],
    );
    return toSectionRow(
      this.db.get<Record<string, unknown>>('SELECT * FROM resume_sections WHERE id = ?', [section.id])!,
    );
  }

  listSections(jobId: string): ResumeSectionRow[] {
    return this.db
      .all<Record<string, unknown>>(
        'SELECT * FROM resume_sections WHERE job_id = ? ORDER BY sort_order',
        [jobId],
      )
      .map(toSectionRow);
  }

  deleteSection(sectionId: string): void {
    this.db.run('DELETE FROM resume_sections WHERE id = ?', [sectionId]);
  }

  deleteSectionsForJob(jobId: string): void {
    this.db.run('DELETE FROM resume_sections WHERE job_id = ?', [jobId]);
  }

  // ── Job entries ──────────────────────────────────────────────────────────

  upsertJobEntry(sectionId: string, entry: EditorJobEntry, sortOrder = 0): ResumeJobEntryRow {
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO resume_job_entries (id, section_id, title, company, location, date, sort_order, created_at)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         company = excluded.company,
         location = excluded.location,
         date = excluded.date,
         sort_order = excluded.sort_order`,
      [entry.id, sectionId, entry.title, entry.company, entry.location, entry.date, sortOrder, now],
    );
    return toJobEntryRow(
      this.db.get<Record<string, unknown>>('SELECT * FROM resume_job_entries WHERE id = ?', [entry.id])!,
    );
  }

  listJobEntries(sectionId: string): ResumeJobEntryRow[] {
    return this.db
      .all<Record<string, unknown>>(
        'SELECT * FROM resume_job_entries WHERE section_id = ? ORDER BY sort_order',
        [sectionId],
      )
      .map(toJobEntryRow);
  }

  deleteJobEntriesForSection(sectionId: string): void {
    this.db.run('DELETE FROM resume_job_entries WHERE section_id = ?', [sectionId]);
  }

  // ── Bullets ──────────────────────────────────────────────────────────────

  upsertBullet(bullet: EditorBulletItem, opts: { sectionId?: string; jobEntryId?: string }, order: number): ResumeBulletRow {
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO resume_bullets (id, section_id, job_entry_id, text, sort_order, created_at)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         text = excluded.text,
         sort_order = excluded.sort_order`,
      [bullet.id, opts.sectionId ?? null, opts.jobEntryId ?? null, bullet.text, order, now],
    );
    return { id: bullet.id, sectionId: opts.sectionId ?? null, jobEntryId: opts.jobEntryId ?? null, text: bullet.text, sortOrder: order, createdAt: now };
  }

  listBulletsForSection(sectionId: string): ResumeBulletRow[] {
    return this.db
      .all<Record<string, unknown>>(
        'SELECT * FROM resume_bullets WHERE section_id = ? ORDER BY sort_order',
        [sectionId],
      )
      .map(toBulletRow);
  }

  listBulletsForJobEntry(jobEntryId: string): ResumeBulletRow[] {
    return this.db
      .all<Record<string, unknown>>(
        'SELECT * FROM resume_bullets WHERE job_entry_id = ? ORDER BY sort_order',
        [jobEntryId],
      )
      .map(toBulletRow);
  }

  deleteBulletsForSection(sectionId: string): void {
    this.db.run('DELETE FROM resume_bullets WHERE section_id = ?', [sectionId]);
  }

  deleteBulletsForJobEntry(jobEntryId: string): void {
    this.db.run('DELETE FROM resume_bullets WHERE job_entry_id = ?', [jobEntryId]);
  }

  // ── Full EditorData write (atomic replace) ──────────────────────────────

  /**
   * Atomically replace all normalized resume data for a job with
   * the contents of the given EditorData. Runs inside a transaction.
   */
  saveEditorData(jobId: string, data: EditorData): void {
    this.db.transaction(() => {
      if (data.header) {
        this.upsertHeader(jobId, data.header);
      }

      // Remove sections no longer present
      const newSectionIds = new Set(data.sections.map(s => s.id));
      for (const old of this.listSections(jobId)) {
        if (!newSectionIds.has(old.id)) {
          this.db.run('DELETE FROM resume_sections WHERE id = ?', [old.id]);
        }
      }

      for (let si = 0; si < data.sections.length; si++) {
        const section = data.sections[si];
        this.upsertSection({ ...section, jobId }, si);

        if (section.type === 'bullets') {
          this.db.run('DELETE FROM resume_bullets WHERE section_id = ?', [section.id]);
          for (let bi = 0; bi < section.items.length; bi++) {
            this.upsertBullet(section.items[bi], { sectionId: section.id }, bi);
          }
        } else if (section.type === 'jobs') {
          // Remove job entries no longer present
          const newEntryIds = new Set(section.jobs.map(j => j.id));
          for (const old of this.listJobEntries(section.id)) {
            if (!newEntryIds.has(old.id)) {
              this.db.run('DELETE FROM resume_job_entries WHERE id = ?', [old.id]);
            }
          }
          for (let ji = 0; ji < section.jobs.length; ji++) {
            const job = section.jobs[ji];
            this.upsertJobEntry(section.id, job, ji);
            this.db.run('DELETE FROM resume_bullets WHERE job_entry_id = ?', [job.id]);
            for (let bi = 0; bi < job.bullets.length; bi++) {
              this.upsertBullet(job.bullets[bi], { jobEntryId: job.id }, bi);
            }
          }
        }
      }
    });
  }

  /**
   * Reassemble the full EditorData for a job from normalized tables.
   */
  loadEditorData(jobId: string): EditorData | null {
    const sections = this.listSections(jobId);
    if (sections.length === 0) {
      const header = this.getHeader(jobId);
      if (!header) return null;
    }

    const header = this.getHeader(jobId);
    const editorSections: EditorSection[] = [];

    for (const section of sections) {
      let items: { id: string; text: string }[] = [];
      let jobs: EditorJobEntry[] = [];

      if (section.type === 'bullets') {
        items = this.listBulletsForSection(section.id).map(b => ({ id: b.id, text: b.text }));
      } else if (section.type === 'jobs') {
        const entries = this.listJobEntries(section.id);
        jobs = entries.map(entry => {
          const bullets = this.listBulletsForJobEntry(entry.id).map(b => ({ id: b.id, text: b.text }));
          return {
            id: entry.id,
            title: entry.title ?? '',
            company: entry.company ?? '',
            location: entry.location ?? '',
            date: entry.date ?? '',
            bullets,
          };
        });
      }

      editorSections.push({
        id: section.id,
        heading: section.heading,
        type: section.type,
        content: section.content ?? '',
        items,
        jobs,
        accepted: section.accepted,
      });
    }

    return {
      kind: 'resume',
      header: header
        ? {
            name: header.name ?? '',
            role: header.role ?? '',
            contact: header.contact ?? '',
            links: header.links ?? '',
          }
        : undefined,
      sections: editorSections,
    };
  }
}

